// Full Canadian calculation for one city: income tax, payroll, consumption, property, benefits,
// then each government's share of borrowing.

import consumption from '../../../data/consumption/ca.json';
import { progressive } from '../brackets';
import { deferredForLevel, type LevelLink } from '../fiscal';
import { assembleResult } from '../assemble';
import type { CalcOptions, InfoItem, LineItem, Persona, PlaceResult } from '../types';
import { incomeTax, payroll, type IndividualIncome } from './incomeTax';
import {
  ASSUMPTIONS,
  CCB,
  CITIES,
  FEDERAL,
  FUEL,
  FX_CAD_PER_USD,
  GST,
  PROVINCES,
  VEHICLE_SALES_TAX,
  type CityParams,
} from './params2026';

type Rates = { gst: number; pst: number };
const SALES = consumption.salesTax as Record<string, Record<string, Rates>>;
const fmt = (n: number) => Math.round(n).toLocaleString('en-CA');
const pct = (r: number, d = 1) => `${(r * 100).toFixed(d)}%`;

/** Grocery share of non-housing spending, interpolated from the household spending survey. */
export function groceryShare(basketCad: number): number {
  const c = consumption.groceryShareCurve;
  if (basketCad <= c[0].basketSpend) return c[0].groceryShare;
  for (let i = 1; i < c.length; i++) {
    if (basketCad <= c[i].basketSpend) {
      const t = (basketCad - c[i - 1].basketSpend) / (c[i].basketSpend - c[i - 1].basketSpend);
      return c[i - 1].groceryShare + t * (c[i].groceryShare - c[i - 1].groceryShare);
    }
  }
  return c[c.length - 1].groceryShare;
}

export function tariffRate(): { rate: number; year: string } {
  const entries = Object.entries(consumption.tariffRateByYear).sort();
  const [year, rate] = entries[entries.length - 1];
  return { rate: rate as number, year };
}

/** Ontario LTT and Toronto MLTT share the same brackets up to $2M. */
const ON_LTT = [
  { upTo: 55000, rate: 0.005 },
  { upTo: 250000, rate: 0.01 },
  { upTo: 400000, rate: 0.015 },
  { upTo: 2000000, rate: 0.02 },
  { upTo: null, rate: 0.025 },
];
const TORONTO_MLTT = [
  ...ON_LTT.slice(0, 4),
  { upTo: 3000000, rate: 0.025 },
  { upTo: 4000000, rate: 0.044 },
  { upTo: 5000000, rate: 0.0545 },
  { upTo: 10000000, rate: 0.065 },
  { upTo: 20000000, rate: 0.0755 },
  { upTo: null, rate: 0.086 },
];
const BC_PTT = [
  { upTo: 200000, rate: 0.01 },
  { upTo: 2000000, rate: 0.02 },
  { upTo: 3000000, rate: 0.03 },
  { upTo: null, rate: 0.05 }, // 3% + 2% additional on residential value over $3M
];

function bcPtt(value: number, firstTime: boolean, newBuild: boolean): { tax: number; note: string } {
  let tax = progressive(value, BC_PTT);
  let note = 'BC property transfer tax: 1% to $200k, 2% to $2M, 3% above, +2% over $3M';
  if (newBuild && value <= 1150000) {
    const share = value <= 1100000 ? 1 : (1150000 - value) / 50000;
    tax -= tax * share;
    note += '; newly built home exemption';
  } else if (firstTime && value <= 860000) {
    const full = progressive(Math.min(value, 500000), BC_PTT);
    const share = value <= 835000 ? 1 : (860000 - value) / 25000;
    tax -= full * share;
    note += '; first-time buyer exemption';
  }
  return { tax: Math.max(0, tax), note };
}

