"""Build data/fiscal/ca.json: how much each Canadian government borrowed on your behalf each year,
its interest bill and its net debt.

Usage: python3 scripts/build_fiscal_ca.py <cache-dir-from-fetch_statcan.sh>

Borrowing = increase in net debt (liabilities minus financial assets). That is the money actually
borrowed: operating deficits plus borrowing for infrastructure, net of financial assets bought with
it. It can only fall when a government runs a cash surplus and pays debt down.

Sources (the cleanest available for each level):
  Federal      public accounts net debt at March 31 (StatCan 10-10-0002, from 2009) and the
               historical net federal debt (10-10-0048, to FY2007-08).
  Provinces    each province's own published net debt (data/fiscal/ca_official_net_debt.csv:
               Ontario budgets and Form 18-K, Alberta annual reports, BC Financial and Economic
               Reviews). Older years: StatCan FMS net debt (10-10-0055) or deficit (10-10-0040).
  Municipal    national accounts net borrowing (StatCan 36-10-0450, transactions only, 2007+);
               older years FMS (10-10-0055 / 10-10-0042). Net debt level from GFS (10-10-0020).
  Taxes and interest (the base for splitting borrowing between taxpayers): StatCan GFS from 2008
               (fiscal year 10-10-0016; provinces 10-10-0147 minus 10-10-0020) and FMS before.
  CPP/QPP are separate pension funds and are excluded everywhere. StatCan treats public-sector
  pension plans as outside government, so pension-fund surpluses never reduce net debt here.

Year labels: federal and provincial years are fiscal years labelled by the year they START in
(2016 = April 2016 to March 2017). Municipal years are calendar years. Amounts in CAD millions.
"""
import csv, json, sys, datetime, pathlib
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = pathlib.Path(sys.argv[1])
OUT = ROOT / "data" / "fiscal" / "ca.json"
OFFICIAL = ROOT / "data" / "fiscal" / "ca_official_net_debt.csv"
PROVINCES = {"Ontario": "ON", "Alberta": "AB", "British Columbia": "BC"}
FIRST, LAST = 2000, 2025


def rows(name):
    with open(CACHE / f"{name}.csv", encoding="utf-8-sig") as fh:
        yield from csv.DictReader(fh)


def num(v, scale=1.0):
    try:
        return float(v) * scale
    except (TypeError, ValueError):
        return None


def blank():
    return {"taxes": None, "interest": None, "borrowing": None, "netDebt": None,
            "borrowingSource": None, "status": "actual", "notes": []}


series = {}


def get(key, label, L):
    return series.setdefault(key, {"label": label, "years": {}})["years"].setdefault(str(L), blank())


# ------------------------------------------------------------------ StatCan sources
# FMS: REF_DATE = fiscal year ENDING in that year -> label = REF - 1 (municipal FMS is calendar).
FMS_TAX = ["Income taxes", "Consumption taxes", "Property and related taxes", "Other taxes",
           "Health and drug insurance premiums", "Contributions to social security plans"]
fms = defaultdict(lambda: defaultdict(dict))
for r in rows("10100040"):
    fms[(r["GEO"], r["Government sectors"][:7])][int(r["REF_DATE"]) - 1][r["Revenue and expenditure"]] = num(r["VALUE"])
fms_nfd = defaultdict(dict)
for r in rows("10100055"):
    v = num(r["VALUE"])
    if v is not None:
        local = r["Government sectors"].startswith("Local")
        fms_nfd[(r["GEO"], r["Government sectors"][:7])][int(r["REF_DATE"]) - (0 if local else 1)] = v
fms_local = defaultdict(lambda: defaultdict(dict))
for r in rows("10100042"):
    fms_local[r["GEO"]][int(r["REF_DATE"])][r["Revenue and expenditure"]] = num(r["VALUE"], 0.001)

ITEMS = ["Taxes [11]", "Social contributions [12]", "Interest expense [24]"]


def gfs(table, component=None, geos=PROVINCES):
    out = defaultdict(lambda: defaultdict(dict))
    for r in rows(table):
        if r["GEO"] not in geos or (component and r["Public sector components"] != component):
            continue
        v, item = num(r["VALUE"]), r["Statement of operations and balance sheet"]
        if v is None:
            continue
        if r["Display value"].startswith("Trans") and item in ITEMS + ["Revenue [1]"]:
            out[r["GEO"]][int(r["REF_DATE"])][item] = v
        elif r["Display value"] == "Stocks" and item == "Net financial worth":
            out[r["GEO"]][int(r["REF_DATE"])]["NFW"] = v
    return out


