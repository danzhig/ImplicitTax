// European cities: 2026 parameters outside income tax (exchange rates, fuel, energy, vehicles,
// property). Sources and status: data/rules/eu/RESEARCH.md.

import type { HomeType } from '../types';
import type { EuCountry } from './common';

/** Local currency per USD: ECB reference rates, average of January-October 2026. */
export const FX: Record<EuCountry, { currency: string; perUsd: number }> = {
  DE: { currency: 'EUR', perUsd: 0.864 },
  LU: { currency: 'EUR', perUsd: 0.864 },
  IE: { currency: 'EUR', perUsd: 0.864 },
  CH: { currency: 'CHF', perUsd: 0.7984 },
  UK: { currency: 'GBP', perUsd: 0.7443 },
  NO: { currency: 'NOK', perUsd: 9.5396 },
  DK: { currency: 'DKK', perUsd: 6.4567 },
};

export interface EuCity {
  id: string;
  name: string;
  region: string;
  country: EuCountry;
  countryName: string;
  /** Fiscal series ids; null where the country has no middle level of government. */
  series: { federal: string; provincial: string | null; local: string };
  levelNames: { federal: string; provincial: string; local: string; social: string };
  mortgageRate: number;
  /** Gross rent ÷ value, to turn rent into an equivalent home value. */
  grossRentalYield: number;
  /** Petrol: excise + carbon tax per litre (local currency), and VAT on the pump price. */
  fuel: { excisePerLitre: number; preTaxPerLitre: number; vat: number; note: string };
  /** Home energy: typical yearly bill (local, for a townhouse) and the tax share of the bill. */
  energy: { bill: number; taxShareElectric: number; taxShareFossil: number; taxShareDistrict: number; note: string };
  /** Car: VAT on purchase, extra one-off registration tax (share of pre-tax price), yearly tax. */
  vehicle: { vat: number; registration: (price: number, ev: boolean) => number; annual: (ev: boolean) => number; note: string };
  /** Who gets the VAT and fuel taxes. Germany shares VAT between levels. */
  vatSplit: { federal: number; provincial: number; local: number };
  /** Tariff-like taxes: EU customs duties are an EU own resource, so none here. */
}

const LEVELS_DE = { federal: 'Federal (Bund)', provincial: 'State (Bavaria)', local: 'City (Munich)', social: 'Social insurance funds' };
const LEVELS_CH = { federal: 'Confederation', provincial: 'Canton (Zurich)', local: 'City (Zurich)', social: 'Social insurance (AHV)' };
const LEVELS_UNITARY = (local: string, social: string) => ({ federal: 'Central government', provincial: '-', local, social });

/** Living area and land area (m²) by home type, used where property tax depends on size. */
export const AREAS: Record<HomeType, { living: number; land: number }> = {
  apartment: { living: 80, land: 40 },
  townhouse: { living: 120, land: 220 },
  detached: { living: 160, land: 550 },
};