export function calculateCanada(persona: Persona, cityId: string, opts: CalcOptions): PlaceResult {
  const city: CityParams = CITIES[cityId];
  const prov = city.province;
  const P = PROVINCES[prov];
  const fx = FX_CAD_PER_USD;
  const cad = (usd: number) => usd * fx;
  const items: LineItem[] = [];
  const info: InfoItem[] = [];
  const warnings: string[] = [];

  // ---------- Income ----------
  const w = persona.wealth;
  const inc = persona.income;
  const derived = inc.deriveInvestmentIncome;
  const interest = cad(derived ? w.cash * ASSUMPTIONS.cashYield + w.bonds * ASSUMPTIONS.bondYield : inc.interest);
  const dividends = cad(derived ? w.equities * ASSUMPTIONS.equityDividendYield : inc.dividends);
  const gains = cad(derived ? w.equities * ASSUMPTIONS.equityRealizedGainRate : inc.capitalGains);
  const rental = cad(derived ? w.otherRealEstate * ASSUMPTIONS.rentalNetYield : inc.rental);
  const kids = persona.household.childrenUnder6 + persona.household.children6to17;
  const partnerIncome = persona.household.hasPartner ? cad(persona.household.partnerEmployment) : 0;

  const me: IndividualIncome = {
    employment: cad(inc.employment),
    selfEmployment: cad(inc.selfEmployment),
    interest,
    eligibleDividends: dividends,
    capitalGains: gains,
    rental,
    rrspContribution: cad(persona.retirementContribution),
    childrenCount: kids,
    partnerNetIncome: persona.household.hasPartner ? partnerIncome : null,
  };
  const grossIncome = me.employment + me.selfEmployment + interest + dividends + gains + rental + partnerIncome;

  const myPay = payroll(me);
  const myTax = incomeTax(me, myPay, prov);
  let partnerPay = null;
  let partnerTax = null;
  if (persona.household.hasPartner && partnerIncome > 0) {
    const partner: IndividualIncome = {
      employment: partnerIncome, selfEmployment: 0, interest: 0, eligibleDividends: 0, capitalGains: 0, rental: 0,
      rrspContribution: 0, childrenCount: 0, partnerNetIncome: null,
    };
    partnerPay = payroll(partner);
    partnerTax = incomeTax(partner, partnerPay, prov);
  }
  const both = <T,>(a: T, b: T | null, f: (x: T) => number) => f(a) + (b ? f(b) : 0);
  const partnerNote = partnerTax ? ` Includes your partner's ${fmt(partnerTax.federalTax)} federal / ${fmt(partnerTax.provincialTax)} provincial.` : '';

  items.push({
    id: 'fed-income', label: 'Federal income tax', category: 'income', level: 'federal',
    amount: both(myTax, partnerTax, (t) => t.federalTax), confidence: 'high',
    note: `2026 brackets 14%–33%, after credits.${partnerNote}`, trace: myTax.federalTrace,
  });
  items.push({
    id: 'prov-income', label: `${P.name} income tax`, category: 'income', level: 'provincial',
    amount: both(myTax, partnerTax, (t) => t.provincialTax), confidence: prov === 'AB' ? 'high' : 'medium',
    note: prov === 'BC' ? 'BC raised its lowest rate to 5.6% for 2026.' : prov === 'AB' ? 'Alberta added an 8% bracket in 2025.' : 'Includes the Ontario surtax.',
    trace: myTax.provincialTrace,
  });
  const ohp = both(myTax, partnerTax, (t) => t.healthPremium);
  if (ohp > 0) {
    items.push({
      id: 'ohp', label: 'Ontario Health Premium', category: 'income', level: 'provincial', amount: ohp, confidence: 'high',
      note: 'A separate income-based tax, up to $900 per person.',
    });
  }

  const relief = both(myTax, partnerTax, (t) => t.contributionRelief);
  const cpp = both(myPay, partnerPay, (p) => p.cppEmployee + p.cpp2Employee + p.cppSelfEmployed + p.cpp2SelfEmployed);
  const ei = both(myPay, partnerPay, (p) => p.ei);
  items.push({
    id: 'cpp', label: 'CPP contributions', category: 'payroll', level: 'social', amount: cpp, confidence: 'high',
    note: `CPP and EI cut your income tax by ${fmt(relief)} through credits and deductions, so their net cost is ${fmt(cpp + ei - relief)}.${me.selfEmployment > 0 ? ' Self-employed: you pay both halves.' : ''}`,
    trace: myPay.trace,
  });
  if (ei > 0) {
    items.push({
      id: 'ei', label: 'EI premiums', category: 'payroll', level: 'federal', amount: ei, confidence: 'high',
      note: '1.63% up to $68,900 of insurable earnings. Earns a non-refundable credit.',
    });
  }
  info.push({
    id: 'contribution-relief', label: 'Income tax saved by CPP/EI credits and deductions', amount: relief,
    note: 'Already reflected in the income tax lines. Shown so you can see both sides of CPP and EI.',
  });
  info.push({
    id: 'employer', label: 'Your employer also pays (not in your rate)',
    amount: both(myPay, partnerPay, (p) => p.employerCpp + p.employerEi) + (P.employerHealthTax ? (me.employment + partnerIncome) * P.employerHealthTax : 0),
    note: `Employer CPP/CPP2 and EI (1.4× yours)${P.employerHealthTax ? `, plus ${pct(P.employerHealthTax, 2)} employer health tax if your employer's payroll is large` : ''}.`,
  });

  // ---------- Benefits ----------
  const ccbMax = persona.household.childrenUnder6 * CCB.under6 + persona.household.children6to17 * CCB.age6to17;
  let ccb = 0;
  if (kids > 0) {
    const familyNet = myTax.netIncome + (partnerTax?.netIncome ?? 0);
    const [r1, r2] = CCB.rates[Math.min(kids, 4) - 1];
    const reduction =
      familyNet <= CCB.threshold1 ? 0
        : familyNet <= CCB.threshold2 ? r1 * (familyNet - CCB.threshold1)
          : r1 * (CCB.threshold2 - CCB.threshold1) + r2 * (familyNet - CCB.threshold2);
    ccb = Math.max(0, ccbMax - reduction);
    if (opts.netOfTransfers) {
      items.push({
        id: 'ccb', label: 'Canada Child Benefit (received)', category: 'benefit', level: 'federal', amount: -ccb, confidence: 'medium',
        note: `Maximum ${fmt(ccbMax)}, reduced by ${fmt(ccbMax - ccb)} because of family income. The reduction acts like an extra tax on each extra dollar.`,
      });
    } else {
      info.push({ id: 'ccb', label: 'Canada Child Benefit received (not netted)', amount: ccb, note: 'Turn on "net of cash transfers" to subtract it.' });
    }
  }

  // ---------- Property ----------
  const h = persona.housing;
  const owner = h.tenure === 'own';
  const homeCad = cad(h.homeValue);
  const rentCad = cad(h.monthlyRent) * 12;
  const taxBase = owner ? homeCad * city.assessmentRatio : opts.rentersPayPropertyTax ? (rentCad / ASSUMPTIONS.grossRentalYield) * city.assessmentRatio : 0;
  let propertyTotal = 0;
  if (taxBase > 0) {
    const label = owner ? '' : ' (built into your rent, estimate)';
    const conf = owner ? 'high' : 'low';
    const baseNote = owner
      ? `Assessed value ${fmt(taxBase)}${city.assessmentRatio !== 1 ? ` (${pct(city.assessmentRatio, 0)} of market value: Ontario assessments still use 2016 values)` : ''}`
      : `Rent ${fmt(rentCad)}/yr ÷ ${pct(ASSUMPTIONS.grossRentalYield)} gross yield = equivalent value ${fmt(taxBase)}`;
    const cityTax = taxBase * city.propertyTax.city;
    const regional = taxBase * city.propertyTax.regional;
    let provincial = taxBase * city.propertyTax.provincial;
    if (owner && city.homeOwnerGrant) {
      const g = city.homeOwnerGrant;
      const grant = Math.max(0, g.amount - Math.max(0, homeCad - g.threshold) / 1000 * g.phaseOutPerThousand);
      provincial = Math.max(0, provincial - grant);
    }
    items.push({ id: 'prop-city', label: `${city.name} property tax${label}`, category: 'property', level: 'local', amount: cityTax + regional, confidence: conf,
      note: `${baseNote} × ${pct(city.propertyTax.city + city.propertyTax.regional, 3)}${regional ? ' (incl. regional levies)' : ''}` });
    items.push({ id: 'prop-prov', label: `Provincial education property tax${label}`, category: 'property', level: 'provincial', amount: provincial, confidence: conf,
      note: `${pct(city.propertyTax.provincial, 3)} of assessed value goes to the province${city.homeOwnerGrant && owner ? ', minus the BC home owner grant' : ''}.` });
    propertyTotal = cityTax + regional + provincial;
  }

  if (owner && h.includePurchase && homeCad > 0) {
    const yrs = Math.max(1, h.holdingYears);
    if (prov === 'ON') {
      let ltt = progressive(homeCad, ON_LTT);
      if (h.firstTimeBuyer) ltt = Math.max(0, ltt - 4000);
      items.push({ id: 'ltt-prov', label: 'Ontario land transfer tax (spread)', category: 'property', level: 'provincial', amount: ltt / yrs, confidence: 'high',
        note: `${fmt(ltt)} one-off, spread over ${yrs} years${h.firstTimeBuyer ? ' (after $4,000 first-time buyer refund)' : ''}.` });
      if (cityId === 'toronto') {
        let mltt = progressive(homeCad, TORONTO_MLTT);
        if (h.firstTimeBuyer) mltt = Math.max(0, mltt - 4475);
        items.push({ id: 'ltt-city', label: 'Toronto land transfer tax (spread)', category: 'property', level: 'local', amount: mltt / yrs, confidence: 'high',
          note: `${fmt(mltt)} one-off, spread over ${yrs} years. Toronto doubles the provincial tax; luxury rates above $3M from April 2026.` });
      }
    } else if (prov === 'BC') {
      const { tax, note } = bcPtt(homeCad, h.firstTimeBuyer, h.newBuild);
      items.push({ id: 'ltt-prov', label: 'BC property transfer tax (spread)', category: 'property', level: 'provincial', amount: tax / yrs, confidence: 'high',
        note: `${fmt(tax)} one-off, spread over ${yrs} years. ${note}.` });
    } else {
      const mortgage = cad(h.mortgageBalance);
      const fee = 50 + 5 * Math.ceil(homeCad / 5000) + (mortgage > 0 ? 50 + 5 * Math.ceil(mortgage / 5000) : 0);
      items.push({ id: 'ltt-prov', label: 'Alberta land title fees (spread)', category: 'property', level: 'provincial', amount: fee / yrs, confidence: 'medium',
        note: `Alberta has no land transfer tax, only registration fees: ${fmt(fee)} one-off.` });
    }
    if (h.newBuild) {
      if (city.developmentCharge !== null) {
        items.push({ id: 'dev-charge', label: 'Development charges in a new home (spread)', category: 'property', level: 'local', amount: city.developmentCharge / yrs, confidence: 'medium',
          note: `${fmt(city.developmentCharge)} per single detached home, built into the price, spread over ${yrs} years.` });
      } else {
        warnings.push(`Development charges for ${city.name} are not sourced yet, so they are left out.`);
      }
    }
    if (h.foreignBuyer) {
      warnings.push('Canada bans most non-Canadians from buying homes until January 1, 2027.');
      const provRate = prov === 'ON' ? 0.25 : prov === 'BC' ? 0.2 : 0;
      if (provRate > 0) {
        items.push({ id: 'foreign-prov', label: 'Foreign buyer tax, provincial (spread)', category: 'property', level: 'provincial', amount: (homeCad * provRate) / yrs, confidence: 'medium',
          note: prov === 'ON' ? 'Ontario non-resident speculation tax, 25% of the price.' : 'BC additional property transfer tax, 20% of the price.' });
      }
      if (cityId === 'toronto') {
        items.push({ id: 'foreign-city', label: 'Toronto foreign buyer tax (spread)', category: 'property', level: 'local', amount: (homeCad * 0.1) / yrs, confidence: 'high',
          note: 'Toronto municipal non-resident speculation tax, 10% of the price (since 2025).' });
      }
    }
  }

  // ---------- Spending and consumption taxes ----------
  const directTaxes = items.filter((i) => i.category !== 'benefit').reduce((s, i) => s + i.amount, 0);
  const afterTax = grossIncome - (directTaxes - (owner ? 0 : propertyTotal)) + ccb;
  const housingCost = owner ? cad(h.mortgageBalance) * ASSUMPTIONS.mortgageRate : rentCad;
  let spendable = Math.max(0, afterTax * (1 - persona.savingsRate) - housingCost);

  const sales = SALES[prov];
  const consumptionTaxes = { gst: 0, pst: 0, fuelFed: 0, fuelProv: 0, fuelRegional: 0, vehicle: 0, luxury: 0, tariff: 0 };
  const traces: string[] = [];

  // Car purchase, spread over the years kept.
  const carPrice = cad(persona.car.purchasePrice);
  if (persona.car.type !== 'none' && carPrice > 0) {
    const yrs = Math.max(1, persona.car.yearsKept);
    const provRate = VEHICLE_SALES_TAX[prov](carPrice);
    const luxury = carPrice > FEDERAL.luxuryThreshold ? Math.min(0.1 * carPrice, 0.2 * (carPrice - FEDERAL.luxuryThreshold)) : 0;
    consumptionTaxes.gst += (carPrice * GST) / yrs;
    consumptionTaxes.vehicle += (carPrice * provRate) / yrs;
    consumptionTaxes.luxury += luxury / yrs;
    spendable = Math.max(0, spendable - (carPrice * (1 + GST + provRate) + luxury) / yrs);
    traces.push(`Car ${fmt(carPrice)}: GST 5%${provRate ? ` + provincial ${pct(provRate, 0)}` : ''}${luxury ? ` + luxury tax ${fmt(luxury)}` : ''}, spread over ${yrs} years`);
  }

  // Motor fuel: per-litre excise, then sales tax on top (tax on tax).
  if (persona.car.type === 'gas') {
    const litres = (FUEL.kmByMileage[persona.car.mileage] * FUEL.litresPer100km) / 100;
    const excise = FUEL.federalPerLitre + city.fuelTax.provincial + city.fuelTax.regional;
    const salesRate = GST + (prov === 'ON' ? 0.08 : 0);
    const perLitre = (FUEL.preTaxPricePerLitre + excise) * (1 + salesRate);
    const cost = litres * perLitre;
    consumptionTaxes.fuelFed += litres * FUEL.federalPerLitre;
    consumptionTaxes.fuelProv += litres * city.fuelTax.provincial;
    consumptionTaxes.fuelRegional += litres * city.fuelTax.regional;
    consumptionTaxes.gst += litres * (FUEL.preTaxPricePerLitre + excise) * GST;
    consumptionTaxes.pst += litres * (FUEL.preTaxPricePerLitre + excise) * (salesRate - GST);
    spendable = Math.max(0, spendable - cost);
    traces.push(`Fuel: ${fmt(litres)} L × (${FUEL.preTaxPricePerLitre} + ${excise.toFixed(3)} excise) × (1 + ${pct(salesRate, 0)} sales tax) = ${fmt(cost)}`);
  } else if (persona.car.type === 'ev') {
    const kwh = FUEL.kmByMileage[persona.car.mileage] * FUEL.evKwhPerKm;
    const r = sales.electricity;
    const cost = kwh * FUEL.electricityPricePerKwh * (1 + r.gst + r.pst);
    consumptionTaxes.gst += kwh * FUEL.electricityPricePerKwh * r.gst;
    consumptionTaxes.pst += kwh * FUEL.electricityPricePerKwh * r.pst;
    spendable = Math.max(0, spendable - cost);
  }

  // Home energy (and water), from household spending survey averages for the province.
  const energySpend = (consumption.homeEnergyAndWater as Record<string, number>)[prov] * ASSUMPTIONS.homeEnergyFactor[h.homeType];
  const er = persona.heating === 'electric' || persona.heating === 'heatpump' ? sales.electricity : sales.naturalGas;
  const energyTaxable = energySpend * 0.8; // ~20% of the survey figure is water, which is not taxed
  consumptionTaxes.gst += (energyTaxable * er.gst) / (1 + er.gst + er.pst);
  consumptionTaxes.pst += (energyTaxable * er.pst) / (1 + er.gst + er.pst);
  spendable = Math.max(0, spendable - energySpend);

  // Everything else: groceries vs. other spending, at the effective rates households actually pay.
  const basket = spendable;
  const gShare = groceryShare(basket);
  const g = basket * gShare;
  const o = basket - g;
  const gr = sales.groceries;
  const or = sales.other;
  consumptionTaxes.gst += (g * gr.gst) / (1 + gr.gst + gr.pst) + (o * or.gst) / (1 + or.gst + or.pst);
  consumptionTaxes.pst += (g * gr.pst) / (1 + gr.gst + gr.pst) + (o * or.pst) / (1 + or.gst + or.pst);
  traces.push(
    `Other spending ${fmt(basket)}: ${pct(gShare, 0)} groceries (taxed at ${pct(gr.gst + gr.pst)}), the rest taxed at an average ${pct(or.gst + or.pst)} (2024 effective rates, StatCan 36-10-0432)`,
  );
  const t = tariffRate();
  consumptionTaxes.tariff = (basket * t.rate) / (1 + t.rate);

  const hst = prov === 'ON';
  items.push({ id: 'gst', label: hst ? 'HST, federal 5% part' : 'GST', category: 'consumption', level: 'federal', amount: consumptionTaxes.gst, confidence: 'medium',
    note: 'On your spending (tax-inclusive). Groceries, rent, most health and financial services are not taxed.', trace: traces });
  if (consumptionTaxes.pst > 0) {
    items.push({ id: 'pst', label: hst ? 'HST, Ontario 8% part' : 'PST', category: 'consumption', level: 'provincial', amount: consumptionTaxes.pst, confidence: 'medium',
      note: hst ? 'Ontario part of the 13% HST, plus 8% retail sales tax on insurance.' : 'BC PST 7% on most goods (10% on liquor); most services are exempt.' });
  }
  if (consumptionTaxes.vehicle + consumptionTaxes.luxury > 0) {
    items.push({ id: 'vehicle', label: 'Sales and luxury tax on your car (spread)', category: 'consumption', level: consumptionTaxes.luxury > consumptionTaxes.vehicle ? 'federal' : 'provincial',
      amount: consumptionTaxes.vehicle + consumptionTaxes.luxury, confidence: 'high',
      note: `Provincial sales tax on the vehicle${consumptionTaxes.luxury ? ' + federal luxury tax' : ''}. GST is in the GST line.` });
  }
  if (consumptionTaxes.fuelFed > 0) {
    items.push({ id: 'fuel-fed', label: 'Federal fuel excise', category: 'consumption', level: 'federal', amount: consumptionTaxes.fuelFed, confidence: 'medium',
      note: '10¢/L regular rate. It was temporarily suspended for part of 2026, and the consumer carbon tax ended April 2025.' });
    items.push({ id: 'fuel-prov', label: `${P.name} fuel tax`, category: 'consumption', level: 'provincial', amount: consumptionTaxes.fuelProv, confidence: 'medium',
      note: `${(city.fuelTax.provincial * 100).toFixed(1)}¢/L${prov === 'AB' ? '; Alberta paused it from October 2026 under its fuel tax relief program' : ''}.` });
    if (consumptionTaxes.fuelRegional > 0) {
      items.push({ id: 'fuel-regional', label: 'TransLink fuel tax', category: 'consumption', level: 'local', amount: consumptionTaxes.fuelRegional, confidence: 'high',
        note: '18.5¢/L in Metro Vancouver, funds regional transit.' });
    }
  }
  if (consumptionTaxes.tariff > 0) {
    items.push({ id: 'tariff', label: 'Tariffs (customs duties)', category: 'consumption', level: 'federal', amount: consumptionTaxes.tariff, confidence: 'low',
      note: `Federal customs revenue in ${t.year} ÷ household spending = ${pct(t.rate, 2)} of what you buy. ${t.year === '2025' ? "2025 includes Canada's counter-tariffs, most of which ended September 2025." : ''}` });
  }

  // ---------- Info lines ----------
  if (w.retirementAccounts > 0) {
    info.push({ id: 'retirement', label: 'Future tax inside your retirement accounts', amount: cad(w.retirementAccounts) * ASSUMPTIONS.retirementFutureTaxRate,
      note: `About ${pct(ASSUMPTIONS.retirementFutureTaxRate, 0)} of RRSP-type balances will be paid as tax on withdrawal, so your net worth is overstated by this much.` });
  }
  if (city.assessmentRatio !== 1 && owner) warnings.push('Toronto assessed values are an estimate (85% of market value); MPAC still uses January 2016 values.');

  // ---------- Borrowing ----------
  const links: LevelLink[] = [
    { level: 'federal', seriesId: 'CA-federal', isProxy: false },
    { level: 'provincial', seriesId: `CA-${prov}`, isProxy: false },
    { level: 'local', seriesId: `CA-${prov}-local`, isProxy: true },
  ];
  return assembleResult({
    placeId: cityId, currency: 'CAD', fx, grossIncome, items, info, warnings,
    deferred: (taxesByLevel) => links.map((l) => deferredForLevel(l, taxesByLevel[l.level], opts.year)),
  });
}
