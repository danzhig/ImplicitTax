import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { PLACES, rateCurve } from '../../engine';
import { axisStyle, baseOption, EChart, useThemeVersion } from '../charts/EChart';
import { chartTheme, pct, usd } from '../format';
import { useStore } from '../store';

const INCOMES = [20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 175, 190, 200, 225, 250, 275, 300, 350, 400, 450, 500].map((k) => k * 1000);

export function CurveView() {
  const persona = useStore((s) => s.working);
  const options = useStore((s) => s.options);
  const v = useThemeVersion();
  const curves = useMemo(() => PLACES.map((p) => ({ place: p, pts: rateCurve(persona, p.id, options, INCOMES) })), [persona, options]);

  const chart = (field: 'effective' | 'marginal'): EChartsOption => {
    const t = chartTheme();
    return {
      ...baseOption(),
      grid: { left: 50, right: 20, top: 40, bottom: 40 },
      tooltip: { ...(baseOption().tooltip as object), trigger: 'axis', valueFormatter: (x) => pct(Number(x)) },
      xAxis: { type: 'value', ...axisStyle(), min: 20000, max: 500000, name: 'Salary (USD)', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: t.muted },
        axisLabel: { color: t.muted, formatter: (x: number) => `$${x / 1000}k` } },
      yAxis: { type: 'value', ...axisStyle(), axisLabel: { color: t.muted, formatter: (x: number) => pct(x, 0) } },
      series: curves.map(({ place, pts }, i) => ({
        name: place.name, type: 'line', step: field === 'marginal' ? 'end' : undefined, symbol: 'none', lineStyle: { width: 2 },
        itemStyle: { color: t.series[i] },
        data: pts.map((p) => [p.incomeUsd, p[field]]),
        markLine: i === 0 ? { symbol: 'none', silent: true, lineStyle: { color: t.axis, type: 'dashed' }, label: { color: t.muted, formatter: 'you' }, data: [{ xAxis: persona.income.employment }] } : undefined,
      })),
    };
  };
  const eff = useMemo(() => chart('effective'), [curves, v]);
  const mar = useMemo(() => chart('marginal'), [curves, v]);

  return (
    <div className="view">
      <section className="block">
        <h2>Implicit rate as salary changes</h2>
        <p className="lede">Your persona with only the salary changed, from {usd(20000)} to {usd(500000)}. Includes your share of borrowing.</p>
        <EChart option={eff} height={340} ariaLabel="Average implicit rate by salary" />
      </section>
      <section className="block">
        <h2>Tax on the next dollar (marginal rate)</h2>
        <p className="lede">How much of an extra $2,000 of salary goes to taxes and borrowing. Steps show brackets, contribution ceilings, surtaxes and benefit clawbacks
          (turn on "net of cash transfers" to include the Canada Child Benefit clawback).</p>
        <EChart option={mar} height={340} ariaLabel="Marginal implicit rate by salary" />
      </section>
    </div>
  );
}
