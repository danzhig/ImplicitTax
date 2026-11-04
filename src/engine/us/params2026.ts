// United States 2026 tax parameters. Sources and status: data/rules/us/RESEARCH.md.
// status notes: verified = official source (IRS Rev. Proc. 2025-32, state agencies, county tax
// offices); secondary = several consistent non-official sources; unverified = best estimate.

import type { Bracket } from '../brackets';

export type StateCode = 'NY' | 'CA' | 'WA' | 'TX';
export type Filing = 'single' | 'joint';

const b = (rows: [number | null, number][]): Bracket[] => rows.map(([upTo, rate]) => ({ upTo, rate }));

/** Federal, tax year 2026 (Rev. Proc. 2025-32 + 2025 budget law). */
export const FEDERAL = {
  brackets: {
    single: b([[12400, 0.1], [50400, 0.12], [105700, 0.22], [201775, 0.24], [256225, 0.32], [640600, 0.35], [null, 0.37]]),
    joint: b([[24800, 0.1], [100800, 0.12], [211400, 0.22], [403550, 0.24], [512450, 0.32], [768700, 0.35], [null, 0.37]]),
  },
  standardDeduction: { single: 16100, joint: 32200 },
  /** Long-term gains and qualified dividends: 0% up to the first amount, 15% up to the second, then 20%. */
  capitalGains: { single: [49450, 545500], joint: [98900, 613700] },
  childTaxCredit: 2200,
  childTaxCreditRefundable: 1700,
  ctcPhaseOut: { single: 200000, joint: 400000 }, // $50 per $1,000 above (not indexed)
  /** SALT deduction cap 2026: $40,400, reduced by 30% of income above $505,000, never below $10,000. */
  salt: { cap: 40400, threshold: 505000, rate: 0.3, floor: 10000 },
  mortgageInterestLoanLimit: 750000,
  seniorDeduction: { amount: 6000, phaseOut: { single: 75000, joint: 150000 }, rate: 0.06 }, // 2025-2028
  niit: { rate: 0.038, threshold: { single: 200000, joint: 250000 } },
  retirementLimit: 24500, // 401(k) elective deferral
};

export const FICA = {
  ssRate: 0.062,
  ssWageBase: 184500,
  medicareRate: 0.0145,
  additionalMedicare: { rate: 0.009, threshold: { single: 200000, joint: 250000 } },
  seFactor: 0.9235,
};

export interface StateParams {
  name: string;
  brackets?: Record<Filing, Bracket[]>;
  standardDeduction?: Record<Filing, number>;
  dependentExemption?: number; // NY: deduction per dependent
  exemptionCredit?: { personal: Record<Filing, number>; dependent: number }; // CA
  millionaireSurcharge?: { over: number; rate: number }; // CA Mental Health Services Tax
  capitalGainsTax?: { deduction: number; rate: number; surcharge: { over: number; rate: number } }; // WA
  payroll: { id: string; label: string; rate: number; wageCap: number | null; maxContribution?: number; note: string }[];
}

export const STATES: Record<StateCode, StateParams> = {
  NY: {
    name: 'New York',
    // 2026 rates after the 0.1-point cut to the five lowest rates (Chapter 59 of the Laws of 2025, Part A).
    brackets: {
      single: b([[8500, 0.039], [11700, 0.044], [13900, 0.0515], [80650, 0.054], [215400, 0.059], [1077550, 0.0685], [5000000, 0.0965], [25000000, 0.103], [null, 0.109]]),
      joint: b([[17150, 0.039], [23600, 0.044], [27900, 0.0515], [161550, 0.054], [323200, 0.059], [2155350, 0.0685], [5000000, 0.0965], [25000000, 0.103], [null, 0.109]]),
    },
    standardDeduction: { single: 8000, joint: 16050 },
    dependentExemption: 1000,
    payroll: [
      { id: 'ny-pfl', label: 'NY Paid Family Leave', rate: 0.00432, wageCap: null, maxContribution: 411.91, note: '0.432% of wages, at most $411.91 in 2026 (NY DFS).' },
      { id: 'ny-sdi', label: 'NY disability insurance', rate: 0.005, wageCap: null, maxContribution: 31.2, note: '0.5% of wages, at most $0.60 a week.' },
    ],
  },
  CA: {
    name: 'California',
    // 2025 FTB rate schedules: the FTB had not published 2026 indexed schedules when this was built.
    brackets: {
      single: b([[11079, 0.01], [26264, 0.02], [41452, 0.04], [57542, 0.06], [72724, 0.08], [371479, 0.093], [445771, 0.103], [742953, 0.113], [null, 0.123]]),
      joint: b([[22158, 0.01], [52528, 0.02], [82904, 0.04], [115084, 0.06], [145448, 0.08], [742958, 0.093], [891542, 0.103], [1485906, 0.113], [null, 0.123]]),
    },
    standardDeduction: { single: 5706, joint: 11412 },
    exemptionCredit: { personal: { single: 153, joint: 306 }, dependent: 475 }, // dependent credit unverified
    millionaireSurcharge: { over: 1000000, rate: 0.01 },
    payroll: [
      { id: 'ca-sdi', label: 'CA State Disability Insurance', rate: 0.013, wageCap: null, note: '1.3% of all wages in 2026, no cap (EDD).' },
    ],
  },
  WA: {
    name: 'Washington',
    capitalGainsTax: { deduction: 278000, rate: 0.07, surcharge: { over: 1000000, rate: 0.029 } }, // 2025 deduction (DOR); 2026 indexing not yet published
    payroll: [
      { id: 'wa-cares', label: 'WA Cares (long-term care)', rate: 0.0058, wageCap: null, note: '0.58% of all wages.' },
      { id: 'wa-pfml', label: 'WA Paid Family & Medical Leave', rate: 0.0113 * 0.7152, wageCap: 184500, note: 'Employee share (71.52%) of the 1.13% premium, up to the Social Security wage base (secondary sources).' },
    ],
  },
  TX: { name: 'Texas', payroll: [] },
};

