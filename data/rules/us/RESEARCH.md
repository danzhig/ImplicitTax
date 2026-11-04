# United States research notes (Phase 2)

Cities: New York City, San Francisco, Seattle, Houston. Tax year 2026. Parameters live in
`src/engine/us/params2026.ts`; this file records where they came from and how sure we are.

Status: **verified** = official source; **secondary** = several consistent non-official sources;
**unverified** = best estimate, needs checking.

## 1. Federal income tax (2026, after the 2025 tax law)

| Parameter | Value | Status |
|---|---|---|
| Brackets, single | 10/12/22/24/32/35/37% at 12,400 / 50,400 / 105,700 / 201,775 / 256,225 / 640,600 | verified (IRS Rev. Proc. 2025-32) |
| Brackets, joint | 24,800 / 100,800 / 211,400 / 403,550 / 512,450 / 768,700 | verified |
| Standard deduction | 16,100 single / 32,200 joint | verified |
| Long-term gains and qualified dividends | 0% to 49,450 / 98,900; 15% to 545,500 / 613,700; 20% above | verified |
| Child tax credit | $2,200 per child, $1,700 refundable, phase-out $50 per $1,000 above 200k / 400k | verified |
| State and local tax (SALT) deduction cap | $40,400, reduced by 30% of income above $505,000, never below $10,000 | verified |
| Senior deduction (2025-2028) | $6,000, phased out at 6% above 75k / 150k | verified |
| Net investment income tax | 3.8% above 200k / 250k (not indexed) | verified |
| 401(k) deferral limit | $24,500 | verified |

Not modelled: alternative minimum tax, earned income credit, qualified business income deduction,
taxation of Social Security benefits, tips/overtime deductions, car loan interest deduction.

## 2. Payroll (both sides)

| Item | Employee | Employer (context only) | Status |
|---|---|---|---|
| Social Security | 6.2% up to $184,500 | 6.2% | verified (SSA) |
| Medicare | 1.45%, +0.9% above 200k single / 250k joint | 1.45% | verified |
| Self-employed | 15.3% on 92.35% of profit (SS part up to the wage base left after wages); half deductible | - | verified |
| NY Paid Family Leave | 0.432%, max $411.91 | - | verified (NY DFS) |
| NY disability | 0.5%, max $31.20 | rest | verified |
| CA SDI | 1.3%, no wage cap | - | verified (EDD) |
| WA Paid Family & Medical Leave | 71.52% of 1.13%, up to the SS wage base | rest | secondary |
| WA Cares | 0.58%, no cap | - | verified |

**Tax relief from contributions (the "both sides" check):** unlike CPP/EI in Canada, US employee
payroll taxes give no income tax credit or deduction. The only relief is the deduction for half
of self-employment tax. Social Security benefits are partly taxable later; that is outside the
annual view. Payroll taxes go to the **federal** level (Social Security and Medicare are federal
trust funds) and state programs go to the **state** level.

## 3. State and city income tax

- **New York**: 2026 rates 3.9% to 10.9% after the cut to the five lowest rates (Laws of 2025, ch. 59).
  Standard deduction 8,000 / 16,050; $1,000 per dependent. High-income "tax benefit recapture" is
  approximated: above $107,650 of AGI the lower brackets are phased out over $50,000, and above each
  top threshold the whole income moves to the next rate (6.85%, 9.65%, 10.3%, 10.9%). Status: verified
  rates; recapture approximated (within a few dollars at most incomes).
- **New York City**: 3.078% to 3.876% on New York taxable income. Verified.
- **California**: the FTB had not published 2026 schedules when this was built, so the **2025
  schedules** are used (standard deduction 5,706 / 11,412; exemption credits 153 / 306 and $475 per
  dependent; 1% Mental Health Services Tax over $1M). Dependent credit amount unverified.
