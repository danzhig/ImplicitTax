#!/usr/bin/env bash
# Download the European source files for build_fiscal_eu.py.
# Usage: scripts/fetch_eu.sh <dir>
set -euo pipefail
D=${1:?usage: fetch_eu.sh <dir>}
mkdir -p "$D"
E=https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data
G="geo=DE&geo=LU&geo=IE&geo=NO&geo=DK&geo=CH"
# Government finance by sub-sector (ESA 2010): net lending, taxes, social contributions, interest.
curl -sS -f -m 300 -o "$D/gov_10a_main.json" \
  "$E/gov_10a_main?unit=MIO_NAC&$G&sector=S13&sector=S1311&sector=S1312&sector=S1313&sector=S1314&na_item=B9&na_item=D2REC&na_item=D5REC&na_item=D91REC&na_item=D611REC&na_item=D41PAY"
# Financial balance sheets: net financial worth by sub-sector (net debt = -BF90).
curl -sS -f -m 300 -o "$D/nasa_10_f_bs.json" \
  "$E/nasa_10_f_bs?unit=MIO_NAC&$G&na_item=BF90&co_nco=CO&finpos=LIAB&sector=S1311&sector=S1312&sector=S1313"
# Household spending weights (HICP item weights) for the effective VAT rate.
curl -sS -f -m 300 -o "$D/prc_hicp_inw.json" "$E/prc_hicp_inw?$G&time=2025"
# UK: ONS public sector finances (all series).
curl -sS -f -L -m 600 -o "$D/pusf.csv" \
  "https://www.ons.gov.uk/file?uri=/economy/governmentpublicsectorandtaxes/publicsectorfinance/datasets/publicsectorfinances/current/pusf.csv"
# Switzerland: Federal Finance Administration net debt by level.
curl -sS -f -m 120 -o "$D/ch_nettoschuld.xlsx" \
  "https://www.data.finance.admin.ch/static/assets/datasets/fs_dashboard/staat_nettoschuld-d.xlsx"
# Denmark: Statistics Denmark net lending by sub-sector (Eurostat withholds the latest years).
curl -sS -f -m 120 -X POST -H 'Content-Type: application/json' -o "$D/dk_off3.csv" https://api.statbank.dk/v1/data \
  -d '{"table":"OFF3","lang":"en","format":"BULK","variables":[{"code":"UI","values":["2.19"]},{"code":"SEKTOR","values":["S"]},{"code":"Tid","values":["*"]}]}'
echo "done: $D"
