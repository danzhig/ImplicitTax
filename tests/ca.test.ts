import { describe, expect, it } from 'vitest';
import { incomeTax, payroll, type IndividualIncome } from '../src/engine/ca/incomeTax';
import { calculate, history, PLACES } from '../src/engine';
import { deferredForLevel } from '../src/engine/fiscal';
import { DEFAULT_OPTIONS } from '../src/engine/types';
import { DEFAULT_PERSONA } from '../src/engine/personas';

const person = (employment: number, extra: Partial<IndividualIncome> = {}): IndividualIncome => ({
  employment, selfEmployment: 0, interest: 0, eligibleDividends: 0, capitalGains: 0, rental: 0,
  rrspContribution: 0, childrenCount: 0, partnerNetIncome: null, ...extra,
});

function combinedMarginal(employment: number, prov: 'AB' | 'ON' | 'BC') {
  const at = (e: number) => {
    const p = person(e);
    const pay = payroll(p);
    const t = incomeTax(p, pay, prov);
    return t.federalTax + t.provincialTax + t.healthPremium;
  };
  return (at(employment + 100) - at(employment)) / 100;
}

describe('CPP and EI (2026 maximums)', () => {
  it('caps employee contributions', () => {
    const p = payroll(person(150000));
    expect(p.cppEmployee).toBeCloseTo(4230.45, 2);
    expect(p.cpp2Employee).toBeCloseTo(416, 2);
    expect(p.ei).toBeCloseTo(1123.07, 2);
  });
  it('charges both halves to the self-employed and makes the employer half deductible', () => {
    const p = payroll(person(0, { selfEmployment: 150000 }));
    expect(p.cppSelfEmployed).toBeCloseTo(4230.45 * 2, 1);
    expect(p.cpp2SelfEmployed).toBeCloseTo(832, 1);
    expect(p.ei).toBe(0);
    // employer half (5.95%) + employee enhanced part (1%) on 71,100, plus all CPP2
    expect(p.cppDeduction).toBeCloseTo(71100 * 0.0695 + 832, 1);
  });
  it('turns contributions into income tax relief', () => {
    const p = person(80000);
    const t = incomeTax(p, payroll(p), 'ON');
    expect(t.contributionRelief).toBeGreaterThan(500);
    expect(t.contributionRelief).toBeLessThan(2000);
  });
});

describe('combined marginal income tax rates (published 2026 values)', () => {
  it('top rates', () => {
    expect(combinedMarginal(400000, 'AB')).toBeCloseTo(0.48, 3);
    expect(combinedMarginal(400000, 'ON')).toBeCloseTo(0.5353, 3);
    expect(combinedMarginal(400000, 'BC')).toBeCloseTo(0.535, 3);
  });
  it('at $95,000 (Ontario surtax not yet reached once CPP/EI credits are counted)', () => {
    expect(combinedMarginal(95000, 'AB')).toBeCloseTo(0.305, 3);
    expect(combinedMarginal(95000, 'BC')).toBeCloseTo(0.282, 3);
    expect(combinedMarginal(95000, 'ON')).toBeCloseTo(0.2965, 3);
  });
  it('at $105,000 (Ontario 20% surtax applies; BC third bracket)', () => {
    expect(combinedMarginal(105000, 'AB')).toBeCloseTo(0.305, 3);
    expect(combinedMarginal(105000, 'BC')).toBeCloseTo(0.31, 3);
    expect(combinedMarginal(105000, 'ON')).toBeCloseTo(0.205 + 0.0915 * 1.2, 3);
  });
});

describe('borrowing share', () => {
  it('scales with your taxes and the borrowing ratio', () => {
    const d = deferredForLevel({ level: 'federal', seriesId: 'CA-federal', isProxy: false }, 10000, 2020);
    expect(d.borrowRatio).not.toBeNull();
    expect(d.borrowed).toBeCloseTo(10000 * d.borrowRatio!, 6);
    expect(d.interestCost).toBeCloseTo(10000 * d.interestRatio!, 6);
    expect(d.borrowed).toBeGreaterThan(5000); // FY2020-21: net debt rose by about as much as a year of tax revenue
  });
  it('gives a credit when debt is paid down', () => {
    const d = deferredForLevel({ level: 'federal', seriesId: 'CA-federal', isProxy: false }, 10000, 2007);
    expect(d.borrowed).toBeLessThan(0);
  });
  it('uses official provincial net debt (Ontario borrowed every year since 2006)', () => {
    for (const y of [2016, 2017, 2021, 2024]) {
      const d = deferredForLevel({ level: 'provincial', seriesId: 'CA-ON', isProxy: false }, 10000, y);
      expect(d.borrowed).toBeGreaterThan(0);
    }
  });
  it('uses the audited deficit where the federal net debt series changes definition (FY2008-09)', () => {
    const d = deferredForLevel({ level: 'federal', seriesId: 'CA-federal', isProxy: false }, 10000, 2008);
    expect(d.borrowRatio).not.toBeNull();
    expect(d.source).toMatch(/Budget 2010/);
  });
  it('has a complete implicit-rate history for every city, 2000 (Singapore: FY2005) to 2024', () => {
    for (const place of PLACES) {
      const first = place.id === 'singapore' ? 2005 : 2000;
      const rows = history(DEFAULT_PERSONA, place.id, DEFAULT_OPTIONS).filter((r) => r.year <= 2024);
      expect(rows.map((r) => r.year)).toEqual(Array.from({ length: 2025 - first }, (_, i) => first + i));
      expect(rows.every((r) => r.implicit !== null)).toBe(true);
    }
  });
});

describe('full city calculation', () => {
  for (const place of PLACES) {
    it(`${place.name}: sensible totals`, () => {
      const r = calculate(DEFAULT_PERSONA, place.id, DEFAULT_OPTIONS);
      expect(r.paidNowRate).toBeGreaterThan(0.2);
      expect(r.paidNowRate).toBeLessThan(0.5);
      expect(r.implicitRate).toBeGreaterThan(r.paidNowRate - 0.15); // Norway saves oil revenue: about -10%
      const sum = r.lineItems.reduce((s, i) => s + i.amount, 0);
      expect(sum).toBeCloseTo(r.paidNow, 6);
      expect(history(DEFAULT_PERSONA, place.id, DEFAULT_OPTIONS).length).toBeGreaterThan(20);
    });
  }
});
