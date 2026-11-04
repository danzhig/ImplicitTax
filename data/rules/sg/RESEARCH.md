# Singapore research notes (Phase 4)

Code: `src/engine/sg/calculate.ts`. Income year 2026 (YA 2027). One level of government.
Status: **verified** = official source; **secondary** = PwC (reviewed July 2026); **estimate**.

## Decisions (user, phase 4)
1. **CPF** is mandatory savings in the member's own accounts: shown as info, not tax (D2); its income
   tax relief is counted. Assumes a citizen or PR; "buying as a foreigner" switches to a work-pass
   holder (no CPF, 60% ABSD).
2. **COE and car taxes** count as tax, the COE spread over its 10 years.
3. **Borrowing** = minus the official Overall Budget Surplus, which includes the Net Investment Returns
   Contribution (consistent with D22, Norway's oil fund).

| Item | Value | Status |
|---|---|---|
| Resident income tax | 0% to S$20k, then 2 / 3.5 / 7 / 11.5 / 15 / 18 / 19 / 19.5 / 20 / 22 / 23 / 24% | verified (IRAS, from YA 2024) |
| Personal income tax rebate | none after YA 2025 | verified (IRAS) |
| Reliefs used | CPF (employee), SRS (S$15,300 cap; 35,700 for foreigners), earned income S$1,000, child S$4,000, spouse S$2,000 | secondary |
| CPF 2026 | employee 20% / employer 17% to age 55; OW ceiling S$8,000 a month, S$102,000 a year | secondary (PwC) |
| Self-employed MediSave | 10.5% of trade income (simplified) | estimate |
| Property tax, owner-occupied | 0% first S$12k AV, 4% to 40k, 6% to 50k, 10% to 75k, 14% to 85k, 20% to 100k, 26% to 140k, 32% above | verified (IRAS, from 1 Jan 2025) |
| Property tax, rented out | 12% first S$30k, 20% to 45k, 28% to 60k, 36% above | verified (IRAS, from 2024) |
| 2026 rebate | 10% (max S$500) on owner-occupied private homes | secondary |
| Annual value | 3% of market value (private homes) | estimate |
| BSD | 1 / 2 / 3 / 4 / 5 / 6% (bands 180k / 360k / 1m / 1.5m / 3m) | verified (IRAS) |
| ABSD | foreigners 60%; citizens 0% on a first home; PRs 5% | secondary |
| GST | 9%; 7.6% of everyday spending (92% taxable) | rate verified; share estimate |
| COE | S$121,792: average Category A premium over the 21 bidding rounds of 2026 | verified (LTA, data.gov.sg) |
| ARF | 100% / 140% / 190% / 250% of OMV (bands 20k / 40k / 60k) | secondary (Budget 2023 tiers) |
| PARF rebate | 75% under 5 years, falling to 50% at 9-10 years | secondary |
| Excise / registration fee | 20% of OMV / S$350 | secondary |
| Road tax | about S$744 (1.6 litre petrol), S$1,100 (EV) | estimate |
| Petrol duty | S$0.66 per litre (RON 95) + GST | secondary |
| Home energy | GST + carbon tax (S$45/t) about 14% of the electricity bill; water conservation tax about S$130 | estimate |
| Exchange rate | 1.2786 SGD per USD (ECB, January-October 2026) | verified |

## Fiscal history
`scripts/build_fiscal_sg.py` → `data/fiscal/sg.json`, from SingStat tables M130561 (fiscal position)
and M130571 (revenue), FY2005-FY2026 (FY2025 revised and FY2026 budget estimates marked as such).
Borrowing ratio (borrowing ÷ tax revenue incl. COE premiums): FY2020 +80.9% (pandemic, paid from past
reserves); FY2024 −2.1%; FY2025 −8.5% (estimate).
Not available: net debt / net assets (reserves undisclosed) and interest on debt (government
securities are issued to invest, and their interest is paid outside the budget).

## Open items
1. ARF tiers and road tax: confirm against LTA (the OneMotoring table is rendered by script).
2. GST share from SingStat household expenditure weights.
3. One-off household support (GST vouchers, CDC vouchers, U-Save) as benefits.
