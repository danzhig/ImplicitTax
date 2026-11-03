import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { history, PLACES, type HistoryRow } from '../../engine';
import type { CalcOptions, Persona } from '../../engine/types';
import { axisStyle, baseOption, EChart, useThemeVersion } from '../charts/EChart';
import { chartTheme, pct } from '../format';
import { placeName } from '../model';
import { useStore } from '../store';

const EVENTS: [number, string][] = [[2009, 'Financial crisis'], [2015, 'Oil crash'], [2020, 'Pandemic'], [2022, 'Rate hikes'], [2025, 'Tariffs']];

function eventLines(selectedYear: number | 'latest') {
  const t = chartTheme();
  return {
    symbol: 'none', silent: true,
    label: { color: t.muted, fontSize: 10, formatter: '{b}' },
    lineStyle: { color: t.axis, type: 'dashed' as const },
    data: [
      ...EVENTS.map(([y, name]) => ({ xAxis: String(y), name })),
      ...(selectedYear !== 'latest' ? [{ xAxis: String(selectedYear), name: 'Selected', lineStyle: { color: t.text, type: 'solid' as const } }] : []),
    ],
  };
}

function useHistories(persona: Persona, options: CalcOptions) {
  return useMemo(() => Object.fromEntries(PLACES.map((p) => [p.id, history(persona, p.id, options)])), [persona, options]);
}

