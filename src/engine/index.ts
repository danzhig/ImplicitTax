// Public API of the engine.

import { calculateCanada } from './ca/calculate';
import { CITIES } from './ca/params2026';
import { seriesYears } from './fiscal';
import type { CalcOptions, Persona, PlaceResult } from './types';

export * from './types';
export { FISCAL_NOTES, getSeries, seriesYears } from './fiscal';

export interface Place {
  id: string;
  name: string;
  region: string;
  country: string;
  currency: string;
  /** Fiscal series behind each level, for the history views. */
  series: { federal: string; provincial: string; local: string };
  calculate: (p: Persona, opts: CalcOptions) => PlaceResult;
}

export const PLACES: Place[] = Object.values(CITIES).map((c) => ({
  id: c.id,
  name: c.name,
  region: c.province === 'AB' ? 'Alberta' : c.province === 'ON' ? 'Ontario' : 'British Columbia',
  country: 'Canada',
  currency: 'CAD',
  series: { federal: 'CA-federal', provincial: `CA-${c.province}`, local: `CA-${c.province}-local` },
  calculate: (p, o) => calculateCanada(p, c.id, o),
}));

export const placeById = (id: string) => PLACES.find((p) => p.id === id)!;

export function calculate(persona: Persona, placeId: string, opts: CalcOptions): PlaceResult {
  return placeById(placeId).calculate(persona, opts);
}

/** Change in (taxes paid now + borrowed) per extra dollar of employment income. */
export function marginalRate(persona: Persona, placeId: string, opts: CalcOptions, stepUsd = 1000): { paidNow: number; implicit: number } {
  const a = calculate(persona, placeId, opts);
  const b = calculate({ ...persona, income: { ...persona.income, employment: persona.income.employment + stepUsd } }, placeId, opts);
  const step = b.grossIncome - a.grossIncome;
  return { paidNow: (b.paidNow - a.paidNow) / step, implicit: (b.implicitTotal - a.implicitTotal) / step };
}

export interface RateCurvePoint {
  incomeUsd: number;
  effective: number;
  effectivePaidNow: number;
  marginal: number;
}

export function rateCurve(persona: Persona, placeId: string, opts: CalcOptions, incomesUsd: number[]): RateCurvePoint[] {
  return incomesUsd.map((incomeUsd) => {
    const p = { ...persona, income: { ...persona.income, employment: incomeUsd } };
    const r = calculate(p, placeId, opts);
    const m = marginalRate(p, placeId, opts, 2000);
    return { incomeUsd, effective: r.implicitRate, effectivePaidNow: r.paidNowRate, marginal: m.implicit };
  });
}

export interface HistoryRow {
  year: number;
  /** Shares of gross income. */
  paidNow: number;
  byLevel: Record<'federal' | 'provincial' | 'local', { programs: number | null; borrowedInterest: number | null; interestFromTaxes: number | null; basis: string | null }>;
  implicit: number | null;
  debtYears: number | null;
}

/** Today's persona and tax rules, with each year's borrowing and interest ratios (docs/PLAN.md §1.4). */
export function history(persona: Persona, placeId: string, opts: CalcOptions): HistoryRow[] {
  const place = placeById(placeId);
  const years = new Set<number>();
  for (const id of Object.values(place.series)) seriesYears(id).forEach((y) => years.add(y));
  const sorted = [...years].sort((a, b) => a - b);
  return sorted.map((year) => {
    const r = calculate(persona, placeId, { ...opts, year });
    const g = r.grossIncome || 1;
    const byLevel = {} as HistoryRow['byLevel'];
    let complete = true;
    for (const lvl of ['federal', 'provincial', 'local'] as const) {
      const d = r.deferred.find((x) => x.level === lvl)!;
      const has = d.deficitRatio !== null;
      if (!has) complete = false;
      byLevel[lvl] = {
        programs: has ? d.borrowedForPrograms / g : null,
        borrowedInterest: has ? d.borrowedForInterest / g : null,
        interestFromTaxes: has ? d.interestFromTaxes / g : null,
        basis: d.basis,
      };
    }
    return { year, paidNow: r.paidNowRate, byLevel, implicit: complete ? r.implicitRate : null, debtYears: complete ? r.debtShareYears : null };
  });
}
