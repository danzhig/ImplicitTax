// Full US calculation for one city. Money in the persona is already USD (fx = 1).
// Internally the "provincial" level holds the state government.

import consumption from '../../../data/consumption/us.json';
import { progressive } from '../brackets';
import { deferredForLevel, type LevelLink } from '../fiscal';
import { assembleResult } from '../assemble';
import type { CalcOptions, InfoItem, LineItem, Persona, PlaceResult } from '../types';
import { usIncomeTax, usPayroll, type UsHousehold } from './incomeTax';
import { FEDERAL, STATES, US_ASSUMPTIONS, US_CITIES, type UsCityParams } from './params2026';
import { ASSUMPTIONS as SHARED } from '../ca/params2026';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const pct = (r: number, d = 1) => `${(r * 100).toFixed(d)}%`;
type CityRates = { stateRate: number; localRate: number; taxableShare: number; note: string };
const SALES = consumption.cities as unknown as Record<string, CityRates>;

/** Buyer- and seller-side property transfer taxes for a home sale at `value` (USD). */
function transferTaxes(cityId: string, value: number, mortgage: number): { label: string; amount: number; level: 'provincial' | 'local'; note: string }[] {
  const out: { label: string; amount: number; level: 'provincial' | 'local'; note: string }[] = [];
  if (cityId === 'nyc') {
    const mansion = value < 1e6 ? 0 : value < 2e6 ? 0.01 : value < 3e6 ? 0.0125 : value < 5e6 ? 0.015 : value < 10e6 ? 0.0225 : value < 15e6 ? 0.0325 : value < 20e6 ? 0.035 : value < 25e6 ? 0.0375 : 0.039;
    if (mansion) out.push({ label: 'NY mansion tax (buyer)', amount: value * mansion, level: 'provincial', note: `${pct(mansion, 2)} of the whole price on homes of $1M+` });
    if (mortgage > 0) out.push({ label: 'NYC mortgage recording tax (buyer)', amount: mortgage * (mortgage < 500000 ? 0.018 : 0.01925), level: 'local', note: '1.8% of the loan (1.925% from $500k); not charged on co-ops' });
    out.push({ label: 'NY transfer tax (seller)', amount: value * (value >= 3e6 ? 0.0065 : 0.004), level: 'provincial', note: 'Paid when you sell: 0.4% (0.65% from $3M)' });
    out.push({ label: 'NYC transfer tax (seller)', amount: value * (value > 500000 ? 0.01425 : 0.01), level: 'local', note: 'Paid when you sell: 1% (1.425% above $500k)' });
  } else if (cityId === 'sf') {
    const r = value <= 250000 ? 0.005 : value <= 1e6 ? 0.0068 : value <= 5e6 ? 0.0075 : value <= 10e6 ? 0.0275 : value <= 25e6 ? 0.055 : 0.06;
    out.push({ label: 'San Francisco transfer tax (usually seller)', amount: value * r, level: 'local', note: `${pct(r, 2)} of the whole price (rates unverified for 2026)` });
  } else if (cityId === 'seattle') {
    const reet = progressive(value, [{ upTo: 525000, rate: 0.011 }, { upTo: 1525000, rate: 0.0128 }, { upTo: 3025000, rate: 0.0275 }, { upTo: null, rate: 0.03 }]);
    out.push({ label: 'WA real estate excise tax (seller)', amount: reet, level: 'provincial', note: 'Graduated 1.1%-3% of the price (thresholds may have been indexed)' });
    out.push({ label: 'Seattle real estate excise tax (seller)', amount: value * 0.005, level: 'local', note: '0.5% local REET' });
  }
  return out;
}

function propertyTax(city: UsCityParams, value: number, owner: boolean): { local: number; state: number; note: string } {
  if (city.propertyUnits) {
    let total = 0;
    const parts: string[] = [];
    for (const u of city.propertyUnits) {
      const taxable = owner ? Math.max(0, value * (1 - (u.homesteadPct ?? 0)) - (u.homesteadFlat ?? 0)) : value;
      total += taxable * u.rate;
      parts.push(`${u.name} ${(u.rate * 100).toFixed(3)}%`);
    }
    return { local: total, state: 0, note: `${parts.join(', ')}${owner ? '; homestead exemptions applied (20% for most units, $140,000 for schools)' : ''}` };
  }
  const base = Math.max(0, value - (owner ? city.homeownerExemption ?? 0 : 0));
  return { local: base * city.propertyTax.local, state: base * city.propertyTax.state, note: city.propertyTax.note };
}

