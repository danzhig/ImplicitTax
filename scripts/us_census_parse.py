"""Parse Census state & local government finance files into per-state, per-level yearly figures.

Two formats:
  - summary tables {yy}slsstab1a/1b (2002, 2005-2016): one column block per state with
    "State & local", "State", "Local" amounts.
  - {yy}statetypepu.txt (2017+): fixed-width aggregates by state and level of government.
Output (thousands of dollars): {state: {level: {year: {taxes, interest, ltdIssued, ltdRetired, debt, stDebt}}}}
"""
import re, sys, json, pathlib
from collections import defaultdict
import pandas as pd

STATES = {"New York": "NY", "California": "CA", "Washington": "WA", "Texas": "TX", "United States Total": "US", "United States": "US"}
FIPS = {"00": "US", "36": "NY", "06": "CA", "53": "WA", "48": "TX"}
# Files up to 2004 use Census's alphabetical state codes instead of FIPS.
CENSUS_CODES = {"00": "US", "33": "NY", "05": "CA", "48": "WA", "44": "TX"}
ROWS = {  # label (normalised) -> field
    "taxes": "taxes", "interest on debt": "interest", "debt outstanding": "debt",
    "short-term": "stDebt", "long-term debt issued": "ltdIssued", "long-term debt retired": "ltdRetired",
}


def norm(s):
    return re.sub(r"[\d\s]+$", "", re.sub(r"\s+", " ", str(s))).strip().lower()


def parse_summary(path, year, out):
    df = pd.read_excel(path, header=None)
    # header row with state names, and the sub-header row naming the level
    hdr_row = next(i for i in range(25) if any(str(x).strip() == "Description" for x in df.iloc[i].tolist()))
    lvl_row = hdr_row + 1
    label_col = next(c for c in range(3) if any(norm(x) == "taxes" for x in df.iloc[:, c].tolist()))
    cols = {}
    current = None
    for c in range(df.shape[1]):
        name = str(df.iat[hdr_row, c]).strip()
        if name and name != "nan":
            current = name
        lvl = norm(df.iat[lvl_row, c])
        current_key = next((k for k in STATES if current and current.startswith(k)), None)
        if current_key and lvl in ("state", "local") and (current_key, lvl) not in cols:
            current = current_key
            cols[(current, lvl)] = c
    found = {}
    for r in range(df.shape[0]):
        lab = norm(df.iat[r, label_col])
        if lab in ROWS and ROWS[lab] not in found:
            found[ROWS[lab]] = r
    for (st, lvl), c in cols.items():
        rec = out[STATES[st]][lvl][year]
        for field, r in found.items():
            v = pd.to_numeric(df.iat[r, c], errors="coerce")
            rec[field] = None if pd.isna(v) else float(v)


# statetypepu item codes. Debt codes are a digit + digit + letter: 1x = long-term debt at the start
# of the year, 2x = issued, 3x = retired, 4x = outstanding at year end (2017+ files collapse these
# into 19U/29U/39U/49U). 61V/64V = short-term debt at start/end of year.
DEBT = re.compile(r"^([1-4])\d[A-Z]$")


def parse_statetype(path, year, out):
    codes = CENSUS_CODES if year <= 2004 else FIPS
    agg = defaultdict(lambda: defaultdict(float))
    for line in open(path, encoding="latin-1"):
        st, lvl, item = line[0:2], line[2], line[4:7]
        if st not in codes or lvl not in ("2", "3"):
            continue
        try:
            amt = float(line[8:20])
        except ValueError:
            continue
        a = agg[(codes[st], "state" if lvl == "2" else "local")]
        m = DEBT.match(item)
        if item.startswith("T"):
            a["taxes"] += amt
        elif item in ("I89", "I91", "I92", "I93", "I94"):
            a["interest"] += amt
        elif m:
            a[{"1": "ltdBegin", "2": "ltdIssued", "3": "ltdRetired", "4": "ltdEnd"}[m.group(1)]] += amt
        elif item == "61V":
            a["stBegin"] += amt
        elif item == "64V":
            a["stDebt"] += amt
    for (st, level), a in agg.items():
        rec = out[st][level][year]
        rec.update({k: a[k] for k in ("taxes", "interest", "ltdIssued", "ltdRetired", "stDebt")})
        rec["debt"] = a["ltdEnd"] + a["stDebt"]
        if a.get("ltdBegin"):
            rec["debtBegin"] = a["ltdBegin"] + a.get("stBegin", 0)


if __name__ == "__main__":
    src = pathlib.Path(sys.argv[1])
    out = defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))
    for f in sorted(src.glob("s20??a.xls*")) + sorted(src.glob("s20??b.xls*")):
        parse_summary(f, int(f.name[1:5]), out)
    for d in sorted(src.glob("st20??")):
        for f in [x for x in d.iterdir() if "statetype" in x.name.lower()]:
            parse_statetype(f, int(d.name[2:]), out)
    res = {st: {lvl: dict(sorted(ys.items())) for lvl, ys in lv.items()} for st, lv in out.items()}
    pathlib.Path(sys.argv[2]).write_text(json.dumps(res, indent=1))
    for st, lv in res.items():
        for lvl, ys in lv.items():
            print(st, lvl)
            for y, r in ys.items():
                b = (r.get("ltdIssued") or 0) - (r.get("ltdRetired") or 0)
                print(f"   {y} taxes {r.get('taxes',0)/1e6:7.1f}B int {(r.get('interest') or 0)/1e6:5.1f}B debt {(r.get('debt') or 0)/1e6:6.1f}B issued-retired {b/1e6:6.1f}B st {(r.get('stDebt') or 0)/1e6:5.1f}")
