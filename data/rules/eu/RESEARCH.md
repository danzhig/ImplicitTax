# Europe research notes (Phase 3)

Cities: Munich, Zurich, London, Luxembourg City, Dublin, Oslo, Copenhagen. Tax year 2026 (UK: 2026-27).
Code: `src/engine/eu/` (one module per country, plus `params2026.ts` and `property.ts`).
Status: **verified** = official source; **secondary** = PwC Worldwide Tax Summaries (reviewed mid-2026);
**estimate** = best estimate, needs checking.

## Exchange rates
ECB reference rates, average of January-October 2026, converted to local currency per USD:
EUR 0.864, CHF 0.7984, GBP 0.7443, NOK 9.5396, DKK 6.4567 (CAD comes out at 1.388, matching Canada).

## Borrowing (fiscal history)
`scripts/fetch_eu.sh` + `scripts/build_fiscal_eu.py` → `data/fiscal/eu.json`.
- Borrowing = ESA 2010 net borrowing (B.9, sign flipped) for central (S.1311), state (S.1312: Länder,
  cantons) and local government (S.1313), Eurostat `gov_10a_main`, 2000-2025. It is transaction-based,
  so revaluations of assets never count.
- Social security funds (S.1314) are excluded, like the CPP: Luxembourg's and Switzerland's run large
  surpluses from pension reserves. Contributions to them are therefore not allocated any borrowing.
- Taxes = D.2 + D.5 + D.91 + D.611 received by that level. Interest = D.41 payable.
- Net debt = minus net financial worth (BF.90, `nasa_10_f_bs`); Switzerland: Federal Finance
  Administration net debt by level; UK: ONS general government net debt split into central and local.
- UK: ONS public sector finances (central NMFJ, local NMOE; taxes MF73 + NICs AIIH; council tax MSF3),
  fiscal years April-March built from quarters.
- Denmark: Eurostat withholds the central government balance for 2024-25; Statistics Denmark table
  OFF3 gives it (net lending DKK 112bn in 2024, 90bn in 2025).
- Norway's central government includes the oil fund, so it shows large net lending (about -38% of its
  taxes in 2025): Oslo's "borrowed on your behalf" is negative. **Decision to confirm with the user.**
- Ireland 2010 includes about EUR 30bn of bank recapitalisations.
- Proxies: Bavaria = all Länder, Zurich canton = all cantons, every city = all local governments.

## Spending taxes
`scripts/build_consumption_eu.py`: Eurostat HICP 2025 item weights × 2026 VAT rates by category
(rent, home energy, vehicles, fuel and tobacco excluded and modelled separately or left out). VAT share
of everyday spending: DE 9.9%, CH 3.9%, UK 12.0% (Irish weights), LU 7.5%, IE 10.8%, NO 14.9%, DK 17.0%.
Germany: restaurant food 7% from 2026. Ireland: food services 13.5% → 9% from July 2026.
Fuel, home energy and vehicle taxes: `params2026.ts`, mostly **estimates** (see notes there).
EU customs duties go to the EU budget, so no tariff line except the UK (0.35% of spending, estimate).

## Germany (Munich)
| Item | 2026 value | Status |
|---|---|---|
| §32a tariff | basic allowance 12,348; zones to 17,799 / 69,878 / 277,825; 42% / 45% | verified (BMF Tarifhistorie) |
| Solidarity surcharge | 5.5%, exemption limit EUR 20,350 of tax (40,700 joint), 11.9% phase-in | secondary |
| Pension / unemployment | 9.3% / 1.3% employee, ceiling 101,400 | secondary (PwC) |
| Health / care | 7.3% + 1.45% (half of avg 2.9% extra) / 1.8% (+0.6% childless), ceiling 69,750 | secondary |
| Flat tax on capital income | 25% + soli, saver allowance 1,000 (2,000 joint) | verified |
| Kindergeld / child allowance | EUR 259 a month / 9,756 per child; better of the two | secondary |
| Church tax | 8% (Bavaria), optional | verified |
| Revenue shares | income tax 42.5/42.5/15; flat tax 44/44/12; VAT about 52/45/3 | verified (Art. 106 GG); VAT split estimate |
| Grundsteuer | Bavarian area model × Munich 824% multiplier; areas by home type are assumptions | estimate |
| Grunderwerbsteuer | 3.5% | verified |
Both sides: pension, health and care contributions are deducted from taxable income (relief shown).

