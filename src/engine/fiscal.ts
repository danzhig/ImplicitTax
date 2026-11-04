// Turns a government's yearly fiscal numbers into your personal share (docs/PLAN.md §1).
//
//   borrowRatio   = borrowing / taxRevenue    (borrowing = increase in net debt; negative = paid down)
//   interestRatio = interest / taxRevenue
//   borrowed      = yourTaxes × borrowRatio   -> added to your implicit rate
//   interestCost  = yourTaxes × interestRatio -> already inside the taxes you pay; shown separately
//   debtShare     = yourTaxes × netDebt / taxRevenue
//
// "Your share" = your share of that government's tax revenue (tax-share method, decision D4).

import caFiscal from '../../data/fiscal/ca.json';
import usFiscal from '../../data/fiscal/us.json';
import euFiscal from '../../data/fiscal/eu.json';
import type { Level, LevelDeferred } from './types';

export interface FiscalYear {
  taxes: number | null;
  interest: number | null;
  borrowing: number | null;
  netDebt: number | null;
  borrowingSource: string | null;
  status: 'actual' | 'estimate' | string;
  notes?: string[];
}

export interface FiscalSeries {
  label: string;
  years: Record<string, FiscalYear>;
}

const SERIES: Record<string, FiscalSeries> = {
  ...(caFiscal.series as unknown as Record<string, FiscalSeries>),
  ...(usFiscal.series as unknown as Record<string, FiscalSeries>),
  ...(euFiscal.series as unknown as Record<string, FiscalSeries>),
};

export const FISCAL_NOTES: Record<'CA' | 'US' | 'EU', string[]> = { CA: [...caFiscal.notes], US: [...usFiscal.notes], EU: [...euFiscal.notes] };

export function getSeries(id: string): FiscalSeries | undefined {
  return SERIES[id];
}

export function seriesYears(id: string): number[] {
  const s = SERIES[id];
  return s ? Object.keys(s.years).map(Number).sort((a, b) => a - b) : [];
}

const usable = (y?: FiscalYear) => !!y && y.borrowing !== null && !!y.taxes;

/** Latest year with actual (not estimated) borrowing and tax data. */
export function latestYear(id: string): number | null {
  const s = SERIES[id];
  const ys = seriesYears(id).filter((y) => usable(s.years[y]) && s.years[y].status === 'actual');
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
  const base: LevelDeferred = {
    level: link.level,
    seriesId: link.seriesId,
    seriesLabel: s?.label ?? link.seriesId,
    year: usable(fy) ? y : null,
    yourTaxes,
    borrowRatio: null,
    interestRatio: null,
    borrowed: 0,
    interestCost: 0,
    debtShare: null,
    source: fy?.borrowingSource ?? null,
    estimate: fy?.status === 'estimate',
    isProxy: link.isProxy,
  };
  if (!fy || !usable(fy)) return base;
  const borrowRatio = fy.borrowing! / fy.taxes!;
  const interestRatio = fy.interest !== null ? fy.interest / fy.taxes! : null;
  return {
    ...base,
    borrowRatio,
    interestRatio,
    borrowed: yourTaxes * borrowRatio,
    interestCost: interestRatio === null ? 0 : yourTaxes * interestRatio,
    debtShare: fy.netDebt === null ? null : (yourTaxes * fy.netDebt) / fy.taxes!,
  };
}

/** Your share of a government's net debt in a given year, using your share of its LATEST tax revenue.
 *  Holding your share fixed shows how the debt itself has grown, in nominal dollars. */
export function debtShareAtFixedShare(seriesId: string, yourTaxes: number, year: number): number | null {
  const s = SERIES[seriesId];
  const ly = latestYear(seriesId);
  if (!s || ly === null) return null;
  const nd = s.years[String(year)]?.netDebt;
  const taxesNow = s.years[String(ly)].taxes!;
  return nd === null || nd === undefined ? null : (yourTaxes * nd) / taxesNow;
}
