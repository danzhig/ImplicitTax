import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import type { PlaceResult } from '../../engine/types';
import { axisStyle, baseOption, EChart, useThemeVersion } from '../charts/EChart';
import { chartTheme, pct, signedPct, usd } from '../format';
import { fingerprint, placeName, SEGMENTS, segmentValue, toUsd } from '../model';
import { useStore } from '../store';

export function HeadlineCards({ results }: { results: PlaceResult[] }) {
  const setCity = useStore((s) => s.setCity);
  const setTab = useStore((s) => s.setTab);
  const sorted = [...results].sort((a, b) => b.implicitRate - a.implicitRate);
  return (
    <div className="cards">
      {sorted.map((r) => {
        const deferred = r.borrowed;
        return (
          <button key={r.placeId} className="card" onClick={() => { setCity(r.placeId); setTab('city'); }}>
            <div className="card-title">{placeName(r.placeId)}</div>
            <div className="hero">{pct(r.implicitRate)}</div>
            <div className="card-sub">implicit income tax rate</div>
            <dl className="card-stats">
              <div><dt>Paid now</dt><dd>{pct(r.paidNowRate)}</dd></div>
              <div><dt>Borrowed for you</dt><dd>{signedPct(deferred / r.grossIncome)}</dd></div>
              <div><dt>Take-home</dt><dd>{usd(toUsd(r, r.disposableIncome))}</dd></div>
            </dl>
          </button>
        );
      })}
    </div>
  );
}

export function CategoryBars({ results, height = 300 }: { results: PlaceResult[]; height?: number }) {
  const v = useThemeVersion();
  const option = useMemo<EChartsOption>(() => {
    const t = chartTheme();
    const sorted = [...results].sort((a, b) => a.implicitRate - b.implicitRate);
    const segs = SEGMENTS.filter((s) => sorted.some((r) => Math.abs(segmentValue(r, s.key)) > 0.5));
    const lastPositive = sorted.map((r) => segs.reduce((last, s, i) => (segmentValue(r, s.key) > 0 ? i : last), 0));
    return {
      ...baseOption(),
      grid: { left: 120, right: 70, top: 84, bottom: 30 },
      tooltip: {
        ...(baseOption().tooltip as object),
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (x) => pct(Number(x)),
      },
      xAxis: { type: 'value', ...axisStyle(), axisLabel: { color: t.muted, formatter: (x: number) => pct(x, 0) } },
      yAxis: { type: 'category', data: sorted.map((r) => placeName(r.placeId)), ...axisStyle(), axisLabel: { color: t.textSecondary } },
      legend: { ...(baseOption().legend as object), data: segs.map((s) => s.label) },
      series: [...segs.map((s, i) => ({
        name: s.label,
        type: 'bar' as const,
        stack: 'total',
        barWidth: 22,
        itemStyle: { color: t.series[s.slot], borderColor: t.surface, borderWidth: 1, borderRadius: i === segs.length - 1 ? [0, 4, 4, 0] : 0 },
        emphasis: { focus: 'series' },
        // The total label sits on each row's last positive segment, so it ends up right of the bar even when borrowing is negative.
        data: sorted.map((r, row) => ({
          value: segmentValue(r, s.key) / r.grossIncome,
          label: i === lastPositive[row] ? { show: true, position: 'right', color: t.text, fontWeight: 600, formatter: () => pct(r.implicitRate) } : { show: false },
        })),
      })),
    ] as unknown as EChartsOption['series'],
    };
  }, [results, v]);
  return <EChart option={option} height={height} ariaLabel="Implicit income tax rate by city, stacked by tax type" />;
}