/** NYC resident income tax, on New York taxable income. */
export const NYC_TAX = {
  single: b([[12000, 0.03078], [25000, 0.03762], [50000, 0.03819], [null, 0.03876]]),
  joint: b([[21600, 0.03078], [45000, 0.03762], [90000, 0.03819], [null, 0.03876]]),
};

export interface UsCityParams {
  id: string;
  name: string;
  state: StateCode;
  /** Property tax as a share of market value, split by who gets it. */
  propertyTax: { local: number; state: number; confidence: 'high' | 'medium' | 'low'; note: string };
  /** Houston: rates per taxing unit and homestead exemptions (applied to market value). */
  propertyUnits?: { name: string; rate: number; homesteadPct?: number; homesteadFlat?: number }[];
  homeownerExemption?: number; // SF: $7,000 off assessed value
  fuelTaxPerGallon: { state: number; salesTaxRate: number };
  vehicle: { salesTaxState: number; salesTaxLocal: number; annualValueTax: number; annualNote?: string };
  sources: string[];
}

export const US_CITIES: Record<string, UsCityParams> = {
  nyc: {
    id: 'nyc', name: 'New York City', state: 'NY',
    propertyTax: { local: 0.0088, state: 0, confidence: 'low',
      note: 'NYC taxes a fraction of market value through its own assessment system; published effective rates for homes range from about 0.8% to 1.2%. 0.88% is used.' },
    fuelTaxPerGallon: { state: 0.2385, salesTaxRate: 0.08875 },
    vehicle: { salesTaxState: 0.04, salesTaxLocal: 0.04875, annualValueTax: 0 },
    sources: ['NYS withholding tables 2026 (rate cuts)', 'NY DFS 2026 PFL rate'],
  },
  sf: {
    id: 'sf', name: 'San Francisco', state: 'CA',
    propertyTax: { local: 0.0118268, state: 0, confidence: 'high', note: 'FY2025-26 rate 1.18268% of assessed value (Board of Supervisors). Prop 13: assessed at purchase price, +2%/yr max.' },
    homeownerExemption: 7000,
    fuelTaxPerGallon: { state: 0.623, salesTaxRate: 0.0225 },
    vehicle: { salesTaxState: 0.039375, salesTaxLocal: 0.046875, annualValueTax: 0.0065, annualNote: 'Vehicle license fee, 0.65% of value a year (goes to local governments)' },
    sources: ['SF Board of Supervisors FY2025-26 tax rate resolution', 'FTB 2025 tax rate schedules', 'EDD 2026 SDI rate'],
  },
  seattle: {
    id: 'seattle', name: 'Seattle', state: 'WA',
    propertyTax: { local: 0.0069, state: 0.0023, confidence: 'low',
      note: 'About $9.19 per $1,000 of value in total (2025, secondary sources); roughly $2.30 of that is the state school levy.' },
    fuelTaxPerGallon: { state: 0.554, salesTaxRate: 0 },
    vehicle: { salesTaxState: 0.065 + 0.003, salesTaxLocal: 0.0405, annualValueTax: 0.011, annualNote: 'Sound Transit motor vehicle excise tax, 1.1% of value a year' },
    sources: ['WA DOR capital gains tax page (2025 deduction)', 'Seattle 10.55% sales tax from Jan 2026 (secondary)'],
  },
  houston: {
    id: 'houston', name: 'Houston', state: 'TX',
    propertyTax: { local: 0, state: 0, confidence: 'high', note: '2025 adopted rates (Harris County Tax Office; City of Houston notice).' },
    propertyUnits: [
      { name: 'City of Houston', rate: 0.0051919, homesteadPct: 0.2 },
      { name: 'Harris County', rate: 0.0038096, homesteadPct: 0.2 },
      { name: 'Harris County Flood Control', rate: 0.0004966, homesteadPct: 0.2 },
      { name: 'Harris Health (hospital district)', rate: 0.0018761, homesteadPct: 0.2 },
      { name: 'Port of Houston', rate: 0.000059, homesteadPct: 0.2 },
      { name: 'Harris County Dept. of Education', rate: 0.00004798, homesteadPct: 0.2 },
      { name: 'Houston City College', rate: 0.00098802 },
      { name: 'Houston ISD', rate: 0.008783, homesteadFlat: 140000 },
    ],
    fuelTaxPerGallon: { state: 0.2, salesTaxRate: 0 },
    vehicle: { salesTaxState: 0.0625, salesTaxLocal: 0, annualValueTax: 0 },
    sources: ['Harris County Tax Office adopted rates 2025', 'City of Houston 2025 tax rate notice'],
  },
};

export const US_ASSUMPTIONS = {
  mortgageRate: 0.0625,
  grossRentalYield: 0.05,
  preTaxGasPrice: 2.75, // USD per gallon before taxes
  litresPerGallon: 3.78541,
  /** FY2026 customs duties $173.2B (Treasury MTS) ÷ 2025 household spending excl. housing $17.06T (BEA). */
  tariffRate: 173.2 / 17056,
  evElectricityPerKwh: 0.18,
};
