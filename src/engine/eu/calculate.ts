// Full calculation for a European city: the country's income-side taxes, property and purchase taxes,
// spending taxes, then each government's share of borrowing.

import consumption from '../../../data/consumption/eu.json';
import { assembleResult } from '../assemble';
import { ASSUMPTIONS as SHARED } from '../ca/params2026';
import { deferredForLevel, type LevelLink } from '../fiscal';
import type { CalcOptions, InfoItem, LineItem, Persona, PlaceResult } from '../types';
import { switzerland } from './ch';
import { fmt, pct, type CountryTaxResult, type EuCountry, type EuHousehold } from './common';
import { germany } from './de';
import { denmark } from './dk';
import { ireland } from './ie';
import { luxembourg } from './lu';
import { norway } from './no';
import { EU_ASSUMPTIONS, EU_CITIES, FX } from './params2026';
import { purchaseTaxes, recurringPropertyTax } from './property';
import { unitedKingdom } from './uk';

const INCOME_SIDE: Record<EuCountry, (h: EuHousehold) => CountryTaxResult> = {
  DE: germany, UK: unitedKingdom, IE: ireland, LU: luxembourg, NO: norway, DK: denmark, CH: switzerland,
};
const VAT = consumption.countries as Record<string, { standardRate: number; vatShareOfSpending: number }>;
/** UK customs duties go to the UK government; EU customs duties belong to the EU budget. */
const TARIFF: Partial<Record<EuCountry, number>> = { UK: 0.0035 };

