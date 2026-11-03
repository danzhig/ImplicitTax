# Canada research dossier (2026 tax year)

Covers: federal, Alberta (Calgary), Ontario (Toronto), British Columbia (Vancouver).
Status key: **verified** = official source or several consistent sources ·
**derived** = computed from a verified value · **unverified** = needs an official check.

Researched November 2026. canada.ca and the StatCan website were not reachable from the build
environment, but the StatCan data API (WDS) was, so all fiscal and spending data comes straight from
StatCan tables. Tax parameters come from web search results (CRA, provincial budgets, tax firms) and
the City of Toronto / City of Calgary websites.

## §4.1 checklist: contributions ↔ income tax

| Item | Finding | Status |
|---|---|---|
| Mandatory contributions | CPP (5.95% employee on earnings $3,500–$74,600), CPP2 (4% on $74,600–$85,000), EI (1.63% up to $68,900). Max: CPP $4,230.45, CPP2 $416, EI $1,123.07 | verified |
| Employer side | CPP/CPP2 matched 1:1; EI 1.4× employee. Ontario and BC employer health tax 1.95% on large payrolls | verified (EHT rate), info only |
| Self-employed | Pay both halves: CPP 11.9%, CPP2 8%. No EI unless opted in | verified |
| CPP → tax | Base CPP (4.95% of 5.95%) → non-refundable credit at the lowest rate, federal and provincial. Enhanced CPP (1%) and all CPP2 → deduction from income. Self-employed: employer half deductible | verified |
| EI → tax | Non-refundable credit at the lowest rate, federal and provincial | verified |
| Credit rate vs. lowest bracket | Federal 14% (= lowest rate for 2026). Alberta 8% (new bracket from 2025; credits follow it, with a supplemental credit for very large credit claims, not modelled). Ontario 5.05%. BC 5.6% (raised from 5.06% in Budget 2026) | verified |
| Employment-linked credits | Canada employment amount $1,501 | unverified (2025 $1,471 × 1.02) |
| Add-ons on tax/income | Ontario surtax 20% of ON tax over $5,818 + 36% over $7,446. Ontario Health Premium up to $900 (schedule not indexed) | verified |
| Ceilings → marginal rate drops | Above $68,900 (EI) and $85,000 (CPP2) contributions stop; visible on the "By income" marginal chart | modelled |
| Employer-paid taxable benefits | Not modelled (no persona input) | gap |
| Retirement deductions | RRSP: 18% of earned income, limit $33,810 | limit unverified |
| Taxable benefits later | CPP pension and EI benefits are taxable when received: info only, not in the annual number | n/a |
| Golden test | tests/ca.test.ts: CPP/EI maximums, self-employed both halves and deduction, contribution relief, combined marginal rates (AB 48%, ON 53.53%, BC 53.5% at the top; mid-bracket rates incl. Ontario surtax) | done |

## Income tax parameters

| Parameter | Value | Status / source |
|---|---|---|
| Federal brackets | 14% to $58,523; 20.5% to $117,045; 26% to $181,440; 29% to $258,482; 33% above | verified (2% indexation) |
| Federal BPA | $16,452, reduced to $14,829 between $181,440 and $258,482 | verified |
| Dividends | Eligible: 38% gross-up, federal credit 15.0198% of grossed-up. Provincial: ON 10%, AB 8.12%, BC 12% | federal verified; provincial unverified |
| Capital gains | 50% inclusion (the 2/3 increase was cancelled in 2025) | verified |
| Alberta | 8% to $61,200; 10% to $154,259; 12% to $185,111; 13% to $246,813; 14% to $370,220; 15% above. BPA $22,769 (spouse amount = BPA) | verified |
| Ontario | 5.05% to $53,891; 9.15% to $107,785; 11.16% to $150,000; 12.16% to $220,000; 13.16% above. BPA $12,989. Spouse amount $11,029 | brackets/BPA verified; spouse unverified |
| Ontario tax reduction | $300 basic + $553 per child (2025 indexed by 1.9%) | derived, unverified |
| BC | 5.6% to $50,363; 7.7% to $100,728; 10.5% to $115,648; 12.29% to $140,430; 14.7% to $190,405; 16.8% to $265,545; 20.5% above. BPA $13,216 | first two thresholds verified; the rest derived (2025 × 1.022) |
| BC tax reduction | Max $690 (Budget 2026), reduced 3.56% of net income over $25,570 | max verified; threshold derived |
| Canada Child Benefit (Jul 2026–Jun 2027) | $8,157 under 6; $6,883 aged 6–17; thresholds $38,237 / $82,847; reduction 7%/3.2% (1 child), 13.5%/5.7% (2), 19%/8% (3), 23%/9.5% (4+) | amounts/thresholds verified; 3+ child rates from prior years |
| Not modelled | AMT, OAS clawback, age amount, pension credit, Alberta supplemental credit, provincial child benefits, GST/HST credit, Canada Workers Benefit | gaps |

## Consumption taxes