export function calculateUs(persona: Persona, cityId: string, opts: CalcOptions): PlaceResult {
  const city = US_CITIES[cityId];
  const S = STATES[city.state];
  const items: LineItem[] = [];
  const info: InfoItem[] = [];
  const warnings: string[] = [];

  // ---------- Income ----------
  const w = persona.wealth;
  const inc = persona.income;
  const d = inc.deriveInvestmentIncome;
  const interest = d ? w.cash * SHARED.cashYield + w.bonds * SHARED.bondYield : inc.interest;
  const dividends = d ? w.equities * SHARED.equityDividendYield : inc.dividends;
  const gains = d ? w.equities * SHARED.equityRealizedGainRate : inc.capitalGains;
  const rental = d ? w.otherRealEstate * SHARED.rentalNetYield : inc.rental;
  const partner = persona.household.hasPartner ? persona.household.partnerEmployment : 0;
  const kids = persona.household.childrenUnder6 + persona.household.children6to17;
  const grossIncome = inc.employment + inc.selfEmployment + interest + dividends + gains + rental + partner;

  const h = persona.housing;
  const owner = h.tenure === 'own';
  const prop = owner ? propertyTax(city, h.homeValue, true) : null;
  const mortgageInterest = owner ? Math.min(h.mortgageBalance, FEDERAL.mortgageInterestLoanLimit) * US_ASSUMPTIONS.mortgageRate : 0;

  const hh: UsHousehold = {
    filing: persona.household.hasPartner ? 'joint' : 'single',
    wages: inc.employment, partnerWages: partner, selfEmployment: inc.selfEmployment,
    interest, qualifiedIncome: dividends + gains, capitalGains: gains, rental,
    retirementContribution: persona.retirementContribution, children: kids, age: persona.age,
    propertyTax: prop ? prop.local + prop.state : 0, mortgageInterest, state: city.state, nyc: cityId === 'nyc',
  };
  const pay = usPayroll(hh);
  const tax = usIncomeTax(hh, pay);

  items.push({ id: 'fed-income', label: 'Federal income tax', category: 'income', level: 'federal', amount: tax.federalTax, confidence: 'high',
    note: `2026 brackets 10%-37%${persona.household.hasPartner ? ', married filing jointly' : ''}. ${tax.itemized ? 'Itemizes: state/local taxes are deductible up to the SALT cap.' : 'Standard deduction.'}`,
    trace: tax.federalTrace });
  if (tax.stateTax > 0 || city.state !== 'TX') {
    items.push({ id: 'state-income', label: city.state === 'WA' ? 'Washington capital gains tax' : `${S.name} income tax`, category: 'income', level: 'provincial',
      amount: tax.stateTax, confidence: city.state === 'CA' ? 'medium' : 'high',
      note: city.state === 'CA' ? 'Uses the 2025 rate schedules; the FTB had not published 2026 schedules yet.' : city.state === 'NY' ? '2026 rates after the middle-class rate cut, with high-income recapture.' : '',
      trace: tax.stateTrace });
  }
  if (tax.cityTax > 0) items.push({ id: 'city-income', label: 'New York City income tax', category: 'income', level: 'local', amount: tax.cityTax, confidence: 'high', note: '3.078%-3.876% on New York taxable income.' });

  items.push({ id: 'social-security', label: 'Social Security tax', category: 'payroll', level: 'federal', amount: pay.socialSecurity + (pay.selfEmploymentTax ? pay.selfEmploymentTax * (12.4 / 15.3) : 0), confidence: 'high',
    note: `6.2% of wages up to $184,500.${pay.selfEmploymentTax ? ' Includes self-employment tax (both halves).' : ''} Unlike Canada's CPP, it earns no income tax credit (half of self-employment tax is deductible).`, trace: pay.trace });
  items.push({ id: 'medicare', label: 'Medicare tax', category: 'payroll', level: 'federal', amount: pay.medicare + pay.additionalMedicare + (pay.selfEmploymentTax ? pay.selfEmploymentTax * (2.9 / 15.3) : 0), confidence: 'high',
    note: '1.45% of all wages, +0.9% above $200,000 ($250,000 joint).' });
  for (const p of pay.statePrograms) {
    if (p.amount > 0) items.push({ id: p.id, label: p.label, category: 'payroll', level: 'provincial', amount: p.amount, confidence: 'medium', note: p.note });
  }
  info.push({ id: 'employer', label: 'Your employer also pays (not in your rate)', amount: pay.employerFica,
    note: 'Employer Social Security and Medicare (7.65%), plus federal and state unemployment insurance.' });

  // ---------- Property ----------
  const rentYear = h.monthlyRent * 12;
  if (owner && prop) {
    items.push({ id: 'prop-local', label: `${city.name} property taxes`, category: 'property', level: 'local', amount: prop.local, confidence: city.propertyTax.confidence,
      note: `On ${fmt(h.homeValue)}. ${prop.note}` });
    if (prop.state > 0) items.push({ id: 'prop-state', label: 'State school property levy', category: 'property', level: 'provincial', amount: prop.state, confidence: 'low', note: 'Washington state school levy, part of the Seattle property tax bill.' });
  } else if (opts.rentersPayPropertyTax && rentYear > 0) {
    const eq = rentYear / US_ASSUMPTIONS.grossRentalYield;
    const p = propertyTax(city, eq, false);
    items.push({ id: 'prop-local', label: `${city.name} property taxes (built into your rent, estimate)`, category: 'property', level: 'local', amount: p.local, confidence: 'low',
      note: `Rent ${fmt(rentYear)}/yr ÷ ${pct(US_ASSUMPTIONS.grossRentalYield)} gross yield = equivalent value ${fmt(eq)}` });
    if (p.state > 0) items.push({ id: 'prop-state', label: 'State school property levy (in rent)', category: 'property', level: 'provincial', amount: p.state, confidence: 'low', note: 'Estimate.' });
  }
  if (owner && h.includePurchase && h.homeValue > 0) {
    const yrs = Math.max(1, h.holdingYears);
    for (const t of transferTaxes(cityId, h.homeValue, h.mortgageBalance)) {
      items.push({ id: `transfer-${t.label}`, label: `${t.label} (spread)`, category: 'property', level: t.level, amount: t.amount / yrs, confidence: 'medium',
        note: `${fmt(t.amount)} one-off, spread over ${yrs} years. ${t.note}.` });
    }
    if (cityId === 'houston') info.push({ id: 'no-transfer', label: 'Texas has no real estate transfer tax', amount: 0, note: 'Buying or selling a home in Houston carries no transfer tax.' });
    if (h.newBuild) warnings.push(`Impact fees on new homes in ${city.name} are not sourced yet, so they are left out.`);
  }

  // ---------- Spending and consumption taxes ----------
  const direct = items.reduce((s, i) => s + i.amount, 0);
  const embeddedProperty = owner ? 0 : items.filter((i) => i.category === 'property').reduce((s, i) => s + i.amount, 0);
  const afterTax = grossIncome - (direct - embeddedProperty);
  const housingCost = owner ? mortgageInterest : rentYear;
  let spendable = Math.max(0, afterTax * (1 - persona.savingsRate) - housingCost);
  const sales = SALES[cityId];
  const ct = { stateSales: 0, localSales: 0, fuelFed: 0, fuelState: 0, vehicleState: 0, vehicleLocal: 0, vehicleAnnual: 0, tariff: 0 };
  const trace: string[] = [];

  const carPrice = persona.car.purchasePrice;
  if (persona.car.type !== 'none' && carPrice > 0) {
    const yrs = Math.max(1, persona.car.yearsKept);
    ct.vehicleState += (carPrice * city.vehicle.salesTaxState) / yrs;
    ct.vehicleLocal += (carPrice * city.vehicle.salesTaxLocal) / yrs;
    // annual value-based taxes, on an average value of about half the purchase price over the years kept
    ct.vehicleAnnual += carPrice * 0.5 * city.vehicle.annualValueTax;
    spendable = Math.max(0, spendable - (carPrice * (1 + city.vehicle.salesTaxState + city.vehicle.salesTaxLocal)) / yrs - ct.vehicleAnnual);
    trace.push(`Car ${fmt(carPrice)}: sales tax ${pct(city.vehicle.salesTaxState + city.vehicle.salesTaxLocal, 2)} spread over ${yrs} years${city.vehicle.annualValueTax ? `; ${city.vehicle.annualNote}` : ''}`);
  }
  if (persona.car.type === 'gas') {
    const km = { low: 8000, average: 15000, high: 25000 }[persona.car.mileage];
    const gallons = (km * 9) / 100 / US_ASSUMPTIONS.litresPerGallon;
    const excise = 0.184 + city.fuelTaxPerGallon.state;
    const price = (US_ASSUMPTIONS.preTaxGasPrice + excise) * (1 + city.fuelTaxPerGallon.salesTaxRate);
    ct.fuelFed += gallons * 0.184;
    ct.fuelState += gallons * city.fuelTaxPerGallon.state;
    ct.localSales += gallons * (US_ASSUMPTIONS.preTaxGasPrice + excise) * city.fuelTaxPerGallon.salesTaxRate;
    spendable = Math.max(0, spendable - gallons * price);
    trace.push(`Fuel: ${fmt(gallons)} gallons; federal 18.4¢ + state ${(city.fuelTaxPerGallon.state * 100).toFixed(1)}¢ per gallon${city.fuelTaxPerGallon.salesTaxRate ? ` + ${pct(city.fuelTaxPerGallon.salesTaxRate, 2)} sales tax` : ''}`);
  } else if (persona.car.type === 'ev') {
    const kwh = { low: 8000, average: 15000, high: 25000 }[persona.car.mileage] * 0.2;
    spendable = Math.max(0, spendable - kwh * US_ASSUMPTIONS.evElectricityPerKwh);
  }
  // Home energy: residential electricity and gas are exempt from sales tax in all four cities.
  spendable = Math.max(0, spendable - 3000 * SHARED.homeEnergyFactor[h.homeType]);

  const rate = sales.stateRate + sales.localRate;
  const effective = sales.taxableShare * rate;
  const salesTotal = (spendable * effective) / (1 + effective);
  ct.stateSales += (salesTotal * sales.stateRate) / rate;
  ct.localSales += (salesTotal * sales.localRate) / rate;
  ct.tariff = (spendable * US_ASSUMPTIONS.tariffRate) / (1 + US_ASSUMPTIONS.tariffRate);
  trace.push(`Other spending ${fmt(spendable)}: about ${pct(sales.taxableShare, 0)} is taxable at ${pct(rate, 3)} (${sales.note}). Groceries, rent, utilities, health care and most services are exempt.`);

  items.push({ id: 'sales-state', label: 'State sales tax', category: 'consumption', level: 'provincial', amount: ct.stateSales + ct.vehicleState, confidence: 'medium',
    note: 'On taxable spending (estimate from the state spending mix and sales tax rules), including on your car.', trace });
  items.push({ id: 'sales-local', label: 'Local sales tax', category: 'consumption', level: 'local', amount: ct.localSales + ct.vehicleLocal, confidence: 'medium', note: 'City, county and transit district sales taxes.' });
  if (ct.vehicleAnnual > 0) items.push({ id: 'vehicle-annual', label: 'Annual vehicle value tax', category: 'consumption', level: 'local', amount: ct.vehicleAnnual, confidence: 'medium', note: `${city.vehicle.annualNote}, on an average value of half the purchase price.` });
  if (ct.fuelFed > 0) {
    items.push({ id: 'fuel-fed', label: 'Federal gasoline tax', category: 'consumption', level: 'federal', amount: ct.fuelFed, confidence: 'high', note: '18.4¢ per gallon.' });
    items.push({ id: 'fuel-state', label: `${S.name} gasoline tax`, category: 'consumption', level: 'provincial', amount: ct.fuelState, confidence: 'medium', note: `${(city.fuelTaxPerGallon.state * 100).toFixed(1)}¢ per gallon.` });
  }
  items.push({ id: 'tariff', label: 'Tariffs (customs duties)', category: 'consumption', level: 'federal', amount: ct.tariff, confidence: 'low',
    note: `US customs revenue FY2026 ($173B) ÷ household spending = ${pct(US_ASSUMPTIONS.tariffRate, 2)} of what you buy.` });

  if (w.retirementAccounts > 0) {
    info.push({ id: 'retirement', label: 'Future tax inside your retirement accounts', amount: w.retirementAccounts * SHARED.retirementFutureTaxRate,
      note: 'About 30% of 401(k)/IRA balances will be paid as tax on withdrawal.' });
  }
  if (tax.childCredit > 0) info.push({ id: 'ctc', label: 'Child tax credit (already in federal income tax)', amount: tax.childCredit, note: '$2,200 per child under 17.' });
  if (persona.housing.foreignBuyer) warnings.push('The US has no foreign-buyer tax on homes, but non-resident sellers face 15% FIRPTA withholding.');

  const links: LevelLink[] = [
    { level: 'federal', seriesId: 'US-federal', isProxy: false },
    { level: 'provincial', seriesId: `US-${city.state}`, isProxy: false },
    { level: 'local', seriesId: `US-${city.state}-local`, isProxy: true },
  ];
  return assembleResult({
    placeId: cityId, currency: 'USD', fx: 1, grossIncome, items, info, warnings,
    deferred: (taxesByLevel) => links.map((l) => deferredForLevel(l, taxesByLevel[l.level], opts.year)),
  });
}
