// Canadian personal income tax, CPP and EI for one individual, 2026 rules.
// Order of calculation (see docs/PLAN.md §4.1):
//   1. CPP / CPP2 / EI contributions
//   2. contributions -> deductions (enhanced CPP, CPP2, employer half if self-employed) and credit bases (base CPP, EI)
//   3. federal and provincial tax: brackets -> non-refundable credits -> dividend tax credit -> surtax / premium / reductions

import { progressive, clamp } from '../brackets';
import { CPP, EI, FEDERAL, PROVINCES, RRSP, ontarioHealthPremium, type ProvinceCode } from './params2026';

export interface IndividualIncome {
  employment: number;
  selfEmployment: number;
  interest: number;
  eligibleDividends: number; // actual (not grossed-up)
  capitalGains: number; // realized
  rental: number;
  rrspContribution: number;
  childrenCount: number; // for the Ontario tax reduction
  /** Partner's net income, if this person claims the spouse amount. null = no partner. */
  partnerNetIncome: number | null;
}

export interface Payroll {
  cppEmployee: number; // CPP1 (5.95%) on employment income
  cpp2Employee: number;
  cppSelfEmployed: number; // both halves (11.9%) on self-employment income
  cpp2SelfEmployed: number; // both halves (8%)
  ei: number;
  /** Credit base for the base-CPP credit (employee base part). */
  cppCreditBase: number;
  /** Deduction from income: enhanced CPP + CPP2 + employer half if self-employed. */
  cppDeduction: number;
  employerCpp: number;
  employerEi: number;
  trace: string[];
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-CA');

export function payroll(inc: IndividualIncome): Payroll {
  const trace: string[] = [];
  const E = Math.max(0, inc.employment);
  const S = Math.max(0, inc.selfEmployment);
  const fullRate = CPP.baseRate + CPP.firstEnhancedRate; // 5.95%

  // CPP1 on employment income, then self-employment fills any remaining room up to the YMPE.
  const empPensionable = clamp(Math.min(E, CPP.ympe) - CPP.exemption, 0, Infinity);
  const cppEmployee = empPensionable * fullRate;
  // Self-employed room: earnings between max(E, exemption) and YMPE.
  const seBase = clamp(Math.min(E + S, CPP.ympe) - Math.max(E, CPP.exemption), 0, Infinity);
  const cppSelfEmployed = seBase * fullRate * 2;

  // CPP2 between YMPE and YAMPE.
  const emp2 = clamp(Math.min(E, CPP.yampe) - CPP.ympe, 0, Infinity);
  const cpp2Employee = emp2 * CPP.cpp2Rate;
  const se2 = clamp(Math.min(E + S, CPP.yampe) - Math.max(E, CPP.ympe), 0, Infinity);
  const cpp2SelfEmployed = se2 * CPP.cpp2Rate * 2;

  const ei = Math.min(E, EI.maxInsurable) * EI.rate;

  // Employee base part (4.95 of 5.95) earns a credit; the enhanced part and CPP2 are deductions.
  const cppCreditBase = (empPensionable + seBase) * CPP.baseRate;
  const cppDeduction =
    empPensionable * CPP.firstEnhancedRate +
    cpp2Employee +
    // self-employed: employer half (base + enhanced) is deductible, plus the employee enhanced part
    seBase * (fullRate + CPP.firstEnhancedRate) +
    cpp2SelfEmployed;

  if (cppEmployee > 0) trace.push(`CPP: 5.95% × (${fmt(Math.min(E, CPP.ympe))} − ${fmt(CPP.exemption)}) = ${fmt(cppEmployee)}`);
  if (cpp2Employee > 0) trace.push(`CPP2: 4% × (${fmt(Math.min(E, CPP.yampe))} − ${fmt(CPP.ympe)}) = ${fmt(cpp2Employee)}`);
  if (cppSelfEmployed > 0) trace.push(`Self-employed CPP, both halves: 11.9% × ${fmt(seBase)} = ${fmt(cppSelfEmployed)}`);
  if (cpp2SelfEmployed > 0) trace.push(`Self-employed CPP2, both halves: 8% × ${fmt(se2)} = ${fmt(cpp2SelfEmployed)}`);
  if (ei > 0) trace.push(`EI: 1.63% × ${fmt(Math.min(E, EI.maxInsurable))} = ${fmt(ei)}`);
  trace.push(`Credit base (base CPP + EI): ${fmt(cppCreditBase)} + ${fmt(ei)}; deductible CPP: ${fmt(cppDeduction)}`);

  return {
    cppEmployee,
    cpp2Employee,
    cppSelfEmployed,
    cpp2SelfEmployed,
    ei,
    cppCreditBase,
    cppDeduction,
    employerCpp: cppEmployee + cpp2Employee,
    employerEi: ei * EI.employerMultiplier,
    trace,
  };
}

export interface IncomeTaxResult {
  netIncome: number;
  taxableIncome: number;
  federalTax: number;
  provincialTax: number; // incl. surtax, before health premium
  healthPremium: number;
  /** Value of the credits that come from CPP and EI (both levels) - the "tax back" from contributions. */
  contributionRelief: number;
  federalTrace: string[];
  provincialTrace: string[];
}

export function incomeTax(inc: IndividualIncome, pay: Payroll, prov: ProvinceCode): IncomeTaxResult {
  const actual = taxCore(inc, pay.cppCreditBase, pay.ei, pay.cppDeduction, prov);
  // What income tax would be if CPP/EI gave no credits or deductions: the difference is the
  // "tax back" from contributions, shown next to each contribution in the breakdown.
  const without = taxCore(inc, 0, 0, 0, prov);
  const total = (r: CoreResult) => r.federalTax + r.provincialTax + r.healthPremium;
  return { ...actual, contributionRelief: Math.max(0, total(without) - total(actual)) };
}

type CoreResult = Omit<IncomeTaxResult, 'contributionRelief'>;

function taxCore(inc: IndividualIncome, cppCreditBase: number, eiCredit: number, cppDeduction: number, prov: ProvinceCode): CoreResult {
  const P = PROVINCES[prov];
  const grossedUp = inc.eligibleDividends * (1 + FEDERAL.dividendGrossUp);
  const earned = inc.employment + inc.selfEmployment + inc.rental;
  const rrsp = Math.max(0, Math.min(inc.rrspContribution, RRSP.rate * earned, RRSP.limit));
  const totalIncome =
    inc.employment + inc.selfEmployment + inc.interest + grossedUp + inc.capitalGains * FEDERAL.capitalGainsInclusion + inc.rental;
  const netIncome = Math.max(0, totalIncome - cppDeduction - rrsp);
  const taxable = netIncome;

  // ---------- Federal ----------
  const ft: string[] = [];
  const fedBasic = progressive(taxable, FEDERAL.brackets);
  ft.push(`Taxable income ${fmt(taxable)} (dividends grossed up 38%, half of capital gains; minus deductible CPP ${fmt(cppDeduction)} and RRSP ${fmt(rrsp)})`);
  ft.push(`Tax on brackets (14% → 33%): ${fmt(fedBasic)}`);
  const bpaShare = clamp((taxable - FEDERAL.bpaPhaseStart) / (FEDERAL.bpaPhaseEnd - FEDERAL.bpaPhaseStart), 0, 1);
  const fedBpa = FEDERAL.bpaMax - bpaShare * (FEDERAL.bpaMax - FEDERAL.bpaMin);
  const fedSpouse = inc.partnerNetIncome === null ? 0 : Math.max(0, fedBpa - inc.partnerNetIncome);
  const employmentAmt = Math.min(inc.employment, FEDERAL.employmentAmount);
  const fedCredits = (fedBpa + fedSpouse + employmentAmt + cppCreditBase + eiCredit) * FEDERAL.creditRate;
  const fedDtc = grossedUp * FEDERAL.dividendCredit;
  const federalTax = Math.max(0, fedBasic - fedCredits - fedDtc);
  ft.push(
    `Credits × 14%: basic ${fmt(fedBpa)}${fedSpouse ? ` + spouse ${fmt(fedSpouse)}` : ''} + employment ${fmt(employmentAmt)} + base CPP ${fmt(cppCreditBase)} + EI ${fmt(eiCredit)} → −${fmt(fedCredits)}`,
  );
  if (fedDtc) ft.push(`Dividend tax credit: −${fmt(fedDtc)}`);
  ft.push(`Federal income tax: ${fmt(federalTax)}`);

  // ---------- Provincial ----------
  const pt: string[] = [];
  const provBasic = progressive(taxable, P.brackets);
  pt.push(`Tax on ${P.name} brackets: ${fmt(provBasic)}`);
  const provSpouse = inc.partnerNetIncome === null ? 0 : Math.max(0, P.spouseAmount - inc.partnerNetIncome);
  const provCredits = (P.bpa + provSpouse + cppCreditBase + eiCredit) * P.creditRate;
  const provDtc = grossedUp * P.dividendCredit;
  let provTax = Math.max(0, provBasic - provCredits - provDtc);
  pt.push(`Credits × ${(P.creditRate * 100).toFixed(2)}%: basic ${fmt(P.bpa)}${provSpouse ? ` + spouse ${fmt(provSpouse)}` : ''} + base CPP + EI → −${fmt(provCredits)}`);
  if (provDtc) pt.push(`Dividend tax credit: −${fmt(provDtc)}`);

  if (P.surtax) {
    const before = provTax;
    const surtax = P.surtax.reduce((sum, t) => sum + Math.max(0, before - t.over) * t.rate, 0);
    if (surtax > 0) pt.push(`Ontario surtax (20% of tax over ${fmt(P.surtax[0].over)}, +36% over ${fmt(P.surtax[1].over)}): ${fmt(surtax)}`);
    provTax += surtax;
  }
  if (P.onTaxReduction) {
    const red = Math.max(0, 2 * (P.onTaxReduction.basic + P.onTaxReduction.perChild * inc.childrenCount) - provTax);
    const used = Math.min(red, provTax);
    if (used > 0) pt.push(`Ontario tax reduction: −${fmt(used)}`);
    provTax -= used;
  }
  if (P.bcTaxReduction) {
    const r = P.bcTaxReduction;
    const red = Math.max(0, r.max - Math.max(0, netIncome - r.threshold) * r.rate);
    const used = Math.min(red, provTax);
    if (used > 0) pt.push(`BC tax reduction: −${fmt(used)}`);
    provTax -= used;
  }
  pt.push(`${P.name} income tax: ${fmt(provTax)}`);

  const healthPremium = P.healthPremium ? ontarioHealthPremium(taxable) : 0;
  return { netIncome, taxableIncome: taxable, federalTax, provincialTax: provTax, healthPremium, federalTrace: ft, provincialTrace: pt };
}
