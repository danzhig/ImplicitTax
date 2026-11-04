// Denmark 2026 (Copenhagen): labour market contribution, municipal and church tax, bottom/middle/top
// taxes (2026 reform), share income tax, employment allowance, child benefit.

import type { InfoItem, LineItem } from '../types';
import { fmt, type CountryTaxResult, type EuHousehold } from './common';

export const DK = {
  am: 0.08,
  municipal: 0.2339, // Copenhagen 2026 (Statistics Denmark PSKAT)
  church: 0.008,
  bottom: 0.1201,
  // Thresholds on personal income after the 8% labour market contribution
  middle: { rate: 0.075, from: 641200 },
  top: { rate: 0.075, from: 777900 },
  topTop: { rate: 0.05, from: 2592700 },
  personalAllowance: 54100,
  employmentAllowance: { rate: 0.1275, max: 63300 },
  shareIncome: { low: 0.27, high: 0.42, threshold: 79400 },
  atpEmployee: 1136, atpEmployer: 2272,
  childBenefit: { under6: (21480 * 3 + 16992 * 4) / 7, from6: 13368 },
};

function person(wages: number, self: number, pension: number, capital: number, church: boolean) {
  const earned = wages + self;
  const am = earned * DK.am;
  const P = Math.max(0, earned - am - pension);
  const posK = Math.max(0, capital);
  const employment = Math.min(DK.employmentAllowance.max, wages * DK.employmentAllowance.rate);
  const taxable = Math.max(0, P + capital - employment);
  const munBase = Math.max(0, taxable - DK.personalAllowance);
  const municipal = munBase * DK.municipal;
  const churchTax = church ? munBase * DK.church : 0;
  const bottom = Math.max(0, P + posK - DK.personalAllowance) * DK.bottom;
  const progressive = (P + posK > DK.middle.from ? (P + posK - DK.middle.from) * DK.middle.rate : 0)
    + (P + posK > DK.top.from ? (P + posK - DK.top.from) * DK.top.rate : 0)
    + (P + posK > DK.topTop.from ? (P + posK - DK.topTop.from) * DK.topTop.rate : 0);
  return { am, municipal, churchTax, state: bottom + progressive, P, taxable, employment, bottom, progressive };
}

export function denmark(h: EuHousehold): CountryTaxResult {
  const items: LineItem[] = [];
  const info: InfoItem[] = [];
  const capital = h.interest + h.rental - h.mortgageInterest;
  const me = person(h.wages, h.selfEmployment, h.retirement, capital, h.church);
  const pa = h.partner ? person(h.partnerWages, 0, 0, 0, h.church) : null;
  const share = h.dividends + h.gains;
  const lim = DK.shareIncome.threshold * (h.partner ? 2 : 1);
  const shareTax = Math.min(share, lim) * DK.shareIncome.low + Math.max(0, share - lim) * DK.shareIncome.high;
  const sum = (f: (p: ReturnType<typeof person>) => number) => f(me) + (pa ? f(pa) : 0);

  items.push({ id: 'dk-am', label: 'Labour market contribution (AM-bidrag)', category: 'income', level: 'federal', amount: sum((p) => p.am), confidence: 'high',
    note: '8% of earnings, deducted before every other income tax. It is a tax that goes to the state budget, not a social insurance fund.' });
  items.push({ id: 'dk-state', label: 'State income tax (bottom, middle and top tax)', category: 'income', level: 'federal', amount: sum((p) => p.state), confidence: 'high',
    note: 'Bottom tax 12.01%; from 2026 a middle tax of 7.5% above DKK 641,200 and top tax of 7.5% above 777,900 (after AM-bidrag); 5% top-top tax above 2.59 million.',
    trace: [`Personal income after AM-bidrag${h.retirement ? ' and pension saving' : ''}: ${fmt(me.P)}; bottom tax ${fmt(me.bottom)}, middle/top ${fmt(me.progressive)}`] });
  items.push({ id: 'dk-municipal', label: 'Copenhagen municipal tax', category: 'income', level: 'local', amount: sum((p) => p.municipal), confidence: 'high',
    note: `23.39% of taxable income after the employment allowance (${fmt(me.employment)}) and the DKK 54,100 personal allowance. Net interest paid (mostly mortgage interest) is deducted here.`,
    trace: [`Taxable income ${fmt(me.taxable)} (capital income ${fmt(capital)})`] });
  if (h.church) items.push({ id: 'dk-church', label: 'Church tax', category: 'income', level: 'local', amount: sum((p) => p.churchTax), confidence: 'high', note: '0.80% in Copenhagen, members of the Danish national church only.' });
  if (shareTax > 0) items.push({ id: 'dk-share', label: 'Share income tax', category: 'income', level: 'federal', amount: shareTax, confidence: 'high', note: `27% on dividends and share gains up to DKK ${fmt(lim)}, 42% above.` });
  info.push({ id: 'atp', label: 'ATP pension contribution (savings, not in your rate)', amount: DK.atpEmployee * (h.partner && h.partnerWages > 0 ? 2 : 1),
    note: 'A small funded pension in your own name; like CPP it is shown but its fund is not part of the government budget.' });
  info.push({ id: 'employer', label: 'Your employer also pays (not in your rate)', amount: DK.atpEmployer * (h.partner && h.partnerWages > 0 ? 2 : 1) + (h.wages + h.partnerWages) * 0.01,
    note: 'Denmark has almost no employer payroll taxes: ATP and small labour market levies.' });
  const b = h.kidsUnder6 * DK.childBenefit.under6 + h.kids6to17 * DK.childBenefit.from6;
  return {
    items, info, warnings: [],
    benefits: b ? [{ id: 'dk-child', label: 'Child and youth benefit', amount: b, level: 'federal', note: 'DKK 21,480 a year (age 0-2), 16,992 (3-6), 13,368 (7-17).' }] : [],
  };
}
