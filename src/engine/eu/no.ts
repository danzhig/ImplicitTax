// Norway 2026 (Oslo): 22% tax on general income, bracket tax on personal income, national insurance,
// wealth tax with valuation discounts, child benefit.

import type { InfoItem, LineItem } from '../types';
import { progressive } from '../brackets';
import { fmt, kids, pct, type CountryTaxResult, type EuHousehold } from './common';

export const NO = {
  generalRate: 0.22,
  /** Part of the 22% that goes to Oslo (municipal + county share); the rest is state tax. Estimate. */
  localShareOfGeneral: 13.55 / 22,
  personalAllowance: 114550,
  minimumDeduction: { rate: 0.46, max: 95700, min: 4000 },
  shareUplift: 1.72,
  ipsCap: 15000,
  bracket: [{ upTo: 226100, rate: 0 }, { upTo: 318300, rate: 0.017 }, { upTo: 725050, rate: 0.04 }, { upTo: 980100, rate: 0.137 }, { upTo: 1467200, rate: 0.168 }, { upTo: null, rate: 0.178 }],
  insurance: { employee: 0.076, selfEmployed: 0.11, exemptBelow: 99650, maxShare: 0.25, employer: 0.141 },
  wealth: { threshold: 1900000, municipal: 0.0035, state: 0.0065, high: { from: 21500000, extra: 0.001 }, homeRate: 0.25, homeRateAbove: 0.7, homeLimit: 14000000, shareRate: 0.8 },
  childBenefit: 1968 * 12,
};

const insurance = (x: number, rate: number) => {
  const I = NO.insurance;
  return x <= I.exemptBelow ? 0 : Math.min(x * rate, (x - I.exemptBelow) * I.maxShare);
};

function person(wages: number, self: number, capital: number, deductions: number) {
  const md = wages > 0 ? Math.min(NO.minimumDeduction.max, Math.max(NO.minimumDeduction.min, wages * NO.minimumDeduction.rate), wages) : 0;
  const general = Math.max(0, wages - md + self + capital - deductions - NO.personalAllowance);
  const personal = wages + self;
  return {
    general: general * NO.generalRate,
    bracket: progressive(personal, NO.bracket),
    insurance: insurance(wages, NO.insurance.employee) + insurance(self, NO.insurance.selfEmployed),
    trace: `Wages ${fmt(wages)} - minimum deduction ${fmt(md)}${self ? ` + business ${fmt(self)}` : ''}${capital ? ` + capital ${fmt(capital)}` : ''}${deductions ? ` - deductions ${fmt(deductions)}` : ''} - personal allowance ${fmt(NO.personalAllowance)} = ${fmt(general)} at 22%`,
  };
}

export function norway(h: EuHousehold): CountryTaxResult {
  const items: LineItem[] = [];
  const info: InfoItem[] = [];
  const ips = Math.min(h.retirement, NO.ipsCap);
  const capital = h.interest + h.rental + (h.dividends + h.gains) * NO.shareUplift;
  const me = person(h.wages, h.selfEmployment, capital, h.mortgageInterest + ips);
  const pa = h.partner ? person(h.partnerWages, 0, 0, 0) : null;
  const general = me.general + (pa?.general ?? 0);
  const local = general * NO.localShareOfGeneral;

  items.push({ id: 'no-general-state', label: 'Tax on general income (state share)', category: 'income', level: 'federal', amount: general - local, confidence: 'medium',
    note: '22% on income after the minimum deduction, mortgage interest and the NOK 114,550 personal allowance. Dividends and share gains are grossed up by 1.72 (37.84% effective).',
    trace: [me.trace, ...(pa ? [`Partner: ${pa.trace}`] : [])] });
  items.push({ id: 'no-general-local', label: 'Tax on general income (Oslo share)', category: 'income', level: 'local', amount: local, confidence: 'medium',
    note: `About ${pct(NO.localShareOfGeneral, 0)} of the 22% goes to Oslo as municipality and county (estimate of the 2026 split).` });
  items.push({ id: 'no-bracket', label: 'Bracket tax', category: 'income', level: 'federal', amount: me.bracket + (pa?.bracket ?? 0), confidence: 'high',
    note: '1.7% / 4.0% / 13.7% / 16.8% / 17.8% on wages and business income above NOK 226,100. No deductions.' });
  items.push({ id: 'no-insurance', label: 'National insurance contribution', category: 'payroll', level: 'federal', amount: me.insurance + (pa?.insurance ?? 0), confidence: 'high',
    note: '7.6% of wages (11% of business income). Not deductible. It is part of the state budget, so it shares state borrowing.' });
  info.push({ id: 'employer', label: 'Your employer also pays (not in your rate)', amount: (h.wages + h.partnerWages) * NO.insurance.employer, note: 'Employer national insurance 14.1%.' });

  // ---- Wealth tax ----
  const W = NO.wealth;
  const homeValue = h.owner ? h.homeValue : 0;
  const homeTaxed = Math.min(homeValue, W.homeLimit) * W.homeRate + Math.max(0, homeValue - W.homeLimit) * W.homeRateAbove;
  const marketAssets = h.cash + h.bonds + h.equities + h.otherRealEstate + homeValue;
  const taxedAssets = h.cash + h.bonds + h.equities * W.shareRate + h.otherRealEstate + homeTaxed;
  // Debt is cut in proportion to the discount on shares and homes.
  const debt = h.mortgage * (marketAssets > 0 ? taxedAssets / marketAssets : 1);
  const people = h.partner ? 2 : 1;
  const net = Math.max(0, taxedAssets - debt);
  const above = Math.max(0, net - W.threshold * people);
  const high = Math.max(0, net - W.high.from * people);
  const municipal = above * W.municipal;
  const state = above * W.state + high * W.high.extra;
  if (municipal + state > 0) {
    const trace = [`Taxable wealth ${fmt(net)}: home at 25% (${fmt(homeTaxed)}), shares at 80%, debt reduced to ${fmt(debt)}`, `Above the NOK ${fmt(W.threshold * people)} threshold: ${fmt(above)}`];
    items.push({ id: 'no-wealth-state', label: 'Wealth tax (state)', category: 'property', level: 'federal', amount: state, confidence: 'medium', note: '0.65% above NOK 1.9 million (0.75% above 21.5 million).', trace });
    items.push({ id: 'no-wealth-local', label: 'Wealth tax (Oslo)', category: 'property', level: 'local', amount: municipal, confidence: 'medium', note: '0.35% above NOK 1.9 million.' });
  }
  const n = kids(h);
  return {
    items, info, warnings: [],
    benefits: n ? [{ id: 'no-child-benefit', label: 'Child benefit (barnetrygd)', amount: n * NO.childBenefit, level: 'federal', note: 'NOK 1,968 a month per child.' }] : [],
  };
}
