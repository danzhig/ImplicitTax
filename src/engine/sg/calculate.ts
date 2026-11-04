// Singapore 2026 (income year 2026, YA 2027): income tax, CPF (mandatory savings: info only, with its
// income tax relief), property tax on annual value, stamp duties, GST, car taxes (COE, ARF, excise),
// fuel duty, water conservation tax. One level of government. Sources: data/rules/sg/RESEARCH.md.

import consumption from '../../../data/consumption/sg.json';
import { assembleResult } from '../assemble';
import { progressive } from '../brackets';
import { ASSUMPTIONS as SHARED } from '../ca/params2026';
import { deferredForLevel } from '../fiscal';
import type { CalcOptions, InfoItem, LineItem, Persona, PlaceResult } from '../types';
import { fmt, pct } from '../eu/common';

/** SGD per USD: ECB reference rates, average of January-October 2026. */
export const FX_SGD_PER_USD = 1.2786;

export const SG = {
  // Resident rates from YA 2024 (IRAS)
  brackets: [
    { upTo: 20000, rate: 0 }, { upTo: 30000, rate: 0.02 }, { upTo: 40000, rate: 0.035 }, { upTo: 80000, rate: 0.07 },
    { upTo: 120000, rate: 0.115 }, { upTo: 160000, rate: 0.15 }, { upTo: 200000, rate: 0.18 }, { upTo: 240000, rate: 0.19 },
    { upTo: 280000, rate: 0.195 }, { upTo: 320000, rate: 0.2 }, { upTo: 500000, rate: 0.22 }, { upTo: 1000000, rate: 0.23 }, { upTo: null, rate: 0.24 },
  ],
  earnedIncomeRelief: 1000,
  childRelief: 4000,
  spouseRelief: 2000,
  srsCap: 15300,
  rentalDeemedExpenses: 0.15,
  cpf: { wageCap: 102000, rates: [[55, 0.2, 0.17], [60, 0.18, 0.16], [65, 0.125, 0.125], [70, 0.075, 0.09], [Infinity, 0.05, 0.075]] as [number, number, number][] },
  medisaveSelfEmployed: 0.105,
  propertyOwner: [
    { upTo: 12000, rate: 0 }, { upTo: 40000, rate: 0.04 }, { upTo: 50000, rate: 0.06 }, { upTo: 75000, rate: 0.1 },
    { upTo: 85000, rate: 0.14 }, { upTo: 100000, rate: 0.2 }, { upTo: 140000, rate: 0.26 }, { upTo: null, rate: 0.32 },
  ],
  propertyNonOwner: [{ upTo: 30000, rate: 0.12 }, { upTo: 45000, rate: 0.2 }, { upTo: 60000, rate: 0.28 }, { upTo: null, rate: 0.36 }],
  propertyRebate2026: { rate: 0.1, cap: 500 }, // one-off, owner-occupied private homes
  bsd: [{ upTo: 180000, rate: 0.01 }, { upTo: 360000, rate: 0.02 }, { upTo: 1000000, rate: 0.03 }, { upTo: 1500000, rate: 0.04 }, { upTo: 3000000, rate: 0.05 }, { upTo: null, rate: 0.06 }],
  absdForeigner: 0.6,
  /** Annual value ≈ market rent: gross rental yield on private homes. */
  rentalYield: 0.03,
  mortgageRate: 0.028,
  car: {
    coe: 121792, // average Category A premium, 2026 bidding exercises to November (LTA via data.gov.sg)
    excise: 0.2,
    gst: 0.09,
    arf: [{ upTo: 20000, rate: 1 }, { upTo: 40000, rate: 1.4 }, { upTo: 60000, rate: 1.9 }, { upTo: null, rate: 2.5 }],
    registrationFee: 350,
    /** PARF rebate share of ARF by age at deregistration (years) */
    parf: [[5, 0.75], [6, 0.7], [7, 0.65], [8, 0.6], [9, 0.55], [10, 0.5]] as [number, number][],
    roadTax: { gas: 744, ev: 1100 },
  },
  fuel: { dutyPerLitre: 0.66, preTaxPerLitre: 1.9, gst: 0.09 },
  energy: { bill: 2000, taxShareElectric: 0.14, taxShareFossil: 0.1 },
  waterConservationTax: 130,
};