export function calculateEu(persona: Persona, cityId: string, opts: CalcOptions): PlaceResult {
  const city = EU_CITIES[cityId];
  const { currency, perUsd: fx } = FX[city.country];
  const L = (usd: number) => usd * fx;
  const items: LineItem[] = [];
  const info: InfoItem[] = [];
  const warnings: string[] = [];

  // ---------- Household in local currency ----------
  const w = persona.wealth;
  const inc = persona.income;
  const d = inc.deriveInvestmentIncome;
  const interest = L(d ? w.cash * SHARED.cashYield + w.bonds * SHARED.bondYield : inc.interest);
  const dividends = L(d ? w.equities * SHARED.equityDividendYield : inc.dividends);
  const gains = L(d ? w.equities * SHARED.equityRealizedGainRate : inc.capitalGains);
  const rental = L(d ? w.otherRealEstate * SHARED.rentalNetYield : inc.rental);
  const hs = persona.housing;
  const owner = hs.tenure === 'own';
  const homeValue = owner ? L(hs.homeValue) : 0;
  const mortgage = owner ? L(hs.mortgageBalance) : 0;
  const mortgageInterest = mortgage * city.mortgageRate;
  const partnerWages = persona.household.hasPartner ? L(persona.household.partnerEmployment) : 0;
  const h: EuHousehold = {
    partner: persona.household.hasPartner, wages: L(inc.employment), partnerWages, selfEmployment: L(inc.selfEmployment),
    interest, dividends, gains, rental, retirement: L(persona.retirementContribution),
    kidsUnder6: persona.household.childrenUnder6, kids6to17: persona.household.children6to17, age: persona.age, church: persona.churchMember,
    owner, homeValue, mortgage, mortgageInterest, homeType: hs.homeType,
    cash: L(w.cash), bonds: L(w.bonds), equities: L(w.equities), otherRealEstate: L(w.otherRealEstate), retirementAccounts: L(w.retirementAccounts), taxFreeAccounts: L(w.taxFreeAccounts),
  };
  const grossIncome = h.wages + h.selfEmployment + interest + dividends + gains + rental + partnerWages;

  // ---------- Income side ----------
  const income = INCOME_SIDE[city.country](h);
  items.push(...income.items);
  info.push(...income.info);
  warnings.push(...income.warnings);
  for (const b of income.benefits) {
    if (opts.netOfTransfers) items.push({ id: b.id, label: b.label, category: 'benefit', level: b.level, amount: -b.amount, confidence: 'medium', note: b.note });
    else info.push({ id: b.id, label: `${b.label} received (not netted)`, amount: b.amount, note: `${b.note} Turn on "net of cash transfers" to subtract it.` });
  }

  // ---------- Property ----------
  const rentYear = L(hs.monthlyRent) * 12;
  if (owner) {
    for (const p of recurringPropertyTax(cityId, homeValue, hs.homeType, true, h.partner)) items.push({ ...p, category: 'property', note: `${p.note}` });
  } else if (rentYear > 0) {
    const eq = rentYear / city.grossRentalYield;
    // London tenants pay council tax themselves; elsewhere the landlord's tax is passed on in rent.
    const direct = cityId === 'london';
    if (direct || opts.rentersPayPropertyTax) {
      for (const p of recurringPropertyTax(cityId, eq, hs.homeType, false, h.partner)) {
        items.push({ ...p, category: 'property', label: direct ? p.label : `${p.label} (built into your rent, estimate)`, confidence: direct ? p.confidence : 'low',
          note: `${direct ? '' : `Rent ${fmt(rentYear)}/yr ÷ ${pct(city.grossRentalYield)} gross yield = equivalent value ${fmt(eq)}. `}${p.note}` });
      }
    }
  }
  if (owner && hs.includePurchase && homeValue > 0) {
    const yrs = Math.max(1, hs.holdingYears);
    for (const t of purchaseTaxes(cityId, homeValue, mortgage, hs.firstTimeBuyer, hs.foreignBuyer, h.partner ? 2 : 1)) {
      if (t.amount <= 0) continue;
      items.push({ id: `transfer-${t.label}`, label: `${t.label} (spread)`, category: 'property', level: t.level, amount: t.amount / yrs, confidence: 'medium',
        note: `${fmt(t.amount)} one-off, spread over ${yrs} years. ${t.note}.` });
    }
    if (cityId === 'zurich') info.push({ id: 'no-transfer', label: 'Zurich has no property transfer tax', amount: 0, note: 'Abolished in 2005. A tax on the gain applies when you sell (not modelled).' });
  }

  // ---------- Spending ----------
  const direct = items.filter((i) => i.category !== 'benefit').reduce((s, i) => s + i.amount, 0);
  const embedded = owner ? 0 : items.filter((i) => i.category === 'property' && i.id !== 'uk-council-tax').reduce((s, i) => s + i.amount, 0);
  const afterTax = grossIncome - (direct - embedded);
  const housingCost = owner ? mortgageInterest : rentYear;
  let spendable = Math.max(0, afterTax * (1 - persona.savingsRate) - housingCost);
  const ct = { fuel: 0, energy: 0, vehicleOnce: 0, vehicleAnnual: 0 };
  const trace: string[] = [];

  const carPrice = L(persona.car.purchasePrice);
  const ev = persona.car.type === 'ev';
  if (persona.car.type !== 'none' && carPrice > 0) {
    const yrs = Math.max(1, persona.car.yearsKept);
    const vat = ev && city.country === 'NO' ? Math.max(0, carPrice - 300000) * city.vehicle.vat : carPrice * city.vehicle.vat;
    const reg = city.vehicle.registration(carPrice, ev);
    ct.vehicleOnce = (vat + reg) / yrs;
    ct.vehicleAnnual = city.vehicle.annual(ev);
    spendable = Math.max(0, spendable - (carPrice + vat + reg) / yrs - ct.vehicleAnnual);
    trace.push(`Car ${fmt(carPrice)} before tax: VAT ${fmt(vat)}${reg ? ` + registration tax ${fmt(reg)}` : ''}, spread over ${yrs} years; ${city.vehicle.note}`);
  }
  if (persona.car.type === 'gas') {
    const litres = (EU_ASSUMPTIONS.kmByMileage[persona.car.mileage] * EU_ASSUMPTIONS.litresPer100km) / 100;
    const F = city.fuel;
    const perLitreTax = F.excisePerLitre + (F.preTaxPerLitre + F.excisePerLitre) * F.vat;
    ct.fuel = litres * perLitreTax;
    spendable = Math.max(0, spendable - litres * (F.preTaxPerLitre + perLitreTax));
    trace.push(`Petrol: ${fmt(litres)} litres; ${F.note}`);
  }
  const E = city.energy;
  const bill = E.bill * SHARED.homeEnergyFactor[hs.homeType] / SHARED.homeEnergyFactor.townhouse;
  const share = persona.heating === 'electric' || persona.heating === 'heatpump' ? E.taxShareElectric : persona.heating === 'district' ? E.taxShareDistrict : E.taxShareFossil;
  ct.energy = bill * share;
  spendable = Math.max(0, spendable - bill);
  const vatShare = VAT[city.country].vatShareOfSpending;
  const vat = spendable * vatShare;
  const tariff = spendable * (TARIFF[city.country] ?? 0);
  trace.push(`Other spending ${fmt(spendable)}: VAT is ${pct(vatShare)} of it (standard rate ${pct(VAT[city.country].standardRate, 1)}; food, books, transport and exempt services pay less).`);

  const S = city.vatSplit;
  const vatLevels: [keyof typeof S, string][] = [['federal', ''], ['provincial', ' (Länder share)'], ['local', ' (municipal share)']];
  for (const [lvl, suffix] of vatLevels) {
    if (S[lvl] > 0) items.push({ id: `vat-${lvl}`, label: `VAT${suffix}`, category: 'consumption', level: lvl, amount: vat * S[lvl], confidence: 'medium',
      note: lvl === 'federal' ? 'VAT on everyday spending, from the national spending mix and 2026 rates by category.' : `${pct(S[lvl], 0)} of VAT revenue goes to this level.`,
      trace: lvl === 'federal' ? trace : undefined });
  }
  if (ct.fuel > 0) items.push({ id: 'fuel', label: 'Fuel taxes', category: 'consumption', level: 'federal', amount: ct.fuel, confidence: 'medium', note: `${city.fuel.note}.` });
  items.push({ id: 'energy', label: 'Taxes on home energy', category: 'consumption', level: 'federal', amount: ct.energy, confidence: 'low',
    note: `About ${pct(share, 0)} of a ${fmt(bill)} energy bill. ${E.note}` });
  if (ct.vehicleOnce > 0) items.push({ id: 'vehicle-purchase', label: 'VAT and registration tax on your car (spread)', category: 'consumption', level: 'federal', amount: ct.vehicleOnce, confidence: 'medium', note: city.vehicle.note });
  if (ct.vehicleAnnual > 0) items.push({ id: 'vehicle-annual', label: 'Annual vehicle tax', category: 'consumption', level: city.country === 'CH' ? 'provincial' : 'federal', amount: ct.vehicleAnnual, confidence: 'medium', note: city.vehicle.note });
  if (tariff > 0) items.push({ id: 'tariff', label: 'Customs duties', category: 'consumption', level: 'federal', amount: tariff, confidence: 'low', note: 'UK customs revenue (about GBP 5 billion) ÷ household spending.' });
  if (city.country !== 'UK') info.push({ id: 'customs', label: 'Customs duties (not counted)', amount: 0, note: city.country === 'CH' || city.country === 'NO' ? 'Small: mostly on farm products.' : 'EU customs duties go to the EU budget, not to any national government.' });

  if (w.retirementAccounts > 0) {
    info.push({ id: 'retirement', label: 'Future tax inside your retirement accounts', amount: L(w.retirementAccounts) * SHARED.retirementFutureTaxRate,
      note: 'About 30% of tax-deferred pension balances will be paid as tax on withdrawal.' });
  }

  const links: LevelLink[] = [
    { level: 'federal', seriesId: city.series.federal, isProxy: false },
    ...(city.series.provincial ? [{ level: 'provincial' as const, seriesId: city.series.provincial, isProxy: true }] : []),
    { level: 'local', seriesId: city.series.local, isProxy: true },
  ];
  return assembleResult({
    placeId: cityId, currency, fx, grossIncome, items, info, warnings,
    deferred: (taxesByLevel) => links.map((l) => deferredForLevel(l, taxesByLevel[l.level], opts.year)),
  });
}
