// Combines line items and the deferred (borrowing) shares into a PlaceResult.

import type { Category, InfoItem, Level, LevelDeferred, LineItem, PlaceResult } from './types';

const CATEGORIES: Category[] = ['income', 'payroll', 'consumption', 'property', 'benefit'];
const LEVELS: Level[] = ['federal', 'provincial', 'local', 'social'];

export interface AssembleInput {
  placeId: string;
  currency: string;
  fx: number;
  grossIncome: number;
  items: LineItem[];
  info: InfoItem[];
  warnings: string[];
  /** Given the taxes you pay to each level, return your share of each level's borrowing. */
  deferred: (taxesByLevel: Record<Level, number>) => LevelDeferred[];
}

export function assembleResult(a: AssembleInput): PlaceResult {
  const items = a.items.filter((i) => Math.abs(i.amount) > 0.005);
  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  const byLevel = Object.fromEntries(LEVELS.map((l) => [l, 0])) as Record<Level, number>;
  // Taxes paid to each level, before benefits: the base for allocating that level's borrowing.
  const taxesByLevel = Object.fromEntries(LEVELS.map((l) => [l, 0])) as Record<Level, number>;
  for (const i of items) {
    byCategory[i.category] += i.amount;
    byLevel[i.level] += i.amount;
    if (i.category !== 'benefit') taxesByLevel[i.level] += i.amount;
  }
  const paidNow = items.reduce((s, i) => s + i.amount, 0);
  const deferred = a.deferred(taxesByLevel);
  const sum = (f: (d: LevelDeferred) => number) => deferred.reduce((s, d) => s + f(d), 0);
  const B = sum((d) => d.borrowedForPrograms);
  const C = sum((d) => d.interestFromTaxes);
  const D = sum((d) => d.borrowedForInterest);
  const implicitTotal = paidNow + B + D;
  const debtKnown = deferred.every((d) => d.debtShare !== null) ? deferred : [];
  const g = a.grossIncome;
  return {
    placeId: a.placeId,
    currency: a.currency,
    fx: a.fx,
    grossIncome: g,
    lineItems: items,
    info: a.info,
    warnings: a.warnings,
    paidNow,
    byCategory,
    byLevel,
    deferred,
    borrowedForPrograms: B,
    interestFromTaxes: C,
    borrowedForInterest: D,
    implicitTotal,
    implicitRate: g > 0 ? implicitTotal / g : 0,
    paidNowRate: g > 0 ? paidNow / g : 0,
    disposableIncome: g - paidNow,
    debtShareYears: g > 0 && debtKnown.length ? debtKnown.reduce((s, d) => s + (d.debtShare ?? 0), 0) / g : null,
  };
}
