// View-model helpers shared by the views.

import { useMemo } from 'react';
import { calculate, PLACES } from '../engine';
import type { CalcOptions, Persona, PlaceResult } from '../engine/types';

export interface Segment {
  key: 'income' | 'payroll' | 'consumption' | 'property' | 'borrowed' | 'benefit';
  label: string;
  slot: number;
  hint: string;
}

/** Stack order = palette order, so adjacent segments keep the validated colour separation. */
export const SEGMENTS: Segment[] = [
  { key: 'income', label: 'Income tax', slot: 0, hint: 'Income taxes at every level, surtaxes and surcharges, taxes on investment income' },
  { key: 'payroll', label: 'Payroll taxes', slot: 1, hint: 'Social contributions: CPP/EI, FICA, National Insurance, European social insurance (employee side; both sides if self-employed)' },
  { key: 'consumption', label: 'Sales, VAT, fuel & tariffs', slot: 2, hint: 'GST/HST/PST, sales tax, VAT, fuel and energy taxes, vehicle taxes, customs duties' },
  { key: 'property', label: 'Property, wealth & transfer', slot: 3, hint: 'Property tax, council tax, wealth tax, land transfer tax and stamp duty, development charges' },
  { key: 'borrowed', label: 'Borrowed on your behalf', slot: 4, hint: 'Your share of the increase in each government\'s net debt this year (negative = debt paid down)' },
  { key: 'benefit', label: 'Benefits received', slot: 5, hint: 'Cash benefits, when "net of cash transfers" is on' },
];

export function segmentValue(r: PlaceResult, key: Segment['key']): number {
  switch (key) {
    case 'borrowed': return r.borrowed;
    default: return r.byCategory[key];
  }
}

export function toUsd(r: PlaceResult, v: number) {
  return v / r.fx;
}

export function useAllResults(persona: Persona, options: CalcOptions): PlaceResult[] {
  return useMemo(() => PLACES.map((p) => calculate(persona, p.id, options)), [persona, options]);
}

export const placeName = (id: string) => PLACES.find((p) => p.id === id)?.name ?? id;

/** Burden mix: what share of the implicit total comes from each family. */
export function fingerprint(r: PlaceResult) {
  const total = r.implicitTotal || 1;
  return {
    labour: (r.byCategory.income + r.byCategory.payroll) / total,
    consumption: r.byCategory.consumption / total,
    property: r.byCategory.property / total,
    deferred: r.borrowed / total,
  };
}
