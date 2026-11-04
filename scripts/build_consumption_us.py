"""Build data/consumption/us.json: effective sales tax rates on household spending for the four
US cities.

Usage: python3 scripts/build_consumption_us.py <bea-SAPCE-dir>

Method (the US has no equivalent of StatCan's "sales taxes actually paid by households" table):
  1. Spending mix: BEA personal consumption expenditures by state and category (SAPCE1, 2024).
     Housing and utilities, gasoline, new vehicles and nonprofit spending are modelled separately
     or excluded. Health care and financial services in PCE include large amounts paid by insurers,
     employers and banks on households' behalf, so only the out-of-pocket share is kept.
  2. Taxability: the share of each category that each state's sales tax applies to (statutory
     rules: groceries exempt everywhere, NY exempts clothing under $110, WA and TX tax many
     services, CA taxes few services). These shares are estimates and are listed below.
  3. Rate: the 2026 combined rate in each city, split into state and local parts.
"""
import csv, json, sys, pathlib, datetime

BEA = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "consumption" / "us.json"
YEAR = "2024"

# Combined 2026 sales tax rates (state part, local part).
RATES = {
    "nyc": {"state": "NY", "stateRate": 0.04, "localRate": 0.04875, "note": "NYC 8.875% = NY 4% + NYC 4.5% + MTA district 0.375%"},
    "sf": {"state": "CA", "stateRate": 0.039375, "localRate": 0.046875, "note": "San Francisco 8.625%; the state keeps 3.9375% of the 7.25% base rate, the rest funds counties, cities and districts"},
    "seattle": {"state": "WA", "stateRate": 0.065, "localRate": 0.0405, "note": "Seattle 10.55% from Jan 1, 2026 = WA 6.5% + local 4.05% (incl. Sound Transit)"},
    "houston": {"state": "TX", "stateRate": 0.0625, "localRate": 0.02, "note": "Houston 8.25% = TX 6.25% + city 1% + METRO 1%"},
}

# BEA line -> (label, out-of-pocket share kept, taxable share by state)
CATS = {
    "9": ("Groceries and drinks for home", 1.0, {"NY": 0.2, "CA": 0.15, "WA": 0.2, "TX": 0.2}),  # alcohol, soda, candy taxable
    "10": ("Clothing and footwear", 1.0, {"NY": 0.3, "CA": 1.0, "WA": 1.0, "TX": 1.0}),  # NY: items under $110 exempt
    "5": ("Furnishings and household equipment", 1.0, {"NY": 1.0, "CA": 1.0, "WA": 1.0, "TX": 1.0}),
    "6": ("Recreational goods", 1.0, {"NY": 1.0, "CA": 1.0, "WA": 1.0, "TX": 1.0}),
    "7": ("Other durable goods", 1.0, {"NY": 1.0, "CA": 1.0, "WA": 1.0, "TX": 1.0}),
    "12": ("Other nondurable goods (incl. medicines)", 1.0, {"NY": 0.55, "CA": 0.55, "WA": 0.55, "TX": 0.55}),  # prescriptions exempt
    "16": ("Health care (out of pocket)", 0.12, {"NY": 0.0, "CA": 0.0, "WA": 0.0, "TX": 0.0}),
    "17": ("Transportation services", 1.0, {"NY": 0.4, "CA": 0.15, "WA": 0.4, "TX": 0.35}),  # repairs taxable except CA labour; transit exempt
    "18": ("Recreation services", 1.0, {"NY": 0.4, "CA": 0.0, "WA": 0.5, "TX": 0.4}),
    "19": ("Restaurants and hotels", 1.0, {"NY": 1.0, "CA": 1.0, "WA": 1.0, "TX": 1.0}),
    "20": ("Financial services and insurance (explicit fees)", 0.5, {"NY": 0.0, "CA": 0.0, "WA": 0.0, "TX": 0.0}),
    "21": ("Other services (telecom, personal care, education, legal)", 1.0, {"NY": 0.25, "CA": 0.05, "WA": 0.35, "TX": 0.3}),
}


def load(state):
    f = next(BEA.glob(f"SAPCE1_{state}_*.csv"))
    out = {}
    with open(f, encoding="latin-1") as fh:
        rd = csv.reader(fh)
        hdr = next(rd)
        col = hdr.index(YEAR)
        for r in rd:
            if len(r) > col and r[4].strip() in CATS:
                out[r[4].strip()] = float(r[col])
    return out


cities = {}
for city, info in RATES.items():
    pce = load(info["state"])
    basket = {k: pce[k] * CATS[k][1] for k in CATS}
    total = sum(basket.values())
    taxable = sum(basket[k] * CATS[k][2][info["state"]] for k in CATS)
    groceries = basket["9"]
    cities[city] = {
        "state": info["state"],
        "stateRate": info["stateRate"],
        "localRate": info["localRate"],
        "note": info["note"],
        "taxableShare": round(taxable / total, 4),
        "groceryShare": round(groceries / total, 4),
        "basket": {CATS[k][0]: round(basket[k] / total, 4) for k in CATS},
    }

out = {
    "generated": datetime.date.today().isoformat(),
    "spendingYear": int(YEAR),
    "notes": [
        "Spending mix: BEA personal consumption expenditures by state (SAPCE1, 2024); health care and financial services reduced to the out-of-pocket share.",
        "Taxable shares per category are estimates from each state's sales tax rules (groceries exempt in all four states; NY exempts clothing under $110; WA and TX tax many services; CA taxes few services).",
        "Combined 2026 rates: NYC 8.875%, San Francisco 8.625%, Seattle 10.55%, Houston 8.25%.",
    ],
    "cities": cities,
}
OUT.write_text(json.dumps(out, indent=1))
for c, v in cities.items():
    print(c, "taxable share", v["taxableShare"], "effective rate", round(v["taxableShare"] * (v["stateRate"] + v["localRate"]) * 100, 2), "%")
