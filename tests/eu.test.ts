import { describe, expect, it } from 'vitest';
import { calculate, history, PLACES } from '../src/engine';
import { DEFAULT_OPTIONS } from '../src/engine/types';
import { DEFAULT_PERSONA } from '../src/engine/personas';
import type { EuHousehold } from '../src/engine/eu/common';
import { deTariff, germany } from '../src/engine/eu/de';
import { unitedKingdom } from '../src/engine/eu/uk';
import { ireland } from '../src/engine/eu/ie';
import { norway } from '../src/engine/eu/no';
import { denmark } from '../src/engine/eu/dk';
import { luTariff } from '../src/engine/eu/lu';
import { switzerland } from '../src/engine/eu/ch';

const hh = (wages: number, extra: Partial<EuHousehold> = {}): EuHousehold => ({
  partner: false, wages, partnerWages: 0, selfEmployment: 0, interest: 0, dividends: 0, gains: 0, rental: 0, retirement: 0,
  kidsUnder6: 0, kids6to17: 0, age: 38, church: false, owner: false, homeValue: 0, mortgage: 0, mortgageInterest: 0, homeType: 'apartment',
  cash: 0, bonds: 0, equities: 0, otherRealEstate: 0, retirementAccounts: 0, taxFreeAccounts: 0, ...extra,
});
const sum = (r: { items: { id: string; amount: number }[] }, prefix: string) => r.items.filter((i) => i.id.startsWith(prefix)).reduce((s, i) => s + i.amount, 0);

describe('Germany 2026', () => {
  it('follows the §32a formula (BMF tariff history)', () => {
    expect(deTariff(12348)).toBe(0);
    expect(deTariff(50000)).toBe(10548);
    expect(deTariff(100000)).toBe(Math.floor(0.42 * 100000 - 11135.63));
    expect(deTariff(300000)).toBe(Math.floor(0.45 * 300000 - 19470.38));
  });
  it('taxes EUR 60,000 of wages after social insurance deductions', () => {
    const r = germany(hh(60000));
    expect(sum(r, 'de-pension')).toBeCloseTo(5580, 0);
    expect(sum(r, 'de-health')).toBeCloseTo(5250, 0);
    expect(sum(r, 'de-care')).toBeCloseTo(1440, 0); // 1.8% + 0.6% childless
    expect(sum(r, 'de-income')).toBe(deTariff(60000 - 1230 - 36 - (5580 + 5250 * 0.96 + 1440)));
    expect(sum(r, 'de-soli')).toBe(0);
  });
  it('splits income tax 42.5 / 42.5 / 15 between Bund, Land and municipality', () => {
    const r = germany(hh(80000));
    const t = sum(r, 'de-income');
    expect(r.items.find((i) => i.id === 'de-income-local')!.amount).toBeCloseTo(t * 0.15, 6);
  });
});

describe('United Kingdom 2026-27', () => {
  it('taxes GBP 60,000 of salary', () => {
    const r = unitedKingdom(hh(60000));
    expect(sum(r, 'uk-income')).toBeCloseTo(7540 + 9730 * 0.4, 0);
    expect(sum(r, 'uk-ni')).toBeCloseTo((50270 - 12570) * 0.08 + 9730 * 0.02, 0);
  });
  it('removes the personal allowance by GBP 125,140', () => {
    const r = unitedKingdom(hh(125140));
    expect(sum(r, 'uk-income')).toBeCloseTo(37700 * 0.2 + (125140 - 37700) * 0.4, 0);
  });
});

describe('Ireland 2026', () => {
  it('taxes EUR 60,000 single: income tax, USC, PRSI', () => {
    const r = ireland(hh(60000));
    expect(sum(r, 'ie-income')).toBeCloseTo(8800 + 6400 - 4000, 0);
    expect(sum(r, 'ie-usc')).toBeCloseTo(12012 * 0.005 + (28700 - 12012) * 0.02 + (60000 - 28700) * 0.03, 0);
    expect(sum(r, 'ie-prsi')).toBeCloseTo(60000 * (0.042 * 0.75 + 0.0435 * 0.25), 0);
  });
});

