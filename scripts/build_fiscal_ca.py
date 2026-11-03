"""Build data/fiscal/ca.json from StatCan government finance tables.

Usage: python3 scripts/build_fiscal_ca.py <cache-dir-from-fetch_statcan.sh>

All money is in CAD millions. For each government and year we keep:
  revenue     total revenue (incl. transfers from other governments)
  taxes       taxes + social contributions (the "tax base" used to allocate deficits)
  interest    interest expense (debt charges)
  balance     accrual operating balance: revenue - expense (expense includes depreciation of
              infrastructure, so long-lived capital is spread over its useful life).
              Negative = deficit. This is the GFS "net operating balance".
  netFinancialWorth  stock at year end: financial assets - liabilities (negative = net debt)
Why not GFS "net lending/borrowing"? In StatCan's provincial tables the non-financial asset
flows include revaluations (e.g. Alberta's oil reserves), which makes net lending swing by
tens of billions. The operating balance is clean and consistent across all levels.
Sources and bases:
  GFS = Canadian Government Finance Statistics (current standard, accrual)
  FMS = Financial Management System (older StatCan basis, used to extend history before 2007)
"""
import csv, json, sys, datetime, pathlib
from collections import defaultdict

CACHE = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "fiscal" / "ca.json"
PROVINCES = {"Ontario": "ON", "Alberta": "AB", "British Columbia": "BC"}
FIRST_YEAR = 2000


def rows(name):
    with open(CACHE / f"{name}.csv", encoding="utf-8-sig") as fh:
        yield from csv.DictReader(fh)


def num(v, scale=1.0):
    try:
        return float(v) * scale
    except (TypeError, ValueError):
        return None


series = {}


def put(key, label, year, rec):
    s = series.setdefault(key, {"label": label, "years": {}})
    s["years"][str(year)] = rec


# ---------- Federal: GFS annual (calendar years), table 10-10-0172 ----------
fed = defaultdict(dict)
for r in rows("10100172"):
    if r["Government sectors"] != "Federal government":
        continue
    fed[int(r["REF_DATE"])][r["Statement of government operations and balance sheet"]] = num(r["VALUE"])
for y, v in sorted(fed.items()):
    if y < FIRST_YEAR or v.get("Revenue") is None:
        continue
    put("CA-federal", "Government of Canada", y, {
        "revenue": v["Revenue"],
        "taxes": (v.get("Taxes") or 0) + (v.get("Social contributions") or 0),
        "interest": v["Interest"],
        "balance": v["Net operating balance"],
        "netFinancialWorth": v.get("Net financial worth"),
        "basis": "GFS", "status": "actual", "table": "10-10-0172",
    })


# ---------- Provinces and municipalities: GFS 2008+ (fiscal year closest to Dec 31) ----------
# Provincial level = consolidated provincial + local public sector (table 10-10-0147)
# minus municipalities (10-10-0020). This keeps hospitals, school boards, colleges and
# universities with the province (as provincial public accounts do) and leaves cities separate.
# Balances and taxes are not affected by consolidation, so the subtraction is exact for them;
# revenue and interest are approximate (inter-government transfers/interest are netted out).
ITEMS = ["Revenue [1]", "Taxes [11]", "Social contributions [12]", "Interest expense [24]", "Net operating balance"]


def gfs_by_province(table, component=None):
    out = defaultdict(lambda: defaultdict(dict))
    for r in rows(table):
        if r["GEO"] not in PROVINCES:
            continue
        if component and r["Public sector components"] != component:
            continue
        item = r["Statement of operations and balance sheet"]
        val = num(r["VALUE"])
        if val is None:
            continue
        if r["Display value"].startswith("Trans") and item in ITEMS:
            out[r["GEO"]][int(r["REF_DATE"])][item] = val
        elif r["Display value"] == "Stocks" and item == "Net financial worth":
            out[r["GEO"]][int(r["REF_DATE"])]["NFW"] = val
    return out


def complete(v):
    return all(k in v for k in ITEMS)


muni = gfs_by_province("10100020")
cons = gfs_by_province("10100147", "Consolidated provincial-territorial and local governments")
for geo in PROVINCES:
    for y, m in muni[geo].items():
        if not complete(m):
            continue
        put(f"CA-{PROVINCES[geo]}-local", f"All municipalities in {geo}", y, {
            "revenue": m["Revenue [1]"],
            "taxes": m["Taxes [11]"] + m["Social contributions [12]"],
            "interest": m["Interest expense [24]"],
            "balance": m["Net operating balance"],
            "netFinancialWorth": m.get("NFW"),
            "basis": "GFS", "status": "actual", "table": "10-10-0020",
        })
        c = cons[geo].get(y)
        if not c or not complete(c):
            continue
        put(f"CA-{PROVINCES[geo]}", f"Government of {geo} (incl. hospitals, schools, colleges)", y, {
            "revenue": c["Revenue [1]"] - m["Revenue [1]"],
            "taxes": (c["Taxes [11]"] + c["Social contributions [12]"]) - (m["Taxes [11]"] + m["Social contributions [12]"]),
            "interest": c["Interest expense [24]"] - m["Interest expense [24]"],
            "balance": c["Net operating balance"] - m["Net operating balance"],
            "netFinancialWorth": (c["NFW"] - m["NFW"]) if "NFW" in c and "NFW" in m else None,
            "basis": "GFS", "status": "actual", "table": "10-10-0147 minus 10-10-0020",
        })


