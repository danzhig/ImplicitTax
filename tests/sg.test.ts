import { describe, expect, it } from 'vitest';
import { calculate, history } from '../src/engine';
import { DEFAULT_OPTIONS, type Persona } from '../src/engine/types';
import { DEFAULT_PERSONA } from '../src/engine/personas';
import { FX_SGD_PER_USD } from '../src/engine/sg/calculate';

const persona = (wagesSgd: number, extra: Partial<Persona> = {}): Persona => ({
  ...structuredClone(DEFAULT_PERSONA),
  retirementContribution: 0,
  income: { ...DEFAULT_PERSONA.income, employment: wagesSgd / FX_SGD_PER_USD, deriveInvestmentIncome: false },
  car: { ...DEFAULT_PERSONA.car, type: 'none' },
  housing: { ...DEFAULT_PERSONA.housing, tenure: 'rent' },
  ...extra,
});
const item = (p: Persona, id: string) => calculate(p, 'singapore', DEFAULT_OPTIONS).lineItems.find((i) => i.id === id)?.amount ?? 0;

describe('Singapore income tax (YA 2027)', () => {
  it('taxes S$100,000 of wages after CPF and earned income relief', () => {
    // chargeable = 100,000 - 20,000 CPF - 1,000 = 79,000 → 550 + 39,000 × 7%
    expect(item(persona(100000), 'sg-income')).toBeCloseTo(550 + 39000 * 0.07, 0);
  });
  it('caps CPF relief at S$102,000 of wages', () => {
    // chargeable = 200,000 - 20,400 - 1,000 = 178,600 → 13,950 + 18,600 × 18%
    expect(item(persona(200000), 'sg-income')).toBeCloseTo(13950 + 18600 * 0.18, 0);
  });
  it('does not tax dividends or capital gains', () => {
    const a = item(persona(100000), 'sg-income');
    const b = item(persona(100000, { income: { ...persona(100000).income, dividends: 50000, capitalGains: 50000 } }), 'sg-income');
    expect(b).toBeCloseTo(a, 6);
  });
  it('keeps CPF out of the rate (info only)', () => {
    const r = calculate(persona(100000), 'singapore', DEFAULT_OPTIONS);
    expect(r.lineItems.some((i) => i.category === 'payroll')).toBe(false);
    expect(r.info.find((i) => i.id === 'sg-cpf')!.amount).toBeCloseTo(20000, 0);
  });
});

describe('Singapore property and cars', () => {
  it('uses owner-occupier property tax rates on the annual value', () => {
    // value S$2,000,000 → AV 60,000 → 1,120 + 600 + 10,000 × 10% = 2,720, less 10% rebate (272)
    const p = persona(100000, { housing: { ...DEFAULT_PERSONA.housing, tenure: 'own', homeValue: 2000000 / FX_SGD_PER_USD, includePurchase: false } });
    expect(item(p, 'sg-property')).toBeCloseTo(2720 * 0.9, 0);
  });
  it('charges 60% ABSD to foreign buyers', () => {
    const p = persona(100000, { housing: { ...DEFAULT_PERSONA.housing, tenure: 'own', homeValue: 1000000 / FX_SGD_PER_USD, holdingYears: 10, foreignBuyer: true } });
    expect(item(p, 'sg-absd')).toBeCloseTo(60000, 0);
  });
  it('makes the COE the largest car cost', () => {
    const p = persona(100000, { car: { type: 'gas', mileage: 'average', purchasePrice: 30000 / FX_SGD_PER_USD, yearsKept: 10 } });
    expect(item(p, 'sg-car')).toBeGreaterThan(121792 / 10);
  });
});

describe('Singapore fiscal history', () => {
  it('has the official budget balance from FY2005 and shows the FY2020 draw on reserves', () => {
    const rows = history(DEFAULT_PERSONA, 'singapore', DEFAULT_OPTIONS);
    expect(rows[0].year).toBe(2005);
    const y2020 = rows.find((r) => r.year === 2020)!;
    expect(y2020.borrowed.federal!).toBeGreaterThan(0.05);
    expect(rows.filter((r) => r.year <= 2024).every((r) => r.implicit !== null)).toBe(true);
  });
});
