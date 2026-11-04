// Recurring property taxes and one-off purchase taxes for the European cities (local currency).

import type { Confidence, HomeType, Level } from '../types';
import { progressive } from '../brackets';
import { fmt } from './common';
import { AREAS } from './params2026';

export interface PropertyLine { id: string; label: string; level: Level; amount: number; confidence: Confidence; note: string }

const UK_BANDS: [number, number][] = [[40000, 6 / 9], [52000, 7 / 9], [68000, 8 / 9], [88000, 1], [120000, 11 / 9], [160000, 13 / 9], [320000, 15 / 9], [Infinity, 18 / 9]];
const LONDON_BAND_D = 2068; // average area Band D 2026-27 (MHCLG)
const LONDON_PRICE_SINCE_1991 = 7.3; // ratio of today's London prices to April 1991 (ONS/Land Registry, rounded)
const LPT_BANDS: [number, number][] = [[240000, 95], [315000, 235], [420000, 333], [525000, 428], [630000, 523], [735000, 618], [840000, 713], [945000, 808],
  [1050000, 903], [1155000, 998], [1260000, 1094], [1365000, 1272], [1470000, 1535], [1575000, 1797], [1680000, 2060], [1785000, 2322], [1890000, 2585],
  [1995000, 2847], [2100000, 3110]];

/** Yearly property taxes on a home worth `value`. `owner` = false gives what a landlord pays (passed on in rent). */
export function recurringPropertyTax(cityId: string, value: number, homeType: HomeType, owner: boolean, partner: boolean): PropertyLine[] {
  const a = AREAS[homeType];
  switch (cityId) {
    case 'munich': {
      const measure = a.land * 0.04 + a.living * 0.5 * 0.7;
      return [{ id: 'de-grundsteuer', label: 'Property tax (Grundsteuer)', level: 'local', amount: measure * 8.24, confidence: 'medium',
        note: `Bavarian area model: land ${a.land} m² × EUR 0.04 + living space ${a.living} m² × EUR 0.50 × 70% (homes), × Munich's 824% multiplier. Not value-based; landlords pass it on in service charges.` }];
    }
    case 'london': {
      const v1991 = value / LONDON_PRICE_SINCE_1991;
      const ratio = UK_BANDS.find(([upTo]) => v1991 <= upTo)![1];
      const band = 'ABCDEFGH'[UK_BANDS.findIndex(([upTo]) => v1991 <= upTo)];
      const discount = partner ? 1 : 0.75;
      return [{ id: 'uk-council-tax', label: 'Council tax', level: 'local', amount: LONDON_BAND_D * ratio * discount, confidence: 'medium',
        note: `Band ${band} (estimated 1991 value ${fmt(v1991)}), London average Band D GBP ${fmt(LONDON_BAND_D)} for 2026-27 (boroughs range widely)${partner ? '' : ', 25% single-person discount'}. Tenants pay it directly.` }];
    }
    case 'luxembourg':
      return [{ id: 'lu-foncier', label: 'Property tax (impôt foncier)', level: 'local', amount: { apartment: 150, townhouse: 250, detached: 400 }[homeType], confidence: 'low',
        note: 'Based on 1941 unit values, so tiny; a reform to a value-based tax is planned. Typical Luxembourg City amounts.' }];
    case 'dublin': {
      const band = LPT_BANDS.find(([upTo]) => value <= upTo);
      const amount = band ? band[1] : value <= 0 ? 0 : 1260000 * 0.000906 + (Math.min(value, 2100000) - 1260000) * 0.0025 + Math.max(0, value - 2100000) * 0.003;
      return [{ id: 'ie-lpt', label: 'Local property tax', level: 'local', amount, confidence: 'high',
        note: '2026-2030 valuation bands; Dublin City Council applies no local adjustment.' }];
    }
    case 'oslo':
      return [{ id: 'no-eiendomsskatt', label: 'Oslo property tax (eiendomsskatt)', level: 'local', amount: Math.max(0, value * 0.7 - 4900000) * 0.00235, confidence: 'low',
        note: '0.235% of 70% of market value above a NOK 4.9 million deduction (Oslo rates, to be confirmed for 2026).' }];
    case 'copenhagen': {
      const landShare = { apartment: 0.15, townhouse: 0.3, detached: 0.4 }[homeType];
      const out: PropertyLine[] = [{ id: 'dk-grundskyld', label: 'Land tax (grundskyld)', level: 'local', amount: value * landShare * 0.8 * 0.0051, confidence: 'medium',
        note: `5.1‰ in Copenhagen on 80% of the land value (land assumed ${Math.round(landShare * 100)}% of the home's value).` }];
      if (owner) {
        const base = value * 0.8;
        out.push({ id: 'dk-ejendomsvaerdiskat', label: 'Property value tax (ejendomsværdiskat)', level: 'federal', amount: progressive(base, [{ upTo: 9007000, rate: 0.0051 }, { upTo: null, rate: 0.014 }]), confidence: 'medium',
          note: '0.51% of 80% of the assessed value, 1.4% above DKK 9 million. Owner-occupiers only; assessed value taken as market value.' });
      }
      return out;
    }
    default:
      return []; // Zurich: no property tax on homes; imputed rent is taxed as income instead
  }
}

