// Canada 2026 tax parameters. Every value lists where it came from; see data/rules/ca/RESEARCH.md.
// status: verified = confirmed by an official or several consistent sources;
//         derived  = computed from a verified value (e.g. indexation);
//         unverified = best available figure, needs checking against an official source.

import type { Bracket } from '../brackets';

export type ProvinceCode = 'AB' | 'ON' | 'BC';

export const TAX_YEAR = 2026;

/** Bank of Canada FXUSDCAD, 2026 average to Nov 2 (209 observations). */
export const FX_CAD_PER_USD = 1.388;

export const FEDERAL = {
  brackets: [
    { upTo: 58523, rate: 0.14 },
    { upTo: 117045, rate: 0.205 },
    { upTo: 181440, rate: 0.26 },
    { upTo: 258482, rate: 0.29 },
    { upTo: null, rate: 0.33 },
  ] as Bracket[],
  creditRate: 0.14,
  bpaMax: 16452,
  bpaMin: 14829,
  bpaPhaseStart: 181440,
  bpaPhaseEnd: 258482,
  employmentAmount: 1501, // unverified (2025: 1,471 indexed by 2.0%)
  dividendGrossUp: 0.38,
  dividendCredit: 0.150198, // share of the grossed-up dividend
  capitalGainsInclusion: 0.5,
  /** Federal luxury tax on vehicles over $100k: lesser of 10% of price or 20% of the excess. */
  luxuryThreshold: 100000,
};

export const CPP = {
  ympe: 74600,
  yampe: 85000,
  exemption: 3500,
  baseRate: 0.0495, // credit-eligible part of the 5.95% employee rate
  firstEnhancedRate: 0.01, // deductible part
  cpp2Rate: 0.04, // deductible
};

export const EI = { maxInsurable: 68900, rate: 0.0163, employerMultiplier: 1.4 };

export const RRSP = { rate: 0.18, limit: 33810 }; // limit: unverified

export interface ProvinceParams {
  name: string;
  brackets: Bracket[];
  creditRate: number;
  bpa: number;
  spouseAmount: number;
  dividendCredit: number; // share of grossed-up eligible dividends
  surtax?: { over: number; rate: number }[];
  /** Ontario tax reduction: reduces Ontario tax by 2 × (basic + per child) − Ontario tax. */
  onTaxReduction?: { basic: number; perChild: number };
  /** BC tax reduction credit. */
  bcTaxReduction?: { max: number; threshold: number; rate: number };
  healthPremium?: boolean;
  /** Employer health tax on large payrolls (info only). */
  employerHealthTax?: number;
}

export const PROVINCES: Record<ProvinceCode, ProvinceParams> = {
  AB: {
    name: 'Alberta',
    brackets: [
      { upTo: 61200, rate: 0.08 },
      { upTo: 154259, rate: 0.1 },
      { upTo: 185111, rate: 0.12 },
      { upTo: 246813, rate: 0.13 },
      { upTo: 370220, rate: 0.14 },
      { upTo: null, rate: 0.15 },
    ],
    creditRate: 0.08,
    bpa: 22769,
    spouseAmount: 22769,
    dividendCredit: 0.0812, // unverified
  },
  ON: {
    name: 'Ontario',
    brackets: [
      { upTo: 53891, rate: 0.0505 },
      { upTo: 107785, rate: 0.0915 },
      { upTo: 150000, rate: 0.1116 },
      { upTo: 220000, rate: 0.1216 },
      { upTo: null, rate: 0.1316 },
    ],
    creditRate: 0.0505,
    bpa: 12989,
    spouseAmount: 11029, // unverified
    dividendCredit: 0.1,
    surtax: [
      { over: 5818, rate: 0.2 },
      { over: 7446, rate: 0.36 },
    ],
    onTaxReduction: { basic: 300, perChild: 553 }, // derived (2025 indexed by 1.9%), unverified
    healthPremium: true,
    employerHealthTax: 0.0195,
  },
  BC: {
    name: 'British Columbia',
    brackets: [
      { upTo: 50363, rate: 0.056 },
      { upTo: 100728, rate: 0.077 },
      { upTo: 115648, rate: 0.105 }, // derived: 2025 threshold × 1.022
      { upTo: 140430, rate: 0.1229 }, // derived
      { upTo: 190405, rate: 0.147 }, // derived
      { upTo: 265545, rate: 0.168 }, // derived
      { upTo: null, rate: 0.205 },
    ],
    creditRate: 0.056,
    bpa: 13216,
    spouseAmount: 11317, // unverified
    dividendCredit: 0.12, // unverified
    bcTaxReduction: { max: 690, threshold: 25570, rate: 0.0356 }, // threshold derived, unverified
    employerHealthTax: 0.0195,
  },
};

/** Ontario Health Premium schedule (not indexed). Returns premium for taxable income. */
export function ontarioHealthPremium(taxable: number): number {
  if (taxable <= 20000) return 0;
  if (taxable <= 36000) return Math.min(300, 0.06 * (taxable - 20000));
  if (taxable <= 38500) return Math.min(450, 300 + 0.06 * (taxable - 36000));
  if (taxable <= 48000) return 450;
  if (taxable <= 48600) return Math.min(600, 450 + 0.25 * (taxable - 48000));
  if (taxable <= 72000) return 600;
  if (taxable <= 72600) return Math.min(750, 600 + 0.25 * (taxable - 72000));
  if (taxable <= 200000) return 750;
  if (taxable <= 200600) return Math.min(900, 750 + 0.25 * (taxable - 200000));
  return 900;
}

