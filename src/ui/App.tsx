import { useState } from 'react';
import { seriesYears } from '../engine';
import { PersonaPanel } from './components/PersonaPanel';
import { useAllResults } from './model';
import { useStore, type Tab } from './store';
import { CityView } from './views/CityView';
import { CompareView } from './views/CompareView';
import { CurveView } from './views/CurveView';
import { HistoryView } from './views/HistoryView';
import { MethodView } from './views/MethodView';
import { MoveView } from './views/MoveView';
import { PersonasView } from './views/PersonasView';

const TABS: [Tab, string][] = [
  ['compare', 'Compare'], ['city', 'City detail'], ['move', 'Move'], ['history', 'Over time'], ['curve', 'By income'], ['personas', 'Personas'], ['method', 'Method'],
];

const YEARS = seriesYears('CA-federal');

function ThemeToggle() {
  const [theme, setTheme] = useState<string>(() => {
    try { return localStorage.getItem('implicit-tax:theme') ?? 'auto'; } catch { return 'auto'; }
  });
  const apply = (t: string) => {
    setTheme(t);
    if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
    try { localStorage.setItem('implicit-tax:theme', t); } catch { /* ignore */ }
  };
  return (
    <select className="theme" value={theme} onChange={(e) => apply(e.target.value)} aria-label="Colour theme">
      <option value="auto">Auto theme</option><option value="light">Light</option><option value="dark">Dark</option>
    </select>
  );
}

function Controls() {
  const options = useStore((s) => s.options);
  const setOptions = useStore((s) => s.setOptions);
  const latest = options.year === 'latest';
  return (
    <div className="controls">
      <label className="year">
        <span>Borrowing year: <b>{latest ? 'latest' : options.year}</b></span>
        <input type="range" min={YEARS[0]} max={YEARS[YEARS.length - 1]} value={latest ? YEARS[YEARS.length - 1] : (options.year as number)}
          onChange={(e) => setOptions({ year: Number(e.target.value) })} aria-label="Borrowing year" />
        <button className={latest ? 'on' : ''} onClick={() => setOptions({ year: 'latest' })}>Latest</button>
      </label>
      <label className="check"><input type="checkbox" checked={options.netOfTransfers} onChange={(e) => setOptions({ netOfTransfers: e.target.checked })} /> Net of cash transfers</label>
      <label className="check"><input type="checkbox" checked={options.rentersPayPropertyTax} onChange={(e) => setOptions({ rentersPayPropertyTax: e.target.checked })} /> Renters pay property tax via rent</label>
    </div>
  );
}

export function App() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const persona = useStore((s) => s.working);
  const options = useStore((s) => s.options);
  const results = useAllResults(persona, options);
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <h1>Implicit Tax</h1>
          <p>Every tax you pay plus your share of government borrowing, as one rate.</p>
        </div>
        <ThemeToggle />
      </header>
      <div className="layout">
        <div className={`panel-wrap ${panelOpen ? 'open' : ''}`}>
          <button className="panel-toggle" onClick={() => setPanelOpen(!panelOpen)} aria-expanded={panelOpen}>
            {panelOpen ? 'Hide persona' : `Edit persona: ${persona.name}`}
          </button>
          <PersonaPanel />
        </div>
        <main>
          <nav className="tabs" role="tablist">
            {TABS.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
            ))}
          </nav>
          <Controls />
          {tab === 'compare' && <CompareView results={results} />}
          {tab === 'city' && <CityView results={results} />}
          {tab === 'move' && <MoveView results={results} />}
          {tab === 'history' && <HistoryView />}
          {tab === 'curve' && <CurveView />}
          {tab === 'personas' && <PersonasView />}
          {tab === 'method' && <MethodView />}
          <footer>Canada, US, European cities and Singapore. 2026 tax rules; fiscal data from Statistics Canada, provincial accounts, OMB, the Census Bureau, Eurostat, ONS, the Swiss Federal Finance Administration, Statistics Denmark and SingStat. Amounts in USD at 2026 average exchange rates. Not tax advice.</footer>
        </main>
      </div>
    </div>
  );
}
