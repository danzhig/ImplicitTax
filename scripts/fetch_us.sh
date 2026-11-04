#!/usr/bin/env bash
# Download the US source files used by us_census_parse.py, build_fiscal_us.py and build_consumption_us.py.
# Usage: scripts/fetch_us.sh <dir>     (creates <dir>/census, <dir>/omb, <dir>/bea)
set -euo pipefail
D=${1:?usage: fetch_us.sh <dir>}
mkdir -p "$D/census" "$D/omb" "$D/bea"
CEN=https://www2.census.gov/programs-surveys/gov-finances/tables

# OMB Historical Tables (FY2027 budget): receipts (2.1), net interest (3.1), debt held by the public (7.1).
for t in hist02z1 hist03z1 hist07z1; do
  curl -sS -f -m 120 -o "$D/omb/$t.xlsx" "https://www.whitehouse.gov/wp-content/uploads/2026/04/${t}_fy2027.xlsx"
done

# Census state & local finance summary tables (2002, 2005-2016): s{year}a/b.xls(x)
for y in 2002 2005 2006 2007 2008 2009 2010 2011 2012 2013 2014 2015 2016; do
  yy=${y:2:2}
  for part in a b; do
    for ext in xlsx xls; do
      if curl -sS -f -m 300 -o "$D/census/s$y$part.$ext" "$CEN/$y/summary-tables/${yy}slsstab1$part.$ext" 2>/dev/null; then break; fi
      rm -f "$D/census/s$y$part.$ext"
    done
  done
done

# Older state-by-type files (2000, 2001, 2003, 2004; 2001 and 2003 hold US totals only).
for yy in 00 01 03 04; do
  mkdir -p "$D/census/st20$yy"
  for name in ${yy}statetypepu.txt ${yy}statetypepu.zip; do
    if curl -sS -f -m 60 -o "$D/census/st20$yy/$name" "https://www2.census.gov/govs/estimate/$name" 2>/dev/null; then
      case $name in *.zip) (cd "$D/census/st20$yy" && unzip -o -q "$name" && rm "$name");; esac
      break
    fi
    rm -f "$D/census/st20$yy/$name"
  done
done

# Individual unit files (2017-2024; the parser reads the state-by-type aggregate inside).
for y in 2017 2018 2019 2020 2021 2022 2023 2024; do
  for name in "${y}_Individual_Unit_File.zip" "${y}_Individual_Unit_file.zip"; do
    if curl -sS -f -m 900 -o "$D/census/iuf$y.zip" "$CEN/$y/$name" 2>/dev/null; then break; fi
    rm -f "$D/census/iuf$y.zip"
  done
  mkdir -p "$D/census/st$y"
  (cd "$D/census/st$y" && unzip -o -q -j ../iuf$y.zip '*statetype*' '*Statetype*' 2>/dev/null || true)
done

# BEA personal consumption expenditures by state (SAPCE1).
curl -sS -f -L -m 300 -o "$D/bea/sapce.zip" "https://apps.bea.gov/regional/zip/SAPCE.zip"
(cd "$D/bea" && unzip -o -q sapce.zip)
echo "done: $D"
