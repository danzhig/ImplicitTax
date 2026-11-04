// Shared pieces for the European countries. Every amount here is in local currency.

import type { HomeType, InfoItem, LineItem } from '../types';

export type EuCountry = 'DE' | 'CH' | 'UK' | 'LU' | 'IE' | 'NO' | 'DK';

/** One household, already converted to local currency. Investment income belongs to the persona. */
export interface EuHousehold {
  partner: boolean;
  wages: number;
  partnerWages: number;
  selfEmployment: number;
  interest: number;
  dividends: number;
  gains: number;
  rental: number;
  /** Voluntary retirement saving (persona), before any country cap. */
  retirement: number;
  kidsUnder6: number;
  kids6to17: number;
  age: number;
  church: boolean;
  owner: boolean;
  homeValue: number;
  mortgage: number;
  mortgageInterest: number;
  homeType: HomeType;
  /** Financial wealth outside retirement and tax-free accounts. */
  cash: number;
  bonds: number;
  equities: number;
  otherRealEstate: number;
  retirementAccounts: number;
  taxFreeAccounts: number;
}

export const kids = (h: EuHousehold) => h.kidsUnder6 + h.kids6to17;

/** A cash benefit received (shown as info, or netted when "net of cash transfers" is on). */
export interface Benefit {
  id: string;
  label: string;
  amount: number;
  level: LineItem['level'];
  note: string;
}

/** What each country's income-side module returns. */
export interface CountryTaxResult {
  items: LineItem[];
  info: InfoItem[];
  benefits: Benefit[];
  warnings: string[];
}

export const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');
export const pct = (r: number, d = 1) => `${(r * 100).toFixed(d)}%`;

/** Linear interpolation in a sorted table of [x, y] points (used for the Swiss tariff tables). */
export function interp(table: number[][], x: number, col = 1): number {
  if (x <= table[0][0]) return table[0][col];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, x1] = [table[i - 1][0], table[i][0]];
      const t = (x - x0) / (x1 - x0);
      return table[i - 1][col] + t * (table[i][col] - table[i - 1][col]);
    }
  }
  // beyond the table: extend the last slope
  const n = table.length;
  const slope = (table[n - 1][col] - table[n - 2][col]) / (table[n - 1][0] - table[n - 2][0]);
  return table[n - 1][col] + slope * (x - table[n - 1][0]);
}