describe('Norway 2026', () => {
  it('taxes NOK 1,000,000 of wages', () => {
    const r = norway(hh(1000000));
    expect(sum(r, 'no-general')).toBeCloseTo((1000000 - 95700 - 114550) * 0.22, 0);
    expect(sum(r, 'no-bracket')).toBeCloseTo(92200 * 0.017 + 406750 * 0.04 + 255050 * 0.137 + 19900 * 0.168, 0);
    expect(sum(r, 'no-insurance')).toBeCloseTo(76000, 0);
  });
  it('values a home at 25% for wealth tax', () => {
    const r = norway(hh(800000, { owner: true, homeValue: 8000000, cash: 2000000 }));
    expect(sum(r, 'no-wealth')).toBeCloseTo((2000000 + 2000000 - 1900000) * 0.01, 0);
  });
});

describe('Denmark 2026', () => {
  it('taxes DKK 600,000 of wages in Copenhagen', () => {
    const r = denmark(hh(600000));
    expect(sum(r, 'dk-am')).toBeCloseTo(48000, 0);
    expect(sum(r, 'dk-municipal')).toBeCloseTo((552000 - 63300 - 54100) * 0.2339, 0);
    expect(sum(r, 'dk-state')).toBeCloseTo((552000 - 54100) * 0.1201, 0);
  });
  it('adds the 7.5% middle tax above DKK 641,200 after AM-bidrag', () => {
    const r = denmark(hh(800000));
    expect(sum(r, 'dk-state')).toBeCloseTo((736000 - 54100) * 0.1201 + (736000 - 641200) * 0.075, 0);
  });
});

describe('Luxembourg 2026', () => {
  it('uses the 2025-indexed scale (42% above EUR 234,870)', () => {
    expect(luTariff(13230)).toBe(0);
    expect(luTariff(300000) - luTariff(299000)).toBeCloseTo(420, 6);
  });
});

describe('Switzerland 2026 (Zurich)', () => {
  it('matches the federal calculator at sampled points', () => {
    // CHF 100,000 taxable: federal 2,684, Zurich simple tax 6,170 (ESTV, 2026)
    const r = switzerland(hh(0, { interest: 100000 + 2900 })); // interest has no work deductions; ZH insurance deduction 2,900
    expect(sum(r, 'ch-canton')).toBeCloseTo(6170 * 0.95, -1);
    expect(sum(r, 'ch-city')).toBeCloseTo(6170 * 1.19 + 24, -1);
  });
  it('charges AHV on all wages and ALV up to CHF 148,200', () => {
    const r = switzerland(hh(200000));
    expect(sum(r, 'ch-ahv')).toBeCloseTo(200000 * 0.053, 0);
    expect(sum(r, 'ch-alv')).toBeCloseTo(148200 * 0.011, 0);
  });
});

describe('European places', () => {
  const eu = PLACES.filter((p) => !['CA', 'US'].includes(p.countryCode));
  it('has the seven European cities', () => {
    expect(eu.map((p) => p.id).sort()).toEqual(['copenhagen', 'dublin', 'london', 'luxembourg', 'munich', 'oslo', 'zurich']);
  });
  it('gives sensible rates for the default persona', () => {
    for (const p of eu) {
      const r = calculate(DEFAULT_PERSONA, p.id, DEFAULT_OPTIONS);
      expect(r.implicitRate, p.id).toBeGreaterThan(0.15);
      expect(r.implicitRate, p.id).toBeLessThan(0.6);
    }
  });
  it('has a complete borrowing history 2000-2024', () => {
    for (const p of eu) {
      const rows = history(DEFAULT_PERSONA, p.id, DEFAULT_OPTIONS).filter((r) => r.year >= 2000 && r.year <= 2024);
      expect(rows.length, p.id).toBe(25);
      for (const r of rows) expect(r.implicit, `${p.id} ${r.year}`).not.toBeNull();
    }
  });
  it('shows Norway saving (negative borrowing) because of the oil fund', () => {
    expect(calculate(DEFAULT_PERSONA, 'oslo', DEFAULT_OPTIONS).borrowed).toBeLessThan(0);
  });
});