export function LevelBars({ results }: { results: PlaceResult[] }) {
  const v = useThemeVersion();
  const option = useMemo<EChartsOption>(() => {
    const t = chartTheme();
    const sorted = [...results].sort((a, b) => a.implicitRate - b.implicitRate);
    const levels: { key: 'federal' | 'provincial' | 'local' | 'social'; label: string }[] = [
      { key: 'federal', label: 'Federal' }, { key: 'provincial', label: 'Province / state / canton' }, { key: 'local', label: 'City & local' }, { key: 'social', label: 'Social insurance funds' },
    ];
    const val = (r: PlaceResult, k: string) => {
      const d = r.deferred.find((x) => x.level === k);
      return (r.byLevel[k as keyof typeof r.byLevel] + (d ? d.borrowed : 0)) / r.grossIncome;
    };
    return {
      ...baseOption(),
      grid: { left: 120, right: 30, top: 70, bottom: 30 },
      tooltip: { ...(baseOption().tooltip as object), trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (x) => pct(Number(x)) },
      xAxis: { type: 'value', ...axisStyle(), axisLabel: { color: t.muted, formatter: (x: number) => pct(x, 0) } },
      yAxis: { type: 'category', data: sorted.map((r) => placeName(r.placeId)), ...axisStyle(), axisLabel: { color: t.textSecondary } },
      series: levels.map((l, i) => ({
        name: l.label, type: 'bar', stack: 'lvl', barWidth: 22,
        itemStyle: { color: t.series[i], borderColor: t.surface, borderWidth: 1 },
        data: sorted.map((r) => val(r, l.key)),
      })),
    };
  }, [results, v]);
  return <EChart option={option} height={100 + results.length * 30} ariaLabel="Implicit tax by level of government" />;
}

export function CompareTable({ results }: { results: PlaceResult[] }) {
  return (
    <details className="table-wrap">
      <summary>Show as a table</summary>
      <div className="scroll-x">
        <table>
          <thead>
            <tr><th>City</th>{SEGMENTS.map((s) => <th key={s.key}>{s.label}</th>)}<th>Implicit rate</th><th>Paid now</th></tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.placeId}>
                <td>{placeName(r.placeId)}</td>
                {SEGMENTS.map((s) => <td key={s.key} className="num">{usd(toUsd(r, segmentValue(r, s.key)))}</td>)}
                <td className="num strong">{pct(r.implicitRate)}</td>
                <td className="num">{pct(r.paidNowRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function Fingerprints({ results }: { results: PlaceResult[] }) {
  const t = chartTheme();
  const parts: { key: keyof ReturnType<typeof fingerprint>; label: string; color: string }[] = [
    { key: 'labour', label: 'Work (income + payroll)', color: t.series[0] },
    { key: 'consumption', label: 'Spending', color: t.series[2] },
    { key: 'property', label: 'Property', color: t.series[3] },
    { key: 'deferred', label: 'Borrowing', color: t.series[4] },
  ];
  return (
    <div className="fingerprints">
      {results.map((r) => {
        const f = fingerprint(r);
        return (
          <div key={r.placeId} className="fp">
            <div className="fp-title">{placeName(r.placeId)}</div>
            <div className="fp-bar" role="img" aria-label={`Burden mix for ${placeName(r.placeId)}`}>
              {parts.map((p) => f[p.key] > 0.002 && (
                <span key={p.key} style={{ width: `${Math.max(0, f[p.key]) * 100}%`, background: p.color }} title={`${p.label}: ${pct(f[p.key], 0)}`} />
              ))}
            </div>
            <div className="fp-legend">{parts.map((p) => <span key={p.key}><i style={{ background: p.color }} />{p.label} {pct(Math.abs(f[p.key]) < 0.005 ? 0 : f[p.key], 0)}</span>)}</div>
          </div>
        );
      })}
    </div>
  );
}

export function CompareView({ results }: { results: PlaceResult[] }) {
  const warnings = [...new Set(results.flatMap((r) => r.warnings))];
  return (
    <div className="view">
      <HeadlineCards results={results} />
      <section className="block">
        <h2>Where the implicit rate comes from</h2>
        <p className="lede">Every tax you pay plus your share of what each government borrowed this year (the increase in its net debt), as a share of your gross income. Click a city card for its full breakdown.</p>
        <CategoryBars results={results} height={110 + results.length * 30} />
        <CompareTable results={results} />
      </section>
      <section className="block">
        <h2>Which government gets it</h2>
        <p className="lede">Taxes plus borrowing, split by level. Local borrowing uses all local governments in the province, state or country as a stand-in.</p>
        <LevelBars results={results} />
      </section>
      <section className="block">
        <h2>Regime fingerprint</h2>
        <p className="lede">What kind of regime each place is: how much of your burden comes from work, spending, property and borrowing.</p>
        <Fingerprints results={results} />
      </section>
      {warnings.length > 0 && <ul className="warnings">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
    </div>
  );
}