export interface TransferLine { label: string; level: Level; amount: number; note: string }

export function purchaseTaxes(cityId: string, value: number, mortgage: number, firstTime: boolean, foreign: boolean, buyers: number): TransferLine[] {
  switch (cityId) {
    case 'munich':
      return [{ label: 'Real estate transfer tax (Grunderwerbsteuer)', level: 'provincial', amount: value * 0.035, note: '3.5% in Bavaria (the lowest rate in Germany)' }];
    case 'london': {
      const ftb = firstTime && value <= 500000;
      const sdlt = ftb ? Math.max(0, Math.min(value, 500000) - 300000) * 0.05
        : progressive(value, [{ upTo: 125000, rate: 0 }, { upTo: 250000, rate: 0.02 }, { upTo: 925000, rate: 0.05 }, { upTo: 1500000, rate: 0.1 }, { upTo: null, rate: 0.12 }]);
      return [{ label: 'Stamp duty land tax', level: 'federal', amount: sdlt + (foreign ? value * 0.02 : 0), note: `${ftb ? 'First-time buyer relief: 0% to GBP 300,000, 5% to 500,000' : '0% / 2% / 5% / 10% / 12% bands'}${foreign ? '; +2% non-resident surcharge' : ''}` }];
    }
    case 'luxembourg': {
      const credit = 40000 * buyers; // Bëllegen Akt: any owner-occupied main home, not only first-time buyers
      const state = Math.max(0, value * 0.07 - credit);
      return [
        { label: 'Registration and transcription duties', level: 'federal', amount: state, note: `7% of the price, less the Bëllegen Akt credit of EUR 40,000 per buyer for a main home` },
        { label: 'Luxembourg City surcharge', level: 'local', amount: value * 0.03, note: 'Luxembourg City adds 50% of the 6% registration duty' },
      ];
    }
    case 'dublin':
      return [{ label: 'Stamp duty', level: 'federal', amount: progressive(value, [{ upTo: 1000000, rate: 0.01 }, { upTo: 1500000, rate: 0.02 }, { upTo: null, rate: 0.06 }]), note: '1% to EUR 1 million, 2% to 1.5 million, 6% above' }];
    case 'oslo':
      return [{ label: 'Document duty (dokumentavgift)', level: 'federal', amount: value * 0.025, note: '2.5% on freehold homes (housing co-op flats are exempt)' }];
    case 'copenhagen':
      return [{ label: 'Land registration fees (tinglysningsafgift)', level: 'federal', amount: 1850 + value * 0.006 + (mortgage > 0 ? 1825 + mortgage * 0.0125 : 0), note: 'DKK 1,850 + 0.6% of the price for the deed; DKK 1,825 + 1.25% of the mortgage' }];
    default:
      return []; // Zurich abolished its transfer tax in 2005
  }
}