const parfShare = (years: number) => (SG.car.parf.find(([y]) => years < y)?.[1] ?? 0.5);

export function calculateSingapore(persona: Persona, opts: CalcOptions): PlaceResult {
  const fx = FX_SGD_PER_USD;
  const L = (usd: number) => usd * fx;
  const items: LineItem[] = [];
  const info: InfoItem[] = [];
  const warnings: string[] = [];
  const foreigner = persona.housing.foreignBuyer;

  // ---------- Income ----------
  const w = persona.wealth;
  const inc = persona.income;
  const d = inc.deriveInvestmentIncome;
  const interest = L(d ? w.cash * SHARED.cashYield + w.bonds * SHARED.bondYield : inc.interest);
  const dividends = L(d ? w.equities * SHARED.equityDividendYield : inc.dividends);
  const gains = L(d ? w.equities * SHARED.equityRealizedGainRate : inc.capitalGains);
  const rental = L(d ? w.otherRealEstate * SHARED.rentalNetYield : inc.rental);
  const wages = L(inc.employment);
  const self = L(inc.selfEmployment);
  const partner = persona.household.hasPartner ? L(persona.household.partnerEmployment) : 0;
  const kids = persona.household.childrenUnder6 + persona.household.children6to17;
  const grossIncome = wages + self + interest + dividends + gains + rental + partner;

  const [, eeRate, erRate] = SG.cpf.rates.find(([age]) => persona.age <= age)!;
  const cpfOf = (x: number) => (foreigner ? 0 : Math.min(x, SG.cpf.wageCap) * eeRate);
  const cpf = cpfOf(wages);
  const medisave = foreigner ? 0 : Math.min(self, 72000) * SG.medisaveSelfEmployed;
  const srs = Math.min(L(persona.retirementContribution), SG.srsCap * (foreigner ? 35700 / 15300 : 1));
  const reliefs = cpf + medisave + srs + (wages + self > 0 ? SG.earnedIncomeRelief : 0) + kids * SG.childRelief
    + (persona.household.hasPartner && partner <= 4000 ? SG.spouseRelief : 0);
  const assessable = wages + self + rental * (1 - SG.rentalDeemedExpenses);
  const chargeable = Math.max(0, assessable - reliefs);
  const tax = progressive(chargeable, SG.brackets);
  const partnerChargeable = partner > 0 ? Math.max(0, partner - cpfOf(partner) - SG.earnedIncomeRelief) : 0;
  const partnerTax = progressive(partnerChargeable, SG.brackets);
  const reliefValue = progressive(chargeable + cpf + medisave, SG.brackets) - tax;

  items.push({ id: 'sg-income', label: 'Income tax', category: 'income', level: 'federal', amount: tax + partnerTax, confidence: 'high',
    note: `Resident rates 0%-24%. Dividends, bank interest and capital gains are not taxed.${partner ? ' Each spouse is taxed separately.' : ''}`,
    trace: [`Employment${self ? ', business' : ''}${rental ? ' and rental (less 15% deemed expenses)' : ''} income ${fmt(assessable)}`,
      `Reliefs ${fmt(reliefs)}: CPF ${fmt(cpf + medisave)}${srs ? `, SRS ${fmt(srs)}` : ''}, earned income 1,000${kids ? `, children ${fmt(kids * SG.childRelief)}` : ''}`,
      `Chargeable income ${fmt(chargeable)} → ${fmt(tax)}`] });
  if (!foreigner) {
    info.push({ id: 'sg-cpf', label: 'CPF contributions (your own savings, not in your rate)', amount: cpf + cpfOf(partner) + medisave,
      note: `${pct(eeRate, 1)} of wages up to S$102,000 a year goes into your own CPF accounts (housing, retirement, health). Like Swiss pillar 2 it is mandatory saving, not tax (decision D2). It cuts your income tax by about ${fmt(reliefValue)}.` });
    info.push({ id: 'employer', label: 'Your employer also pays (not in your rate)', amount: Math.min(wages, SG.cpf.wageCap) * erRate + Math.min(partner, SG.cpf.wageCap) * erRate + 135,
      note: `Employer CPF ${pct(erRate, 1)} (also into your accounts) and the skills development levy.` });
  } else {
    warnings.push('Foreigners (Employment Pass holders) pay no CPF, so they get no CPF relief and pay 60% additional stamp duty on homes.');
  }

  // ---------- Property ----------
  const hs = persona.housing;
  const owner = hs.tenure === 'own';
  const value = L(hs.homeValue);
  const mortgage = owner ? L(hs.mortgageBalance) : 0;
  const rentYear = L(hs.monthlyRent) * 12;
  if (owner) {
    const av = value * SG.rentalYield;
    const gross = progressive(av, SG.propertyOwner);
    const rebate = Math.min(gross * SG.propertyRebate2026.rate, SG.propertyRebate2026.cap);
    items.push({ id: 'sg-property', label: 'Property tax', category: 'property', level: 'federal', amount: gross - rebate, confidence: 'medium',
      note: `Owner-occupier rates 0%-32% on the annual value (estimated rent ${fmt(av)}, ${pct(SG.rentalYield)} of value), less the 2026 one-off rebate (10%, max S$500).` });
  } else if (opts.rentersPayPropertyTax && rentYear > 0) {
    items.push({ id: 'sg-property', label: 'Property tax (built into your rent, estimate)', category: 'property', level: 'federal', amount: progressive(rentYear, SG.propertyNonOwner), confidence: 'low',
      note: `Landlords pay non-owner-occupier rates (12%-36%) on the annual value, about your rent of ${fmt(rentYear)}.` });
  }
  if (owner && hs.includePurchase && value > 0) {
    const yrs = Math.max(1, hs.holdingYears);
    const bsd = progressive(value, SG.bsd);
    items.push({ id: 'sg-bsd', label: "Buyer's stamp duty (spread)", category: 'property', level: 'federal', amount: bsd / yrs, confidence: 'high', note: `${fmt(bsd)} one-off (1%-6%), spread over ${yrs} years.` });
    if (foreigner) items.push({ id: 'sg-absd', label: "Additional buyer's stamp duty (spread)", category: 'property', level: 'federal', amount: (value * SG.absdForeigner) / yrs, confidence: 'high', note: '60% for foreign buyers, spread over the years you keep the home. Citizens pay 0% on a first home, permanent residents 5%.' });
  }

  // ---------- Spending ----------
  const direct = items.reduce((s, i) => s + i.amount, 0);
  const embedded = owner ? 0 : items.filter((i) => i.category === 'property').reduce((s, i) => s + i.amount, 0);
  // CPF goes into your own accounts, so it is not spendable this year.
  const afterTax = grossIncome - (direct - embedded) - cpf - cpfOf(partner) - medisave;
  const housing = owner ? mortgage * SG.mortgageRate : rentYear;
  let spendable = Math.max(0, afterTax * (1 - persona.savingsRate) - housing);
  const trace: string[] = [];
  let carOnce = 0;
  let carAnnual = 0;
  let fuel = 0;
  const omv = L(persona.car.purchasePrice);
  const ev = persona.car.type === 'ev';
  if (persona.car.type !== 'none' && omv > 0) {
    const yrs = Math.min(10, Math.max(1, persona.car.yearsKept));
    const C = SG.car;
    const excise = omv * C.excise;
    const gst = (omv + excise) * C.gst;
    const arf = progressive(omv, C.arf);
    const arfNet = arf * (1 - parfShare(yrs));
    carOnce = C.coe / 10 + (excise + gst + arfNet + C.registrationFee) / yrs;
    carAnnual = ev ? C.roadTax.ev : C.roadTax.gas;
    spendable = Math.max(0, spendable - omv / yrs - carOnce - carAnnual);
    trace.push(`Car worth ${fmt(omv)} (open market value): COE ${fmt(C.coe)} over its 10 years; ARF ${fmt(arf)} less a ${pct(parfShare(yrs), 0)} rebate when deregistered after ${yrs} years; excise ${fmt(excise)}; GST ${fmt(gst)}`);
  }
  if (persona.car.type === 'gas') {
    const litres = ({ low: 8000, average: 15000, high: 25000 }[persona.car.mileage] * 7.5) / 100;
    const F = SG.fuel;
    fuel = litres * (F.dutyPerLitre + (F.preTaxPerLitre + F.dutyPerLitre) * F.gst);
    spendable = Math.max(0, spendable - litres * (F.preTaxPerLitre + F.dutyPerLitre) * (1 + F.gst));
  }
  const factor = SHARED.homeEnergyFactor[hs.homeType] / SHARED.homeEnergyFactor.townhouse;
  const bill = SG.energy.bill * factor;
  const energyShare = persona.heating === 'gas' || persona.heating === 'oil' ? SG.energy.taxShareFossil : SG.energy.taxShareElectric;
  spendable = Math.max(0, spendable - bill);
  const gstShare = consumption.gstShareOfSpending;
  const gst = spendable * gstShare;
  trace.push(`Other spending ${fmt(spendable)}: GST is ${pct(gstShare)} of it (9% on almost everything; financial services exempt).`);

  items.push({ id: 'sg-gst', label: 'GST', category: 'consumption', level: 'federal', amount: gst, confidence: 'medium', note: '9% goods and services tax with very few exemptions.', trace });
  if (carOnce > 0) items.push({ id: 'sg-car', label: 'COE, registration fee and excise on your car (spread)', category: 'consumption', level: 'federal', amount: carOnce, confidence: 'medium',
    note: 'The certificate of entitlement (COE) is a 10-year right to own a car, bought at auction from the government. Additional registration fee 100%-250% of the car\'s value (partly refunded on deregistration), 20% excise and GST.' });
  if (carAnnual > 0) items.push({ id: 'sg-road-tax', label: 'Road tax', category: 'consumption', level: 'federal', amount: carAnnual, confidence: 'medium', note: 'Yearly, by engine size (electric cars by power).' });
  if (fuel > 0) items.push({ id: 'sg-fuel', label: 'Petrol duty', category: 'consumption', level: 'federal', amount: fuel, confidence: 'medium', note: 'S$0.66 a litre (RON 95), plus GST on the pump price.' });
  items.push({ id: 'sg-energy', label: 'Taxes on home energy and water', category: 'consumption', level: 'federal', amount: bill * energyShare + SG.waterConservationTax * factor, confidence: 'low',
    note: `GST and the carbon tax (S$45/t) in a ${fmt(bill)} energy bill, plus the water conservation tax on your water bill.` });
  info.push({ id: 'customs', label: 'No tariffs', amount: 0, note: 'Singapore charges no customs duties on most goods (only excise on alcohol, tobacco, cars and fuel).' });
  if (w.retirementAccounts > 0) {
    info.push({ id: 'retirement', label: 'Future tax inside your retirement accounts', amount: L(w.retirementAccounts) * 0.05,
      note: 'Only 50% of SRS withdrawals are taxed, at low rates in retirement; CPF payouts are tax-free.' });
  }
  if (kids > 0) info.push({ id: 'sg-family', label: 'No regular child benefit', amount: 0, note: 'Singapore pays a Baby Bonus at birth and a matched Child Development Account, not a monthly benefit; the S$4,000 child relief is in your income tax.' });

  return assembleResult({
    placeId: 'singapore', currency: 'SGD', fx, grossIncome, items, info, warnings,
    deferred: (taxesByLevel) => [deferredForLevel({ level: 'federal', seriesId: 'SG-federal', isProxy: false }, taxesByLevel.federal, opts.year)],
  });
}
