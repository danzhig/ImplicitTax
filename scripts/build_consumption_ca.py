"""Build data/consumption/ca.json: effective sales tax rates and spending patterns.

Usage: python3 scripts/build_consumption_ca.py <cache-dir-from-fetch_statcan.sh>

- Effective GST/HST and PST rates by spending category and province come from table
  36-10-0432 (sales taxes actually paid on household consumption, 2024).
- How the grocery share of spending falls with income comes from the Survey of
  Household Spending by income quintile (11-10-0223, 2023, Canada).
- Home energy + water spending by province comes from the same survey.
- The tariff rate = federal customs revenue (GFS 10-10-0172) / household consumption.
"""
import csv, json, sys, pathlib, datetime
from collections import defaultdict

CACHE = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "consumption" / "ca.json"
PROV = {"Ontario": "ON", "Alberta": "AB", "British Columbia": "BC", "Canada": "CA"}
YEAR = "2024"


def rows(name):
    with open(CACHE / f"{name}.csv", encoding="utf-8-sig") as fh:
        yield from csv.DictReader(fh)


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


# ---- 36-10-0432: sales tax by category ----
st = defaultdict(lambda: defaultdict(dict))
for r in rows("36100432"):
    if r["REF_DATE"] == YEAR and r["GEO"] in PROV and num(r["VALUE"]) is not None:
        st[r["GEO"]][r["Estimates"]][r["Sales taxes"]] = num(r["VALUE"])

EX, G, P = "Excluding sales taxes", "Goods and Services Tax (GST)", "Provincial Sales Tax (PST)"
TOP = ["Food and non-alcoholic beverages", "Alcoholic beverages, tobacco and cannabis", "Clothing and footwear",
       "Housing, water, electricity, gas and other fuels", "Furnishings, household equipment and other goods and services related to the dwelling and property",
       "Health", "Transport", "Communications", "Recreation and culture", "Education",
       "Food, beverage and accommodation services", "Insurance and financial services", "Miscellaneous goods and services",
       "Expenditure by Canadians abroad"]
# Removed from the general basket because they are modelled separately (or are not cash spending)
REMOVE = ["Food", "Paid rental fees for housing", "Imputed rental fees for housing", "Water supply and sanitation services",
          "Electricity", "Gas", "Other fuels", "Fuels and lubricants", "New passenger cars",
          "New trucks, vans and sport utility vehicles", "Implicit loan charges", "Implicit deposit charges"]


def agg(geo, cats):
    ex = sum(st[geo][c].get(EX, 0) for c in cats)
    g = sum(st[geo][c].get(G, 0) for c in cats)
    p = sum(st[geo][c].get(P, 0) for c in cats)
    return ex, g, p


def rate(geo, cats):
    ex, g, p = agg(geo, cats)
    return {"gst": round(g / ex, 5), "pst": round(p / ex, 5), "spendingMillions": round(ex)}


sales = {}
for geo, code in PROV.items():
    ex_t, g_t, p_t = agg(geo, TOP)
    ex_r, g_r, p_r = agg(geo, REMOVE)
    other_ex, other_g, other_p = ex_t - ex_r, g_t - g_r, p_t - p_r
    sales[code] = {
        "groceries": rate(geo, ["Food"]),
        "other": {"gst": round(other_g / other_ex, 5), "pst": round(other_p / other_ex, 5), "spendingMillions": round(other_ex)},
        "electricity": rate(geo, ["Electricity"]),
        "naturalGas": rate(geo, ["Gas"]),
        "motorFuel": rate(geo, ["Fuels and lubricants"]),
    }

# ---- 11-10-0223: grocery share of non-housing basket by quintile (Canada, 2023) ----
shs = defaultdict(dict)
for r in rows("11100223"):
    if r["REF_DATE"] == "2023" and r["GEO"] in PROV:
        shs[(r["GEO"], r["Before-tax household income quintile"])][r["Household expenditures, summary-level categories"]] = num(r["VALUE"])
curve = []
for q in ["Lowest quintile", "Second quintile", "Third quintile", "Fourth quintile", "Highest quintile"]:
    v = shs[("Canada", q)]
    basket = v["Total current consumption"] - v["Shelter"] - v["Gas and other fuels (all vehicles and tools)"] - (v.get("Purchase of automobiles, vans and trucks") or 0)
    curve.append({"quintile": q, "basketSpend": round(basket), "groceryShare": round(v["Food purchased from stores"] / basket, 4)})
curve.sort(key=lambda c: c["basketSpend"])
energy = {code: shs[(geo, "All quintiles")].get("Water, fuel and electricity for principal accommodation") for geo, code in PROV.items()}

# ---- Tariffs: federal customs revenue / household consumption (excluding rent and imputed financial charges) ----
customs = {}
for r in rows("10100172"):
    if r["Government sectors"] == "Federal government" and r["Statement of government operations and balance sheet"] == "Taxes on international trade and transactions":
        customs[r["REF_DATE"]] = num(r["VALUE"])
ex_all, _, _ = agg("Canada", TOP)
ex_housing, _, _ = agg("Canada", ["Paid rental fees for housing", "Imputed rental fees for housing", "Implicit loan charges", "Implicit deposit charges"])
base = ex_all - ex_housing
tariff = {y: round(v / base, 5) for y, v in customs.items() if int(y) >= 2015}

out = {
    "generated": datetime.date.today().isoformat(),
    "salesTaxYear": int(YEAR),
    "notes": [
        "Effective rates = sales tax actually paid / spending excluding sales tax, StatCan table 36-10-0432, 2024.",
        "2024 includes the temporary GST/HST holiday (Dec 14, 2024 - Feb 15, 2025), so some rates are slightly understated.",
        "'other' = all household spending except groceries, rent, home energy and water, motor fuel, new vehicles and imputed bank charges; includes spending abroad (untaxed).",
        "Grocery share curve: Survey of Household Spending 2023, Canada, by income quintile (table 11-10-0223).",
        "Tariff rate = federal taxes on international trade (GFS 10-10-0172) / household consumption excl. rent (2024 base).",
    ],
    "salesTax": sales,
    "groceryShareCurve": curve,
    "homeEnergyAndWater": energy,
    "tariffRateByYear": tariff,
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(out, indent=1))
print(json.dumps(out, indent=1)[:2500])
