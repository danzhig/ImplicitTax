import { PlaceOptions } from '../components/PlaceOptions';
import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import type { PlaceResult } from '../../engine/types';
import { axisStyle, baseOption, EChart, useThemeVersion } from '../charts/EChart';
import { chartTheme, pct, signedPct, signedUsd, usd } from '../format';
import { fingerprint, placeName, SEGMENTS, segmentValue, toUsd } from '../model';
import { useStore } from '../store';

function describe(r: PlaceResult) {
  const f = fingerprint(r);
  const main = f.labour > 0.75 ? 'work-income-heavy' : f.consumption > 0.2 ? 'spending-heavy' : 'mixed';
  const borrowing = f.deferred > 0.08 ? 'high-borrowing' : f.deferred > 0.02 ? 'moderate-borrowing' : f.deferred < -0.02 ? 'surplus-running' : 'roughly balanced';
  return `${main}, ${borrowing}`;
}

export function MoveView({ results }: { results: PlaceResult[] }) {
  const { fromId, toId, setMove } = useStore();
  const v = useThemeVersion();
  const a = results.find((r) => r.placeId === fromId) ?? results[0];
  const b = results.find((r) => r.placeId === toId) ?? results[1];

  const deltas = SEGMENTS.map((s) => ({ ...s, delta: toUsd(b, segmentValue(b, s.key)) - toUsd(a, segmentValue(a, s.key)) }))
    .filter((d) => Math.abs(d.delta) >= 1);
  const totalDelta = toUsd(b, b.implicitTotal) - toUsd(a, a.implicitTotal);
  const keepDelta = toUsd(b, b.grossIncome - b.paidNow) - toUsd(a, a.grossIncome - a.paidNow);

  const option = useMemo<EChartsOption>(() => {
    const t = chartTheme();
    return {
      ...baseOption(),
      legend: { show: false },
      grid: { left: 170, right: 70, top: 10, bottom: 30 },
      tooltip: { ...(baseOption().tooltip as object), trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (x) => signedUsd(Number(x)) },
      xAxis: { type: 'value', ...axisStyle(), axisLabel: { color: t.muted, formatter: (x: number) => signedUsd(x) } },
      yAxis: { type: 'category', data: deltas.map((d) => d.label), inverse: true, ...axisStyle(), axisLabel: { color: t.textSecondary } },
      series: [{
        type: 'bar', barWidth: 18,
        data: deltas.map((d) => ({ value: d.delta, itemStyle: { color: t.series[d.slot], borderRadius: d.delta >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4] } })),
        label: { show: true, position: 'right', color: t.text, formatter: (p: { value: unknown }) => signedUsd(Number(p.value)) },
      }],
    };
  }, [a, b, v]);

  return (
    <div className="view">
      <div className="toolbar start">
        <label className="field inline"><span className="field-label">Moving from</span>
          <select value={a.placeId} onChange={(e) => setMove(e.target.value, b.placeId)}><PlaceOptions /></select>
        </label>
        <button className="swap" onClick={() => setMove(b.placeId, a.placeId)} aria-label="Swap">⇄</button>
        <label className="field inline"><span className="field-label">to</span>
          <select value={b.placeId} onChange={(e) => setMove(a.placeId, e.target.value)}><PlaceOptions /></select>
        </label>
      </div>
      <section className="block verdict">
        <p className="big">
          Moving your persona from <b>{placeName(a.placeId)}</b> to <b>{placeName(b.placeId)}</b> changes your implicit rate from{' '}
          <b>{pct(a.implicitRate)}</b> to <b>{pct(b.implicitRate)}</b> ({signedPct(b.implicitRate - a.implicitRate)}), or <b>{signedUsd(totalDelta)}</b> a year.
        </p>
        <p>Cash you keep after taxes paid now: <b>{signedUsd(keepDelta)}</b> a year.</p>
        <p>You'd go from a <b>{describe(a)}</b> regime to a <b>{describe(b)}</b> one.</p>
      </section>
      <section className="block">
        <h2>What changes, by type (USD per year)</h2>
        {deltas.length ? <EChart option={option} height={Math.max(180, deltas.length * 44 + 40)} ariaLabel="Change in each tax type when moving" /> : <p>No differences.</p>}
        <div className="scroll-x">
          <table>
            <thead><tr><th>Type</th><th className="num">{placeName(a.placeId)}</th><th className="num">{placeName(b.placeId)}</th><th className="num">Change</th></tr></thead>
            <tbody>
              {SEGMENTS.map((s) => (
                <tr key={s.key}><td>{s.label}</td><td className="num">{usd(toUsd(a, segmentValue(a, s.key)))}</td><td className="num">{usd(toUsd(b, segmentValue(b, s.key)))}</td>
                  <td className="num">{signedUsd(toUsd(b, segmentValue(b, s.key)) - toUsd(a, segmentValue(a, s.key)))}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
