// Turns a government's yearly fiscal numbers into your personal share (docs/PLAN.md §1.1, §1.4).
//
//   deficitRatio  = −balance / taxRevenue     (positive = deficit)
//   interestRatio =  interest / taxRevenue
//   D (borrowed interest)      = yourTaxes × min(max(deficitRatio, 0), interestRatio)
//   C (interest paid by taxes) = yourTaxes × interestRatio − D
//   B (borrowed for programs)  = yourTaxes × deficitRatio − D   (negative in surplus years)
//
// Interest counts as borrowed first (primary-balance convention), so in a year where a
// government borrows less than its interest bill, all of the borrowing is "compounding".

import caFiscal from '../../data/fiscal/ca.json';
import type { Level, LevelDeferred } from './types';

export interface FiscalYear {
  revenue: number;
  taxes: number;
  interest: number | null;
  balance: number | null;
  netFinancialWorth?: number | null;
  basis: string;
  status: string;
  table: string;
}

export interface FiscalSeries {
  label: string;
  years: Record<string, FiscalYear>;
}

const SERIES: Record<string, FiscalSeries> = {
  ...(caFiscal.series as unknown as Record<string, FiscalSeries>),
};

export const FISCAL_NOTES: string[] = [...caFiscal.notes];

export function getSeries(id: string): FiscalSeries | undefined {
  return SERIES[id];
}

export function seriesYears(id: string): number[] {
  const s = SERIES[id];
  return s ? Object.keys(s.years).map(Number).sort((a, b) => a - b) : [];
}

export function latestYear(id: string): number | null {
  const ys = seriesYears(id).filter((y) => SERIES[id].years[y].balance !== null);
  return ys.length ? ys[ys.length - 1] : null;
}

export interface LevelLink {
  level: Level;
  seriesId: string;
  /** True when the series stands in for this place (e.g. all municipalities in the province for one city). */
  isProxy: boolean;
}

export function deferredForLevel(link: LevelLink, yourTaxes: number, year: number | 'latest'): LevelDeferred {
  const s = SERIES[link.seriesId];
  const y = year === 'latest' ? latestYear(link.seriesId) : year;
  const fy = s && y !== null ? s.years[String(y)] : undefined;
  const empty: LevelDeferred = {
    level: link.level,
    seriesId: link.seriesId,
    seriesLabel: s?.label ?? link.seriesId,
    year: fy ? y : null,
    yourTaxes,
    deficitRatio: null,
    interestRatio: null,
    borrowedForPrograms: 0,
    interestFromTaxes: 0,
    borrowedForInterest: 0,
    debtShare: null,
    basis: fy?.basis ?? null,
    isProxy: link.isProxy,
  };
  if (!fy || fy.balance === null || fy.interest === null || !fy.taxes) return empty;

  const deficitRatio = -fy.balance / fy.taxes;
  const interestRatio = fy.interest / fy.taxes;
  const D = yourTaxes * Math.min(Math.max(deficitRatio, 0), interestRatio);
  const C = yourTaxes * interestRatio - D;
  const B = yourTaxes * deficitRatio - D;
  const nfw = fy.netFinancialWorth;
  return {
    ...empty,
    deficitRatio,
    interestRatio,
    borrowedForPrograms: B,
    interestFromTaxes: C,
    borrowedForInterest: D,
    debtShare: nfw === null || nfw === undefined ? null : yourTaxes * (-nfw / fy.taxes),
  };
}
