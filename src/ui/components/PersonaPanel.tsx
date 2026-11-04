import { useRef, useState, type ReactNode } from 'react';
import { placeById } from '../../engine';
import { normalizePersona } from '../../engine/personas';
import type { Persona } from '../../engine/types';
import { shareLink, SLOT_COUNT, useStore } from '../store';

/** Shows the local-currency equivalent of a USD amount for the city being viewed. */
function useLocal() {
  const cityId = useStore((s) => s.cityId);
  const place = placeById(cityId);
  return (usd: number) =>
    place.currency === 'USD'
      ? `${place.name} uses USD`
      : `≈ ${(usd * place.fx).toLocaleString('en-US', { maximumFractionDigits: 0 })} ${place.currency} in ${place.name} (${place.fx.toFixed(3)} ${place.currency}/USD)`;
}

function Num({ label, value, onChange, step = 1000, hint, suffix = 'USD' }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; hint?: string; suffix?: string;
}) {
  const local = useLocal();
  return (
    <label className="field">
      <span className="field-label">{label}{hint && <span className="hint" title={hint}> ⓘ</span>}</span>
      <span className="field-input">
        <input type="number" inputMode="decimal" value={Number.isFinite(value) ? value : 0} step={step} min={0}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} />
        <span className="suffix">{suffix}</span>
      </span>
      {suffix === 'USD' && value > 0 && <span className="local">{local(value)}</span>}
    </label>
  );
}

function Sel<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: [T, string][]; onChange: (v: T) => void;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function Check({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}{hint && <span className="hint" title={hint}> ⓘ</span>}</span>
    </label>
  );
}

function Section({ title, children, open = true }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="section" open={open}>
      <summary>{title}</summary>
      <div className="section-body">{children}</div>
    </details>
  );
}

