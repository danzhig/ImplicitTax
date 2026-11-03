export interface Bracket {
  /** Upper bound of this bracket (null = no upper bound). */
  upTo: number | null;
  rate: number;
}

/** Tax on `income` under progressive brackets. */
export function progressive(income: number, brackets: Bracket[]): number {
  let tax = 0;
  let lower = 0;
  for (const b of brackets) {
    if (income <= lower) break;
    const upper = b.upTo ?? Infinity;
    tax += (Math.min(income, upper) - lower) * b.rate;
    lower = upper;
  }
  return tax;
}

/** Marginal bracket rate at `income`. */
export function bracketRate(income: number, brackets: Bracket[]): number {
  for (const b of brackets) if (b.upTo === null || income <= b.upTo) return b.rate;
  return brackets[brackets.length - 1].rate;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const round2 = (v: number) => Math.round(v * 100) / 100;
