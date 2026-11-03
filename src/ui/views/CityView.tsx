import { useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { PLACES } from '../../engine';
import type { Level, PlaceResult } from '../../engine/types';
import { axisStyle, baseOption, EChart, useThemeVersion } from '../charts/EChart';
import { chartTheme, money, pct, usd } from '../format';
import { placeName, toUsd } from '../model';
import { useStore } from '../store';

const LEVEL_LABEL: Record<Level, string> = { federal: 'Federal', provincial: 'Provincial', local: 'City / regional', social: 'CPP fund' };

function Waterfall({ r }: { r: PlaceResult }) {
  const v = useThemeVersion();
  const option = useMemo<EChartsOption>(() => {
    const t = chartTheme();
    const u = (x: number) => toUsd(r, x);
    const steps: { label: string; value: number; kind: 'total' | 'down' | 'up'; color: string }[] = [
      { label: 'Gross income', value: u(r.grossIncome), kind: 'total', color: t.axis },
      { label: 'Income tax', value: -u(r.byCategory.income), kind: 'down', color: t.series[0] },
      { label: 'CPP / EI', value: -u(r.byCategory.payroll), kind: 'down', color: t.series[1] },
      { label: 'Sales & fuel', value: -u(r.byCategory.consumption), kind: 'down', color: t.series[2] },
      { label: 'Property', value: -u(r.byCategory.property), kind: 'down', color: t.series[3] },
      ...(Math.abs(r.byCategory.benefit) > 0.5 ? [{ label: 'Benefits', value: -u(r.byCategory.benefit), kind: 'up' as const, color: t.series[6] }] : []),
      { label: 'Kept (paid-now view)', value: u(r.grossIncome - r.paidNow), kind: 'total', color: t.muted },
      { label: 'Borrowed for programs', value: -u(r.borrowedForPrograms), kind: 'down', color: t.series[4] },
      { label: 'Borrowed for interest', value: -u(r.borrowedForInterest), kind: 'down', color: t.series[5] },
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
          return `${s.label}<br/><b>${s.kind === 'total' ? usd(s.value) : (s.value <= 0 ? '−' : '+') + usd(Math.abs(s.value))}</b> (${pct(Math.abs(s.value) / u(r.grossIncome))} of income)`;
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

function FlowSankey({ r }: { r: PlaceResult }) {
  const v = useThemeVersion();
  const option = useMemo<EChartsOption>(() => {
    const t = chartTheme();
    const u = (x: number) => Math.round(toUsd(r, x));
    const cats: [string, keyof PlaceResult['byCategory'], number][] = [
      ['Income tax', 'income', 0], ['CPP / EI', 'payroll', 1], ['Sales & fuel', 'consumption', 2], ['Property', 'property', 3],
    ];
    const nodes: { name: string; itemStyle?: object }[] = [{ name: 'Your income', itemStyle: { color: t.axis } }];
    const links: { source: string; target: string; value: number }[] = [];
    for (const [label, key, slot] of cats) {
      if (r.byCategory[key] > 0.5) { nodes.push({ name: label, itemStyle: { color: t.series[slot] } }); links.push({ source: 'Your income', target: label, value: u(r.byCategory[key]) }); }
    }
    const kept = r.grossIncome - r.paidNow;
    if (kept > 0) { nodes.push({ name: 'You keep', itemStyle: { color: t.muted } }); links.push({ source: 'Your income', target: 'You keep', value: u(kept) }); }
    const levels: Level[] = ['federal', 'provincial', 'local', 'social'];
    for (const l of levels) nodes.push({ name: LEVEL_LABEL[l], itemStyle: { color: t.textSecondary } });
    for (const i of r.lineItems) {
      if (i.amount <= 0) continue;
      const cat = cats.find((c) => c[1] === i.category);
      if (cat) {
        const existing = links.find((x) => x.source === cat[0] && x.target === LEVEL_LABEL[i.level]);
        if (existing) existing.value += u(i.amount); else links.push({ source: cat[0], target: LEVEL_LABEL[i.level], value: u(i.amount) });
      }
    }
    const borrowed = r.deferred.filter((d) => d.borrowedForPrograms + d.borrowedForInterest > 0.5);
    if (borrowed.length) {
      nodes.push({ name: 'Borrowed on your behalf', itemStyle: { color: t.series[4] } });
      for (const d of borrowed) links.push({ source: 'Borrowed on your behalf', target: LEVEL_LABEL[d.level], value: u(Math.max(0, d.borrowedForPrograms) + d.borrowedForInterest) });
    }
    nodes.push({ name: 'Programs & services', itemStyle: { color: t.series[0] } }, { name: 'Interest on past debt', itemStyle: { color: t.series[5] } });
    for (const l of levels) {
      const d = r.deferred.find((x) => x.level === l);
      const inflow = links.filter((x) => x.target === LEVEL_LABEL[l]).reduce((s, x) => s + x.value, 0);
      if (inflow <= 0) continue;
      const interest = d ? u(d.interestFromTaxes + d.borrowedForInterest) : 0;
      const surplus = d && d.borrowedForPrograms < 0 ? u(-d.borrowedForPrograms) : 0;
      if (interest > 0) links.push({ source: LEVEL_LABEL[l], target: 'Interest on past debt', value: Math.min(interest, inflow) });
      if (surplus > 0) {
        if (!nodes.find((n) => n.name === 'Surplus (pays down debt)')) nodes.push({ name: 'Surplus (pays down debt)', itemStyle: { color: t.series[2] } });
        links.push({ source: LEVEL_LABEL[l], target: 'Surplus (pays down debt)', value: Math.min(surplus, inflow - interest) });
      }
      const programs = inflow - Math.min(interest, inflow) - Math.min(surplus, Math.max(0, inflow - interest));
      if (programs > 0) links.push({ source: LEVEL_LABEL[l], target: 'Programs & services', value: programs });
    }
    const used = new Set(links.flatMap((x) => [x.source, x.target]));
    return {
      ...baseOption(),
      tooltip: { ...(baseOption().tooltip as object), trigger: 'item', valueFormatter: (x) => usd(Number(x)) },
      series: [{
        type: 'sankey', left: 10, right: 150, top: 10, bottom: 10, nodeGap: 10, nodeWidth: 12, draggable: false,
        data: nodes.filter((n) => used.has(n.name)),
        links: links.filter((x) => x.value > 0),
        label: { color: t.text, fontSize: 12 },
        lineStyle: { color: 'gradient', opacity: 0.35, curveness: 0.5 },
        emphasis: { focus: 'adjacency' },
      }],
    };
  }, [r, v]);
  return <EChart option={option} height={440} ariaLabel="Flow from your income to taxes, governments, programs and interest" />;
}

function DeferredGrid({ r }: { r: PlaceResult }) {
  const u = (x: number) => usd(toUsd(r, x));
  return (
    <div className="scroll-x">
      <table className="grid2">
        <thead>
          <tr><th>Government (data year)</th><th>Taxes you pay it</th><th>Deficit ÷ its tax revenue</th><th>Interest ÷ its tax revenue</th>
            <th>Borrowed for programs</th><th>Borrowed to pay interest</th><th>Interest paid from your taxes</th></tr>
        </thead>
        <tbody>
          {r.deferred.map((d) => (
            <tr key={d.level}>
              <td>{d.seriesLabel}{d.isProxy ? ' *' : ''} <span className="muted">({d.year ?? 'no data'}{d.basis === 'FMS' ? ', older basis' : ''})</span></td>
              <td className="num">{u(d.yourTaxes)}</td>
              <td className="num">{d.deficitRatio === null ? '–' : pct(d.deficitRatio)}</td>
              <td className="num">{d.interestRatio === null ? '–' : pct(d.interestRatio)}</td>
              <td className="num">{u(d.borrowedForPrograms)}</td>
              <td className="num strong">{u(d.borrowedForInterest)}</td>
              <td className="num">{u(d.interestFromTaxes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="fine">Negative "deficit" = surplus. Interest counts as borrowed first, so when a government borrows less than its interest bill, all of its borrowing is compounding.
        "Interest paid from your taxes" is already inside the taxes you pay, so it is not added again. * City figures use all municipalities in the province.</p>
    </div>
  );
}

function LineItems({ r }: { r: PlaceResult }) {
  const [open, setOpen] = useState<string | null>(null);
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
          <tr><td>Borrowed on your behalf (programs + interest)</td><td /><td className="num">{usd(toUsd(r, r.borrowedForPrograms + r.borrowedForInterest))}</td>
            <td className="num">{money(r.borrowedForPrograms + r.borrowedForInterest, r.currency)}</td><td className="num">{pct((r.borrowedForPrograms + r.borrowedForInterest) / r.grossIncome)}</td><td /></tr>
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
            {PLACES.map((p) => <option key={p.id} value={p.id}>{p.name}, {p.region}</option>)}
          </select>
        </label>
        <div className="kpis">
          <div><span>Implicit rate</span><b>{pct(r.implicitRate)}</b></div>
          <div><span>Paid now</span><b>{pct(r.paidNowRate)}</b></div>
          <div><span>Public debt you carry</span><b>{r.debtShareYears === null ? '–' : `${r.debtShareYears.toFixed(2)} yrs of income`}</b></div>
          <div><span>Exchange rate</span><b>{r.fx.toFixed(3)} {r.currency}/USD</b></div>
        </div>
      </div>
      <section className="block">
        <h2>From gross income to what you keep, {placeName(r.placeId)}</h2>
        <Waterfall r={r} />
      </section>
      <section className="block">
        <h2>Borrowing on your behalf</h2>
        <p className="lede">Each government's operating balance and interest bill, applied to the taxes you pay it.</p>
        <DeferredGrid r={r} />
      </section>
      <section className="block">
        <h2>Where your money goes</h2>
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
