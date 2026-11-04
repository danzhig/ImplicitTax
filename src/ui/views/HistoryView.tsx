import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { history, PLACES, placeById, type HistoryRow } from '../../engine';
import type { CalcOptions, Persona } from '../../engine/types';
import { axisStyle, baseOption, EChart, useThemeVersion } from '../charts/EChart';
import { chartTheme, pct, usd } from '../format';
import { placeName } from '../model';
import { useStore } from '../store';

const EVENTS: [number, string][] = [[2008, 'Financial crisis'], [2015, 'Oil crash'], [2020, 'Pandemic'], [2022, 'Rate hikes'], [2025, 'Tariffs']];
const LEVELS = [['federal', 'Federal'], ['provincial', 'Provincial'], ['local', 'City*']] as const;

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

const yearLabel = (r: HistoryRow) => `${r.year}${r.estimate ? ' (est.)' : ''}`;

export function HistoryView() {
  const persona = useStore((s) => s.working);
  const options = useStore((s) => s.options);
  const cityId = useStore((s) => s.cityId);
  const setCity = useStore((s) => s.setCity);
  const v = useThemeVersion();
  const all = useHistories(persona, options);
  const rows: HistoryRow[] = all[cityId] ?? Object.values(all)[0];
  const years = rows.map(yearLabel);
  const fx = placeById(cityId).fx;

  const allCities = useMemo<EChartsOption>(() => {
    const t = chartTheme();
    return {
      ...baseOption(),
      grid: { left: 50, right: 20, top: 40, bottom: 30 },
      tooltip: { ...(baseOption().tooltip as object), trigger: 'axis', valueFormatter: (x) => (x === null || x === undefined ? 'no data' : pct(Number(x))) },
      xAxis: { type: 'category', data: years, ...axisStyle(), boundaryGap: false },
      yAxis: { type: 'value', ...axisStyle(), scale: true, axisLabel: { color: t.muted, formatter: (x: number) => pct(x, 0) } },
      series: PLACES.map((p, i) => ({
        name: p.name, type: 'line', symbolSize: 6, connectNulls: false, lineStyle: { width: 2 }, itemStyle: { color: t.series[i] },
        data: all[p.id].map((r) => r.implicit),
        ...(i === 0 ? { markLine: eventLines(options.year) } : {}),
      })),
    };
  }, [all, v, options.year, years]);

  const stacked = (field: 'borrowed' | 'interest', fmtDigits: number): EChartsOption => {
    const t = chartTheme();
    return {
      ...baseOption(),
      grid: { left: 50, right: 20, top: 40, bottom: 30 },
      tooltip: {
        ...(baseOption().tooltip as object), trigger: 'axis', axisPointer: { type: 'shadow' },
        valueFormatter: (x) => (x === null || x === undefined ? 'no data' : pct(Number(x), fmtDigits)),
      },
      xAxis: { type: 'category', data: years, ...axisStyle() },
      yAxis: { type: 'value', ...axisStyle(), axisLabel: { color: t.muted, formatter: (x: number) => pct(x, 0) } },
      series: LEVELS.map(([k, label], i) => ({
        name: label, type: 'bar', stack: field, barWidth: '62%',
        itemStyle: { color: t.series[i], borderColor: t.surface, borderWidth: 1 },
        data: rows.map((r) => r[field][k]),
        ...(i === 0 ? { markLine: eventLines(options.year) } : {}),
      })),
    };
  };
  const borrowedChart = useMemo(() => stacked('borrowed', 1), [rows, v, options.year]);
  const interestChart = useMemo(() => stacked('interest', 2), [rows, v, options.year]);

  const debtChart = useMemo<EChartsOption>(() => {
    const t = chartTheme();
    return {
      ...baseOption(),
      grid: { left: 70, right: 20, top: 40, bottom: 30 },
      tooltip: { ...(baseOption().tooltip as object), trigger: 'axis', valueFormatter: (x) => (x === null || x === undefined ? 'no data' : usd(Number(x))) },
      xAxis: { type: 'category', data: years, ...axisStyle() },
      yAxis: { type: 'value', ...axisStyle(), axisLabel: { color: t.muted, formatter: (x: number) => `$${Math.round(x / 1000)}k` } },
      series: LEVELS.map(([k, label], i) => ({
        name: label, type: 'bar', stack: 'debt', barWidth: '62%',
        itemStyle: { color: t.series[i], borderColor: t.surface, borderWidth: 1 },
        data: rows.map((r) => (r.debt[k] === null ? null : r.debt[k]! / fx)),
      })),
    };
  }, [rows, v, fx, years]);

  const last = rows[rows.length - 1];
  const totalDebtNow = last ? LEVELS.reduce((s, [k]) => s + (last.debt[k] ?? 0), 0) / fx : 0;

  return (
    <div className="view">
      <section className="block">
        <h2>Implicit rate over time, all cities</h2>
        <p className="lede">Your persona and today's tax rules held fixed. Only each government's borrowing changes from year to year. Gaps mean missing data, not zero.</p>
        <EChart option={allCities} height={320} ariaLabel="Implicit rate by year for each city" />
      </section>
      <section className="block">
        <div className="toolbar">
          <h2>Borrowed on your behalf each year</h2>
          <label className="field inline"><span className="field-label">City</span>
            <select value={cityId} onChange={(e) => setCity(e.target.value)}>{PLACES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </label>
        </div>
        <p className="lede">Your share of each government's new borrowing (the increase in its net debt) in {placeName(cityId)}, as a share of your income.
          Below zero = debt paid down. Taxes paid now are a flat {pct(last?.paidNow ?? 0)} in every year.</p>
        <EChart option={borrowedChart} height={380} ariaLabel="Borrowing on your behalf by year and government" />
      </section>
      <section className="block">
        <h2>Interest on past debt each year</h2>
        <p className="lede">The part of your taxes that went to interest, by government. It is already inside the taxes you pay; this shows how the cost of
          past borrowing grows.</p>
        <EChart option={interestChart} height={320} ariaLabel="Interest on past debt by year and government" />
      </section>
      <section className="block">
        <h2>Public debt you carry</h2>
        <p className="lede">Your share of each government's accumulated net debt in {placeName(cityId)}, in USD. Your share of today's tax revenue is held
          fixed, so the bars show how the debt itself has built up. Today: <b>{usd(totalDebtNow)}</b>. Below zero = net financial assets
          (Alberta before 2016, and most municipalities).</p>
        <EChart option={debtChart} height={320} ariaLabel="Your share of public net debt over time" />
        <p className="fine">Years are fiscal years starting in April (2016 = 2016-17), except city figures, which are calendar years. * City = all municipalities in the province.
          Federal 2008-09 uses the audited deficit because the net debt series changes definition that year; city 2006 uses Canada-wide municipal figures.
          (est.) = estimates, or interim and forecast figures from the latest budgets.</p>
      </section>
    </div>
  );
}
