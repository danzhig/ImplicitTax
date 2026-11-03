// Shared types for the calculation engine. The engine is pure TypeScript with no DOM access,
// so it can run in the browser, in tests, or in a worker.

/** Which government receives the money. "social" = pre-funded pension plans (CPP), which are not
 *  part of any government's budget balance, so they are never allocated a deficit share. */
export type Level = 'federal' | 'provincial' | 'local' | 'social';

export type Category =
  | 'income' // income taxes, surtaxes, health premiums
  | 'payroll' // CPP, EI and other contributions (employee side, or both sides if self-employed)
  | 'consumption' // GST/HST/PST, fuel taxes, vehicle taxes, tariffs
  | 'property' // property tax, land transfer tax, development charges
  | 'benefit'; // cash benefits received (negative), only counted when "net of transfers" is on

export type Confidence = 'high' | 'medium' | 'low';

export interface LineItem {
  id: string;
  label: string;
  category: Category;
  level: Level;
  /** Annual amount in local currency. Positive = paid by you. */
  amount: number;
  confidence: Confidence;
  /** One-line explanation shown in the breakdown table. */
  note?: string;
  /** Step-by-step calculation trace. */
  trace?: string[];
}

/** Context numbers that are shown but never added to the implicit rate. */
export interface InfoItem {
  id: string;
  label: string;
  amount: number;
  note: string;
}

export type Tenure = 'own' | 'rent';
export type HomeType = 'apartment' | 'townhouse' | 'detached';
export type CarType = 'none' | 'gas' | 'ev';
export type Mileage = 'low' | 'average' | 'high';
export type Heating = 'gas' | 'electric' | 'heatpump' | 'oil' | 'district';

/** Everything money-related is entered in USD and converted at the place's exchange rate. */
export interface Persona {
  schemaVersion: 1;
  name: string;
  age: number;
  income: {
    employment: number;
    selfEmployment: number;
    rental: number; // net rental income
    /** When true, investment income is derived from wealth × yields. */
    deriveInvestmentIncome: boolean;
    interest: number;
    dividends: number; // treated as eligible Canadian dividends in Canada
    capitalGains: number; // realized
  };
  wealth: {
    cash: number;
    bonds: number;
    equities: number; // taxable account
    retirementAccounts: number; // tax-deferred (RRSP / 401k / pillar 3a)
    taxFreeAccounts: number; // TFSA / Roth / ISA
    otherRealEstate: number; // investment property value
  };
  household: {
    hasPartner: boolean;
    partnerEmployment: number;
    childrenUnder6: number;
    children6to17: number;
  };
  housing: {
    tenure: Tenure;
    homeValue: number;
    mortgageBalance: number;
    monthlyRent: number;
    homeType: HomeType;
    /** Spread a home purchase's one-off taxes (land transfer tax, development charges) over the holding period. */
    includePurchase: boolean;
    holdingYears: number;
    firstTimeBuyer: boolean;
    newBuild: boolean;
    foreignBuyer: boolean;
  };
  car: {
    type: CarType;
    mileage: Mileage;
    /** Purchase price of the current/next car. 0 = don't include vehicle purchase taxes. */
    purchasePrice: number;
    yearsKept: number;
  };
  heating: Heating;
  /** Share of after-tax income saved (0-0.6). */
  savingsRate: number;
  /** Annual contribution to tax-deferred retirement accounts (RRSP / 401k). */
  retirementContribution: number;
  churchMember: boolean;
}

export interface CalcOptions {
  /** Fiscal year for the deferred (borrowing) part. 'latest' = latest year available for each level. */
  year: number | 'latest';
  /** Subtract cash benefits (e.g. Canada Child Benefit) from taxes. */
  netOfTransfers: boolean;
  /** Renters pay property tax indirectly through rent. */
  rentersPayPropertyTax: boolean;
}

export const DEFAULT_OPTIONS: CalcOptions = {
  year: 'latest',
  netOfTransfers: false,
  rentersPayPropertyTax: true,
};

/** Your share of one government's borrowing and interest for one year. */
export interface LevelDeferred {
  level: Level;
  seriesId: string;
  seriesLabel: string;
  year: number | null;
  /** Taxes you pay to this level (local currency). */
  yourTaxes: number;
  /** Borrowing (increase in net debt) ÷ its tax revenue. Negative = debt paid down. */
  borrowRatio: number | null;
  /** Interest on its debt ÷ its tax revenue. */
  interestRatio: number | null;
  /** Your share of what it borrowed this year (added to your implicit rate). */
  borrowed: number;
  /** Your share of its interest bill. Already inside the taxes you pay, so never added again. */
  interestCost: number;
  /** Your share of its net debt (stock), local currency. Null if unknown. */
  debtShare: number | null;
  /** Where the borrowing figure comes from. */
  source: string | null;
  estimate: boolean;
  isProxy: boolean;
}

export interface PlaceResult {
  placeId: string;
  currency: string;
  /** Local currency per USD. */
  fx: number;
  grossIncome: number;
  lineItems: LineItem[];
  info: InfoItem[];
  warnings: string[];
  paidNow: number;
  byCategory: Record<Category, number>;
  byLevel: Record<Level, number>;
  deferred: LevelDeferred[];
  /** Your share of all governments' borrowing this year. */
  borrowed: number;
  /** Your share of all governments' interest bills (already inside paidNow). */
  interestCost: number;
  /** paidNow + borrowed */
  implicitTotal: number;
  /** implicitTotal / grossIncome */
  implicitRate: number;
  paidNowRate: number;
  /** Income left after taxes paid now (cash view). */
  disposableIncome: number;
  /** Your share of all governments' net debt, in years of your gross income. */
  debtShareYears: number | null;
}
