// Switzerland 2026 (City of Zurich): federal, cantonal and communal income tax, wealth tax, imputed
// rent, AHV/IV/EO and unemployment insurance (both sides), pillar 2 (mandatory savings, info only).
// The federal tax and the Zurich "simple tax" come from tables sampled from the Federal Tax
// Administration's calculator (scripts/fetch_ch_tariffs.py); canton and city multiply the simple tax.

import tariffs from '../../../data/rules/ch/zh2026.json';
import type { InfoItem, LineItem } from '../types';
import { fmt, interp, kids, type CountryTaxResult, type EuHousehold } from './common';

export const CH = {
  steuerfuss: { canton: tariffs.steuerfuss.canton, city: tariffs.steuerfuss.city, church: tariffs.steuerfuss.reformedChurch },
  personalTax: tariffs.personalTax,
  federalChildCredit: tariffs.federalChildCredit,
  ahv: 0.053, alv: { rate: 0.011, ceiling: 148200 }, selfEmployedAhv: 0.1,
  bvg: { entry: 22680, coordination: 26460, max: 90720 },
  workExpenses: { rate: 0.03, min: 2000, max: 4000 }, commute: 800,
  insurance: { fed: { single: 1800, married: 3600, child: 700 }, zh: { single: 2900, married: 5800, child: 1300 } },
  pillar3a: 7258,
  twoEarner: { fedRate: 0.5, fedMin: 8600, fedMax: 14100, zh: 5900 },
  child: { fed: 6800, zh: 9300 },
  marriedFed: 2800,
  imputedRent: 0.021, maintenanceFlat: 0.2,
  realEstateTaxValue: 0.7,
  wealthAllowance: { single: 80000, married: 159000, child: 41000 },
  childAllowance: { under6: 215 * 12, from6: 240 * 12 },
  healthPremium: { adult: 6500, child: 1600 },
};

const bvgCredit = (age: number) => (age < 25 ? 0 : age < 35 ? 0.07 : age < 45 ? 0.1 : age < 55 ? 0.15 : 0.18);

