// United Kingdom 2026-27 (London, England): income tax by slices (earnings, savings, dividends),
// capital gains tax, National Insurance, child benefit with the high-income charge.

import type { InfoItem, LineItem } from '../types';
import { fmt, kids, type CountryTaxResult, type EuHousehold } from './common';

export const UK = {
  personalAllowance: 12570,
  taperFrom: 100000,
  basicBand: 37700, // 12,571 to 50,270
  higherLimit: 125140,
  rates: { basic: 0.2, higher: 0.4, additional: 0.45 },
  dividendRates: { basic: 0.1075, higher: 0.3575, additional: 0.3935 }, // from April 2026
  dividendAllowance: 500,
  savingsAllowance: { basic: 1000, higher: 500, additional: 0 },
  startingRateSavings: 5000,
  cgt: { allowance: 3000, basic: 0.18, higher: 0.24 },
  ni: { primary: 12570, upper: 50270, main: 0.08, above: 0.02, class4Main: 0.06, employer: 0.15, employerThreshold: 5000 },
  childBenefit: { first: 27.05 * 52, other: 17.9 * 52, hicbcFrom: 60000, hicbcTo: 80000 },
  pensionCap: 60000, // annual allowance
};

interface PersonTax { tax: number; ani: number; trace: string[]; cgt: number }

function personTax(nonSavings: number, savings: number, dividends: number, gains: number): PersonTax {
  const U = UK;
  const ani = nonSavings + savings + dividends;
  const pa = Math.max(0, U.personalAllowance - Math.max(0, ani - U.taperFrom) / 2);
  const trace: string[] = [];
  // Allocate the allowance to non-savings first, then savings, then dividends.
  let paLeft = pa;
  const take = (x: number) => { const used = Math.min(x, paLeft); paLeft -= used; return x - used; };
  const ns = take(nonSavings);
  const sv = take(savings);
  const dv = take(dividends);
  const basicTop = U.basicBand;
  const higherTop = U.higherLimit; // additional rate on taxable income above 125,140 (the allowance is gone by then)
  let used = 0; // taxable income used so far, for band positions
  const band = (amount: number, rates: { basic: number; higher: number; additional: number }) => {
    let tax = 0;
    let left = amount;
    const seg = (limit: number, rate: number) => {
      const room = Math.max(0, limit - used);
      const x = Math.min(left, room);
      tax += x * rate; used += x; left -= x;
    };
    seg(basicTop, rates.basic); seg(Math.max(basicTop, higherTop), rates.higher); seg(Infinity, rates.additional);
    return tax;
  };
  const nsTax = band(ns, U.rates);
  // Savings: 0% starting rate (reduced by taxable non-savings income), then the personal savings allowance.
  const starting = Math.max(0, U.startingRateSavings - ns);
  const bandOf = ani > U.higherLimit ? 'additional' : ani - pa > basicTop ? 'higher' : 'basic';
  const psa = U.savingsAllowance[bandOf];
  const svFree = Math.min(sv, starting + psa);
  used += svFree;
  const svTax = band(sv - svFree, U.rates);
  const dvFree = Math.min(dv, U.dividendAllowance);
  used += dvFree;
  const dvTax = band(dv - dvFree, U.dividendRates);
  trace.push(`Personal allowance ${fmt(pa)}${pa < U.personalAllowance ? ' (reduced by GBP 1 for every GBP 2 over 100,000)' : ''}`);
  trace.push(`Earnings and rent taxed: ${fmt(ns)} → ${fmt(nsTax)} at 20/40/45%`);
  if (savings) trace.push(`Interest ${fmt(savings)}: ${fmt(svFree)} tax-free (savings allowance ${fmt(psa)}) → ${fmt(svTax)}`);
  if (dividends) trace.push(`Dividends ${fmt(dividends)}: first 500 tax-free → ${fmt(dvTax)} at 10.75/35.75/39.35%`);
  // Capital gains: 18% within the unused basic band, 24% above.
  const g = Math.max(0, gains - U.cgt.allowance);
  const basicLeft = Math.max(0, basicTop - used);
  const cgt = Math.min(g, basicLeft) * U.cgt.basic + Math.max(0, g - basicLeft) * U.cgt.higher;
  if (gains) trace.push(`Capital gains ${fmt(gains)} less the 3,000 exemption at 18/24%: ${fmt(cgt)}`);
  return { tax: nsTax + svTax + dvTax, ani, trace, cgt };
}

