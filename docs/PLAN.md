# ImplicitTax — Build Plan

> **One-line idea:** Add up every tax a person pays *and* their share of government
> borrowing, then express the total as one "implicit income tax rate". Do this for one
> persona across 15 cities so you can see what kind of tax regime you're leaving and
> entering.

Status: **Phases 1-4 built**: all 15 cities (Canada, US, Europe, Singapore). See README.md, data/rules/ca/RESEARCH.md, data/rules/us/RESEARCH.md, data/rules/eu/RESEARCH.md and data/rules/sg/RESEARCH.md. Section 9 lists the decisions that need an
answer before (or during) the build. Section 10 lists things that are easy to miss.

---

## 1. The core metric

**Implicit Income Tax Rate (IITR)**

```
IITR = (taxes you pay now + your share of this year's government net borrowing)
       ─────────────────────────────────────────────────────────────────────────
                         your gross income (decision D3 ✅)
```

- **Gross income** is the number you'd quote as your income: salary, bonus and
  self-employment profit, plus investment income (interest, dividends, realized gains,
  rent). $100k USD in Calgary and $100k USD in Munich are the same $100k, and the question
  is what comes off it before it reaches your life.
- **Employer-side contributions are not in the headline.** They never touch your
  paycheque, so they aren't counted on top or underneath. They're shown as an
  information line ("your employer also pays $X on your behalf"), off by default.

- "Taxes you pay now" covers income tax, payroll and social contributions, VAT/GST/HST/sales
  tax, fuel and home-energy taxes, vehicle taxes, property tax, wealth tax,
  transfer and stamp duties, and tariffs.
- "Your share of net borrowing" is the deferred tax: what governments spent on your behalf
  this year but didn't collect. It's computed separately for each level (federal,
  provincial/state, city).
- Surpluses produce a **negative** deferred tax, a credit. Norway, Singapore and
  Luxembourg will often show one.

### 1.1 Splitting it into "debt issuance" and "interest" without double counting

This is the subtle part. Interest on old debt is already part of this year's spending, so
some of it is paid by your current taxes and some by new borrowing. If you simply add
"deficit tax" and "interest tax" on top of the taxes you pay, interest gets counted twice.

The clean breakdown, for each level of government L:

|                                  | Paid now (your taxes) | Deferred (new borrowing) | Covered by non-tax revenue* |
|----------------------------------|-----------------------|--------------------------|-----------------------------|
| **Programs** (non-interest spending) | A                 | B = your primary deficit | E                           |
| **Interest** on past debt        | C                     | D = borrowing to pay interest | F                     |

\* Resource royalties, fees, investment income, central bank profits. This matters a lot
for Alberta, Norway and Singapore.

