"""Build data/fiscal/us.json: US federal, state and local borrowing, interest and debt by year.

Usage:
  python3 scripts/us_census_parse.py <census-dir> <parsed.json>      # state & local, Census
  python3 scripts/build_fiscal_us.py <omb-dir> <parsed.json>

Federal (fiscal years ending September 30, labelled by that year), from the OMB Historical Tables
(FY2027 Budget edition):
  borrowing = increase in debt held by the public (Table 7.1)   -> excludes Social Security and
              other trust fund holdings, i.e. only money borrowed from outside the government
  interest  = net interest (Table 3.1)
  taxes     = total receipts incl. payroll taxes and customs duties (Table 2.1)

State and local (Census Annual Survey of State and Local Government Finances, survey years =
government fiscal years ending in that year, mostly June 30):
  borrowing = year-over-year change in debt outstanding (long- plus short-term) within the same
              file format (2006-2016, 2018+); otherwise long-term debt issued minus retired
  interest  = interest on general and utility debt;  taxes = all taxes (T-codes)
  Debt is gross (US states and cities do not publish a comparable net debt); it includes utility
  debt (e.g. water and power utilities), which is repaid from user charges.
  2001 and 2003: Census only published US-wide totals, so US-wide state/local ratios are used.
Amounts in USD millions.
"""
import json, sys, pathlib, datetime
import openpyxl

ROOT = pathlib.Path(__file__).resolve().parent.parent
OMB = pathlib.Path(sys.argv[1])
PARSED = json.loads(pathlib.Path(sys.argv[2]).read_text())
OUT = ROOT / "data" / "fiscal" / "us.json"
FIRST, LAST = 2000, 2025
NAMES = {"NY": "New York", "CA": "California", "WA": "Washington", "TX": "Texas"}


def table(name):
    ws = openpyxl.load_workbook(OMB / f"{name}.xlsx", data_only=True).worksheets[0]
    return [r for r in ws.iter_rows(values_only=True)]


def blank():
    return {"taxes": None, "interest": None, "borrowing": None, "netDebt": None, "borrowingSource": None, "status": "actual"}


series = {}

# ---------------------------------------------------------------- federal (OMB)
rec = {}
for r in table("hist07z1"):
    if r and r[0] is not None and str(r[0]).strip().isdigit():
        rec.setdefault(int(r[0]), {})["held"] = float(r[3])
for r in table("hist02z1"):
    if r and r[0] is not None and str(r[0]).strip().isdigit():
        rec.setdefault(int(r[0]), {})["receipts"] = float(r[8])
rows = table("hist03z1")
hdr = rows[1]
for r in rows:
    if r and r[0] and str(r[0]).startswith("Net interest"):
        for i, h in enumerate(hdr):
            if str(h).strip().isdigit() and isinstance(r[i], (int, float)):
                rec.setdefault(int(h), {})["interest"] = float(r[i])
        break
fed = {}
for y in range(FIRST, LAST + 1):
    d, p = rec.get(y, {}), rec.get(y - 1, {})
    if "held" not in d:
        continue
    fed[str(y)] = {**blank(), "taxes": d.get("receipts"), "interest": d.get("interest"), "netDebt": d["held"],
                   "borrowing": d["held"] - p["held"] if "held" in p else None,
                   "borrowingSource": "change in federal debt held by the public (OMB Historical Table 7.1)"}
series["US-federal"] = {"label": "US federal government", "years": fed}

# ---------------------------------------------------------------- states and local (Census)
K = 1 / 1000.0  # thousands -> millions


