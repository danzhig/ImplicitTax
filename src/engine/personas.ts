import type { Persona } from './types';

export const DEFAULT_PERSONA: Persona = {
  schemaVersion: 1,
  name: 'Mid-career professional',
  age: 38,
  income: {
    employment: 110000,
    selfEmployment: 0,
    rental: 0,
    deriveInvestmentIncome: true,
    interest: 0,
    dividends: 0,
    capitalGains: 0,
  },
  wealth: {
    cash: 20000,
    bonds: 0,
    equities: 60000,
    retirementAccounts: 120000,
    taxFreeAccounts: 40000,
    otherRealEstate: 0,
  },
  household: { hasPartner: false, partnerEmployment: 0, childrenUnder6: 0, children6to17: 0 },
  housing: {
    tenure: 'own',
    homeValue: 550000,
    mortgageBalance: 350000,
    monthlyRent: 2000,
    homeType: 'townhouse',
    includePurchase: true,
    holdingYears: 10,
    firstTimeBuyer: false,
    newBuild: false,
    foreignBuyer: false,
  },
  car: { type: 'gas', mileage: 'average', purchasePrice: 35000, yearsKept: 8 },
  heating: 'gas',
  savingsRate: 0.1,
  retirementContribution: 10000,
  churchMember: false,
};

/** Fill in any fields missing from an older or hand-edited persona. */
export function normalizePersona(p: Partial<Persona> | undefined): Persona {
  const d = DEFAULT_PERSONA;
  if (!p) return structuredClone(d);
  return {
    ...d,
    ...p,
    schemaVersion: 1,
    income: { ...d.income, ...(p.income ?? {}) },
    wealth: { ...d.wealth, ...(p.wealth ?? {}) },
    household: { ...d.household, ...(p.household ?? {}) },
    housing: { ...d.housing, ...(p.housing ?? {}) },
    car: { ...d.car, ...(p.car ?? {}) },
  };
}
