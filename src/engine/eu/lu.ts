// Luxembourg 2026: income tax (classes 1 and 2), employment fund surcharge, employee tax credit,
// 20% final tax on interest, social security and dependency contributions, family allowance.

import type { InfoItem, LineItem } from '../types';
import { fmt, kids, type CountryTaxResult, type EuHousehold } from './common';

const SCALE: [number, number][] = [
  [13230, 0], [15435, 0.08], [17640, 0.09], [19845, 0.1], [22050, 0.11], [24255, 0.12], [26550, 0.14], [28845, 0.16],
  [31140, 0.18], [33435, 0.2], [35730, 0.22], [38025, 0.24], [40320, 0.26], [42615, 0.28], [44910, 0.3], [47205, 0.32],
  [49500, 0.34], [51795, 0.36], [54090, 0.38], [117450, 0.39], [176160, 0.4], [234870, 0.41], [Infinity, 0.42],
];

export const LU = {
  workExpenses: 540, specialExpenses: 480, privatePensionCap: 4500,
  surcharge: { rate: 0.07, high: 0.09, highFrom: { single: 150000, joint: 300000 } },
  interestTax: 0.2,
  si: { pension: 0.085, health: 0.0305, dependence: 0.014, dependenceAllowance: 8313.96, ceiling: 13856.63 * 12, selfEmployedPension: 0.17, selfEmployedHealth: 0.0585 },
  employerRate: 0.085 + 0.0305 + 0.01 + 0.011, // pension, health, accident, mutual
  familyAllowance: 300 * 12,
};

export function luTariff(income: number): number {
  let tax = 0;
  let lower = 0;
  for (const [upTo, rate] of SCALE) {
    if (income <= lower) break;
    tax += (Math.min(income, upTo) - lower) * rate;
    lower = upTo;
  }
  return tax;
}

/** Employee tax credit (CIS): EUR 696 from 11,265 to 40,000 of gross pay, phased out by 80,000. */
const employeeCredit = (w: number) => (w < 936 ? 0 : w < 11265 ? 600 : w <= 40000 ? 696 : Math.max(0, 696 * (1 - (w - 40000) / 40000)));

export function luxembourg(h: EuHousehold): CountryTaxResult {
  const items: LineItem[] = [];
  const info: InfoItem[] = [];
  const warnings: string[] = [];
  const S = LU.si;
  const contrib = (w: number) => Math.min(w, S.ceiling) * (S.pension + S.health);
  const seContrib = Math.min(Math.max(0, h.selfEmployment), S.ceiling) * (S.selfEmployedPension + S.selfEmployedHealth);
  const social = contrib(h.wages) + contrib(h.partnerWages) + seContrib;
  const depBase = (x: number) => Math.max(0, x - S.dependenceAllowance);
  const dependence = (depBase(h.wages + h.selfEmployment + h.rental + h.dividends) + (h.partner ? depBase(h.partnerWages) : 0)) * S.dependence;

  const wageNet = (w: number) => (w > 0 ? Math.max(0, w - LU.workExpenses) : 0);
  const pension = Math.min(h.retirement, LU.privatePensionCap);
  const taxable = Math.max(0, wageNet(h.wages) + wageNet(h.partnerWages) + h.selfEmployment + h.rental + h.dividends * 0.5
    - social - dependence - LU.specialExpenses * (h.partner ? 2 : 1) - pension);
  const joint = h.partner;
  const base = joint ? 2 * luTariff(taxable / 2) : luTariff(taxable);
  const surchargeRate = taxable > LU.surcharge.highFrom[joint ? 'joint' : 'single'] ? LU.surcharge.high : LU.surcharge.rate;
  const credit = employeeCredit(h.wages) + (joint ? employeeCredit(h.partnerWages) : 0);
  const incomeTax = Math.max(0, base * (1 + surchargeRate) - credit);
  const interestTax = h.interest * LU.interestTax;
  const relief = (joint ? 2 * luTariff((taxable + social) / 2) : luTariff(taxable + social)) * (1 + surchargeRate) - base * (1 + surchargeRate);

  items.push({ id: 'lu-income', label: 'Income tax', category: 'income', level: 'federal', amount: incomeTax, confidence: 'high',
    note: `Tax class ${joint ? '2 (joint, splitting)' : '1'}: 0%-42%, plus ${Math.round(surchargeRate * 100)}% for the employment fund, less the employee tax credit (${fmt(credit)}). Half of dividends are exempt; gains on shares held over 6 months are tax-free.`,
    trace: [`Taxable income ${fmt(taxable)} after work expenses, social contributions${pension ? ', private pension' : ''} and the special-expense lump sum`, `Tariff tax ${fmt(base)} + ${Math.round(surchargeRate * 100)}% surcharge - credit ${fmt(credit)}`] });
  if (interestTax > 0) items.push({ id: 'lu-interest', label: 'Withholding tax on interest', category: 'income', level: 'federal', amount: interestTax, confidence: 'high', note: '20% final tax on savings interest.' });
  items.push({ id: 'lu-social', label: 'Pension and health insurance', category: 'payroll', level: 'social', amount: social, confidence: 'high',
    note: `Pension 8.5% (raised from 8% in 2026) and health 3.05%, up to EUR 13,857 a month.${seContrib ? ' Self-employed pay both halves.' : ''} Fully deductible: saves about ${fmt(relief)} of income tax.` });
  items.push({ id: 'lu-dependence', label: 'Dependency insurance', category: 'payroll', level: 'social', amount: dependence, confidence: 'high',
    note: '1.4% of all professional and investment income above EUR 8,314 a year, no ceiling. Deductible.' });
  info.push({ id: 'employer', label: 'Your employer also pays (not in your rate)', amount: (Math.min(h.wages, S.ceiling) + Math.min(h.partnerWages, S.ceiling)) * LU.employerRate,
    note: 'Employer pension, health, accident and mutual insurance contributions.' });
  if (!h.partner && kids(h) > 0) warnings.push('Luxembourg single parents use tax class 1a, which is approximated here by class 1 (tax slightly overstated).');
  const n = kids(h);
  return {
    items, info, warnings,
    benefits: n ? [{ id: 'lu-family', label: 'Family allowance', amount: n * LU.familyAllowance, level: 'social', note: 'About EUR 300 a month per child (CAE), plus age supplements not modelled.' }] : [],
  };
}
