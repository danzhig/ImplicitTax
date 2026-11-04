#!/usr/bin/env bash
# Download the StatCan government finance tables used for the Canadian fiscal history.
# Usage: scripts/fetch_statcan.sh <cache-dir>
# The StatCan WDS API is occasionally flaky, so each table is retried a few times.
set -euo pipefail
OUT="${1:?cache dir required}"
mkdir -p "$OUT"
cd "$OUT"
TABLES=(
  36100477 # National accounts: government revenue, spending and net lending, Canada, quarterly 1961+
  36100450 # National accounts: government revenue, spending and net lending by province and level, 2007+
  10100016 # GFS federal government, fiscal years 2007+
  10100048 # Federal government net debt, fiscal years to 2007-08
  10100055 # Net financial debt by government and province, to 2006
  10100002 # Central government debt (public accounts net debt), monthly 2009+
  10100133 # Central government operations (public debt charges, revenues), monthly 2009+
  10100172 # GFS annual, by government sector (federal, provinces combined, local combined), calendar years 1990+
  10100017 # GFS, provincial and territorial governments, by province, fiscal years 2007+
  10100020 # GFS, municipalities and other local public administrations, by province, 2007+
  10100040 # FMS (older basis), federal and provincial revenue/expenditure, fiscal years 1989-2009
  10100042 # FMS (older basis), local general government by province, 1988-2005
  10100169 # GFS for individual municipalities (Toronto, Calgary, Vancouver), 2018-2020
  10100147 # GFS consolidated provincial-territorial and local governments, by province, 2007+
  36100432 # Household consumption: sales taxes vs. spending, by category and province, 2007-2024
  11100223 # Survey of Household Spending by income quintile, 2010-2023
)
for pid in "${TABLES[@]}"; do
  for attempt in 1 2 3 4 5; do
    url=$(curl -sS -m 60 "https://www150.statcan.gc.ca/t1/wds/rest/getFullTableDownloadCSV/$pid/en" \
      | python3 -I -c "import json,sys;print(json.load(sys.stdin)['object'])" 2>/dev/null || true)
    if [ -n "$url" ] && curl -sS -m 300 -o "$pid.zip" "$url" && unzip -o -q "$pid.zip"; then
      echo "downloaded $pid"; break
    fi
    sleep $((attempt * 3))
  done
done
