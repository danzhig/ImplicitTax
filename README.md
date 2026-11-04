# ImplicitTax

A static website that calculates your **implicit income tax rate**: every tax you pay
(income, payroll, sales, fuel, property, ...) **plus your share of government borrowing** at the
federal, provincial/state and city levels, expressed as a single percentage of your income.

Build a persona (income, wealth, home, car) in USD, then move it between cities to see which
kind of tax regime you'd be leaving and entering.

**Status:** Phase 1 (Canada: Calgary, Toronto, Vancouver), Phase 2 (US: New York City, San Francisco,
Seattle, Houston), Phase 3 (Europe: Munich, Zurich, London, Luxembourg, Dublin, Oslo, Copenhagen) and Phase 4 (Singapore) done:
all 15 cities,
with 2026 tax rules and fiscal history from 2000. The plan for all 15 cities is in
[docs/PLAN.md](docs/PLAN.md); research notes are in [data/rules/ca/RESEARCH.md](data/rules/ca/RESEARCH.md)
[data/rules/us/RESEARCH.md](data/rules/us/RESEARCH.md), [data/rules/eu/RESEARCH.md](data/rules/eu/RESEARCH.md) and [data/rules/sg/RESEARCH.md](data/rules/sg/RESEARCH.md).

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

Europe (Eurostat, ONS, Swiss Federal Finance Administration, Statistics Denmark):

```bash
scripts/fetch_eu.sh /tmp/eu
```

```bash
python3 scripts/build_fiscal_eu.py /tmp/eu
```

```bash
python3 scripts/build_consumption_eu.py /tmp/eu
```

Singapore (SingStat):

```bash
python3 scripts/build_fiscal_sg.py /tmp/sg
```

Zurich tax tariffs (sampled from the Swiss federal tax calculator):

```bash
python3 scripts/fetch_ch_tariffs.py
```

Tax parameters live in `src/engine/ca/params2026.ts`, `src/engine/us/params2026.ts` and `src/engine/eu/`, each with its source and status.

## Layout

```
src/engine/         pure TypeScript calculation engine (no DOM)
  ca/               Canada: parameters, income tax + CPP/EI, full city calculation
  us/               United States: parameters, federal/state/city income tax + FICA, full city calculation
  eu/               Europe: one module per country (DE, CH, UK, LU, IE, NO, DK), property, shared calculation
  sg/               Singapore: income tax, CPF, property, stamp duties, GST, COE and car taxes
  fiscal.ts         borrowing share: programs vs. interest, without double counting
src/ui/             React app (ECharts charts, zustand state)
data/fiscal/        government finance history (StatCan, provincial accounts, OMB, Census, Eurostat, ONS)
data/consumption/   effective sales tax / VAT rates and spending patterns (StatCan, BEA, Eurostat)
data/rules/*/       research dossiers
scripts/            data fetch/build scripts
tests/              engine tests (CPP/EI and FICA maximums, published rates, history coverage)
```

Not tax advice.
