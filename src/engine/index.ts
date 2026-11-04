// Public API of the engine.

import { calculateCanada } from './ca/calculate';
import { CITIES, FX_CAD_PER_USD } from './ca/params2026';
import { calculateUs } from './us/calculate';
import { US_CITIES } from './us/params2026';
import { calculateEu } from './eu/calculate';
import { EU_CITIES, FX as EU_FX } from './eu/params2026';
import type { EuCountry } from './eu/common';
import { calculateSingapore, FX_SGD_PER_USD } from './sg/calculate';
import { debtShareAtFixedShare, seriesYears } from './fiscal';
import type { CalcOptions, Level, Persona, PlaceResult } from './types';

export * from './types';
export { FISCAL_NOTES, getSeries, seriesYears } from './fiscal';

export interface Place {
  id: string;
  name: string;
  region: string;
  country: string;
  countryCode: 'CA' | 'US' | EuCountry | 'SG';
  /** What each level is called in this country. */
  levelNames: Record<Level, string>;
  currency: string;
  /** Local currency per USD. */
  fx: number;
  /** Fiscal series behind each level, for the history views. Null where there is no middle level. */
  series: { federal: string; provincial: string | null; local: string | null };
  calculate: (p: Persona, opts: CalcOptions) => PlaceResult;
}

const CA_LEVELS: Record<Level, string> = { federal: 'Federal', provincial: 'Provincial', local: 'City / regional', social: 'CPP fund' };
const US_LEVELS: Record<Level, string> = { federal: 'Federal', provincial: 'State', local: 'City, county & schools', social: 'Pension fund' };
const US_STATE_NAMES = { NY: 'New York', CA: 'California', WA: 'Washington', TX: 'Texas' } as const;

const CANADA: Place[] = Object.values(CITIES).map((c) => ({
  id: c.id,
  name: c.name,
  region: c.province === 'AB' ? 'Alberta' : c.province === 'ON' ? 'Ontario' : 'British Columbia',
  country: 'Canada',
  countryCode: 'CA',
  levelNames: CA_LEVELS,
  currency: 'CAD',
  fx: FX_CAD_PER_USD,
  series: { federal: 'CA-federal', provincial: `CA-${c.province}`, local: `CA-${c.province}-local` },
  calculate: (p, o) => calculateCanada(p, c.id, o),
}));

const UNITED_STATES: Place[] = Object.values(US_CITIES).map((c) => ({
  id: c.id,
  name: c.name,
  region: US_STATE_NAMES[c.state],
  country: 'United States',
  countryCode: 'US',
  levelNames: US_LEVELS,
  currency: 'USD',
  fx: 1,
  series: { federal: 'US-federal', provincial: `US-${c.state}`, local: `US-${c.state}-local` },
  calculate: (p, o) => calculateUs(p, c.id, o),
}));

const EUROPE: Place[] = Object.values(EU_CITIES).map((c) => ({
  id: c.id,
  name: c.name,
  region: c.region,
  country: c.countryName,
  countryCode: c.country,
  levelNames: c.levelNames,
  currency: EU_FX[c.country].currency,
  fx: EU_FX[c.country].perUsd,
  series: c.series,
  calculate: (p, o) => calculateEu(p, c.id, o),
}));

const SINGAPORE: Place = {
  id: 'singapore', name: 'Singapore', region: 'Singapore', country: 'Singapore', countryCode: 'SG',
  levelNames: { federal: 'Government of Singapore', provincial: '-', local: '-', social: 'CPF' },
  currency: 'SGD', fx: FX_SGD_PER_USD,
  series: { federal: 'SG-federal', provincial: null, local: null },
  calculate: (p, o) => calculateSingapore(p, o),
};

export const PLACES: Place[] = [...CANADA, ...UNITED_STATES, ...EUROPE, SINGAPORE];

/** Levels of government that exist in a place (no middle level in unitary countries). */
export const placeLevels = (p: Place): Lvl[] => LVLS.filter((l) => p.series[l] !== null);