export const EU_CITIES: Record<string, EuCity> = {
  munich: {
    id: 'munich', name: 'Munich', region: 'Bavaria', country: 'DE', countryName: 'Germany',
    series: { federal: 'DE-federal', provincial: 'DE-BY', local: 'DE-BY-local' },
    levelNames: LEVELS_DE, mortgageRate: 0.036, grossRentalYield: 0.032,
    fuel: { excisePerLitre: 0.6545 + 0.142, preTaxPerLitre: 0.78, vat: 0.19, note: 'Energy tax 65.45 ct/l plus the CO2 price (EUR 55-65/t in 2026, about 14 ct/l), then 19% VAT' },
    energy: { bill: 2800, taxShareElectric: 0.256, taxShareFossil: 0.296, taxShareDistrict: 0.18,
      note: 'Electricity: 19% VAT, electricity tax 2.05 ct/kWh, local concession fee. Gas: VAT, energy tax 0.55 ct/kWh and the CO2 price.' },
    vehicle: { vat: 0.19, registration: () => 0, annual: (ev) => (ev ? 0 : 150), note: 'Motor vehicle tax by CO2 and engine size (about EUR 150); electric cars exempt until 2030' },
    // Federal/Land/municipal shares of VAT (2024 distribution, rounded)
    vatSplit: { federal: 0.52, provincial: 0.45, local: 0.03 },
  },
  zurich: {
    id: 'zurich', name: 'Zurich', region: 'Canton of Zurich', country: 'CH', countryName: 'Switzerland',
    series: { federal: 'CH-federal', provincial: 'CH-ZH', local: 'CH-ZH-local' },
    levelNames: LEVELS_CH, mortgageRate: 0.017, grossRentalYield: 0.03,
    fuel: { excisePerLitre: 0.7682, preTaxPerLitre: 0.85, vat: 0.081, note: 'Mineral oil tax and surcharge 76.82 Rp/l, then 8.1% VAT' },
    energy: { bill: 2400, taxShareElectric: 0.075, taxShareFossil: 0.24, taxShareDistrict: 0.075,
      note: '8.1% VAT; the CO2 levy on heating oil and gas (CHF 120/t) adds about 2.4 Rp/kWh. Two-thirds of the CO2 levy is refunded per head through health insurance.' },
    vehicle: { vat: 0.081, registration: (p) => p * 0.04, annual: (ev) => (ev ? 350 : 450), note: '4% automobile tax on import, Zurich road tax by weight and power' },
    vatSplit: { federal: 1, provincial: 0, local: 0 },
  },
  london: {
    id: 'london', name: 'London', region: 'England', country: 'UK', countryName: 'United Kingdom',
    series: { federal: 'UK-federal', provincial: null, local: 'UK-London-local' },
    levelNames: LEVELS_UNITARY('Borough & GLA', 'National Insurance'), mortgageRate: 0.045, grossRentalYield: 0.045,
    fuel: { excisePerLitre: 0.544, preTaxPerLitre: 0.62, vat: 0.2, note: 'Fuel duty 52.95p/l, rising in steps from September 2026 (about 54.4p averaged over 2026-27), then 20% VAT' },
    energy: { bill: 1720, taxShareElectric: 0.048, taxShareFossil: 0.048, taxShareDistrict: 0.048, note: '5% VAT on domestic energy (policy levies are not taxes and are left out)' },
    vehicle: { vat: 0.2, registration: (p, ev) => (ev ? 10 : Math.min(p, 40000) * 0.012), annual: () => 195,
      note: 'Vehicle excise duty: first-year rate by CO2, then GBP 195 a year (electric cars included from April 2025); GBP 425 extra for cars over GBP 40,000 in years 2-6 not included' },
    vatSplit: { federal: 1, provincial: 0, local: 0 },
  },
  luxembourg: {
    id: 'luxembourg', name: 'Luxembourg City', region: 'Luxembourg', country: 'LU', countryName: 'Luxembourg',
    series: { federal: 'LU-federal', provincial: null, local: 'LU-local' },
    levelNames: LEVELS_UNITARY('Commune', 'Social security'), mortgageRate: 0.036, grossRentalYield: 0.035,
    fuel: { excisePerLitre: 0.58, preTaxPerLitre: 0.78, vat: 0.17, note: 'Excise duties and CO2 tax about 58 ct/l, then 17% VAT' },
    energy: { bill: 2200, taxShareElectric: 0.08, taxShareFossil: 0.12, taxShareDistrict: 0.08, note: '8% VAT on electricity and gas, small electricity tax, CO2 tax on gas and heating oil' },
    vehicle: { vat: 0.17, registration: () => 0, annual: (ev) => (ev ? 30 : 120), note: 'Annual road tax by CO2 emissions' },
    vatSplit: { federal: 1, provincial: 0, local: 0 },
  },
  dublin: {
    id: 'dublin', name: 'Dublin', region: 'Ireland', country: 'IE', countryName: 'Ireland',
    series: { federal: 'IE-federal', provincial: null, local: 'IE-local' },
    levelNames: LEVELS_UNITARY('Dublin City Council', 'Social Insurance Fund'), mortgageRate: 0.039, grossRentalYield: 0.055,
    fuel: { excisePerLitre: 0.68, preTaxPerLitre: 0.78, vat: 0.23, note: 'Mineral oil tax including carbon tax (EUR 71/t from May 2026), then 23% VAT' },
    energy: { bill: 2300, taxShareElectric: 0.083, taxShareFossil: 0.19, taxShareDistrict: 0.083, note: '9% VAT on energy; carbon tax on gas and oil' },
    vehicle: { vat: 0.23, registration: (p, ev) => (ev ? Math.max(0, p * 0.07 - 5000) : p * 0.15), annual: (ev) => (ev ? 120 : 210),
      note: 'Vehicle registration tax by CO2 (about 15% for a typical petrol car; electric cars 7% less up to EUR 5,000 relief), motor tax by CO2' },
    vatSplit: { federal: 1, provincial: 0, local: 0 },
  },
  oslo: {
    id: 'oslo', name: 'Oslo', region: 'Norway', country: 'NO', countryName: 'Norway',
    series: { federal: 'NO-federal', provincial: null, local: 'NO-local' },
    levelNames: LEVELS_UNITARY('Municipality & county', 'National insurance'), mortgageRate: 0.052, grossRentalYield: 0.04,
    fuel: { excisePerLitre: 6.5, preTaxPerLitre: 9.0, vat: 0.25, note: 'Road usage tax and CO2 tax about NOK 6.5/l, then 25% VAT' },
    energy: { bill: 22000, taxShareElectric: 0.26, taxShareFossil: 0.26, taxShareDistrict: 0.22, note: '25% VAT and the electricity consumption tax' },
    vehicle: { vat: 0.25, registration: (p, ev) => (ev ? 0 : p * 0.4),
      annual: () => 3300, note: 'One-off registration tax on petrol cars (CO2, NOx and weight; about 40% of the price for a typical car); VAT on electric cars only above NOK 300,000 from 2026; yearly traffic insurance tax' },
    vatSplit: { federal: 1, provincial: 0, local: 0 },
  },
  copenhagen: {
    id: 'copenhagen', name: 'Copenhagen', region: 'Denmark', country: 'DK', countryName: 'Denmark',
    series: { federal: 'DK-federal', provincial: null, local: 'DK-local' },
    levelNames: LEVELS_UNITARY('Municipality & region', 'ATP'), mortgageRate: 0.04, grossRentalYield: 0.04,
    fuel: { excisePerLitre: 4.9, preTaxPerLitre: 5.4, vat: 0.25, note: 'Energy and CO2 taxes about DKK 4.9/l, then 25% VAT' },
    energy: { bill: 19500, taxShareElectric: 0.21, taxShareFossil: 0.35, taxShareDistrict: 0.22, note: '25% VAT; the electricity tax is cut to the EU minimum in 2026-27; gas carries energy and CO2 taxes' },
    vehicle: { vat: 0.25, registration: (p, ev) => dkRegistrationTax(p * 1.25, ev), annual: (ev) => (ev ? 800 : 3000),
      note: 'Registration tax 25%/85%/150% of the price incl. VAT (electric cars pay 40% of it after a deduction), half-yearly owner tax' },
    vatSplit: { federal: 1, provincial: 0, local: 0 },
  },
};

/** Danish registration tax 2026 on the taxable value (price incl. VAT), simplified (no CO2 surcharge). */
function dkRegistrationTax(value: number, ev: boolean): number {
  const t = Math.min(value, 74800) * 0.25 + Math.max(0, Math.min(value, 232600) - 74800) * 0.85 + Math.max(0, value - 232600) * 1.5;
  return ev ? Math.max(0, t * 0.4 - 165000 * 0.4) : t;
}

/** Shared assumptions that are the same everywhere (yields follow the Canadian ones). */
export const EU_ASSUMPTIONS = {
  /** Litres of petrol per 100 km. */
  litresPer100km: 7.5,
  /** EV charging cost per kWh is not taxed separately here; home electricity covers it. */
  kmByMileage: { low: 8000, average: 15000, high: 25000 } as const,
};