def borrow(lvl_data, y):
    """Borrowing for year y and a description of how it was measured."""
    r, p = lvl_data.get(str(y), {}), lvl_data.get(str(y - 1), {})
    # (Beginning-of-year balances in the 2000-2004 files are incomplete, so they are not used.)
    # year-over-year change only within the same file format: summary tables 2002, 2005-2016;
    # public-use files 2017+ (debt definition changed in 2017)
    same_format = (2006 <= y <= 2016) or (y >= 2018)  # previous year in the same file format
    if same_format and p.get("debt") is not None and r.get("debt") is not None:
        return r["debt"] - p["debt"], "change in debt outstanding (Census)"
    if r.get("ltdIssued") is not None and r.get("ltdRetired") is not None:
        st = 0.0
        if p.get("stDebt") is not None and r.get("stDebt") is not None and same_format:
            st = r["stDebt"] - p["stDebt"]
        return r["ltdIssued"] - r["ltdRetired"] + st, "long-term debt issued minus retired (Census)"
    return None, None


us = PARSED["US"]
for code, name in NAMES.items():
    for lvl, key, label in (("state", f"US-{code}", f"State of {name}"), ("local", f"US-{code}-local", f"All local governments in {name}")):
        data = PARSED[code][lvl]
        years = {}
        for y in range(FIRST, 2025):
            r = data.get(str(y))
            if r and r.get("taxes"):
                b, how = borrow(data, y)
                years[str(y)] = {**blank(), "taxes": r["taxes"] * K, "interest": (r.get("interest") or 0) * K,
                                 "borrowing": None if b is None else b * K, "netDebt": (r.get("debt") or 0) * K or None,
                                 "borrowingSource": how}
            elif us[lvl].get(str(y)):
                # No state detail published: use US-wide totals (only the ratios are used).
                u = us[lvl][str(y)]
                b, how = borrow(us[lvl], y)
                years[str(y)] = {**blank(), "taxes": u["taxes"] * K, "interest": (u.get("interest") or 0) * K,
                                 "borrowing": None if b is None else b * K, "netDebt": None,
                                 "borrowingSource": f"US-wide {lvl} government figures; Census published no state detail for this year",
                                 "status": "estimate",
                                 "notes": ["Census published only US-wide totals this year; US-wide ratios are used."]}
        # Debt stock for the US-wide years: halfway between this state's neighbouring years.
        for y, v in years.items():
            if v["netDebt"] is None and v["status"] == "estimate":
                a, b = years.get(str(int(y) - 1), {}).get("netDebt"), years.get(str(int(y) + 1), {}).get("netDebt")
                if a is not None and b is not None:
                    v["netDebt"] = (a + b) / 2
                    v["notes"].append("Debt outstanding interpolated between the years either side.")
        series[key] = {"label": label, "years": years}

out = {
    "generated": datetime.date.today().isoformat(),
    "currency": "USD", "unit": "millions",
    "notes": [
        "Federal: fiscal years ending September 30. Borrowing = increase in debt held by the public (OMB Historical Table 7.1); trust-fund holdings such as Social Security are excluded. Interest = net interest (Table 3.1). Taxes = total receipts (Table 2.1).",
        "States and local governments: Census Annual Survey of State and Local Government Finances, by government fiscal year (most end June 30). Borrowing = change in debt outstanding; where that is not available, long-term debt issued minus retired.",
        "US state and local debt is gross debt and includes utility debt repaid from user charges; US governments do not publish a comparable net debt.",
        "2001 and 2003 state and local figures use US-wide ratios: Census published no state detail for those years.",
        "City lines use all local governments in the state (cities, counties, school districts and special districts).",
    ],
    "series": series,
}
OUT.write_text(json.dumps(out, indent=1))
print(f"wrote {OUT}")
for k, s in series.items():
    print("==", k)
    for y, v in s["years"].items():
        t, b = v["taxes"], v["borrowing"]
        f = lambda x: "     -" if x is None else f"{x/1000:7.1f}"
        print(f"  {y} tax {f(t)} borrow {f(b)} int {f(v['interest'])} debt {f(v['netDebt'])} b/t {(b/t*100 if b is not None and t else float('nan')):6.1f}% {v['status'][:3]}")
