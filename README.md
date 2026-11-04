# ImplicitTax

A static website that calculates your **implicit income tax rate**: every tax you pay
(income, payroll, sales, fuel, property, ...) **plus your share of government borrowing** at the
federal, provincial/state and city levels, expressed as a single percentage of your income.

Build a persona (income, wealth, home, car) in USD, then move it between cities to see which
kind of tax regime you'd be leaving and entering.

**Status:** Phase 1 (Canada: Calgary, Toronto, Vancouver) and Phase 2 (US: New York City, San Francisco,
Seattle, Houston) done, with 2026 tax rules and fiscal history from 2000. The plan for all 15 cities is in
[docs/PLAN.md](docs/PLAN.md); research notes are in [data/rules/ca/RESEARCH.md](data/rules/ca/RESEARCH.md)
and [data/rules/us/RESEARCH.md](data/rules/us/RESEARCH.md).

## What you can see

- **Compare:** implicit rate per city, split into income tax, CPP/EI, sales and fuel taxes,
  property taxes, borrowing for programs and borrowing just to pay interest.
- **City detail:** waterfall from gross income to what you keep, each government's deficit and
  interest applied to your taxes, a money-flow diagram, and every line item with its calculation.
- **Move:** what changes when you move your persona from one city to another.
- **Over time:** the same breakdown for every year since 2000, by level of government.
- **By income:** average and marginal implicit rate from $20k to $500k.
- **Personas:** up to 3 saved personas × every city.

Personas are stored only in your browser (plus export/import and share links).

## Run it

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

## Deploy on Vercel

Import the GitHub repo in Vercel. `vercel.json` sets the Vite build (`npm run build`, output `dist/`).
There is no backend.

## Update the data

```bash
scripts/fetch_statcan.sh /tmp/statcan
```

```bash
python3 scripts/build_fiscal_ca.py /tmp/statcan
```

```bash
python3 scripts/build_consumption_ca.py /tmp/statcan
```

United States (OMB, Census, BEA):

```bash
scripts/fetch_us.sh /tmp/us
```

```bash
python3 scripts/us_census_parse.py /tmp/us/census /tmp/us/census_parsed.json
```

```bash
python3 scripts/build_fiscal_us.py /tmp/us/omb /tmp/us/census_parsed.json
```

```bash
python3 scripts/build_consumption_us.py /tmp/us/bea
```

Tax parameters live in `src/engine/ca/params2026.ts` and `src/engine/us/params2026.ts`, each with its source and status.

## Layout

```
src/engine/         pure TypeScript calculation engine (no DOM)
  ca/               Canada: parameters, income tax + CPP/EI, full city calculation
  us/               United States: parameters, federal/state/city income tax + FICA, full city calculation
  fiscal.ts         borrowing share: programs vs. interest, without double counting
src/ui/             React app (ECharts charts, zustand state)
data/fiscal/        government finance history (StatCan, provincial accounts, OMB, Census)
data/consumption/   effective sales tax rates and spending patterns (StatCan, BEA)
data/rules/*/       research dossiers
scripts/            data fetch/build scripts
tests/              engine tests (CPP/EI and FICA maximums, published rates, history coverage)
```

Not tax advice.
