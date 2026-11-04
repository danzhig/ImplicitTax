// Germany 2026 (Munich, Bavaria): income tax (§32a EStG), solidarity surcharge, church tax, flat tax on
// capital income, social insurance (both sides), Kindergeld vs. child allowance.

import type { InfoItem, LineItem } from '../types';
import { fmt, kids, pct, type CountryTaxResult, type EuHousehold } from './common';

export const DE = {
  // §32a EStG 2026 (BMF tariff history): zone limits and formula constants
  tariff: { basic: 12348, z2: 17799, z3: 69878, z4: 277825 },
  soli: { rate: 0.055, freigrenze: 20350, slope: 0.119 },
  church: 0.08, // Bavaria
  flatTax: 0.25,
  saverAllowance: 1000, // Sparer-Pauschbetrag per person
  workAllowance: 1230, // Arbeitnehmer-Pauschbetrag
  specialAllowance: 36,
  childAllowance: 9756, // Kinderfreibetrag + BEA, per child (both parents)
  kindergeld: 259 * 12,
  basisrenteCap: 30826, // 2026 cap on old-age provision incl. statutory pension contributions (estimate)
  si: {
    pension: 0.093, unemployment: 0.013, health: 0.073 + 0.0145, care: 0.018, careChildless: 0.006,
    ceilingPension: 101400, ceilingHealth: 69750,
    selfEmployedHealth: 0.14 + 0.029, selfEmployedCare: 0.036,
  },
  // Revenue shares (Art. 106 GG): wage/income tax 42.5/42.5/15; flat tax on interest and gains 44/44/12
  incomeTaxShare: { federal: 0.425, provincial: 0.425, local: 0.15 },
  flatTaxShare: { federal: 0.44, provincial: 0.44, local: 0.12 },
};

/** Tariff income tax for one taxable income (single). */
export function deTariff(zvE: number): number {
  const x = Math.floor(Math.max(0, zvE));
  const T = DE.tariff;
  if (x <= T.basic) return 0;
  if (x <= T.z2) {
    const y = (x - T.basic) / 10000;
    return Math.floor((914.51 * y + 1400) * y);
  }
  if (x <= T.z3) {
    const z = (x - T.z2) / 10000;
    return Math.floor((173.1 * z + 2397) * z + 1034.87);
  }
  if (x <= T.z4) return Math.floor(0.42 * x - 11135.63);
  return Math.floor(0.45 * x - 19470.38);
}

const incomeTaxFor = (zvE: number, joint: boolean) => (joint ? 2 * deTariff(zvE / 2) : deTariff(zvE));

function soli(tax: number, joint: boolean): number {
  const f = DE.soli.freigrenze * (joint ? 2 : 1);
  return tax <= f ? 0 : Math.min(tax * DE.soli.rate, (tax - f) * DE.soli.slope);
}

interface Contributions { pension: number; unemployment: number; health: number; care: number }

function employeeContributions(wage: number, childless: boolean): Contributions {
  const S = DE.si;
  const p = Math.min(wage, S.ceilingPension);
  const h = Math.min(wage, S.ceilingHealth);
  return { pension: p * S.pension, unemployment: p * S.unemployment, health: h * S.health, care: h * (S.care + (childless ? S.careChildless : 0)) };
}