## Switzerland (Zurich)
Federal tax and Zurich simple tax sampled from the ESTV calculator (`scripts/fetch_ch_tariffs.py`,
`data/rules/ch/zh2026.json`); canton 95%, city 119%, church 10% (optional); personal tax CHF 24.
Check against the ESTV detailed calculation for CHF 100,000 single: our federal taxable income 84,787
vs ESTV 85,173 (we include a commute deduction; ESTV includes accident insurance).
AHV/IV/EO 5.3% (no ceiling), ALV 1.1% to 148,200; pillar 2 (age-based credit, half employee) and
mandatory health premiums are info only (decision D2). Imputed rent ≈ 2.1% of value less 20% upkeep
(**estimate**); homes at 70% of value for wealth tax (**estimate**). No property or transfer tax in Zurich.
Deduction amounts for insurance premiums and children: **secondary/estimate**.

## United Kingdom (London)
Personal allowance 12,570 (frozen to 2031), 20/40/45%, dividends 10.75/35.75/39.35% from April 2026,
savings allowance 1,000/500, CGT 18/24% above 3,000, NI 8%/2% (Class 4 6%/2%), employer 15% above 5,000.
Child benefit GBP 27.05 / 17.90 a week, high income charge 60k-80k (gov.uk). SDLT bands and first-time
buyer relief (gov.uk). Council tax: London average Band D GBP 2,068 for 2026-27 (MHCLG); the band is
estimated from today's value ÷ 7.3 (**estimate**); tenants pay it directly.

## Ireland (Dublin)
Standard rate band 44,000 (53,000 married + up to 35,000), credits 2,000 personal + 2,000 employee,
USC 0.5/2/3/8% (bands 12,012 / 28,700 / 70,044), PRSI 4.2% → 4.35% from October 2026, DIRT and CGT 33%,
child benefit EUR 140 a month. LPT 2026-2030 bands (Revenue), Dublin City 0% local adjustment.
Stamp duty 1/2/6%.

## Luxembourg
2025-indexed scale (0-42%), unchanged for 2026; employment fund surcharge 7% (9% above 150,000 /
300,000); employee tax credit up to EUR 696; pension 8.5% (up from 8%), health 3.05%, ceiling EUR
13,856.63 a month; dependency 1.4% above EUR 8,314, no ceiling; 20% final tax on interest; half of
dividends exempt. Registration duties 7% less the Bëllegen Akt credit (EUR 40,000 per buyer), plus
Luxembourg City's 3% surcharge. Family allowance about EUR 300 a month (**estimate**); property tax
(**estimate**).

## Norway (Oslo)
22% on general income (Oslo share about 13.55 points, **estimate**), personal allowance 114,550,
minimum deduction 46% (max 95,700), bracket tax 1.7/4.0/13.7/16.8/17.8%, national insurance 7.6%
(self-employed 11%), share income ×1.72. Wealth tax 1.0% above NOK 1.9m (0.35% municipal, 0.65% state),
1.1% above 21.5m; primary home at 25% up to NOK 14m. Child benefit NOK 1,968 a month. Oslo property tax
and document duty: **estimate**.

## Denmark (Copenhagen)
AM-bidrag 8%; municipal 23.39% and church 0.80% (Statistics Denmark PSKAT, 2026); bottom 12.01%,
middle 7.5% above DKK 641,200, top 7.5% above 777,900, top-top 5% above 2,592,700 (after AM-bidrag);
personal allowance 54,100; employment allowance 12.75% (max 63,300); share income 27/42% (threshold
79,400). Property value tax 0.51% / 1.4% on 80% of value; land tax 5.1‰ on 80% of land value (land share
by home type: **estimate**). ATP is a funded pension, shown as info. Registration tax on cars: simplified.

## Open items
1. Bavaria- and Zurich-specific fiscal series instead of all Länder / all cantons.
2. Norway: confirm the 2026 split of the 22% rate and Oslo's property tax.
3. Car registration taxes (NO, DK, IE) and energy tax shares: replace estimates with sourced figures.
4. Luxembourg tax class 1a; UK council tax by borough.