- **Headline IITR** = A + B + C + D (everything you pay or will owe).
- **"Debt issuance tax"** = B + D (this year's new borrowing on your behalf).
- **"Interest tax"** = C + D (what servicing past debt costs you this year).
- **D is the compounding**: borrowing to pay interest. When D > 0, debt grows on its own.
  This should be its own highlighted color in every chart.

Charts show B, C and D as layers inside the headline, never added on top of it.

### 1.2 How to allocate a government's borrowing to one person

Recommended default: the **tax-share method**. Your share of a level's borrowing equals
your share of what that level collects in taxes:

```
deferred_L = your_taxes_to_L × (net_borrowing_L / total_tax_revenue_L)
```

This gives a very intuitive number, the **deficit surcharge**: "Ottawa borrowed $0.X for
every $1 it collected, so your federal tax bill is really X% bigger." The logic is that
future repayment will most likely use roughly today's tax mix.

Alternatives to offer as a toggle, so users can see how sensitive the result is (decision D4):

- **Per capita**: equal share per resident. This is regressive and makes the deficit look
  huge for low earners.
- **Per taxpayer**: equal share per tax filer.
- **Income share**: your income ÷ total personal income in that jurisdiction.

### 1.3 Three ways to view debt

1. **Flow (default):** this year's net borrowing, as above.
2. **Stock:** your share of the outstanding net debt, shown as "years of your income"
   ("you carry 0.9 years of income in public debt across 3 levels of government").
3. **Sustainability (r − g):** if the economy grows faster than the interest rate, debt
   can be rolled over forever and never repaid by taxes. This optional view shows the
   primary surplus needed to keep debt/GDP stable, which is a more defensible "true
   deferred tax" number for economists. It belongs in a footnote toggle, since it
   undercuts the simple framing but makes the tool credible.

### 1.4 History over time (every city, every year)

Every city gets a full year-by-year version of the breakdown, ≈2000 → latest year. The
persona and **today's tax rules stay fixed** (your income, taxes paid now and taxes per
level don't change). What changes each year is each government's borrowing and interest,
at the federal, provincial/state and city level (decision D9 ✅).

**Per year t, per level L** (fed / prov-state / city, plus social security funds where
separate):

```
your_taxes_L          = today's tax bill to level L (fixed across years)
deficit_ratio_L,t     = net_borrowing_L,t / tax_revenue_L,t
interest_ratio_L,t    = interest_L,t      / tax_revenue_L,t

Primary balance convention (interest counts as borrowed first):
  D  (borrowed interest)      = your_taxes_L × min(max(deficit_ratio, 0), interest_ratio)
  C  (interest paid by taxes) = your_taxes_L × interest_ratio − D
  B  (borrowed for programs)  = your_taxes_L × deficit_ratio − D      (negative in surplus years = credit)
```

Each of these, divided by your income, gives a percentage layer for that year. Taxes paid
now are the same in every year, so the year-to-year movement in the chart comes entirely
from government borrowing and interest.

Example result: "If you had lived in Toronto in 2009 with today's income and tax bill,
the federal government would have borrowed 6% of your income on your behalf, Ontario 4%,
and the City 0.3%. Of that, 2.5% was borrowing just to pay interest."

**What the history view shows** (details in §5, chart 8):
- The **same stacked percentage breakdown as the current-year view**, for every year.
  Layers: taxes paid now (flat band) → deferred programs (B) and borrowed interest (D),
  split by federal / provincial / city → interest paid from taxes (C) as an overlay.
- A **year slider**: drag it and every other chart (waterfall, Sankey, city ranking) shows
  that year's numbers.
- **All cities over time**: one line per city for the total implicit rate, or for just the
  deferred part, so you can see which places borrowed through which crises.
- **By level**: small multiples per city with federal / provincial / city on separate rows.
  This shows whether a city's change came from Ottawa, the province or city hall.
- **Cumulative**: running total of B + D since 2000 against interest paid (C + D). This
  shows the compounding. Plus a stock line: "your share of public debt, in years of income".
- **Event markers**: 2008–09 crisis, 2014–15 oil crash (Calgary, Houston, Oslo), 2020
  pandemic, 2022 rate rises, 2025 tariffs.

**Data rules:**
- Everything is shown as **% of your income**, which removes currency and inflation noise.
  Per-capita amounts in real base-year dollars go in a secondary view.
- If a level's data starts later than 2000 (likely for some cities), the chart shows a
  gap. Gaps are never filled with guesses.
- Years based on budget estimates rather than audited results are drawn hatched.
- Fiscal years are mapped to calendar years (§7).

**Possible v2 toggle:** apply the biggest historical rate changes to the "taxes paid now"
band too (e.g. Canadian GST 7% → 6% → 5%, consumer carbon tax on/off, US 2017 and 2025 tax
changes) without rebuilding full historical tax law.

---

## 2. Places: 15 cities

A strict "top 15 by GDP per capita" list would be almost all US metros, plus Luxembourg,
Zurich, Oslo and Dublin, and Canada would not appear at all. So the list is **curated**:
all three Canadian cities, four US cities (two of them, Seattle and Houston, with no state
income tax), a strong European group, and Singapore (decision D1 ✅).

| # | City | Country | Levels of government to model | Why it's interesting |
|---|------|---------|-------------------------------|----------------------|
| 1 | Calgary | Canada | Federal · Alberta · City | No provincial sales tax, resource revenue, Heritage Fund |
| 2 | Toronto | Canada | Federal · Ontario · City | HST 13%, double land transfer tax, large provincial debt |
| 3 | Vancouver | Canada | Federal · BC · City (+ Metro Van/TransLink) | PST + GST, speculation and vacancy tax, empty homes tax |
| 4 | New York City | USA | Federal · NY State · NYC (+ MTA) | City income tax, high SALT |
| 5 | San Francisco | USA | Federal · California · City & County | Top state income tax rate, Prop 13 property tax |
| 6 | Seattle | USA | Federal · Washington · King County · City | No wage income tax, high sales tax, WA capital gains tax |
| 7 | Zurich | Switzerland | Confederation · Canton · Commune (+ church) | 3-level income tax, wealth tax, imputed rent, mandatory health premiums |
| 8 | Luxembourg City | Luxembourg | State · Commune | Highest GDP per capita, low VAT, surplus-ish |
| 9 | Dublin | Ireland | State · City Council (Local Property Tax) | High marginal rates at low thresholds, USC, multinational corporate tax windfall |
| 10 | Oslo | Norway | State · Municipality | Wealth tax, sovereign wealth fund (large net *assets*) |
| 11 | Copenhagen | Denmark | State · Region · Municipality | Municipal income tax, 25% VAT, car registration tax |
| 12 | London | UK | Central · GLA · Borough (council tax) | Stamp duty, non-dom changes, frozen thresholds |
| 13 | Munich | Germany | Federal · Bavaria · City | Solidarity surcharge, church tax, heavy social contributions |
| 14 | Singapore | Singapore | Single level | CPF (is it a tax?), car COE, ABSD for foreigners, reserves |
| 15 | Houston | USA | Federal · Texas · Harris County · City · school district (+ special districts: flood control, community college, MUDs) | No state income tax, 8.25% sales tax, high property tax that funds schools, oil economy (pairs with Calgary), city pension debt |

Alternates if you want to swap any in later: **Dubai** (zero income tax, very useful
contrast), Sydney, Amsterdam (30% ruling, box 3), Stockholm, Geneva, Boston, Hong Kong,
Tokyo, Paris.

That gives 10 countries, 15 sub-national regimes and 15+ municipal regimes. Only the
income tax and payroll parts need full engines. Every other tax type uses a simpler,
data-driven calculation (see §4).

---

## 3. Persona inputs

All money is entered in **USD** and converted at a fixed exchange rate for the tax year
(PPP is optional, see decision D5). Each section can be switched on or off.

**Identity and household**
- Age (some credits and pensions depend on it), citizenship (US citizens are taxed
  everywhere), years since arrival (newcomer regimes), religion (church tax in DE, CH, DK)
- Filing status: single, or married with 1 or 2 earners. Number and ages of children.

**Income**
- Employment salary and bonus; self-employment profit
- Investment income: interest, dividends (domestic/foreign), realized capital gains
  (short/long)
- Rental income, pension withdrawals
- Default: investment income is *derived from wealth × yield assumptions*, with a manual
  override (decision D7)

**Wealth (balance sheet)**
- Cash and deposits, bonds, equities (taxable vs. retirement accounts), primary residence
  (value + mortgage), other real estate, business equity, vehicles
- Used for wealth tax (CH, NO), property tax and investment income

**Housing**
- Own or rent; home value or rent; purchase this year? (transfer and stamp duty, either
  annualized or one-off, decision D8); first-time buyer; foreign buyer status

**Consumption (what consumption taxes are applied to)**

No receipts-level questions. The user sets a **savings rate**; spending = income − taxes −
savings. That spending is split automatically using national household spending survey
averages for that income level. This fixes the VAT-exempt vs. taxed share (rent, groceries,
financial services). An "advanced" panel can override the split, but nobody has to touch it.

**Energy and transport (only the inputs that move the number)**
- Car: none / gas / EV, and rough km per year (low / average / high). Fuel economy uses a
  default.
- Home heating: gas / oil / electric / heat pump / district, with usage estimated from home
  size.
- New car this year? (registration taxes in DK/NO and the COE in SG are large enough to
  matter)

**Retirement and deductions**
- RRSP/401k/pillar 3a/CPF top-up contributions, mortgage interest (deductible in US, CH, NO,
  DK), charitable giving

---

## 4. What the tax engine must calculate

| Tax family | How it's modeled | Notes |
|---|---|---|
| Personal income tax (all levels) | **Full engine**: brackets, credits, deductions, surtaxes | Ontario surtax, Swiss communal multiplier, NYC tax, DK municipal rate, German Soli, US AMT (possibly simplified) |
| Payroll / social contributions | **Full engine**: rates, ceilings; employee side in the headline, employer side as an info line only | CPP/CPP2/EI, FICA, NI, German social contributions, AHV/IV/EO, PRSI, CPF, Ontario Health Premium. **How each one feeds back into income tax is in §4.1.** |
| Capital income | Engine | Dividend tax credits, CG inclusion rates, NIIT, box-style systems, WA capital gains tax |
| VAT / GST / HST / sales tax | Basket × effective rate per category | Prices include tax: `tax = spend × r / (1 + r)`. US sales tax mostly excludes services. |
| Excise: fuel and home energy | Estimated quantity × per-unit rate | Carbon pricing (Canada's consumer carbon tax ended April 2025, EU ETS2 from 2027–28), electricity levies (DE, DK are large) |
| Vehicles | Purchase/registration + annual fees | DK/NO registration tax, SG COE + ARF, UK VED |
| Property tax | Assessed value × mill rate (city + school + regional) | Prop 13 assessment caps, UK council tax bands, Irish LPT bands, Swiss imputed rent (voted to be abolished in 2025, date of effect still to come) |
| Wealth tax | Net wealth × cantonal/national schedule | Zurich, Oslo; Spain/NL if added later |
| Transfer and stamp duty | On purchase; annualized option | Toronto double LTT, UK SDLT, SG ABSD, foreign buyer surcharges |
| Tariffs | Customs revenue ÷ household consumption → effective rate on goods | US effective tariff rate rose sharply in 2025. This belongs in the consumption tax bucket. |
| Mandatory "tax-like" costs (optional) | Flat inputs | Swiss/Dutch mandatory health premiums, US employer health insurance, CPF, Swiss pillar 2 (decision D2) |
| Corporate tax incidence (optional) | Your share-ownership × effective corporate rate | For business owners and investors. Off by default. |
| Deferred tax (deficit) | §1.2 per level | Federal, provincial/state, city, plus regional bodies (TransLink, MTA, GLA) where data exists |

**Explainability is required.** Every number needs a line-item trace ("Ontario basic
personal amount credit: −$X") and a source link. Without that, nobody will trust a
comparison across 15 cities.

### 4.1 Contributions ↔ income tax interactions (must be done for every place)

Payroll contributions are not separate from income tax. Most of them reduce income tax
through a **credit** or a **deduction**, so their real cost is lower than the amount
withheld. CPP and EI are the clearest examples. If the engine misses these links, every
place's number is wrong in a different way, and the comparison is worthless. So this is a
required part of the research phase for each country, written up in
`data/rules/{country}/RESEARCH.md` before any code for that country is written.

**Calculation order (same skeleton everywhere):**
1. Payroll contributions (employee side; both sides if self-employed), with floors and
   ceilings.
2. Turn those contributions into **deductions** (lower taxable income) or **credit bases**
   (lower tax directly), separately for each level. Federal and provincial/state treatment
   can differ.
3. Income tax per level: brackets → credits (incl. those from step 2) → surtaxes and
   add-ons computed on tax (Ontario surtax, Ontario Health Premium, German Soli, church
   tax, Swiss communal/cantonal multipliers).
4. Report each contribution **gross** and the **tax relief it generates** as a linked
   negative line: "CPP $4,0xx paid → −$5xx back through credits → net cost $3,5xx". Show
   the same for EI and every other contribution, so you see both sides.

**Self-employed personas pay both sides.** A self-employed person pays the employee *and*
employer share themselves, out of their own income. So both halves count in the headline
(consistent with D3), along with whatever relief applies to the employer half.

**Research checklist per country and level:**
- [ ] Every mandatory contribution: rate, floor, ceiling, employee vs. employer vs.
      self-employed rates
- [ ] For each one: deductible, credit (at what rate?), or neither? Federal and
      sub-national separately
- [ ] Credit rate ≠ lowest bracket rate? (check, since provinces/states can set them
      differently)
- [ ] Employment-linked credits/deductions (e.g. Canada employment amount, Norway minimum
      deduction, Denmark employment deduction)
- [ ] Add-ons computed on tax or on income (surtaxes, health premiums, Soli, church tax)
- [ ] Do contributions above the ceiling stop? That causes a drop in the marginal rate,
      which should show up on the rate curve
- [ ] Employer-paid items that are taxable benefits to the employee
- [ ] Retirement savings deductions and their limits (RRSP, 401k, pillar 3a, CPF top-ups)
- [ ] Are benefits later received from the contribution taxable? (CPP pension, EI benefits:
      info only, not in the annual number)
- [ ] One golden test per country that exercises the contribution → tax link

**Starting hypotheses to verify during research** (from general knowledge, not yet
checked against current-year sources):

| Place | Contributions | Expected income tax treatment (verify) |
|---|---|---|
| Canada (fed + AB/ON/BC) | CPP base, CPP enhanced (first additional), CPP2, EI | Base CPP and EI → non-refundable credits at federal and provincial level. Enhanced CPP and CPP2 → deductions. Self-employed: employer half deductible. Plus the Canada employment amount credit. Ontario Health Premium is an extra tax. |
| USA (fed + NY/NYC, CA, WA, TX) | Social Security, Medicare, Additional Medicare 0.9%; CA SDI; NY SDI/PFL; WA Cares and PFML | Employee FICA not deductible. Self-employed deduct half of SE tax. State payroll programs vary, so check each state. |
| Switzerland (ZH) | AHV/IV/EO, ALV, BVG (pillar 2), accident insurance | Employee contributions deductible at federal, cantonal and communal levels. Pillar 3a deductible up to a cap. Health premiums partly deductible (capped). |
| Luxembourg | Pension, health, dependence insurance | Social contributions largely deductible; check dependence insurance. |
| Ireland | PRSI, USC | Neither deductible. Pension contributions get relief at marginal rate within age-based limits. |
| Norway | National insurance (trygdeavgift) | Not deductible. Two income bases (ordinary income vs. personal income for bracket tax), plus the minimum deduction. |
| Denmark | AM-bidrag 8%, ATP | AM-bidrag is deducted before income tax. Employment deduction. Municipal + church tax rates. |
| UK | Employee NI | Not deductible. Pension contributions get relief; salary sacrifice also cuts NI. |
| Germany | Pension, health, long-term care, unemployment | Pension contributions deductible. Basic health and care deductible. Unemployment limited within a capped allowance. Soli and church tax computed on income tax. |
| Singapore | CPF (employee) | CPF relief on mandatory contributions up to the ceiling. |

### 4.2 Hidden and "effective" taxes (shortlist)

**Rule for what's included.** A hidden tax only makes the list if it meets all four tests:
1. **Large enough to matter:** typically ≥ ~0.5% of income for a normal persona, or it
   creates a big jump in marginal rates.
2. **Recurring:** paid every year, or a one-off that can sensibly be spread over years.
3. **Data is public and easy to get** for all 15 cities.
4. **Needs no personal detail.** It runs off inputs the persona already has (income, wealth,
   home, car) or no inputs at all.

**Automatic: no extra questions**

| Hidden tax | What it is | Default |
|---|---|---|
| Benefit clawbacks | Benefits shrink as income rises (Canada Child Benefit, GST credit, OAS, UK child benefit charge, US ACA subsidy cliff), which works like an extra marginal tax | **On** in marginal rates and in "net of transfers" (D13) |
| Tariff price effect | Domestic competitors raise prices to match tariffed imports, so you pay more but no tax is collected (the tariff revenue itself is already counted in §4) | **Toggle** |
| Corporate tax incidence | Part of corporate tax comes out of your wages and investment returns | **Toggle** |
| Tax on tax | VAT/GST charged on top of fuel excise | **On** (calculation rule, not a separate line) |

**Info lines: shown, never added to the rate**

| Hidden tax | What it is |
|---|---|
| Employer-side payroll and health taxes | Taxes moved from your paycheque to your employer (BC Employer Health Tax replaced MSP premiums; German employer contributions). Already the D3 info line. |
| Tax inside retirement accounts | Part of every RRSP/401k/pillar 3a balance is future tax, so net worth is overstated. Shown as a net-of-tax wealth line. |

**One checkbox**

| Hidden tax | What it is | Default |
|---|---|---|
| Development charges | Charges on new homes, built into the purchase price; tens of thousands of dollars per home in Toronto and Vancouver | **On** if "bought a new-build" is ticked, spread over the holding period like land transfer tax |

**Dropped** (too small, too personal, or poor data). Mention them once on the methodology
page so they don't look forgotten: alcohol, tobacco and cannabis excise and liquor board
markups; broadcast fees; telecom surcharges; insurance premium taxes; utility franchise
fees; travel taxes; tolls and congestion charges; supply management; VAT hidden in exempt
services; industrial carbon pricing in prices; probate fees; share transaction taxes;
foreign dividend withholding; Swiss military exemption tax; student loan repayments; tax
filing costs; interest-free over-withholding. Inflation-related items (inflation tax on
cash and bonds, tax on nominal gains, bracket creep) are excluded on purpose (D18).

---

## 5. Outputs and charts

1. **Headline card per city**: IITR %, total $ (USD + local), net disposable income, and
   purchasing-power-adjusted disposable income.
2. **Stacked bar, all 15 cities sorted**: IITR split into labor / consumption / property /
   wealth / deferred-programs / deferred-interest. This is the main comparison view.
3. **Waterfall for one city**: gross income → income tax → payroll → consumption →
   property → **paid-now total** → deferred (B) → compounding interest (D) → implicit
   total.
4. **Sankey**: your income → each tax → each level of government → (programs | interest
   | deferred). Very good for "where does my dollar go".
5. **Move my persona (origin → destination)**: diverging bar of the change per tax type
   ("+$14k income tax, −$3k VAT, +$2k deferred"), plus a one-line verdict ("You'd move
   from a consumption-heavy, low-borrowing regime to a labor-heavy, high-borrowing one").
6. **Regime fingerprint**: a small chart per city of the burden mix (labor vs. consumption
   vs. capital/wealth vs. deferred). This shows the kind of regime, not just its size.
7. **Rate curve**: effective and **marginal** IITR as income goes from $30k to $1M, one
   line per city. This shows how progressive each place is and where the cliffs are
   (e.g. UK personal allowance taper, Canadian clawbacks).
8. **History (per city, every year)**: the full percentage breakdown as a stacked area,
   2000 → latest:
   - taxes paid now (flat band)
   - deferred programs (B) and borrowed interest (D), split federal / provincial / city
   - interest paid from taxes (C) as an overlay

   Plus a year slider that drives every other chart, an all-cities line comparison,
   by-level small multiples, a cumulative compounding chart and a "public debt in years of
   income" stock line. See §1.4.
9. **Persona × City heatmap**: 3 saved personas × 15 cities, IITR in each cell.
10. **Uncertainty**: each number has a confidence badge (high: statutory calculation;
    medium: basket estimate; low: allocation assumption).

Charting library: **Apache ECharts** (stacked bar, waterfall, sankey, heatmap and line in
one library, good performance, works on static sites).

---

## 6. Architecture

```
ImplicitTax/
├─ apps/web/                  # Vite + React + TypeScript static site
│  ├─ src/components/charts/  # ECharts wrappers
│  ├─ src/features/persona/   # input forms, 3 local slots, import/export, share link
│  └─ src/features/compare/   # city compare, move, history views
├─ packages/engine/           # pure TS, no DOM — the calculation engine
│  ├─ core/                   # bracket engine, credits, caps, basket VAT, allocation math
│  ├─ jurisdictions/
│  │   ├─ ca/  (federal.ts, ab.ts, on.ts, bc.ts, cities/…)
│  │   ├─ us/  (federal.ts, ny.ts, nyc.ts, ca.ts, wa.ts, …)
│  │   └─ ch/, lu/, ie/, no/, dk/, uk/, de/, sg/
│  └─ trace/                  # line-item explanation output
├─ data/
│  ├─ rules/{country}/{year}.json     # brackets, rates, thresholds (zod-validated)
│  ├─ rules/{country}/RESEARCH.md     # filled-in §4.1 checklist with sources
│  ├─ fiscal/{place}/{level}.json     # per year: total revenue, tax revenue, spending, interest, net borrowing, net debt, audited/estimate flag, source
│  ├─ fx/{year}.json, ppp/{year}.json
│  └─ baskets/{country}.json          # default spending shares, VAT category mapping
├─ scripts/                   # data fetch/clean (run manually, outputs committed)
└─ tests/golden/              # known-answer cases vs. official calculators
```

- **Rules are data where possible, code where needed.** Brackets and rates go in JSON,
  and quirks go in small per-jurisdiction functions. Everything is versioned by tax year.
- **Engine is a pure function**: `calculate(persona, placeId, year, options) →
  { lineItems[], totals, byLevel, trace }`. It's easy to test and runs quickly in the
  browser for rate curves (≈100 incomes × 15 cities).
- **Static only**: no backend. All data is bundled JSON. Deploy on Vercel from GitHub
  (Vite preset, `dist/`); every PR gets a preview URL.
- **Personas**: 3 slots in `localStorage` with a schema version for migrations, JSON
  export/import, and a share link that encodes the persona in the URL hash
  (lz-string compressed). Nothing leaves the browser, which is worth stating in the UI.
- **Testing**: Vitest unit tests on the engine, plus **golden tests** checked against
  official calculators (HMRC, Swiss ESTV, Skatteetaten, IRAS, Revenue.ie, SKAT, CRA payroll calculator, IRS withholding estimator) and
  the **OECD *Taxing Wages*** tax-wedge figures at 67/100/167% of average wage. That's a
  ready-made benchmark for all 10 countries.

---

## 7. Data sources (fiscal / borrowing side)

| Need | Sources |
|---|---|
| National + sub-national government finance, harmonized | IMF GFS & WEO, OECD Government at a Glance / National Accounts by sub-sector, Eurostat `gov_10a_main` (sub-sectors S1311 central, S1312 state, S1313 local, S1314 social security) |
| Canada | Statistics Canada Canadian Government Finance Statistics, Fiscal Reference Tables (Finance Canada), provincial Public Accounts, city annual financial reports (use **change in net debt**, not the PSAB "annual surplus", which counts capital) |
| USA | CBO / Treasury (federal), Census Annual Survey of State & Local Government Finances, state & city ACFRs (NYC, SF, Seattle, King County, Houston, Harris County), Texas Comptroller and Texas Bond Review Board (local and school district debt) |
| Switzerland | Federal Finance Administration financial statistics (Confederation, cantons, communes) |
| UK | ONS Public Sector Finances, MHCLG local authority revenue/capital outturn, GLA accounts |
| Germany | Destatis (Bund, Länder, Gemeinden), Bavarian statistics office, Munich budget |
| Others | STATEC (LU), CSO / Dept. of Finance (IE), SSB (NO), Statistics Denmark, Singapore MOF budget statements |
| Tax rules | Official revenue agency sites + OECD Tax Database + PwC Worldwide Tax Summaries for cross-checking |
| FX / PPP | Central bank annual average rates; World Bank / OECD PPP |
| Consumption baskets | National household spending surveys (StatCan SHS, BLS CEX, ONS LCF, Eurostat HBS) |

Calendar alignment matters: fiscal years differ (Canada Apr–Mar, US federal Oct–Sep, most
states Jul–Jun but Texas Sep–Aug, UK Apr–Mar, NYC and Houston Jul–Jun). Assign each fiscal year to the
calendar year it mostly covers, and document the choice.

---

## 8. Phased roadmap

| Phase | Scope | Result |
|---|---|---|
| **0. Decisions + schema** | Answer §9, define persona, rule, fiscal and output schemas | Specs + empty engine skeleton, Vercel deploy working |
| **1. Canada end-to-end** ✅ | Federal + AB/ON/BC income tax, CPP/EI, GST/HST/PST, fuel and home-energy taxes, property tax, LTT, fiscal history for 3 levels × 3 cities | Calgary vs Toronto vs Vancouver fully working: all charts, 3 persona slots. Proves the concept. |
| **2. USA** ✅ | Federal (current law), NY + NYC, CA, WA, TX (Houston), FICA, sales tax, property, tariffs, federal/state/city fiscal history | First cross-border "move my persona" |
| **3. Europe** ✅ | CH (ZH), LU, IE, NO, DK, UK, DE | Wealth tax, church tax, VAT-heavy regimes, surplus regimes |
| **4. Singapore** ✅ | SG | CPF handling, COE, ABSD |
| **5. Depth** | Rate curves, r−g view, newcomer regimes, corporate incidence, sensitivity toggles | Credibility and nuance |
| **6. Hardening** | Golden tests for all places, source citations everywhere, accessibility, mobile layout | Public-ready |

Realistic sizing: Phase 1 is the largest single step (it builds the core engine, the
chart system and the data pipeline). Each later country takes roughly a third of the
Phase 1 effort, and most of that goes into income tax, payroll and fiscal data.

---

## 9. Decisions you need to make

My recommendation is in **bold** for each. ✅ = decided.

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D1 ✅ | City list | Strict GDP-per-capita ranking vs. curated | **Decided: curated 15 in §2** (Houston in place of Sydney). Dubai is the first alternate. |
| D2 ✅ | Do mandatory savings and insurance count as tax? (CPP, CPF, Swiss pillar 2, Swiss health premiums, US employer health) | Tax / not tax / separate bucket | **Separate "mandatory, tax-like" bucket**, shown and toggleable. CPP and public pensions count as tax by default; private mandatory accounts (CPF, BVG) don't by default. Without this, Singapore and Zurich comparisons are misleading. |
| D3 ✅ | Denominator of the rate | Gross salary / gross + employer payroll tax ("total labor cost") / total economic income incl. investment income | **Decided: your gross income** (salary + self-employment + investment income) — the paycheque view. Employer-side contributions are excluded from the headline and shown only as an info line. |
| D4 ✅ | Deficit allocation method | Tax-share / per capita / per taxpayer / income-share | **Tax-share** default, others as a toggle with side-by-side sensitivity |
| D5 | Currency conversion | Market FX / PPP | **Market FX** for "move my USD", plus a PPP-adjusted disposable income line, so you see both the tax and the cost-of-living picture |
| D6 | "Same USD" vs. "same life" when moving | Keep the USD house value / keep an equivalent house (local median multiple) | **Same USD by default**, "equivalent lifestyle" as v2. Also show your income percentile in each city ($200k is top 2% in Oslo, upper-middle in SF). |
| D7 | Investment income | Entered directly / derived from wealth × yields | **Derived, with override** |
| D8 | One-off taxes (land transfer, stamp duty, car registration) | Year of purchase / annualized over a holding period | **Annualized over a user-set holding period (default 10 yr)** |
| D9 ✅ | History method | Hold today's tax rules and apply historical fiscal ratios / rebuild past tax law | **Today's rules × historical ratios** (rebuilding past law is impractical) |
| D10 ✅ | Gross or net debt; which borrowing measure | Gross / net; deficit / net lending / change in net debt | **Borrowing = yearly increase in official net debt** (debts minus financial assets), from each government's own accounts; interest shown separately, not split out of borrowing. Revised after review: StatCan accrual and national-accounts measures understated federal borrowing, and StatCan provincial net debt moves with market prices. See data/rules/ca/RESEARCH.md. |
| D22 ✅ | Sovereign wealth funds (Norway's oil fund) | Exclude like CPP / keep in central government | **Keep.** Pension funds like the CPP are owned by members and can only pay pensions, so they are excluded. A state-owned fund that pays for the budget is part of the government's finances: its saving shows as negative borrowing, a credit to residents. |
| D11 | Social security funds (CPP/QPP, US Social Security trust funds, DE Sozialversicherung) | Fold into federal / separate level | **Separate "social security" level** in the breakdown |
| D12 | Unfunded pension liabilities and implicit debt | Ignore / show as an info stock | **Info only** (not in IITR), with a footnote. US state/city pension gaps are large. |
| D13 | Cash benefits received (child benefit, refundable credits) | Ignore / net them off | **Show gross IITR and a "net of cash transfers" toggle**. Public services (healthcare, schools) are not valued, with a clear disclaimer. |
| D14 | Household scope v1 | Single only / single + couples + kids | **Single + couple (1 or 2 earners) + children count** |
| D15 | Citizenship effects | Ignore / model US citizenship tax, departure taxes | **Flag them in "move" view** (US citizens owe US tax anywhere; Canada departure tax on emigration) but don't fully model them in v1 |
| D16 | Newcomer regimes (UK 4-year FIG regime, Swiss lump-sum, DK researcher scheme, IE SARP, NL 30%) | Ignore / toggle | **Toggle per city, v2** |
| D17 | Base tax year | 2025 (final) / 2026 (current) | **2026 rules**, with fiscal data through the latest audited year plus budget estimates clearly marked |
| D18 ✅ | Tariffs and inflation | Include / exclude | **Tariffs on. Everything inflation-related is excluded** (inflation tax, tax on nominal gains, bracket creep). Deficits are already counted, and inflating debt away is just one way they get paid, so including it would double count. |
| D19 | Regional bodies (TransLink, MTA, GLA, King County, Metro Vancouver) | Fold into city / separate / skip | **Fold into "local" level** with a note |
| D20 ✅ | Tech stack | Vite+React / Next static export / SvelteKit / Astro | **Vite + React + TS + ECharts + Zustand + Vitest**, plain CSS with light/dark tokens (Tailwind dropped as unnecessary). Single package; the engine lives in `src/engine` with no DOM access. |
| D21 | Public or personal tool? | Personal / public site | This changes how much effort goes into citations, disclaimers, accessibility and analytics. **Assume public-quality, but ship personal-quality first.** |

---

## 10. Things you might not have thought about

**Accounting and economics**
- **Interest double counting** (§1.1). Interest is already inside current spending.
  "Deficit tax" and "interest tax" overlap and should be shown as layers, not summed.
- **Primary vs. total deficit.** A government can run a primary surplus and still borrow,
  just to pay interest. That case is pure compounding, and it's the thing you want to see.
- **Present value view.** If you discount future repayment at the government's own
  borrowing rate, today's deficit already *equals* the present value of the future taxes,
  so interest isn't an extra burden in present value terms. It is an extra burden in
  cash-flow terms. Worth one sentence in the methodology page so nobody can call the
  tool wrong.
- **r − g.** If growth beats interest rates, debt is never fully repaid by taxes. The
  "delayed tax" is then smaller than the deficit. Offer it as a sensitivity view.
- **Inflation is deliberately excluded.** Deficits are already counted in full, and
  inflating debt away is just one of the ways they get paid, so counting both would be
  double counting. The methodology page should say this explicitly, since inflation is
  the first thing critics will ask about. (Inflation from other causes, like supply shocks
  or central bank policy unrelated to deficits, is also out of scope.)
- **Who repays?** Future taxpayers may not include you (you move, retire, die). The metric
  is "your fair share if it were settled now", not a prediction of your personal bill.
- **Tax incidence.** Employer payroll taxes, corporate taxes and even property taxes on
  rentals are partly passed on to you as lower wages or higher rents. The headline uses the
  paycheque view (D3), so Germany, France and others with heavy employer contributions will
  show a lower rate than the OECD "tax wedge". Golden tests must compare against the
  employee-side OECD figures, not the full wedge.
- **Non-tax revenue funds some governments** (Alberta oil royalties, Norway's fund, Swiss
  National Bank profits, Singapore's reserve returns). Low taxes there don't mean low
  spending. Your share of resource revenue is a hidden subsidy, not a tax.
- **Intergovernmental transfers.** Federal transfers to provinces/states are spending at
  one level and revenue at another. Allocate each level's deficit using its own taxes, so
  transfers aren't counted twice.
- **City deficits look small** because Canadian municipalities can't borrow for operating
  costs, and many US states and cities have balanced-budget rules. Their debt is mostly
  capital debt, plus large unfunded pensions in the US. Use change in net debt, and show
  pension gaps as a stock (D12).
- **Singapore's government debt doesn't fund spending.** It's issued for the CPF and
  invested, so the deficit tax there should be about zero, not its large gross debt.

**Tax mechanics**
- **US sales tax vs. VAT.** Sales tax mostly skips services, so a 10% sales tax can
  raise less than a 10% VAT. Your consumption basket matters more than the headline rate.
- **Embedded and cascading taxes**: BC PST and US sales taxes on business inputs, and
  fuel taxes built into delivery costs. These are hidden in prices. Possibly a rough
  "embedded tax" factor in v2.
- **Prices include VAT.** Use `spend × r/(1+r)`, not `spend × r`.
- **Energy taxes go beyond gasoline**: German and Danish electricity levies, natural gas
  taxes, EU ETS2 (household carbon pricing from 2027–28). Canada's *consumer* carbon tax
  ended in April 2025, so history charts should show the drop.
- **Car taxes can dominate**: Denmark's registration tax, Singapore's COE (often more
  than the car itself), Norway's vehicle taxes. These need a "car owner" switch.
- **Church tax** (DE, CH, DK) depends on a personal choice. It needs an input.
- **Mortgage interest deductibility** and **imputed rent** (CH) make owning vs. renting
  very different between cities.
- **Benefit clawbacks create hidden marginal rates** (UK personal allowance taper
  between £100k–£125k gives a ~60%+ marginal rate; Canadian OAS clawback; Canada Child
  Benefit phase-out). The marginal rate curve chart is where these show up.
- **Joint vs. individual filing** (US joint returns, German income splitting) can change
  the result a lot for one-earner couples.
- **Recent and upcoming changes to track**: US 2025 tax law changes (SALT cap, new
  deductions), UK non-dom abolition (April 2025), Swiss imputed-rent abolition (voted
  2025, date of effect still to come), the end of Canada's consumer carbon tax, and the
  US tariff level.

**Moving the persona**
- **Exit and entry costs**: Canada's departure tax (deemed sale of assets on leaving),
  the US exit tax for renouncing citizenship, and US citizenship-based taxation. A US
  citizen in Zurich still files US returns.
- **Foreign buyer rules**: Canada's foreign buyer ban, Singapore ABSD (60% for
  foreigners), BC speculation tax. Your residency status
  changes the property picture.
- **Retirement accounts don't move cleanly.** An RRSP or 401k held abroad may lose its
  tax shelter (e.g. a Canadian TFSA isn't sheltered in the US).
- **Same USD ≠ same position.** Your income percentile and the size of home you can buy
  change completely between cities. Show this beside the tax result.
- **Tax treaties and foreign tax credits** matter if income stays in the origin country
  (rental property back home, pensions). Out of scope for v1, but flag it.

**Data and product**
- **Fiscal years don't line up** across countries (§7).
- **Sources are in German, Norwegian, Danish and French.** Budget time to read
  primary sources, or rely on OECD/Eurostat harmonized data where possible.
- **Data goes stale every year.** You need an annual update routine, every number needs
  an as-of date, and the UI should show the data vintage.
- **Calculating the rate curve and all 15 cities live** means the engine has to be fast
  (pure functions, no I/O). That's easy if planned for, painful to retrofit.
- **Legal and trust**: a "not tax advice" disclaimer, a methodology page, and
  open-sourced rule files so people can check them.
- **Persona privacy**: everything stays local. Say so, since people will be entering
  their net worth.
- **Share links** let you send a persona or comparison to someone without a backend.

---

## 11. Suggested next step

D1–D4 are decided (✅). Next: the Canada research dossier (§4.1 checklist for federal, AB,
ON, BC), then Phase 1. Then start **Phase 1 (Canada)**: it exercises every part of the system (3 levels,
3 provinces, deficits at all levels, provincial sales tax differences, property and land
transfer tax) using data that's easy to get and easy to check.