muni = gfs("10100020")
cons = gfs("10100147", "Consolidated provincial-territorial and local governments")
# National accounts, municipal level: net lending, taxes and interest by province (2007+) ...
SNA_ITEMS = {"Equals: net lending or net borrowing": "nl", "Taxes on production and imports": "tax",
             "Taxes on incomes": "tax", "Contributions to social insurance plans": "tax", "Interest on debt": "int"}
sna_local = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
for r in rows("36100450"):
    if r["GEO"] in PROVINCES and r["Levels of government"] == "Local general governments" \
            and r["Estimates"] in SNA_ITEMS and num(r["VALUE"]) is not None:
        sna_local[r["GEO"]][int(r["REF_DATE"])][SNA_ITEMS[r["Estimates"]]] += num(r["VALUE"])
# ... and Canada-wide (quarterly, summed) for years before provincial detail exists.
sna_local_canada = defaultdict(lambda: defaultdict(float))
for r in rows("36100477"):
    if r["Levels of government"] == "Local general governments" and r["Seasonal adjustment"] == "Unadjusted" \
            and r["Estimates"] in SNA_ITEMS and num(r["VALUE"]) is not None:
        sna_local_canada[int(r["REF_DATE"][:4])][SNA_ITEMS[r["Estimates"]]] += num(r["VALUE"])

# ------------------------------------------------------------------ federal
FED = ("CA-federal", "Government of Canada")
# Audited budgetary deficit, CAD millions, for the year where the two net debt series meet.
FED_DEFICIT_AT_BREAK = {2008: 5800}  # FY2008-09: -5.8 billion, Budget 2010 Table 4.2.3 (budget.canada.ca/2010)
for r in rows("10100048"):
    if r["Government debt"] == "Net federal government financial debt" and num(r["VALUE"]) is not None:
        L = int(r["REF_DATE"]) - 1
        if L >= FIRST - 1:
            y = get(*FED, L)
            y["netDebt"], y["_stock"] = num(r["VALUE"]), "historical"
pa_net, monthly_balance, pdc, rev = {}, {}, defaultdict(float), defaultdict(float)
for r in rows("10100002"):
    if r["Central government debt"] == "B. Net debt, (C - D)" and num(r["VALUE"]) is not None:
        pa_net[r["REF_DATE"]] = num(r["VALUE"])
for r in rows("10100133"):
    v = num(r["VALUE"])
    if v is None:
        continue
    yy, mm = map(int, r["REF_DATE"].split("-"))
    L = yy if mm >= 4 else yy - 1
    item = r["Central government operations"]
    if item.startswith("A. Budgetary balance"):
        monthly_balance[r["REF_DATE"]] = v
    elif item == "Public debt charges":
        pdc[L] += v
    elif item == "B. Revenues":
        rev[L] += v
for ref, v in pa_net.items():
    yy, mm = map(int, ref.split("-"))
    if mm == 3:
        y = get(*FED, yy - 1)
        y["netDebt"], y["_stock"] = v, "public accounts"
# Monthly net debt starts September 2009: back out March 2009 by undoing Apr-Sep 2009 balances.
first = min(pa_net)
y = get(*FED, 2008)
y["netDebt"] = pa_net[first] + sum(v for k, v in monthly_balance.items() if "2009-04" <= k <= first)
y["_stock"] = "public accounts"
y["notes"].append("March 2009 net debt estimated from September 2009 and the monthly budget balances in between.")

gfs_fed = defaultdict(dict)
for r in rows("10100016"):
    if r["Display value"].startswith("Trans") and num(r["VALUE"]) is not None:
        gfs_fed[int(r["REF_DATE"])][r["Statement of operations and balance sheet"]] = num(r["VALUE"])
for L in range(FIRST, LAST + 1):
    y, p = get(*FED, L), get(*FED, L - 1)
    f = fms[("Canada", "Federal")].get(L)
    if L <= 2007 and f:
        y["taxes"] = sum(f.get(k) or 0 for k in FMS_TAX)
        y["interest"] = f.get("Debt charges")
    else:
        g = gfs_fed.get(L, {})
        if "Taxes [11]" in g:
            y["taxes"] = g["Taxes [11]"] + (g.get("Social contributions [12]") or 0)
        elif L == LAST:
            g0 = gfs_fed[L - 1]
            y["taxes"] = (g0["Taxes [11]"] + (g0.get("Social contributions [12]") or 0)) * rev[L] / rev[L - 1]
            y["status"] = "estimate"
            y["notes"].append("Tax revenue estimated from monthly revenue growth; StatCan GFS figures not yet published.")
        y["interest"] = pdc.get(L) or g.get("Interest expense [24]")
    if y["netDebt"] is not None and p["netDebt"] is not None:
        y["borrowing"] = y["netDebt"] - p["netDebt"]
        if y.get("_stock") == p.get("_stock"):
            y["borrowingSource"] = f"change in {y['_stock']} net debt"
        else:
            # The two net debt series use different definitions, so their difference is not borrowing.
            # Use the audited public accounts deficit for that year instead (net capital spending
            # federally is small, so this is close to the net debt change).
            y["borrowing"] = FED_DEFICIT_AT_BREAK.get(L)
            y["borrowingSource"] = "public accounts budgetary deficit (Budget 2010, Table 4.2.3); net debt series changes definition this year"
            y["notes"].append("Net debt series switches from StatCan's historical federal debt to public accounts net debt this year, so the audited deficit is used.")