| Item | Value | Source |
|---|---|---|
| Effective sales tax rates by spending category and province | Ontario ~8% on non-grocery spending (2.9% GST + 5.0% provincial), Alberta 3.1%, BC 5.7% (2.9% + 2.8%); groceries ~0.5–1.3% | StatCan 36-10-0432 (2024); built by scripts/build_consumption_ca.py |
| Grocery share of spending by income | 24% (lowest fifth) → 17% (highest fifth) | StatCan 11-10-0223 (SHS 2023) |
| Fuel excise | Federal 10¢/L (temporarily suspended for part of 2026; regular rate used). Alberta 13¢ (relief program paused it from Oct 1, 2026). Ontario 9¢. BC in Metro Vancouver: 8.5¢ provincial + 18.5¢ TransLink. Consumer carbon tax ended April 1, 2025 | web search (NRCan, provincial sites), regular rates used |
| Vehicles | GST 5%; Ontario HST 8% portion; BC PST 7–20% by price; federal luxury tax over $100k | statutory |
| Tariffs | Federal customs revenue ÷ household consumption excl. rent: 0.81% in 2025 (counter-tariffs), 0.45% in 2024 | StatCan GFS 10-10-0172 + 36-10-0432 |

## Property

| City | 2026 residential rates | Status |
|---|---|---|
| Calgary | Municipal 0.38906% (Bylaw 9M2026). Provincial ~0.2817% (derived: the City says ~42% of a residential bill goes to the province) | municipal verified; provincial derived |
| Toronto | City 0.605295% + City Building Fund 0.009016% + education 0.153% = 0.767311%. Assessed at 85% of market (estimate: MPAC still uses Jan 1, 2016 values) | rates verified (toronto.ca); assessment ratio unverified |
| Vancouver | Per $1,000: general 1.93406, school 0.98001, TransLink 0.35893, Metro Vancouver 0.05260, BC Assessment 0.03814, MFA 0.0002 = 3.36394. Home owner grant $570, phased out above $2.15M | third-party table, partly matched to council documents; grant threshold unverified for 2026 |
| Land transfer | Ontario 0.5/1/1.5/2/2.5%, first-time refund ≤ $4,000. Toronto MLTT same to $2M, 2.5% to $3M, then 4.4/5.45/6.5/7.55/8.6% (from April 1, 2026), first-time refund ≤ $4,475. BC 1/2/3% + 2% over $3M; first-time exemption to $835k (phased out by $860k); new-build exemption to $1.1M. Alberta: title fees only | Toronto verified (toronto.ca); others from secondary sources |
| Foreign buyers | Federal ban on most non-Canadian buyers until Jan 1, 2027. Ontario NRST 25%, Toronto MNRST 10%, BC additional PTT 20% | verified (Toronto); others secondary |
| Development charges | Calgary off-site levy $9,328 per single detached (2026 rate card). Toronto and Vancouver: not yet sourced | partial |

## Fiscal data (borrowing)

All from StatCan via the WDS API (scripts/fetch_statcan.sh → scripts/build_fiscal_ca.py → data/fiscal/ca.json).

| Level | Series | Years | Notes |
|---|---|---|---|
| Federal | GFS annual, table 10-10-0172 | 2000–2025 (calendar) | CPP/QPP separate sector, excluded |
| Provincial | Consolidated provincial + local (10-10-0147) minus municipalities (10-10-0020) | 2008–2024 GFS; 2000–2007 FMS (10-10-0040, core government only) | includes hospitals, school boards, colleges |
| City | All municipalities in the province (10-10-0020; FMS 10-10-0042 before 2006) | 2000–2005, 2008–2024 | proxy; 2006–2007 missing. City-specific GFS for 2018–2020 (10-10-0169) kept as a cross-check |

**Deficit measure decision:** GFS *net operating balance* (accrual; expenses include depreciation).
GFS *net lending/borrowing* could not be used for provinces because StatCan's non-financial asset
flows include revaluations (Alberta's swings by up to $250B a year). The operating balance differs
from provincial public-accounts deficits. For 2024-25, Ontario reported −$1.1B and this measure shows
about −$16B, mostly because of how government business enterprise income and pensions are treated.

**Latest public-accounts figures (for reference only, not used):** federal 2024-25 deficit $36.3B
(revenue $511.0B, debt charges $53.4B); Ontario 2024-25 −$1.1B (taxation $151.5B, interest $15.1B);
Alberta 2024-25 +$8.3B (revenue $82.5B, taxes $30.4B, debt servicing $3.2B); BC 2024-25 −$7.3B,
2025-26 −$7.7B. City reports: Toronto net debt +$403M in 2024; Calgary net financial assets +$374M.

## Exchange rate

Bank of Canada FXUSDCAD, 2026 average to Nov 2: 1.388 CAD per USD.

## To do

- Confirm the unverified parameters above against CRA / provincial tables when canada.ca is reachable.
- Source Toronto and Vancouver development charges.
- Replace the city proxy with city financial statements (Toronto FIR, Calgary and Vancouver annual reports) where a consistent series can be built.
- Add 2025 provincial and municipal years when StatCan publishes them.