export const placeById = (id: string) => PLACES.find((p) => p.id === id)!;

export function calculate(persona: Persona, placeId: string, opts: CalcOptions): PlaceResult {
  return placeById(placeId).calculate(persona, opts);
}

/** Change in (taxes paid now + borrowed) per extra dollar of employment income. */
export function marginalRate(persona: Persona, placeId: string, opts: CalcOptions, stepUsd = 1000): { paidNow: number; implicit: number } {
  const a = calculate(persona, placeId, opts);
  const b = calculate({ ...persona, income: { ...persona.income, employment: persona.income.employment + stepUsd } }, placeId, opts);
  const step = b.grossIncome - a.grossIncome;
  return { paidNow: (b.paidNow - a.paidNow) / step, implicit: (b.implicitTotal - a.implicitTotal) / step };
}

export interface RateCurvePoint {
  incomeUsd: number;
  effective: number;
  effectivePaidNow: number;
  marginal: number;
}

export function rateCurve(persona: Persona, placeId: string, opts: CalcOptions, incomesUsd: number[]): RateCurvePoint[] {
  return incomesUsd.map((incomeUsd) => {
    const p = { ...persona, income: { ...persona.income, employment: incomeUsd } };
    const r = calculate(p, placeId, opts);
    const m = marginalRate(p, placeId, opts, 2000);
    return { incomeUsd, effective: r.implicitRate, effectivePaidNow: r.paidNowRate, marginal: m.implicit };
  });
}

type Lvl = 'federal' | 'provincial' | 'local';
const LVLS: Lvl[] = ['federal', 'provincial', 'local'];

export interface HistoryRow {
  year: number;
  /** Taxes paid now, share of gross income (same every year: today's rules). */
  paidNow: number;
  /** Per level, shares of gross income (null = no data). */
  borrowed: Record<Lvl, number | null>;
  interest: Record<Lvl, number | null>;
  /** Your share of each government's net debt, local currency, using your share of today's tax revenue. */
  debt: Record<Lvl, number | null>;
  implicit: number | null;
  estimate: boolean;
}

/** Today's persona and tax rules, with each year's borrowing and interest (docs/PLAN.md §1.4). */
export function history(persona: Persona, placeId: string, opts: CalcOptions): HistoryRow[] {
  const place = placeById(placeId);
  const years = new Set<number>();
  for (const id of Object.values(place.series)) if (id) seriesYears(id).forEach((y) => years.add(y));
  const levels = placeLevels(place);
  const now = calculate(persona, placeId, { ...opts, year: 'latest' });
  const taxesNow = Object.fromEntries(now.deferred.map((d) => [d.level, d.yourTaxes])) as Record<Lvl, number>;
  return [...years].sort((a, b) => a - b).map((year) => {
    const r = calculate(persona, placeId, { ...opts, year });
    const g = r.grossIncome || 1;
    const borrowed = {} as HistoryRow['borrowed'];
    const interest = {} as HistoryRow['interest'];
    const debt = {} as HistoryRow['debt'];
    let complete = true;
    let estimate = false;
    for (const lvl of LVLS) {
      if (!levels.includes(lvl)) {
        borrowed[lvl] = null; interest[lvl] = null; debt[lvl] = null;
        continue;
      }
      const d = r.deferred.find((x) => x.level === lvl)!;
      const has = d.borrowRatio !== null;
      if (!has) complete = false;
      if (d.estimate) estimate = true;
      borrowed[lvl] = has ? d.borrowed / g : null;
      interest[lvl] = d.interestRatio !== null ? d.interestCost / g : null;
      debt[lvl] = debtShareAtFixedShare(place.series[lvl]!, taxesNow[lvl], year);
    }
    return { year, paidNow: r.paidNowRate, borrowed, interest, debt, implicit: complete ? r.implicitRate : null, estimate };
  });
}