function ni(wages: number, profit: number): { class1: number; class4: number } {
  const N = UK.ni;
  const band = (x: number, main: number) => Math.max(0, Math.min(x, N.upper) - N.primary) * main + Math.max(0, x - N.upper) * N.above;
  return { class1: band(wages, N.main), class4: band(profit, N.class4Main) };
}

export function unitedKingdom(h: EuHousehold): CountryTaxResult {
  const items: LineItem[] = [];
  const info: InfoItem[] = [];
  const pension = Math.min(h.retirement, UK.pensionCap, h.wages + h.selfEmployment);
  const me = personTax(Math.max(0, h.wages + h.selfEmployment + h.rental - pension), h.interest, h.dividends, h.gains);
  const partner = h.partner && h.partnerWages > 0 ? personTax(h.partnerWages, 0, 0, 0) : null;
  const myNi = ni(h.wages, h.selfEmployment);
  const partnerNi = partner ? ni(h.partnerWages, 0) : { class1: 0, class4: 0 };

  items.push({ id: 'uk-income', label: 'Income tax', category: 'income', level: 'federal', amount: me.tax + (partner?.tax ?? 0), confidence: 'high',
    note: `2026-27: 20% / 40% / 45%, personal allowance GBP 12,570 (frozen to 2031).${pension ? ` Pension contributions of ${fmt(pension)} get relief at your top rate.` : ''}${partner ? ' Each partner is taxed separately.' : ''}`,
    trace: [...me.trace, ...(partner ? [`Partner: ${fmt(partner.tax)}`] : [])] });
  if (me.cgt > 0) items.push({ id: 'uk-cgt', label: 'Capital gains tax', category: 'income', level: 'federal', amount: me.cgt, confidence: 'high', note: '18% / 24% above the GBP 3,000 annual exempt amount.' });
  items.push({ id: 'uk-ni', label: 'National Insurance', category: 'payroll', level: 'federal', amount: myNi.class1 + myNi.class4 + partnerNi.class1 + partnerNi.class4, confidence: 'high',
    note: `Employees 8% between GBP 12,570 and 50,270, 2% above${myNi.class4 ? '; self-employed (Class 4) 6% and 2%' : ''}. Not deductible from income tax, and it is part of central government (the National Insurance Fund), so it shares central borrowing.` });
  const employer = (w: number) => Math.max(0, w - UK.ni.employerThreshold) * UK.ni.employer;
  info.push({ id: 'employer', label: 'Your employer also pays (not in your rate)', amount: employer(h.wages) + employer(h.partnerWages),
    note: 'Employer National Insurance: 15% of pay above GBP 5,000.' });

  // Child benefit, clawed back by the high income child benefit charge on the higher earner's income.
  const n = kids(h);
  const benefits = [];
  if (n > 0) {
    const cb = UK.childBenefit.first + (n - 1) * UK.childBenefit.other;
    const top = Math.max(me.ani, partner?.ani ?? 0);
    const keep = Math.max(0, Math.min(1, 1 - (top - UK.childBenefit.hicbcFrom) / (UK.childBenefit.hicbcTo - UK.childBenefit.hicbcFrom)));
    if (cb * keep > 0) benefits.push({ id: 'uk-child-benefit', label: 'Child benefit (after the high income charge)', amount: cb * keep, level: 'federal' as const,
      note: `GBP 27.05 a week for the first child, 17.90 for others; ${keep < 1 ? `${Math.round((1 - keep) * 100)}% taken back by the high income child benefit charge` : 'no high income charge'}.` });
  }
  return { items, info, benefits, warnings: [] };
}
