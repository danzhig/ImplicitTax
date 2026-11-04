// US 2026 income and payroll taxes for one household (single, or married filing jointly).
// Order: payroll (FICA, state programs) -> state and city income tax -> federal income tax, because
// state income and property taxes are deductible federally (SALT, capped).

import { progressive } from '../brackets';
import { FEDERAL, FICA, NYC_TAX, STATES, type Filing, type StateCode } from './params2026';

export interface UsHousehold {
  filing: Filing;
  wages: number; // persona wages
  partnerWages: number;
  selfEmployment: number;
  interest: number;
  qualifiedIncome: number; // qualified dividends + long-term capital gains
  capitalGains: number; // the long-term gains part (for Washington's tax)
  rental: number;
  retirementContribution: number; // 401(k), persona only
  children: number;
  age: number;
  propertyTax: number; // owner-paid, deductible (SALT)
  mortgageInterest: number;
  state: StateCode;
  nyc: boolean;
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export interface UsPayroll {
  socialSecurity: number;
  medicare: number;
  additionalMedicare: number;
  selfEmploymentTax: number;
  halfSeDeduction: number;
  statePrograms: { id: string; label: string; amount: number; note: string }[];
  employerFica: number;
  trace: string[];
}

export function usPayroll(h: UsHousehold): UsPayroll {
  const trace: string[] = [];
  const ss = (w: number) => Math.min(w, FICA.ssWageBase) * FICA.ssRate;
  const socialSecurity = ss(h.wages) + ss(h.partnerWages);
  const medicare = (h.wages + h.partnerWages) * FICA.medicareRate;
  // Self-employment tax: both halves of FICA on 92.35% of profit; Social Security part only up to the wage base left after wages.
  const seBase = Math.max(0, h.selfEmployment) * FICA.seFactor;
  const seSs = Math.min(seBase, Math.max(0, FICA.ssWageBase - h.wages)) * FICA.ssRate * 2;
  const seMed = seBase * FICA.medicareRate * 2;
  const selfEmploymentTax = seSs + seMed;
  const addThreshold = FICA.additionalMedicare.threshold[h.filing];
  const additionalMedicare = Math.max(0, h.wages + h.partnerWages + seBase - addThreshold) * FICA.additionalMedicare.rate;
  trace.push(`Social Security 6.2% up to ${fmt(FICA.ssWageBase)} of wages per person: ${fmt(socialSecurity)}`);
  trace.push(`Medicare 1.45% of all wages: ${fmt(medicare)}${additionalMedicare ? `; +0.9% above ${fmt(addThreshold)}: ${fmt(additionalMedicare)}` : ''}`);
  if (selfEmploymentTax) trace.push(`Self-employment tax (both halves, 15.3% on 92.35% of profit): ${fmt(selfEmploymentTax)}; half is deductible`);

  const statePrograms = STATES[h.state].payroll.map((p) => {
    const base = (w: number) => (p.wageCap === null ? w : Math.min(w, p.wageCap));
    const per = (w: number) => {
      const amt = base(w) * p.rate;
      return p.maxContribution ? Math.min(amt, p.maxContribution) : amt;
    };
    return { id: p.id, label: p.label, amount: per(h.wages) + per(h.partnerWages), note: p.note };
  });
  return {
    socialSecurity, medicare, additionalMedicare, selfEmploymentTax, halfSeDeduction: selfEmploymentTax / 2,
    statePrograms, employerFica: socialSecurity + medicare, trace,
  };
}

export interface UsIncomeTax {
  agi: number;
  federalTax: number;
  childCredit: number;
  niit: number;
  stateTax: number;
  cityTax: number;
  itemized: boolean;
  saltDeducted: number;
  federalTrace: string[];
  stateTrace: string[];
}

/** New York "tax benefit recapture": once income passes $107,650 the benefit of the lower brackets
 *  is phased out over the next $50,000, so higher earners pay a flat rate on all their income.
 *  Above the 9.65%, 10.3% and 10.9% thresholds the same happens again. This approximates the
 *  official recapture tables (exact to within a few dollars at most incomes). */
function nyRecapture(taxable: number, agi: number, filing: Filing, bracketTax: number): number {
  if (agi <= 107650) return bracketTax;
  const br = STATES.NY.brackets![filing];
  const t5 = br[4].upTo as number; // top of the 5.9% bracket
  const t6 = br[5].upTo as number; // top of the 6.85% bracket
  const phase = (from: number) => Math.min(1, Math.max(0, (agi - from) / 50000));
  // Step 1: above $107,650 of AGI, income below the 5.9% bracket loses its lower rates (phased in over $50,000).
  const flatLow = 0.059 * Math.min(taxable, t5) + progressive(taxable, br) - progressive(Math.min(taxable, t5), br);
  let tax = bracketTax + phase(107650) * (Math.max(bracketTax, flatLow) - bracketTax);
  // Step 2: above the top of each bracket, the whole income moves to the next rate (6.85%, 9.65%, 10.3%, 10.9%).
  for (const [from, rate] of [[t5, 0.0685], [t6, 0.0965], [5000000, 0.103], [25000000, 0.109]] as [number, number][]) {
    if (agi > from) tax = tax + phase(from) * (Math.max(tax, rate * taxable) - tax);
  }
  return tax;
}

export function usIncomeTax(h: UsHousehold, pay: UsPayroll): UsIncomeTax {
  const F = FEDERAL;
  const filing = h.filing;
  const retirement = Math.min(h.retirementContribution, F.retirementLimit, h.wages);
  const agi = Math.max(0, h.wages + h.partnerWages + h.selfEmployment - pay.halfSeDeduction + h.interest + h.qualifiedIncome + h.rental - retirement);
  const kids = h.children;
  const ft: string[] = [];
  const st: string[] = [];

  // ---------- State and city income tax ----------
  let stateTax = 0;
  let cityTax = 0;
  const S = STATES[h.state];
  if (h.state === 'NY' || h.state === 'CA') {
    const itemizedState = h.mortgageInterest + h.propertyTax; // no deduction for state income tax itself
    const std = S.standardDeduction![filing];
    const ded = Math.max(std, itemizedState) + (S.dependentExemption ?? 0) * kids;
    const taxable = Math.max(0, agi - ded);
    let tax = progressive(taxable, S.brackets![filing]);
    st.push(`${S.name} taxable income ${fmt(taxable)} (${itemizedState > std ? 'itemized mortgage interest + property tax' : `standard deduction ${fmt(std)}`})`);
    if (h.state === 'NY') {
      const recaptured = nyRecapture(taxable, agi, filing, tax);
      if (recaptured > tax + 1) st.push(`High-income recapture of the lower brackets: +${fmt(recaptured - tax)}`);
      tax = recaptured;
      if (h.nyc) {
        cityTax = progressive(taxable, NYC_TAX[filing]);
        st.push(`New York City income tax 3.078%-3.876%: ${fmt(cityTax)}`);
      }
    }
    if (S.exemptionCredit) {
      const credit = S.exemptionCredit.personal[filing] + S.exemptionCredit.dependent * kids;
      tax = Math.max(0, tax - credit);
      st.push(`Exemption credits: -${fmt(credit)}`);
    }
    if (S.millionaireSurcharge && taxable > S.millionaireSurcharge.over) {
      const s = (taxable - S.millionaireSurcharge.over) * S.millionaireSurcharge.rate;
      tax += s;
      st.push(`Mental Health Services Tax (1% over $1M): ${fmt(s)}`);
    }
    stateTax = tax;
    st.push(`${S.name} income tax: ${fmt(stateTax)}`);
  } else if (S.capitalGainsTax) {
    const c = S.capitalGainsTax;
    stateTax = Math.max(0, h.capitalGains - c.deduction) * c.rate + Math.max(0, h.capitalGains - c.surcharge.over) * c.surcharge.rate;
    st.push(stateTax > 0
      ? `Washington capital gains tax: 7% of gains over ${fmt(c.deduction)} (+2.9% over $1M): ${fmt(stateTax)}`
      : `Washington has no tax on wages; its 7% capital gains tax starts above ${fmt(c.deduction)} of gains.`);
  } else {
    st.push('Texas has no personal income tax.');
  }

  // ---------- Federal ----------
  const saltCap = Math.max(F.salt.floor, F.salt.cap - Math.max(0, agi - F.salt.threshold) * F.salt.rate);
  const saltPaid = stateTax + cityTax + h.propertyTax;
  const saltDeducted = Math.min(saltPaid, saltCap);
  const itemized = saltDeducted + h.mortgageInterest;
  const std = F.standardDeduction[filing];
  const useItemized = itemized > std;
  let deduction = Math.max(std, itemized);
  if (h.age >= 65) {
    const persons = filing === 'joint' ? 1 : 1; // partner age is not asked; count the persona only
    const senior = Math.max(0, F.seniorDeduction.amount * persons - Math.max(0, agi - F.seniorDeduction.phaseOut[filing]) * F.seniorDeduction.rate);
    deduction += senior;
    if (senior) ft.push(`Senior deduction (65+): ${fmt(senior)}`);
  }
  const taxable = Math.max(0, agi - deduction);
  const pref = Math.min(taxable, h.qualifiedIncome);
  const ordinary = taxable - pref;
  const ordTax = progressive(ordinary, F.brackets[filing]);
  const [zeroTop, fifteenTop] = F.capitalGains[filing];
  const at0 = Math.max(0, Math.min(pref, zeroTop - ordinary));
  const at15 = Math.max(0, Math.min(pref - at0, fifteenTop - Math.max(ordinary, zeroTop)));
  const at20 = pref - at0 - at15;
  const prefTax = at15 * 0.15 + at20 * 0.2;
  ft.push(`AGI ${fmt(agi)} (after ${fmt(retirement)} 401(k) and half of self-employment tax)`);
  ft.push(useItemized
    ? `Itemized: state/local taxes ${fmt(saltDeducted)} (cap ${fmt(saltCap)} of ${fmt(saltPaid)} paid) + mortgage interest ${fmt(h.mortgageInterest)}`
    : `Standard deduction ${fmt(std)}${saltPaid > 0 ? ` (state/local taxes ${fmt(saltPaid)} do not beat it)` : ''}`);
  ft.push(`Tax on ${fmt(ordinary)} ordinary income (10%-37%): ${fmt(ordTax)}${pref ? `; dividends/gains ${fmt(pref)} at 0/15/20%: ${fmt(prefTax)}` : ''}`);
  let tax = ordTax + prefTax;

  // Child tax credit: $2,200 per child, phased out $50 per $1,000 above the threshold; up to $1,700 refundable.
  let childCredit = 0;
  if (kids > 0) {
    const full = kids * F.childTaxCredit;
    const reduce = Math.ceil(Math.max(0, agi - F.ctcPhaseOut[filing]) / 1000) * 50;
    const allowed = Math.max(0, full - reduce);
    const nonRef = Math.min(allowed, tax);
    const earned = h.wages + h.partnerWages + h.selfEmployment;
    const refundable = Math.min(allowed - nonRef, kids * F.childTaxCreditRefundable, Math.max(0, 0.15 * (earned - 2500)));
    childCredit = nonRef + refundable;
    tax -= childCredit;
    ft.push(`Child tax credit: -${fmt(childCredit)}`);
  }
  const nii = h.interest + h.qualifiedIncome + h.rental;
  const niit = Math.max(0, Math.min(nii, agi - F.niit.threshold[filing])) * F.niit.rate;
  if (niit) ft.push(`Net investment income tax 3.8%: ${fmt(niit)}`);
  ft.push(`Federal income tax: ${fmt(tax + niit)}`);

  return { agi, federalTax: tax + niit, childCredit, niit, stateTax, cityTax, itemized: useItemized, saltDeducted, federalTrace: ft, stateTrace: st };
}