function Slots() {
  const { slots, active, saveSlot, loadSlot, clearSlot, working, setWorking } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(working, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${working.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'persona'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJson = async (f: File) => {
    try { setWorking(normalizePersona(JSON.parse(await f.text()) as Partial<Persona>)); } catch { alert('That file is not a persona JSON export.'); }
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareLink(working)); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { prompt('Copy this link:', shareLink(working)); }
  };
  return (
    <div className="slots">
      <div className="slot-row">
        {Array.from({ length: SLOT_COUNT }, (_, i) => (
          <div key={i} className={`slot ${active === i ? 'active' : ''}`}>
            <button className="slot-name" disabled={!slots[i]} onClick={() => loadSlot(i)} title={slots[i] ? 'Load this persona' : 'Empty slot'}>
              <span className="slot-num">{i + 1}</span> {slots[i]?.name ?? 'Empty'}
            </button>
            <div className="slot-actions">
              <button onClick={() => saveSlot(i)} title="Save the current persona into this slot">Save here</button>
              {slots[i] && <button onClick={() => clearSlot(i)} title="Clear this slot" aria-label={`Clear slot ${i + 1}`}>✕</button>}
            </div>
          </div>
        ))}
      </div>
      <div className="slot-tools">
        <button onClick={copyLink}>{copied ? 'Link copied' : 'Copy share link'}</button>
        <button onClick={exportJson}>Export</button>
        <button onClick={() => fileRef.current?.click()}>Import</button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
      </div>
      <p className="fine">Saved only in this browser. Nothing is sent anywhere.</p>
    </div>
  );
}

export function PersonaPanel() {
  const p = useStore((s) => s.working);
  const update = useStore((s) => s.update);
  const set = (f: (p: Persona) => void) => update(f);

  return (
    <aside className="panel" aria-label="Persona">
      <p className="fine currency-note">Enter amounts in US dollars. Each one is converted to the local currency of the city you're viewing at the
        2026 average exchange rate; the local amount shows under each field.</p>
      <label className="field name-field">
        <span className="field-label">Persona name</span>
        <input value={p.name} onChange={(e) => set((x) => { x.name = e.target.value; })} />
      </label>
      <Slots />

      <Section title="Income (per year)">
        <Num label="Salary" value={p.income.employment} onChange={(v) => set((x) => { x.income.employment = v; })} />
        <Num label="Self-employment profit" value={p.income.selfEmployment} onChange={(v) => set((x) => { x.income.selfEmployment = v; })}
          hint="Self-employed people pay both the employee and employer halves of CPP." />
        <Num label="Retirement contribution (RRSP/401k)" value={p.retirementContribution} onChange={(v) => set((x) => { x.retirementContribution = v; })} />
        <Check label="Work out investment income from my savings" checked={p.income.deriveInvestmentIncome}
          onChange={(v) => set((x) => { x.income.deriveInvestmentIncome = v; })}
          hint="Cash 2.5%, bonds 3.5%, stocks 2% dividends + 2% realized gains, rental property 3% net." />
        {!p.income.deriveInvestmentIncome && (
          <>
            <Num label="Interest" value={p.income.interest} onChange={(v) => set((x) => { x.income.interest = v; })} />
            <Num label="Dividends" value={p.income.dividends} onChange={(v) => set((x) => { x.income.dividends = v; })} />
            <Num label="Realized capital gains" value={p.income.capitalGains} onChange={(v) => set((x) => { x.income.capitalGains = v; })} />
            <Num label="Net rental income" value={p.income.rental} onChange={(v) => set((x) => { x.income.rental = v; })} />
          </>
        )}
      </Section>

      <Section title="Household">
        <Check label="Partner" checked={p.household.hasPartner} onChange={(v) => set((x) => { x.household.hasPartner = v; })} />
        {p.household.hasPartner && (
          <Num label="Partner's salary" value={p.household.partnerEmployment} onChange={(v) => set((x) => { x.household.partnerEmployment = v; })} />
        )}
        <Num label="Children under 6" value={p.household.childrenUnder6} step={1} suffix="" onChange={(v) => set((x) => { x.household.childrenUnder6 = Math.round(v); })} />
        <Num label="Children 6–17" value={p.household.children6to17} step={1} suffix="" onChange={(v) => set((x) => { x.household.children6to17 = Math.round(v); })} />
      </Section>

      <Section title="Savings & wealth">
        <Num label="Cash" value={p.wealth.cash} step={5000} onChange={(v) => set((x) => { x.wealth.cash = v; })} />
        <Num label="Bonds" value={p.wealth.bonds} step={5000} onChange={(v) => set((x) => { x.wealth.bonds = v; })} />
        <Num label="Stocks (taxable account)" value={p.wealth.equities} step={5000} onChange={(v) => set((x) => { x.wealth.equities = v; })} />
        <Num label="Retirement accounts" value={p.wealth.retirementAccounts} step={5000} onChange={(v) => set((x) => { x.wealth.retirementAccounts = v; })} />
        <Num label="Tax-free accounts" value={p.wealth.taxFreeAccounts} step={5000} onChange={(v) => set((x) => { x.wealth.taxFreeAccounts = v; })} />
        <Num label="Investment property" value={p.wealth.otherRealEstate} step={10000} onChange={(v) => set((x) => { x.wealth.otherRealEstate = v; })} />
        <label className="field">
          <span className="field-label">Share of after-tax income saved: {Math.round(p.savingsRate * 100)}%</span>
          <input type="range" min={0} max={0.6} step={0.01} value={p.savingsRate} onChange={(e) => set((x) => { x.savingsRate = Number(e.target.value); })} />
        </label>
      </Section>

      <Section title="Home">
        <Sel label="Own or rent" value={p.housing.tenure} options={[['own', 'Own'], ['rent', 'Rent']]} onChange={(v) => set((x) => { x.housing.tenure = v; })} />
        <Sel label="Home type" value={p.housing.homeType} options={[['apartment', 'Apartment'], ['townhouse', 'Townhouse'], ['detached', 'Detached house']]}
          onChange={(v) => set((x) => { x.housing.homeType = v; })} />
        {p.housing.tenure === 'own' ? (
          <>
            <Num label="Home value" value={p.housing.homeValue} step={10000} onChange={(v) => set((x) => { x.housing.homeValue = v; })} />
            <Num label="Mortgage balance" value={p.housing.mortgageBalance} step={10000} onChange={(v) => set((x) => { x.housing.mortgageBalance = v; })} />
            <Check label="Include purchase taxes (land transfer tax)" checked={p.housing.includePurchase}
              onChange={(v) => set((x) => { x.housing.includePurchase = v; })} hint="One-off taxes are spread over the years you keep the home." />
            {p.housing.includePurchase && (
              <>
                <Num label="Years you keep the home" value={p.housing.holdingYears} step={1} suffix="yrs" onChange={(v) => set((x) => { x.housing.holdingYears = Math.max(1, Math.round(v)); })} />
                <Check label="First-time buyer" checked={p.housing.firstTimeBuyer} onChange={(v) => set((x) => { x.housing.firstTimeBuyer = v; })} />
                <Check label="New build (development charges)" checked={p.housing.newBuild} onChange={(v) => set((x) => { x.housing.newBuild = v; })} />
                <Check label="Buying as a foreigner" checked={p.housing.foreignBuyer} onChange={(v) => set((x) => { x.housing.foreignBuyer = v; })} />
              </>
            )}
          </>
        ) : (
          <Num label="Monthly rent" value={p.housing.monthlyRent} step={100} onChange={(v) => set((x) => { x.housing.monthlyRent = v; })} />
        )}
        <Sel label="Heating" value={p.heating} options={[['gas', 'Natural gas'], ['electric', 'Electric'], ['heatpump', 'Heat pump'], ['oil', 'Oil'], ['district', 'District heat']]}
          onChange={(v) => set((x) => { x.heating = v; })} />
      </Section>

      <Section title="Car">
        <Sel label="Car" value={p.car.type} options={[['none', 'No car'], ['gas', 'Gas'], ['ev', 'Electric']]} onChange={(v) => set((x) => { x.car.type = v; })} />
        {p.car.type !== 'none' && (
          <>
            <Sel label="Driving" value={p.car.mileage} options={[['low', 'Low (8,000 km)'], ['average', 'Average (15,000 km)'], ['high', 'High (25,000 km)']]}
              onChange={(v) => set((x) => { x.car.mileage = v; })} />
            <Num label="Car price" value={p.car.purchasePrice} step={5000} onChange={(v) => set((x) => { x.car.purchasePrice = v; })} />
            <Num label="Years you keep it" value={p.car.yearsKept} step={1} suffix="yrs" onChange={(v) => set((x) => { x.car.yearsKept = Math.max(1, Math.round(v)); })} />
          </>
        )}
      </Section>
    </aside>
  );
}
