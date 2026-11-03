import { useMemo } from 'react';
import { calculate, PLACES } from '../../engine';
import type { Persona } from '../../engine/types';
import { chartTheme, pct, usd } from '../format';
import { useStore } from '../store';

export function PersonasView() {
  const { slots, working, options, loadSlot } = useStore();
  const rows = useMemo(() => {
    const list: { label: string; persona: Persona; slot: number | null }[] = [{ label: `${working.name} (editing)`, persona: working, slot: null }];
    slots.forEach((p, i) => p && list.push({ label: `${i + 1}. ${p.name}`, persona: p, slot: i }));
    return list.map((r) => ({ ...r, results: PLACES.map((pl) => calculate(r.persona, pl.id, options)) }));
  }, [slots, working, options]);

  const all = rows.flatMap((r) => r.results.map((x) => x.implicitRate));
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const t = chartTheme();
  const shade = (v: number) => {
    const k = hi === lo ? 0.5 : (v - lo) / (hi - lo);
    const idx = Math.min(t.seq.length - 1, Math.floor(k * t.seq.length));
    return { background: t.seq[idx], color: idx >= 4 ? '#ffffff' : '#0b0b0b' };
  };

  return (
    <div className="view">
      <section className="block">
        <h2>Personas × cities</h2>
        <p className="lede">Implicit income tax rate for each saved persona in each city. Darker = higher. Save up to 3 personas in the panel on the left.</p>
        <div className="scroll-x">
          <table className="heat">
            <thead><tr><th>Persona</th><th className="num">Gross income</th>{PLACES.map((p) => <th key={p.id} className="num">{p.name}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td>{r.slot !== null ? <button className="linkish" onClick={() => loadSlot(r.slot!)}>{r.label}</button> : r.label}</td>
                  <td className="num">{usd(r.results[0].grossIncome / r.results[0].fx)}</td>
                  {r.results.map((x) => (
                    <td key={x.placeId} className="num heat-cell" style={shade(x.implicitRate)} title={`Paid now ${pct(x.paidNowRate)}`}>{pct(x.implicitRate)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 1 && <p className="fine">Only the persona you're editing is shown. Use "Save here" in the panel to keep up to three for comparison.</p>}
      </section>
    </div>
  );
}