export function switzerland(h: EuHousehold): CountryTaxResult {
  const items: LineItem[] = [];
  const info: InfoItem[] = [];
  const joint = h.partner;
  const n = kids(h);
  const T = joint || n > 0 ? tariffs.married : tariffs.single; // single parents get the married rate

  // ---- Social insurance ----
  const ahv = (h.wages + h.partnerWages) * CH.ahv + Math.max(0, h.selfEmployment) * CH.selfEmployedAhv;
  const alv = (Math.min(h.wages, CH.alv.ceiling) + Math.min(h.partnerWages, CH.alv.ceiling)) * CH.alv.rate;
  const bvg = (w: number) => (w < CH.bvg.entry ? 0 : (Math.min(w, CH.bvg.max) - CH.bvg.coordination) * bvgCredit(h.age) / 2);
  const bvgEmployee = Math.max(0, bvg(h.wages)) + Math.max(0, bvg(h.partnerWages));

  // ---- Taxable income ----
  const work = (w: number) => (w > 0 ? Math.min(CH.workExpenses.max, Math.max(CH.workExpenses.min, w * CH.workExpenses.rate)) + CH.commute : 0);
  const imputed = h.owner ? h.homeValue * CH.imputedRent * (1 - CH.maintenanceFlat) : 0;
  const gross = h.wages + h.partnerWages + h.selfEmployment + h.interest + h.dividends + h.rental + imputed;
  const pillar3a = Math.min(h.retirement, CH.pillar3a);
  const common = ahv + alv + bvgEmployee + pillar3a + work(h.wages) + work(h.partnerWages) + h.mortgageInterest;
  const lower = Math.min(h.wages, h.partnerWages);
  const fedDed = common + (joint ? CH.insurance.fed.married + CH.marriedFed : CH.insurance.fed.single) + n * (CH.insurance.fed.child + CH.child.fed)
    + (joint && lower > 0 ? Math.min(CH.twoEarner.fedMax, Math.max(CH.twoEarner.fedMin, lower * CH.twoEarner.fedRate)) : 0);
  const zhDed = common + (joint ? CH.insurance.zh.married : CH.insurance.zh.single) + n * (CH.insurance.zh.child + CH.child.zh)
    + (joint && lower > 0 ? CH.twoEarner.zh : 0);
  const fedTaxable = Math.max(0, gross - fedDed);
  const zhTaxable = Math.max(0, gross - zhDed);
  const fedTax = Math.max(0, interp(T.income, fedTaxable, 1) - n * CH.federalChildCredit);
  const simple = interp(T.income, zhTaxable, 2);
  const cantonTax = simple * CH.steuerfuss.canton;
  const cityTax = simple * CH.steuerfuss.city + CH.personalTax * (joint ? 2 : 1);
  const relief = interp(T.income, zhTaxable + ahv + alv + bvgEmployee, 2) * (CH.steuerfuss.canton + CH.steuerfuss.city) - simple * (CH.steuerfuss.canton + CH.steuerfuss.city)
    + interp(T.income, fedTaxable + ahv + alv + bvgEmployee, 1) - interp(T.income, fedTaxable, 1);

  // ---- Wealth tax ----
  const wealth = h.cash + h.bonds + h.equities + h.taxFreeAccounts + h.otherRealEstate + (h.owner ? h.homeValue * CH.realEstateTaxValue : 0) - h.mortgage;
  const allowance = (joint ? CH.wealthAllowance.married : CH.wealthAllowance.single) + n * CH.wealthAllowance.child;
  const taxableWealth = Math.max(0, wealth - allowance);
  const wealthSimple = interp(T.wealth, taxableWealth, 1);
  const church = h.church ? (simple + wealthSimple) * CH.steuerfuss.church : 0;

  const trace = [
    `Income ${fmt(gross)}${imputed ? ` incl. imputed rent ${fmt(imputed)} (rental value less 20% upkeep)` : ''}`,
    `Deductions: AHV/ALV ${fmt(ahv + alv)}, pillar 2 ${fmt(bvgEmployee)}${pillar3a ? `, pillar 3a ${fmt(pillar3a)}` : ''}${h.mortgageInterest ? `, mortgage interest ${fmt(h.mortgageInterest)}` : ''}, work costs, insurance${n ? ', children' : ''}`,
    `Taxable: federal ${fmt(fedTaxable)}, Zurich ${fmt(zhTaxable)}; Zurich simple tax ${fmt(simple)} × 95% canton and 119% city`,
  ];
  items.push({ id: 'ch-federal', label: 'Federal income tax', category: 'income', level: 'federal', amount: fedTax, confidence: 'high',
    note: `2026 federal tariff (up to 11.5%)${joint || n ? ', married/family scale' : ''}${n ? `, less CHF 263 per child` : ''}.`, trace });
  items.push({ id: 'ch-canton', label: 'Canton of Zurich income tax', category: 'income', level: 'provincial', amount: cantonTax, confidence: 'high', note: '95% of the Zurich simple tax (2026 Steuerfuss).' });
  items.push({ id: 'ch-city', label: 'City of Zurich income tax', category: 'income', level: 'local', amount: cityTax, confidence: 'high', note: '119% of the simple tax, plus the CHF 24 personal tax.' });
  if (wealthSimple > 0) {
    items.push({ id: 'ch-wealth-canton', label: 'Wealth tax (canton)', category: 'property', level: 'provincial', amount: wealthSimple * CH.steuerfuss.canton, confidence: 'medium',
      note: `On net wealth ${fmt(wealth)} less the ${fmt(allowance)} allowance. Homes count at about 70% of market value; pension savings are exempt.` });
    items.push({ id: 'ch-wealth-city', label: 'Wealth tax (city)', category: 'property', level: 'local', amount: wealthSimple * CH.steuerfuss.city, confidence: 'medium', note: '119% of the simple wealth tax.' });
  }
  if (church > 0) items.push({ id: 'ch-church', label: 'Church tax', category: 'income', level: 'social', amount: church, confidence: 'high', note: '10% of the simple tax for church members. It funds the churches, not the government.' });
  items.push({ id: 'ch-ahv', label: 'AHV/IV/EO (old age, disability, income loss)', category: 'payroll', level: 'social', amount: ahv, confidence: 'high',
    note: `5.3% of all wages, no ceiling${h.selfEmployment ? '; self-employed 10%' : ''}. Fully deductible: together with unemployment insurance and pillar 2 it saves about ${fmt(relief)} of income tax.` });
  items.push({ id: 'ch-alv', label: 'Unemployment insurance', category: 'payroll', level: 'social', amount: alv, confidence: 'high', note: '1.1% of wages up to CHF 148,200. Deductible.' });
  info.push({ id: 'ch-bvg', label: 'Pillar 2 pension contribution (mandatory savings, not in your rate)', amount: bvgEmployee,
    note: 'Employee half of the age-based savings credit on the coordinated salary. It builds your own pension account, so it is treated like an RRSP, not a tax. Deductible.' });
  info.push({ id: 'ch-health', label: 'Mandatory health insurance premiums (not in your rate)', amount: CH.healthPremium.adult * (joint ? 2 : 1) + n * CH.healthPremium.child,
    note: 'Every resident must buy basic health insurance (about CHF 540 a month per adult in Zurich). In Canada this is paid through taxes, so compare with care.' });
  info.push({ id: 'employer', label: 'Your employer also pays (not in your rate)', amount: (h.wages + h.partnerWages) * (CH.ahv + 0.012 + 0.01) + Math.min(h.wages, CH.alv.ceiling) * CH.alv.rate + bvgEmployee,
    note: 'Employer AHV/IV/EO, family allowance fund, unemployment insurance and at least the same pillar 2 contribution.' });
  const b = h.kidsUnder6 * CH.childAllowance.under6 + h.kids6to17 * CH.childAllowance.from6;
  return {
    items, info, warnings: [],
    benefits: b ? [{ id: 'ch-child', label: 'Child allowances', amount: b, level: 'social', note: 'Zurich: CHF 215 a month per child (268 from age 12), paid through the employer and funded by employer contributions.' }] : [],
  };
}
