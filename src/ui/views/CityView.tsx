import { PlaceOptions } from '../components/PlaceOptions';
import { useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { placeById } from '../../engine';
import type { Level, PlaceResult } from '../../engine/types';
import { axisStyle, baseOption, EChart, useThemeVersion } from '../charts/EChart';
import { chartTheme, money, pct, usd } from '../format';
import { placeName, toUsd } from '../model';
import { useStore } from '../store';

const levelNames = (r: PlaceResult): Record<Level, string> => placeById(r.placeId).levelNames;

function Waterfall({ r }: { r: PlaceResult }) {
  const v = useThemeVersion();
  const option = useMemo<EChartsOption>(() => {
    const t = chartTheme();
    const u = (x: number) => toUsd(r, x);
    const steps: { label: string; value: number; kind: 'total' | 'step'; color: string }[] = [
      { label: 'Gross income', value: u(r.grossIncome), kind: 'total', color: t.axis },
      { label: 'Income tax', value: -u(r.byCategory.income), kind: 'step', color: t.series[0] },
      { label: 'Payroll taxes', value: -u(r.byCategory.payroll), kind: 'step', color: t.series[1] },
      { label: 'Sales & fuel', value: -u(r.byCategory.consumption), kind: 'step', color: t.series[2] },
      { label: 'Property', value: -u(r.byCategory.property), kind: 'step', color: t.series[3] },
      ...(Math.abs(r.byCategory.benefit) > 0.5 ? [{ label: 'Benefits', value: -u(r.byCategory.benefit), kind: 'step' as const, color: t.series[5] }] : []),
      { label: 'Kept (paid-now view)', value: u(r.grossIncome - r.paidNow), kind: 'total', color: t.muted },
      { label: 'Borrowed on your behalf', value: -u(r.borrowed), kind: 'step', color: t.series[4] },
      { label: 'Kept (implicit view)', value: u(r.grossIncome - r.implicitTotal), kind: 'total', color: t.textSecondary },
    ];
    let running = 0;
    const base: number[] = [];
    const vals: { value: number; itemStyle: object }[] = [];
    for (const s of steps) {
      if (s.kind === 'total') {
        base.push(0); vals.push({ value: s.value, itemStyle: { color: s.color, borderRadius: [4, 4, 0, 0] } }); running = s.value;
      } else {
        const next = running + s.value;
        base.push(Math.min(running, next));
        vals.push({ value: Math.abs(s.value), itemStyle: { color: s.color } });
        running = next;
      }
    }
    return {
      ...baseOption(),
      legend: { show: false },
      grid: { left: 70, right: 20, top: 20, bottom: 90 },
      tooltip: {
        ...(baseOption().tooltip as object), trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (ps: unknown) => {
          const p = (ps as { dataIndex: number }[])[0];
          const s = steps[p.dataIndex];
          const amount = s.kind === 'total' ? usd(s.value) : `${s.value <= 0 ? '−' : '+'}${usd(Math.abs(s.value))}`;
          return `${s.label}<br/><b>${amount}</b> (${pct(Math.abs(s.value) / u(r.grossIncome))} of income)`;
        },
      },
      xAxis: { type: 'category', data: steps.map((s) => s.label), ...axisStyle(), axisLabel: { color: t.textSecondary, interval: 0, rotate: 35, fontSize: 11 } },
      yAxis: { type: 'value', ...axisStyle(), axisLabel: { color: t.muted, formatter: (x: number) => `$${Math.round(x / 1000)}k` } },
      series: [
        { type: 'bar', stack: 'w', itemStyle: { color: 'transparent' }, data: base, emphasis: { disabled: true }, tooltip: { show: false } },
        { type: 'bar', stack: 'w', barWidth: '60%', data: vals },
      ],
    };
  }, [r, v]);
  return <EChart option={option} height={360} ariaLabel="Waterfall from gross income to what you keep" />;
}

/**
 * Money flow, left to right: where it comes from → what kind of tax → which government → what it pays for.
 * Nodes are listed in a fixed top-to-bottom order in every column (layoutIterations: 0) so streams keep
 * their order and only cross where they genuinely split. Hovering a stream highlights its whole path.
 */
function FlowSankey({ r }: { r: PlaceResult }) {
  const v = useThemeVersion();
  const option = useMemo<EChartsOption>(() => {
    const t = chartTheme();
    const LEVEL_LABEL = levelNames(r);
    const u = (x: number) => Math.max(0, Math.round(toUsd(r, x)));
    const nodes: { name: string; depth: number; itemStyle: { color: string } }[] = [];
    const links: { source: string; target: string; value: number; lineStyle?: object }[] = [];
    const node = (name: string, depth: number, color: string) => { if (!nodes.find((n) => n.name === name)) nodes.push({ name, depth, itemStyle: { color } }); };
    const link = (source: string, target: string, value: number) => {
      if (value <= 0) return;
      const l = links.find((x) => x.source === source && x.target === target);
      if (l) l.value += value; else links.push({ source, target, value });
    };

    // Column 0: your income. Column 1: borrowing (a future tax, on top) then the tax types, so no
    // stream has to cross another before it splits.
    const borrowedTotal = r.deferred.reduce((s, d) => s + Math.max(0, d.borrowed), 0);
    node('Your income', 0, t.axis);
    if (u(borrowedTotal) > 0) node('Borrowed on your behalf', 1, t.series[4]);
    const cats: [string, keyof PlaceResult['byCategory'], number][] = [
      ['Income tax', 'income', 0], ['Payroll taxes', 'payroll', 1], ['Sales & fuel', 'consumption', 2], ['Property', 'property', 3],
    ];
    for (const [label, key, slot] of cats) if (r.byCategory[key] > 0.5) { node(label, 1, t.series[slot]); link('Your income', label, u(r.byCategory[key])); }

    // Column 2: governments.
    const levels: Level[] = ['federal', 'provincial', 'local', 'social'];
    for (const l of levels) node(LEVEL_LABEL[l], 2, t.textSecondary);
    for (const i of r.lineItems) {
      const cat = cats.find((c) => c[1] === i.category);
      if (cat && i.amount > 0) link(cat[0], LEVEL_LABEL[i.level], u(i.amount));
    }
    for (const d of r.deferred) if (d.borrowed > 0) link('Borrowed on your behalf', LEVEL_LABEL[d.level], u(d.borrowed));

    // Column 3: what the money pays for, then what you keep (bottom).
    node('Interest on past debt', 3, t.series[6]);
    node('Programs & services', 3, t.series[0]);
    for (const l of levels) {
      const inflow = links.filter((x) => x.target === LEVEL_LABEL[l]).reduce((s, x) => s + x.value, 0);
      if (inflow <= 0) continue;
      const d = r.deferred.find((x) => x.level === l);
      const interest = Math.min(d ? u(d.interestCost) : 0, inflow);
      const repaid = d && d.borrowed < 0 ? Math.min(u(-d.borrowed), inflow - interest) : 0;
      link(LEVEL_LABEL[l], 'Interest on past debt', interest);
      if (repaid > 0) { node('Paying down debt', 3, t.series[2]); link(LEVEL_LABEL[l], 'Paying down debt', repaid); }
      link(LEVEL_LABEL[l], 'Programs & services', inflow - interest - repaid);
    }
    const kept = r.grossIncome - r.paidNow;
    if (kept > 0) { node('You keep', 3, t.muted); link('Your income', 'You keep', u(kept)); }

    // Colour each stream by what it carries: income flows take their destination's colour, flows out of
    // a tax type keep that colour, and flows out of a government take the colour of what they pay for.
    const colorOf = (name: string) => nodes.find((n) => n.name === name)?.itemStyle.color ?? t.muted;
    const levelSet = new Set(levels.map((l) => LEVEL_LABEL[l]));
    for (const l of links) {
      const c = l.source === 'Your income' || levelSet.has(l.source) ? colorOf(l.target) : colorOf(l.source);
      l.lineStyle = { color: c };
    }
    const used = new Set(links.flatMap((x) => [x.source, x.target]));
    return {
      ...baseOption(),
      tooltip: { ...(baseOption().tooltip as object), trigger: 'item', valueFormatter: (x) => usd(Number(x)) },
      series: [{
        type: 'sankey', left: 10, right: 160, top: 10, bottom: 10, nodeGap: 8, nodeWidth: 12, draggable: false,
        layoutIterations: 0,
        data: nodes.filter((n) => used.has(n.name)),
        links,
        label: { color: t.text, fontSize: 12 },
        lineStyle: { opacity: 0.4, curveness: 0.5 },
        emphasis: { focus: 'trajectory', lineStyle: { opacity: 0.7 } },
        blur: { lineStyle: { opacity: 0.06 }, itemStyle: { opacity: 0.3 } },
      }],
    };
  }, [r, v]);
  return <EChart option={option} height={460} ariaLabel="Flow from your income and borrowing to taxes, governments, programs and interest" />;
}

function BorrowingTable({ r }: { r: PlaceResult }) {
  const u = (x: number) => usd(toUsd(r, x));
  return (
    <div className="scroll-x">
      <table className="grid2">
        <thead>
          <tr><th>Government (data year)</th><th className="num">Taxes you pay it</th><th className="num">Borrowing ÷ its tax revenue</th>
            <th className="num">Borrowed on your behalf</th><th className="num">Interest ÷ its tax revenue</th><th className="num">Interest share of your taxes</th>
            <th className="num">Your share of its net debt</th></tr>
        </thead>
        <tbody>
          {r.deferred.map((d) => (
            <tr key={d.level}>
              <td>{d.seriesLabel}{d.isProxy ? ' *' : ''} <span className="muted">({d.year === null ? 'no data' : fy(d.year, d.level, placeById(r.placeId).countryCode)}{d.estimate ? ', estimate' : ''})</span></td>
              <td className="num">{u(d.yourTaxes)}</td>
              <td className="num">{d.borrowRatio === null ? '–' : pct(d.borrowRatio)}</td>
              <td className="num strong">{u(d.borrowed)}</td>
              <td className="num">{d.interestRatio === null ? '–' : pct(d.interestRatio)}</td>
              <td className="num">{u(d.interestCost)}</td>
              <td className="num">{d.debtShare === null ? '–' : u(d.debtShare)}</td>
            </tr>
          ))}
          <tr className="total"><td>Total</td><td className="num">{u(r.deferred.reduce((s, d) => s + d.yourTaxes, 0))}</td><td />
            <td className="num">{u(r.borrowed)}</td><td /><td className="num">{u(r.interestCost)}</td>
            <td className="num">{u(r.deferred.reduce((s, d) => s + (d.debtShare ?? 0), 0))}</td></tr>
        </tbody>
      </table>
      <p className="fine">Borrowing = the increase in each government's net debt that year (debts minus financial assets), so it includes borrowing for
        infrastructure; negative = debt paid down. Interest is already inside the taxes you pay, so it is shown but not added again.
        * {proxyNote(placeById(r.placeId).countryCode)}</p>
    </div>
  );
}

const proxyNote = (c: string) =>
  c === 'US' ? 'Local figures use all local governments in the state (cities, counties, school and special districts).'
    : c === 'CA' ? 'Local figures use all municipalities in the province.'
      : c === 'DE' ? 'Bavaria is shown through all 16 Länder and Munich through all German municipalities.'
        : c === 'CH' ? 'The canton is shown through all 26 cantons and the city through all Swiss communes.'
          : c === 'SG' ? 'Singapore has one level of government.' : 'Local figures use all local governments in the country.';

const fy = (year: number, level: Level, country: string) =>
  country === 'US' ? `FY${year}`
    : country === 'UK' || country === 'SG' || (country === 'CA' && level !== 'local') ? `${year}-${String((year + 1) % 100).padStart(2, '0')}`
      : String(year);

function LineItems({ r }: { r: PlaceResult }) {
  const [open, setOpen] = useState<string | null>(null);
  const LEVEL_LABEL = levelNames(r);
  return (
    <div className="scroll-x">
      <table className="items">
        <thead><tr><th>Tax</th><th>Goes to</th><th className="num">USD / yr</th><th className="num">{r.currency} / yr</th><th className="num">% of income</th><th>Confidence</th></tr></thead>
        <tbody>
          {r.lineItems.map((i) => (
            <FragmentRow key={i.id} open={open === i.id} onToggle={() => setOpen(open === i.id ? null : i.id)}
              cells={[i.label, LEVEL_LABEL[i.level], usd(toUsd(r, i.amount)), money(i.amount, r.currency), pct(i.amount / r.grossIncome), i.confidence]}
              detail={[i.note, ...(i.trace ?? [])].filter(Boolean) as string[]} />
          ))}
          <tr className="total"><td>Taxes paid now</td><td /><td className="num">{usd(toUsd(r, r.paidNow))}</td><td className="num">{money(r.paidNow, r.currency)}</td><td className="num">{pct(r.paidNowRate)}</td><td /></tr>
          <tr><td>Borrowed on your behalf</td><td /><td className="num">{usd(toUsd(r, r.borrowed))}</td>
            <td className="num">{money(r.borrowed, r.currency)}</td><td className="num">{pct(r.borrowed / r.grossIncome)}</td><td /></tr>
          <tr className="total"><td>Implicit total</td><td /><td className="num">{usd(toUsd(r, r.implicitTotal))}</td><td className="num">{money(r.implicitTotal, r.currency)}</td><td className="num">{pct(r.implicitRate)}</td><td /></tr>
        </tbody>
      </table>
    </div>
  );
}

function FragmentRow({ cells, detail, open, onToggle }: { cells: string[]; detail: string[]; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="clickable" onClick={onToggle} aria-expanded={open}>
        <td><span className="caret">{open ? '▾' : '▸'}</span> {cells[0]}</td>
        <td>{cells[1]}</td>
        <td className="num">{cells[2]}</td>
        <td className="num">{cells[3]}</td>
        <td className="num">{cells[4]}</td>
        <td><span className={`badge ${cells[5]}`}>{cells[5]}</span></td>
      </tr>
      {open && <tr className="trace"><td colSpan={6}><ul>{detail.map((d, k) => <li key={k}>{d}</li>)}</ul></td></tr>}
    </>
  );
}

export function CityView({ results }: { results: PlaceResult[] }) {
  const cityId = useStore((s) => s.cityId);
  const setCity = useStore((s) => s.setCity);
  const r = results.find((x) => x.placeId === cityId) ?? results[0];
  return (
    <div className="view">
      <div className="toolbar">
        <label className="field inline">
          <span className="field-label">City</span>
          <select value={r.placeId} onChange={(e) => setCity(e.target.value)}>
            <PlaceOptions withRegion />
          </select>
        </label>
        <div className="kpis">
          <div><span>Implicit rate</span><b>{pct(r.implicitRate)}</b></div>
          <div><span>Paid now</span><b>{pct(r.paidNowRate)}</b></div>
          <div><span>Of which interest on past debt</span><b>{pct(r.interestCost / r.grossIncome)}</b></div>
          <div><span>Public debt you carry</span><b>{r.debtShareYears === null ? '–' : `${r.debtShareYears.toFixed(2)} yrs of income`}</b></div>
          <div><span>Exchange rate</span><b>{r.fx.toFixed(3)} {r.currency}/USD</b></div>
        </div>
      </div>
      <section className="block">
        <h2>From gross income to what you keep, {placeName(r.placeId)}</h2>
        <Waterfall r={r} />
      </section>
      <section className="block">
        <h2>Borrowing and interest on your behalf</h2>
        <p className="lede">Each government's new borrowing and interest bill, applied to your share of the taxes it collects.</p>
        <BorrowingTable r={r} />
      </section>
      <section className="block">
        <h2>Where your money goes</h2>
        <p className="lede">Hover a stream to follow it from start to finish.</p>
        <FlowSankey r={r} />
      </section>
      <section className="block">
        <h2>Line by line</h2>
        <p className="lede">Click a row to see how it was calculated.</p>
        <LineItems r={r} />
        {r.info.length > 0 && (
          <div className="info">
            <h3>For context (not in your rate)</h3>
            <ul>{r.info.map((i) => <li key={i.id}><b>{i.label}: {usd(toUsd(r, i.amount))}</b>. {i.note}</li>)}</ul>
          </div>
        )}
        {r.warnings.length > 0 && <ul className="warnings">{r.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
      </section>
    </div>
  );
}