export function germany(h: EuHousehold): CountryTaxResult {
  const items: LineItem[] = [];
  const info: InfoItem[] = [];
  const warnings: string[] = [];
  const joint = h.partner;
  const nKids = kids(h);
  const childless = nKids === 0 && h.age >= 23;

  // ---- Social insurance ----
  const me = employeeContributions(h.wages, childless);
  const pa = employeeContributions(h.partnerWages, childless);
  const S = DE.si;
  const seBase = Math.min(Math.max(0, h.selfEmployment), S.ceilingHealth);
  const seHealth = seBase * S.selfEmployedHealth;
  const seCare = seBase * (S.selfEmployedCare + (childless ? S.careChildless : 0));
  const pension = me.pension + pa.pension;
  const unemployment = me.unemployment + pa.unemployment;
  const health = me.health + pa.health + seHealth;
  const care = me.care + pa.care + seCare;

  // ---- Taxable income ----
  const wageIncome = (w: number) => (w > 0 ? Math.max(0, w - DE.workAllowance) : 0);
  const earned = wageIncome(h.wages) + wageIncome(h.partnerWages) + h.selfEmployment + h.rental;
  const voluntary = Math.max(0, Math.min(h.retirement, DE.basisrenteCap - 2 * pension));
  // Pension contributions fully deductible; basic health (less 4% for sick pay) and care fully deductible.
  const vorsorge = pension + voluntary + health * 0.96 + care;
  const special = DE.specialAllowance * (joint ? 2 : 1);
  const zvEBase = Math.max(0, earned - vorsorge - special);

  const taxNoKids = incomeTaxFor(zvEBase, joint);
  const zvEKids = Math.max(0, zvEBase - nKids * DE.childAllowance);
  const taxWithAllowance = incomeTaxFor(zvEKids, joint);
  const kindergeld = nKids * DE.kindergeld;
  // Günstigerprüfung: the child allowance is used only if its tax saving beats Kindergeld.
  const allowanceWins = taxNoKids - taxWithAllowance > kindergeld;
  const incomeTax = allowanceWins ? taxWithAllowance + kindergeld : taxNoKids;
  // Soli and church tax are always based on the tax after child allowances.
  const soliTax = soli(taxWithAllowance, joint);
  const churchTax = h.church ? taxWithAllowance * DE.church : 0;

  // ---- Capital income: 25% flat tax + soli ----
  const capital = h.interest + h.dividends + h.gains;
  const capitalTaxable = Math.max(0, capital - DE.saverAllowance * (joint ? 2 : 1));
  const flat = capitalTaxable * DE.flatTax;
  const flatSoli = flat * DE.soli.rate;
  const flatChurch = h.church ? flat * DE.church : 0;

  const reliefFromContributions = incomeTaxFor(zvEBase + pension + health * 0.96 + care, joint) - taxNoKids;
  const trace = [
    `Wages after the EUR 1,230 work allowance, self-employment and rental income: ${fmt(earned)}`,
    `Deductible social insurance and pension saving: -${fmt(vorsorge)} (pension ${fmt(pension)}${voluntary ? ` + private pension ${fmt(voluntary)}` : ''}, health ${fmt(health * 0.96)}, care ${fmt(care)})`,
    `Taxable income ${fmt(zvEBase)}${joint ? ' (joint: splitting, tax on half × 2)' : ''}: tariff tax ${fmt(taxNoKids)}`,
  ];
  if (nKids) trace.push(allowanceWins ? `Child allowance (${fmt(DE.childAllowance)} per child) beats Kindergeld: tax ${fmt(taxWithAllowance)} + Kindergeld ${fmt(kindergeld)} added back` : `Kindergeld ${fmt(kindergeld)} beats the child allowance, so it stays`);

  const split = (id: string, label: string, amount: number, share: { federal: number; provincial: number; local: number }, note: string, tr?: string[]) => {
    const parts: [keyof typeof share, string][] = [['federal', 'federal share'], ['provincial', 'Bavaria share'], ['local', 'Munich share']];
    for (const [lvl, name] of parts) {
      items.push({ id: `${id}-${lvl}`, label: `${label} (${name})`, category: 'income', level: lvl, amount: amount * share[lvl], confidence: 'high',
        note: lvl === 'federal' ? note : `${pct(share[lvl], 1)} of ${label.toLowerCase()} goes to ${lvl === 'provincial' ? 'the Land' : 'the municipality'}.`,
        trace: lvl === 'federal' ? tr : undefined });
    }
  };
  split('de-income', 'Income tax', incomeTax, DE.incomeTaxShare, `2026 tariff 14%-45%. Shared: 42.5% federal, 42.5% Land, 15% municipality.`, trace);
  if (soliTax + flatSoli > 0) items.push({ id: 'de-soli', label: 'Solidarity surcharge', category: 'income', level: 'federal', amount: soliTax + flatSoli, confidence: 'high',
    note: `5.5% of income tax above the EUR 20,350 exemption limit${joint ? ' (doubled for couples)' : ''}, phased in; always 5.5% on the flat tax on capital income.` });
  if (flat > 0) split('de-flat', 'Flat tax on capital income', flat, DE.flatTaxShare, `25% on interest, dividends and gains above the EUR 1,000 saver allowance${joint ? ' (2,000 for couples)' : ''}.`);
  if (churchTax + flatChurch > 0) items.push({ id: 'de-church', label: 'Church tax', category: 'income', level: 'social', amount: churchTax + flatChurch, confidence: 'high',
    note: '8% of income tax in Bavaria, for church members. It goes to the churches, so it carries no government borrowing.' });

  const contribNote = (what: string) => `${what} Deductible from taxable income, which saves about ${fmt(reliefFromContributions)} of income tax across pension, health and care.`;
  items.push({ id: 'de-pension', label: 'Pension insurance', category: 'payroll', level: 'social', amount: pension, confidence: 'high',
    note: contribNote(`9.3% of wages up to EUR 101,400.`) });
  items.push({ id: 'de-health', label: 'Health insurance', category: 'payroll', level: 'social', amount: health, confidence: 'high',
    note: `7.3% + half of the average 2.9% extra contribution, up to EUR 69,750.${seHealth ? ' Self-employed pay both halves.' : ''}` });
  items.push({ id: 'de-care', label: 'Long-term care insurance', category: 'payroll', level: 'social', amount: care, confidence: 'high',
    note: `1.8%${childless ? ' + 0.6% childless surcharge' : ''} up to EUR 69,750.` });
  items.push({ id: 'de-unemployment', label: 'Unemployment insurance', category: 'payroll', level: 'social', amount: unemployment, confidence: 'high',
    note: '1.3% up to EUR 101,400. Not deductible in practice (the cap is used up by health and care).' });
  if (h.selfEmployment > 0) warnings.push('German self-employed are usually not in the state pension; only health and care insurance are counted for self-employment income.');

  const employer = (w: number) => Math.min(w, S.ceilingPension) * (0.093 + 0.013) + Math.min(w, S.ceilingHealth) * (0.073 + 0.0145 + 0.018) + w * 0.025;
  info.push({ id: 'employer', label: 'Your employer also pays (not in your rate)', amount: employer(h.wages) + employer(h.partnerWages),
    note: 'Employer halves of pension, unemployment, health and care insurance, plus accident insurance and levies (about 2.5%).' });

  return {
    items, info, warnings,
    // Kindergeld is paid either way; when the child allowance wins it is added back to income tax above.
    benefits: kindergeld > 0 ? [{ id: 'kindergeld', label: 'Kindergeld', amount: kindergeld, level: 'federal', note: 'EUR 259 a month per child.' }] : [],
  };
}