# ------------------------------------------------------------------ provinces
official = defaultdict(lambda: defaultdict(dict))  # prov -> series -> year -> (value, source)
series_order = defaultdict(list)
with open(OFFICIAL) as fh:
    for r in csv.DictReader(fh):
        official[r["province"]][r["series"]][int(r["year"])] = (float(r["net_debt"]), r["source"])
        if r["series"] not in series_order[r["province"]]:
            series_order[r["province"]].append(r["series"])
# newest series last in file order per province (file is written oldest -> newest)

for geo, code in PROVINCES.items():
    key = (f"CA-{code}", f"Government of {geo} (incl. hospitals, schools, colleges)")
    order = series_order[code][::-1]  # newest first
    for L in range(FIRST - 1, LAST + 1):
        y = get(*key, L)
        # net debt level: newest official series that has the year, else StatCan FMS
        for s in order:
            if L in official[code][s]:
                y["netDebt"], src = official[code][s][L]
                y["_netDebtSource"] = src
                break
        else:
            if L in fms_nfd[(geo, "Provinc")]:
                y["netDebt"] = fms_nfd[(geo, "Provinc")][L]
                y["_netDebtSource"] = "StatCan FMS net debt (10-10-0055)"
        # borrowing: change within the newest official series that has both years
        for s in order:
            o = official[code][s]
            if L in o and L - 1 in o:
                y["borrowing"] = o[L][0] - o[L - 1][0]
                y["borrowingSource"] = f"change in official net debt: {o[L][1]}"
                break
        else:
            # crossing from an older edition to a newer one (restatements are usually small)
            newer = next((s for s in order if L in official[code][s]), None)
            older = next((s for s in order if s != newer and L - 1 in official[code][s]), None)
            if newer and older:
                y["borrowing"] = official[code][newer][L][0] - official[code][older][L - 1][0]
                y["borrowingSource"] = f"change in official net debt across editions: {official[code][newer][L][1]}"
            elif L in fms_nfd[(geo, "Provinc")] and L - 1 in fms_nfd[(geo, "Provinc")]:
                y["borrowing"] = fms_nfd[(geo, "Provinc")][L] - fms_nfd[(geo, "Provinc")][L - 1]
                y["borrowingSource"] = "change in StatCan FMS net debt (10-10-0055)"
            elif fms[(geo, "Provinc")].get(L, {}).get("Surplus (+) / deficit (-)") is not None:
                y["borrowing"] = -fms[(geo, "Provinc")][L]["Surplus (+) / deficit (-)"]
                y["borrowingSource"] = "StatCan FMS deficit (10-10-0040); no net debt figure for this year"
        # taxes and interest
        m, c = muni[geo].get(L, {}), cons[geo].get(L, {})
        if L >= 2008 and all(k in c and k in m for k in ITEMS):
            y["taxes"] = (c["Taxes [11]"] + c["Social contributions [12]"]) - (m["Taxes [11]"] + m["Social contributions [12]"])
            y["interest"] = c["Interest expense [24]"] - m["Interest expense [24]"]
        elif fms[(geo, "Provinc")].get(L):
            f = fms[(geo, "Provinc")][L]
            y["taxes"] = sum(f.get(k) or 0 for k in FMS_TAX)
            y["interest"] = f.get("Debt charges")
        if L == 2025 and y["netDebt"] is not None:
            prev = series[key[0]]["years"].get(str(L - 1), {})
            y["taxes"] = y["taxes"] or prev.get("taxes")
            y["interest"] = y["interest"] or prev.get("interest")
            y["status"] = "estimate"
            y["notes"].append("2025-26 net debt is the province's interim/forecast figure; taxes and interest carried forward from 2024-25.")

    # ------------------------------------------------------------------ municipalities (calendar years)
    lkey = (f"CA-{code}-local", f"All municipalities in {geo}")
    for L in range(FIRST - 1, LAST + 1):
        z = get(*lkey, L)
        m = muni[geo].get(L, {})
        if "NFW" in m:
            z["netDebt"] = -m["NFW"]
        elif L in fms_nfd[(geo, "Local g")]:
            z["netDebt"] = fms_nfd[(geo, "Local g")][L]
        if L in sna_local[geo]:
            a = sna_local[geo][L]
            z["borrowing"], z["taxes"], z["interest"] = -a["nl"], a["tax"], a["int"]
            z["borrowingSource"] = "national accounts net borrowing (StatCan 36-10-0450)"
        elif L in fms_nfd[(geo, "Local g")] and L - 1 in fms_nfd[(geo, "Local g")]:
            z["borrowing"] = fms_nfd[(geo, "Local g")][L] - fms_nfd[(geo, "Local g")][L - 1]
            z["borrowingSource"] = "change in StatCan FMS net debt (10-10-0055)"
        elif fms_local[geo].get(L, {}).get("Surplus (+) / deficit (-)") is not None:
            z["borrowing"] = -fms_local[geo][L]["Surplus (+) / deficit (-)"]
            z["borrowingSource"] = "StatCan FMS deficit (10-10-0042)"
        elif FIRST <= L < 2007 and sna_local_canada.get(L):
            # No provincial municipal figures for this year: use all Canadian municipalities.
            # Only the ratios (borrowing / taxes, interest / taxes) are used, so totals are fine.
            a = sna_local_canada[L]
            z["borrowing"], z["taxes"], z["interest"] = -a["nl"], a["tax"], a["int"]
            z["borrowingSource"] = "Canada-wide municipal net borrowing (StatCan 36-10-0477); no provincial figure for this year"
            z["status"] = "estimate"
            z["notes"].append("Provincial municipal figures are not published for this year; all Canadian municipalities are used.")
        if z["taxes"] is not None:
            pass  # national accounts figures set above
        elif fms_local[geo].get(L, {}).get("Total revenue") is not None:
            f = fms_local[geo][L]
            z["taxes"] = sum(f.get(k) or 0 for k in ["Property and related taxes, revenue", "Consumption taxes, revenue", "Other taxes, revenue"])
            z["interest"] = f.get("Debt charges, expenditures")

