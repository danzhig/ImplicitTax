import { describe, expect, it } from 'vitest';
import { usIncomeTax, usPayroll, type UsHousehold } from '../src/engine/us/incomeTax';
import { calculate, history, PLACES } from '../src/engine';
import { DEFAULT_OPTIONS } from '../src/engine/types';
import { DEFAULT_PERSONA } from '../src/engine/personas';

const hh = (wages: number, extra: Partial<UsHousehold> = {}): UsHousehold => ({
  filing: 'single', wages, partnerWages: 0, selfEmployment: 0, interest: 0, qualifiedIncome: 0, capitalGains: 0, rental: 0,
  retirementContribution: 0, children: 0, age: 40, propertyTax: 0, mortgageInterest: 0, state: 'TX', nyc: false, ...extra,
});
const tax = (h: UsHousehold) => usIncomeTax(h, usPayroll(h));

describe('US federal (2026)', () => {
  it('taxes $100k of single wages after the $16,100 standard deduction', () => {
    expect(tax(hh(100000)).federalTax).toBeCloseTo(1240 + 4560 + 7370, 0);
  });
  it('caps Social Security at the $184,500 wage base and adds 0.9% Medicare over $200k', () => {
    const p = usPayroll(hh(300000));
    expect(p.socialSecurity).toBeCloseTo(11439, 0);
    expect(p.medicare).toBeCloseTo(4350, 0);
    expect(p.additionalMedicare).toBeCloseTo(900, 0);
  });
  it('charges both FICA halves to the self-employed and deducts half', () => {
    const p = usPayroll(hh(0, { selfEmployment: 100000 }));
    expect(p.selfEmploymentTax).toBeCloseTo(100000 * 0.9235 * 0.153, 0);
    expect(p.halfSeDeduction).toBeCloseTo(p.selfEmploymentTax / 2, 5);
  });
  it('gives the $2,200 child tax credit', () => {
    expect(tax(hh(100000)).federalTax - tax(hh(100000, { children: 2 })).federalTax).toBeCloseTo(4400, 0);
  });
  it('taxes dividends and gains at 15% in the middle band', () => {
    const base = tax(hh(100000)).federalTax;
    expect(tax(hh(100000, { qualifiedIncome: 10000 })).federalTax - base).toBeCloseTo(1500, 0);
  });
});

describe('US states', () => {
  it('Texas and Washington do not tax wages', () => {
    expect(tax(hh(150000, { state: 'TX' })).stateTax).toBe(0);
    expect(tax(hh(150000, { state: 'WA' })).stateTax).toBe(0);
  });
  it('Washington taxes capital gains above the deduction at 7%', () => {
    expect(tax(hh(100000, { state: 'WA', qualifiedIncome: 300000, capitalGains: 300000 })).stateTax).toBeCloseTo(22000 * 0.07, 0);
  });
  it('California tax on $100k single (2025 FTB schedule, less the exemption credit)', () => {
    expect(tax(hh(100000, { state: 'CA' })).stateTax).toBeCloseTo(5054.98, 0);
  });
  it('New York City adds city income tax on top of state tax', () => {
    const t = tax(hh(100000, { state: 'NY', nyc: true }));
    expect(t.stateTax).toBeGreaterThan(4500);
    expect(t.cityTax).toBeGreaterThan(2800);
    expect(t.cityTax).toBeLessThan(3500);
  });
  it('New York recapture moves high earners to a flat rate', () => {
    const t = tax(hh(1_000_000, { state: 'NY' }));
    const taxable = 1_000_000 - 8000;
    expect(t.stateTax).toBeCloseTo(taxable * 0.0685, -1);
    const top = tax(hh(2_000_000, { state: 'NY' }));
    expect(top.stateTax).toBeCloseTo((2_000_000 - 8000) * 0.0965, -1);
  });
  it('itemizes state and local taxes up to the SALT cap', () => {
    const t = tax(hh(300000, { state: 'NY', nyc: true, propertyTax: 15000, mortgageInterest: 20000 }));
    expect(t.itemized).toBe(true);
    expect(t.saltDeducted).toBeCloseTo(40400, 0);
  });
});

describe('US places', () => {
  const us = PLACES.filter((p) => p.countryCode === 'US');
  it('has the four US cities', () => {
    expect(us.map((p) => p.id).sort()).toEqual(['houston', 'nyc', 'seattle', 'sf']);
  });
  it('gives sensible implicit rates for the default persona', () => {
    for (const p of us) {
      const r = calculate(DEFAULT_PERSONA, p.id, DEFAULT_OPTIONS);
      expect(r.implicitRate).toBeGreaterThan(0.2);
      expect(r.implicitRate).toBeLessThan(0.55);
      expect(r.borrowed).toBeGreaterThan(0); // federal deficit
    }
  });
  it('Houston has no state income tax line', () => {
    const r = calculate(DEFAULT_PERSONA, 'houston', DEFAULT_OPTIONS);
    expect(r.lineItems.filter((i) => i.level === 'provincial' && i.category === 'income').reduce((s, i) => s + i.amount, 0)).toBe(0);
  });
  it('has a complete borrowing history 2000-2024', () => {
    for (const p of us) {
      const rows = history(DEFAULT_PERSONA, p.id, DEFAULT_OPTIONS).filter((r) => r.year >= 2000 && r.year <= 2024);
      expect(rows.length).toBe(25);
      for (const r of rows) expect(r.implicit, `${p.id} ${r.year}`).not.toBeNull();
    }
  });
});