- **Washington**: no tax on wages. 7% capital gains tax on long-term gains above $278,000 (2025
  deduction; 2026 indexing not yet published), plus 2.9% above $1M. Secondary for the surcharge.
- **Texas**: no personal income tax.

## 4. Sales tax

The US has no StatCan-style table of sales taxes actually paid by households, so
`scripts/build_consumption_us.py` builds an effective rate from the BEA spending mix (SAPCE1, 2024)
and estimated taxable shares per category (groceries exempt in all four states; NY exempts clothing
under $110; WA and TX tax many services; CA few). Combined 2026 rates: NYC 8.875%, SF 8.625%,
Seattle 10.55%, Houston 8.25%. Resulting effective rates on spending: NYC 4.16%, SF 3.72%,
Seattle 5.75%, Houston 4.4%. Taxable shares are **estimates**.

## 5. Property and transfer taxes

| City | Rate used | Status |
|---|---|---|
| NYC | 0.88% of market value (effective rate; NYC's class 1 assessment caps make the statutory rate meaningless) | low |
| San Francisco | 1.18268% of assessed value (FY2025-26), $7,000 homeowner exemption; Prop 13 | verified |
| Seattle | about 0.92% of value (0.69% local + 0.23% state school levy) | low |
| Houston | 2025 adopted rates by unit (city, county, HISD, college, flood, port, hospital) with homestead exemptions (20%; $140k for HISD) | verified |

Transfer taxes, spread over the years you keep the home: NYC mansion tax (buyer), NYC mortgage
recording tax, NY and NYC transfer taxes (seller, embedded in price); SF transfer tax (tiers
**unverified**); Washington graduated REET plus Seattle's local REET. Houston has no transfer tax;
impact fees for new builds are **not sourced** yet.

Renters: property tax is assumed to be passed through in rent (toggle).

## 6. Fuel, vehicles, tariffs

Federal gasoline tax 18.4¢/gal. State gasoline taxes per gallon: NY 23.85¢ (plus sales tax on fuel),
CA 62.3¢ (plus 2.25% sales tax), WA 55.4¢, TX 20¢; pre-tax gas price $2.75/gal. Vehicles: state and
local sales tax on the purchase price, plus value-based annual taxes in CA (vehicle license fee 0.65%)
and Seattle (Sound Transit motor vehicle excise tax 1.1%). Flat registration fees are left out.
Tariffs: customs duties ÷ household spending ($173.2B / $17,056B), allocated by spending.

## 7. Fiscal history (borrowing)

- **Federal**: OMB Historical Tables, FY2027 budget edition. Borrowing = change in debt held by the
  public (Table 7.1), so trust-fund balances (Social Security) never offset it. Interest = net
  interest (3.1). Taxes = total receipts (2.1). Fiscal years end September 30. 2025 ratio: borrowing
  = 37.7% of receipts.
- **States and local governments**: Census Annual Survey of State and Local Government Finances.
  Borrowing = change in total debt outstanding when the two years come from the same file format
  (2006-2016, 2018+), otherwise long-term debt issued minus retired. US governments publish gross,
  not net, debt, so state savings funds are not subtracted (a difference from Canada).
- **2001 and 2003**: Census published only US-wide totals; US-wide ratios are used for borrowing and
  interest, and debt stock is interpolated between the neighbouring years. Marked as estimates.
- Local = all local governments in the state (counties, cities, school and special districts).
- State and local data end in 2024 (survey lag); the federal series runs to 2025.

Sources are fetched with `scripts/fetch_us.sh` and built with `scripts/us_census_parse.py`,
`scripts/build_fiscal_us.py` and `scripts/build_consumption_us.py`.

## 8. Open items

1. California 2026 schedules (when the FTB publishes them).
2. NYC and Seattle property tax: replace effective-rate estimates with assessment-based models.
3. SF transfer tax tiers, Houston impact fees.
4. Washington 2026 capital gains deduction.
5. Earned income credit and AMT (matter for low and high personas).