# ------------------------------------------------------------------ tidy and write
for s in series.values():
    keep = {}
    for k, v in sorted(s["years"].items()):
        if int(k) < FIRST or all(v[f] is None for f in ("taxes", "borrowing", "netDebt")):
            continue
        for f in [f for f in v if f.startswith("_")]:
            del v[f]
        if not v["notes"]:
            del v["notes"]
        keep[k] = v
    s["years"] = keep

out = {
    "generated": datetime.date.today().isoformat(),
    "currency": "CAD", "unit": "millions",
    "notes": [
        "Borrowing = increase in net debt (debts minus financial assets): operating deficits plus borrowing for infrastructure. Negative = debt paid down.",
        "Federal and provincial years are fiscal years labelled by the year they start (2016 = April 2016 to March 2017). Municipal years are calendar years.",
        "Federal: public accounts net debt (StatCan 10-10-0002) from 2009; historical net federal debt (10-10-0048) before; FY2008-09, where the two meet, uses the audited deficit (Budget 2010).",
        "Provinces: each province's own published net debt (Ontario budgets and Form 18-K, Alberta annual reports, BC Financial and Economic Reviews); see data/fiscal/ca_official_net_debt.csv. Ontario before 2006 uses StatCan FMS net debt.",
        "Municipalities: national accounts net borrowing, taxes and interest (transactions only, StatCan 36-10-0450) from 2007; StatCan FMS before; 2006 uses Canada-wide municipal figures (36-10-0477). City lines use all municipalities in the province.",
        "Taxes and interest come from StatCan government finance statistics. CPP/QPP are excluded everywhere.",
    ],
    "series": series,
}
OUT.write_text(json.dumps(out, indent=1))
print(f"wrote {OUT}")
for k, s in series.items():
    print(f"\n== {k}")
    for yk, v in s["years"].items():
        fmt = lambda x: "      -" if x is None else f"{x/1000:7.1f}"
        t, b = v["taxes"], v["borrowing"]
        ratio = f"{b / t * 100:6.1f}%" if b is not None and t else "     -"
        print(f"  {yk} tax {fmt(t)} borrow {fmt(b)} int {fmt(v['interest'])} netDebt {fmt(v['netDebt'])} b/t {ratio} {v['status'][:3]} | {(v['borrowingSource'] or '')[:70]}")