export function HistoryView() {
  const persona = useStore((s) => s.working);
  const options = useStore((s) => s.options);
  const cityId = useStore((s) => s.cityId);
  const setCity = useStore((s) => s.setCity);
  const v = useThemeVersion();
  const all = useHistories(persona, options);
  const rows: HistoryRow[] = all[cityId] ?? Object.values(all)[0];
  const years = rows.map((r) => String(r.year));

  const allCities = useMemo<EChartsOption>(() => {
    const t = chartTheme();
    return {
      ...baseOption(),
      grid: { left: 50, right: 20, top: 40, bottom: 30 },
      tooltip: { ...(baseOption().tooltip as object), trigger: 'axis', valueFormatter: (x) => (x === null || x === undefined ? 'no data' : pct(Number(x))) },
      xAxis: { type: 'category', data: years, ...axisStyle(), boundaryGap: false },
      yAxis: { type: 'value', ...axisStyle(), scale: true, axisLabel: { color: t.muted, formatter: (x: number) => pct(x, 0) } },
      series: PLACES.map((p, i) => ({
        name: p.name, type: 'line', smooth: false, symbolSize: 6, connectNulls: false, lineStyle: { width: 2 },
        itemStyle: { color: t.series[i] },
        data: all[p.id].map((r) => r.implicit),
        ...(i === 0 ? { markLine: eventLines(options.year) } : {}),
      })),
    };
  }, [all, v, options.year]);

  const breakdown = useMemo<EChartsOption>(() => {
    const t = chartTheme();
    const levels = [['federal', 'Federal'], ['provincial', 'Provincial'], ['local', 'City*']] as const;
    const series = levels.flatMap(([k, label], li) => [
      { name: `${label}: borrowed for programs`, key: k, field: 'programs' as const, color: t.series[li * 2], },
      { name: `${label}: borrowed to pay interest`, key: k, field: 'borrowedInterest' as const, color: t.series[li * 2 + 1] },
    ]);
    return {
      ...baseOption(),
      grid: { left: 50, right: 20, top: 96, bottom: 30 },
      tooltip: { ...(baseOption().tooltip as object), trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (x) => (x === null || x === undefined ? 'no data' : pct(Number(x), 2)) },
      xAxis: { type: 'category', data: years, ...axisStyle() },
      yAxis: { type: 'value', ...axisStyle(), axisLabel: { color: t.muted, formatter: (x: number) => pct(x, 0) } },
      series: series.map((s, i) => ({
        name: s.name, type: 'bar', stack: 'd', barWidth: '60%',
        itemStyle: { color: s.color, borderColor: t.surface, borderWidth: 1 },
        data: rows.map((r) => r.byLevel[s.key][s.field]),
        ...(i === 0 ? { markLine: eventLines(options.year) } : {}),
      })),
    };
  }, [rows, v, options.year]);

  const interestChart = useMemo<EChartsOption>(() => {
    const t = chartTheme();
    const total = (r: HistoryRow, f: 'interestFromTaxes' | 'borrowedInterest') =>
      (['federal', 'provincial', 'local'] as const).reduce<number | null>((s, k) => (s === null || r.byLevel[k][f] === null ? null : s + (r.byLevel[k][f] as number)), 0);
    let cumBorrowed = 0;
    let cumInterest = 0;
    const cum = rows.map((r) => {
      const b = (['federal', 'provincial', 'local'] as const).reduce((s, k) => s + (r.byLevel[k].programs ?? 0) + (r.byLevel[k].borrowedInterest ?? 0), 0);
      const i = (total(r, 'interestFromTaxes') ?? 0) + (total(r, 'borrowedInterest') ?? 0);
      cumBorrowed += b; cumInterest += i;
      return [cumBorrowed, cumInterest];
    });
    return {
      ...baseOption(),
      grid: { left: 50, right: 20, top: 64, bottom: 30 },
      tooltip: { ...(baseOption().tooltip as object), trigger: 'axis', valueFormatter: (x) => `${pct(Number(x), 0)} of a year's income` },
      xAxis: { type: 'category', data: years, ...axisStyle(), boundaryGap: false },
      yAxis: { type: 'value', ...axisStyle(), axisLabel: { color: t.muted, formatter: (x: number) => pct(x, 0) } },
      series: [
        { name: 'Total borrowed on your behalf since 2000', type: 'line', symbolSize: 5, itemStyle: { color: t.series[4] }, lineStyle: { width: 2 }, data: cum.map((c) => c[0]) },
        { name: 'Total interest you paid or had borrowed', type: 'line', symbolSize: 5, itemStyle: { color: t.series[5] }, lineStyle: { width: 2 }, data: cum.map((c) => c[1]) },
      ],
    };
  }, [rows, v]);

  const debtChart = useMemo<EChartsOption>(() => {
    const t = chartTheme();
    return {
      ...baseOption(),
      grid: { left: 50, right: 20, top: 40, bottom: 30 },
      tooltip: { ...(baseOption().tooltip as object), trigger: 'axis', valueFormatter: (x) => (x === null || x === undefined ? 'no data' : `${Number(x).toFixed(2)} years`) },
      xAxis: { type: 'category', data: years, ...axisStyle(), boundaryGap: false },
      yAxis: { type: 'value', ...axisStyle(), axisLabel: { color: t.muted, formatter: (x: number) => `${x.toFixed(1)} yr` } },
      series: PLACES.map((p, i) => ({ name: p.name, type: 'line', symbolSize: 5, itemStyle: { color: t.series[i] }, lineStyle: { width: 2 }, data: all[p.id].map((r) => r.debtYears) })),
    };
  }, [all, v]);

  return (
    <div className="view">
      <section className="block">
        <h2>Implicit rate over time, all cities</h2>
        <p className="lede">Your persona and today's tax rules held fixed. Only each government's borrowing and interest change from year to year. Gaps mean missing data, not zero.</p>
        <EChart option={allCities} height={320} ariaLabel="Implicit rate by year for each city" />
      </section>
      <section className="block">
        <div className="toolbar">
          <h2>Borrowing on your behalf, by government</h2>
          <label className="field inline"><span className="field-label">City</span>
            <select value={cityId} onChange={(e) => setCity(e.target.value)}>{PLACES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </label>
        </div>
        <p className="lede">Share of your income each government borrowed for you in {placeName(cityId)}, split into program spending and borrowing that only pays interest. Below zero = surplus.
          Taxes paid now are a flat {pct(rows[rows.length - 1]?.paidNow ?? 0)} in every year.</p>
        <EChart option={breakdown} height={400} ariaLabel="Borrowing on your behalf by year and government" />
        <p className="fine">* City = all municipalities in the province. Before 2008 the data uses StatCan's older FMS basis (core government only), so there is a series break.</p>
      </section>
      <section className="block two-col">
        <div>
          <h2>Compounding since 2000</h2>
          <p className="lede">Running totals in {placeName(cityId)}, as a share of one year's income.</p>
          <EChart option={interestChart} height={300} ariaLabel="Cumulative borrowing and interest since 2000" />
        </div>
        <div>
          <h2>Public debt you carry</h2>
          <p className="lede">Your share of all three governments' net debt, in years of your income.</p>
          <EChart option={debtChart} height={300} ariaLabel="Your share of public net debt over time" />
        </div>
      </section>
    </div>
  );
}
