// Ireland 2026 (Dublin): income tax with joint assessment, tax credits, USC, PRSI, DIRT and CGT,
// child benefit.

import type { InfoItem, LineItem } from '../types';
import { progressive } from '../brackets';
import { fmt, kids, type CountryTaxResult, type EuHousehold } from './common';

export const IE = {
  band: { single: 44000, marriedOneIncome: 53000, secondIncomeMax: 35000 },
  rates: { standard: 0.2, higher: 0.4 },
  credits: { personal: 2000, employee: 2000 },
  usc: [{ upTo: 12012, rate: 0.005 }, { upTo: 28700, rate: 0.02 }, { upTo: 70044, rate: 0.03 }, { upTo: null, rate: 0.08 }],
  uscExemptBelow: 13000,
  uscSelfEmployedSurcharge: { over: 100000, rate: 0.03 },
  // 4.2% to 30 September 2026, 4.35% from 1 October: weighted average for the year
  prsi: 0.042 * 0.75 + 0.0435 * 0.25,
  prsiEmployer: 0.1125 * 0.75 + 0.114 * 0.25,
  prsiUnearnedFrom: 5000,
  dirt: 0.33,
  cgt: { rate: 0.33, exemption: 1270 },
  childBenefit: 140 * 12,
  pensionEarningsCap: 115000,
};

const pensionLimit = (age: number) => (age < 30 ? 0.15 : age < 40 ? 0.2 : age < 50 ? 0.25 : age < 55 ? 0.3 : age < 60 ? 0.35 : 0.4);

function usc(gross: number, selfEmployed: number): number {
  if (gross <= IE.uscExemptBelow) return 0;
  return progressive(gross, IE.usc) + Math.max(0, selfEmployed - IE.uscSelfEmployedSurcharge.over) * IE.uscSelfEmployedSurcharge.rate;
}

export function ireland(h: EuHousehold): CountryTaxResult {
  const items: LineItem[] = [];
  const info: InfoItem[] = [];
  const earnings = h.wages + h.selfEmployment;
  const pension = Math.min(h.retirement, pensionLimit(h.age) * Math.min(earnings, IE.pensionEarningsCap));
  const myIncome = Math.max(0, h.wages + h.selfEmployment + h.rental + h.dividends - pension);
  const partnerIncome = h.partner ? h.partnerWages : 0;
  const total = myIncome + partnerIncome;

  // Standard rate band: joint assessment raises the band by the lower earner's income (max 35,000).
  const band = h.partner
    ? IE.band.marriedOneIncome + Math.min(IE.band.secondIncomeMax, Math.min(myIncome, partnerIncome))
    : IE.band.single;
  const gross = Math.min(total, band) * IE.rates.standard + Math.max(0, total - band) * IE.rates.higher;
  const employeeCredit = (w: number) => Math.min(IE.credits.employee, w * 0.2);
  const credits = IE.credits.personal * (h.partner ? 2 : 1) + employeeCredit(earnings) + (h.partner ? employeeCredit(h.partnerWages) : 0);
  const incomeTax = Math.max(0, gross - credits);
  const dirt = h.interest * IE.dirt;
  const cgt = Math.max(0, h.gains - IE.cgt.exemption) * IE.cgt.rate;
  const uscTotal = usc(h.wages + h.selfEmployment + h.rental + h.dividends, h.selfEmployment) + (h.partner ? usc(h.partnerWages, 0) : 0);
  const unearned = h.selfEmployment + h.rental + h.dividends;
  const prsi = (h.wages + h.partnerWages) * IE.prsi + (unearned > IE.prsiUnearnedFrom ? unearned * IE.prsi : 0);

  items.push({ id: 'ie-income', label: 'Income tax', category: 'income', level: 'federal', amount: incomeTax, confidence: 'high',
    note: `20% up to ${fmt(band)}, 40% above, less tax credits of ${fmt(credits)}.${pension ? ` Pension contributions of ${fmt(pension)} are deducted (age-based limit).` : ''}`,
    trace: [`Taxable income ${fmt(total)}${h.partner ? ' (joint assessment)' : ''}: ${fmt(gross)} before credits`, `Credits: personal ${fmt(IE.credits.personal * (h.partner ? 2 : 1))}, employee ${fmt(credits - IE.credits.personal * (h.partner ? 2 : 1))}`] });
  items.push({ id: 'ie-usc', label: 'Universal Social Charge', category: 'income', level: 'federal', amount: uscTotal, confidence: 'high',
    note: '0.5% / 2% / 3% / 8% on gross income (pension contributions are not deducted), charged on each person separately.' });
  if (dirt > 0) items.push({ id: 'ie-dirt', label: 'Deposit interest retention tax', category: 'income', level: 'federal', amount: dirt, confidence: 'high', note: '33% on deposit interest, final.' });
  if (cgt > 0) items.push({ id: 'ie-cgt', label: 'Capital gains tax', category: 'income', level: 'federal', amount: cgt, confidence: 'high', note: '33% above the EUR 1,270 exemption.' });
  items.push({ id: 'ie-prsi', label: 'PRSI (social insurance)', category: 'payroll', level: 'social', amount: prsi, confidence: 'high',
    note: '4.2% of earnings, 4.35% from October 2026; also on rental, dividend and self-employment income above EUR 5,000. Not deductible from income tax.' });
  info.push({ id: 'employer', label: 'Your employer also pays (not in your rate)', amount: (h.wages + h.partnerWages) * IE.prsiEmployer,
    note: 'Employer PRSI 11.25% (11.4% from October 2026).' });
  const n = kids(h);
  return {
    items, info, warnings: [],
    benefits: n ? [{ id: 'ie-child-benefit', label: 'Child benefit', amount: n * IE.childBenefit, level: 'federal', note: 'EUR 140 a month per child.' }] : [],
  };
}