/** Canada Child Benefit, July 2026 - June 2027. */
export const CCB = {
  under6: 8157,
  age6to17: 6883,
  threshold1: 38237,
  threshold2: 82847,
  // reduction rates by number of children (1, 2, 3, 4+): [between thresholds, above threshold 2]
  rates: [
    [0.07, 0.032],
    [0.135, 0.057],
    [0.19, 0.08],
    [0.23, 0.095],
  ] as [number, number][],
};

export const GST = 0.05;

/** Statutory sales tax rates for big purchases (vehicles). */
export const VEHICLE_SALES_TAX: Record<ProvinceCode, (price: number) => number> = {
  AB: () => 0,
  ON: () => 0.08,
  // BC PST on passenger vehicles rises with price and applies to the whole price.
  BC: (p) => (p <= 55000 ? 0.07 : p <= 56000 ? 0.08 : p <= 57000 ? 0.09 : p <= 125000 ? 0.1 : p <= 150000 ? 0.15 : 0.2),
};

/** Fuel excise, CAD per litre of gasoline. Regular statutory rates; 2026 had temporary relief (see notes). */
export const FUEL = {
  federalPerLitre: 0.1,
  preTaxPricePerLitre: 1.05, // assumption, used only for tax-on-tax
  litresPer100km: 9.0,
  kmByMileage: { low: 8000, average: 15000, high: 25000 },
  evKwhPerKm: 0.2,
  electricityPricePerKwh: 0.15,
};

export interface CityParams {
  id: string;
  name: string;
  province: ProvinceCode;
  /** Property tax rates as a share of assessed value, split by who receives the money. */
  propertyTax: { city: number; provincial: number; regional: number };
  /** Assessed value ÷ market value. Ontario assessments still use Jan 1, 2016 values. */
  assessmentRatio: number;
  /** Fuel tax per litre: provincial and regional (e.g. TransLink). */
  fuelTax: { provincial: number; regional: number };
  /** Development charges for a new single detached home (null = not yet sourced). */
  developmentCharge: number | null;
  /** BC home owner grant (reduces provincial school tax). */
  homeOwnerGrant?: { amount: number; threshold: number; phaseOutPerThousand: number };
  sources: string[];
}

export const CITIES: Record<string, CityParams> = {
  calgary: {
    id: 'calgary',
    name: 'Calgary',
    province: 'AB',
    // Municipal 0.0038906 (Bylaw 9M2026). The City says ~42% of a residential bill goes to the
    // province, so the provincial rate is derived as 0.0038906 × 42/58.
    propertyTax: { city: 0.0038906, provincial: 0.002817, regional: 0 },
    assessmentRatio: 1,
    fuelTax: { provincial: 0.13, regional: 0 },
    developmentCharge: 9328, // 2026 off-site levy, single detached (City rate card)
    sources: ['Calgary Bylaw 9M2026', 'calgary.ca property tax changes 2026 (58% city / 42% province)', 'Calgary 2026 off-site levy rate card'],
  },
  toronto: {
    id: 'toronto',
    name: 'Toronto',
    province: 'ON',
    // 2026 residential: city 0.605295% + city building fund 0.009016% + education 0.153%
    propertyTax: { city: 0.00605295 + 0.00009016, provincial: 0.00153, regional: 0 },
    assessmentRatio: 0.85, // unverified estimate: MPAC values are still based on 2016 prices
    fuelTax: { provincial: 0.09, regional: 0 },
    developmentCharge: null,
    sources: ['toronto.ca 2026 property tax rates', 'toronto.ca MLTT rates (April 1, 2026)'],
  },
  vancouver: {
    id: 'vancouver',
    name: 'Vancouver',
    province: 'BC',
    // 2026 residential per $1,000: general 1.93406, school 0.98001, TransLink 0.35893,
    // Metro Vancouver 0.05260, BC Assessment 0.03814, MFA 0.0002 (third-party table, partly matched to council documents)
    propertyTax: { city: 0.00193406, provincial: 0.00098001, regional: 0.00035893 + 0.0000526 + 0.00003814 + 0.0000002 },
    assessmentRatio: 1,
    fuelTax: { provincial: 0.085, regional: 0.185 },
    developmentCharge: null,
    homeOwnerGrant: { amount: 570, threshold: 2150000, phaseOutPerThousand: 5 }, // threshold unverified for 2026
    sources: ['Vancouver 2026 tax rates (council documents, May 2026)', 'BC motor fuel tax: 8.5¢ provincial + 18.5¢ TransLink in Metro Vancouver'],
  },
};

/** Default assumptions used to derive investment income and spending. */
export const ASSUMPTIONS = {
  cashYield: 0.025,
  bondYield: 0.035,
  equityDividendYield: 0.02,
  equityRealizedGainRate: 0.02,
  rentalNetYield: 0.03,
  mortgageRate: 0.045,
  /** Rent ÷ value for converting rent into the property tax a landlord passes on. */
  grossRentalYield: 0.045,
  retirementFutureTaxRate: 0.3,
  homeEnergyFactor: { apartment: 0.6, townhouse: 0.9, detached: 1.2 },
};