# ---------- Before 2007: FMS basis ----------
fms = defaultdict(lambda: defaultdict(dict))
for r in rows("10100040"):
    if r["GEO"] in PROVINCES and r["Government sectors"].startswith("Provincial"):
        fms[r["GEO"]][int(r["REF_DATE"])][r["Revenue and expenditure"]] = num(r["VALUE"])
FMS_TAX = ["Income taxes", "Consumption taxes", "Property and related taxes", "Other taxes",
           "Health and drug insurance premiums", "Contributions to social security plans"]
for geo, years in fms.items():
    for y, v in years.items():
        if y < FIRST_YEAR or y >= 2008 or v.get("Total revenue") is None:
            continue
        put(f"CA-{PROVINCES[geo]}", f"Government of {geo}", y, {
            "revenue": v["Total revenue"],
            "taxes": sum(v.get(k) or 0 for k in FMS_TAX),
            "interest": v.get("Debt charges"),
            "balance": v.get("Surplus (+) / deficit (-)"),
            "basis": "FMS", "status": "actual", "table": "10-10-0040",
        })

fmsl = defaultdict(lambda: defaultdict(dict))
for r in rows("10100042"):
    if r["GEO"] in PROVINCES:
        fmsl[r["GEO"]][int(r["REF_DATE"])][r["Revenue and expenditure"]] = num(r["VALUE"], 0.001)  # thousands -> millions
LOCAL_TAX = ["Property and related taxes, revenue", "Consumption taxes, revenue", "Other taxes, revenue"]
for geo, years in fmsl.items():
    for y, v in years.items():
        if y < FIRST_YEAR or y >= 2008 or v.get("Total revenue") is None:
            continue
        put(f"CA-{PROVINCES[geo]}-local", f"All municipalities in {geo}", y, {
            "revenue": v["Total revenue"],
            "taxes": sum(v.get(k) or 0 for k in LOCAL_TAX),
            "interest": v.get("Debt charges, expenditures"),
            "balance": v.get("Surplus (+) / deficit (-)"),
            "basis": "FMS", "status": "actual", "table": "10-10-0042",
        })

# ---------- Individual cities, 2018-2020 (cross-check only) ----------
CITY_GEO = {"Toronto (C), Ontario": "toronto", "Calgary (CY), Alberta": "calgary", "Vancouver (CY), British Columbia": "vancouver"}
city = defaultdict(lambda: defaultdict(dict))
for r in rows("10100169"):
    if r["GEO"] in CITY_GEO:
        city[CITY_GEO[r["GEO"]]][int(r["REF_DATE"])][r["Statement of operations and balance sheet"]] = num(r["VALUE"], 0.001)
city_check = {}
for cid, years in city.items():
    for y, v in years.items():
        city_check.setdefault(cid, {})[str(y)] = {
            "revenue": v.get("Revenue [1]"),
            "taxes": (v.get("Taxes [11]") or 0) + (v.get("Social contributions [12]") or 0),
            "interest": v.get("Interest expense [24]"),
            "netOperatingBalance": v.get("Net operating balance"),
        }

for s in series.values():
    s["years"] = dict(sorted(s["years"].items()))

out = {
    "generated": datetime.date.today().isoformat(),
    "currency": "CAD", "unit": "millions",
    "notes": [
        "Federal: calendar years (GFS annual, table 10-10-0172). CPP/QPP are a separate sector and excluded.",
        "Provinces and municipalities: GFS 2008+ uses the fiscal year closest to Dec 31 (e.g. 2024 = FY2024-25).",
        "Provincial level = consolidated provincial + local public sector minus municipalities, so hospitals, school boards and colleges count with the province.",
        "Before 2008 the older FMS basis is used (tables 10-10-0040 and 10-10-0042); there is a series break at 2008. FMS provincial figures cover core government only.",
        "Local government 2006-2007 is missing (FMS ends 2005, GFS operating balances start 2008).",
        "balance = accrual operating balance (GFS net operating balance); negative = deficit.",
        "City lines use all municipalities in the province as a proxy; city-specific data (2018-2020) is kept in cityCheck.",
    ],
    "series": series,
    "cityCheck": city_check,
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(out, indent=1))
print(f"wrote {OUT}")
for k, s in series.items():
    ys = list(s["years"])
    print(k, ys[0], "->", ys[-1], len(ys), "years")
