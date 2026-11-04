"""Build data/consumption/eu.json: the VAT share of everyday spending for each European country.

Usage: python3 scripts/build_consumption_eu.py <dir from fetch_eu.sh>

Method: Eurostat HICP item weights (2025) give the household spending mix by COICOP group. Housing
rent, home energy, vehicles and motor fuel are modelled separately and left out here; tobacco is left
out (Luxembourg's weights are inflated by cross-border buyers). Each remaining group gets the VAT rate
that applies in 2026 (a blend where a group mixes rates). The result is VAT as a share of spending
including VAT: sum(w * t / (1 + t)) / sum(w). The UK is no longer in the HICP, so Ireland's mix is used
with UK rates.
"""
import json, sys, pathlib, datetime

SRC = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "consumption" / "eu.json"
d = json.loads((SRC / "prc_hicp_inw.json").read_text())
ids, size = d["id"], d["size"]
cats = [sorted(d["dimension"][k]["category"]["index"].items(), key=lambda x: x[1]) for k in ids]
W = {}
for flat, v in d["value"].items():
    flat = int(flat); idx = []
    for s in reversed(size):
        idx.append(flat % s); flat //= s
    idx.reverse()
    key = {ids[i]: cats[i][j][0] for i, j in enumerate(idx)}
    W[(key["geo"], key["coicop"])] = v

GROUPS = ["CP011", "CP012", "CP021", "CP031", "CP032", "CP043", "CP044", "CP051", "CP052", "CP053", "CP054", "CP055", "CP056",
          "CP061", "CP062", "CP063", "CP073", "CP08", "CP091", "CP092", "CP093", "CP094", "CP095", "CP096", "CP10",
          "CP111", "CP112", "CP121", "CP123", "CP124", "CP125", "CP126", "CP127"]
STD = {"DE": 0.19, "CH": 0.081, "UK": 0.20, "LU": 0.17, "IE": 0.23, "NO": 0.25, "DK": 0.25}
# Rates that differ from the standard rate. Exempt services are 0 (no VAT charged to the household).
EXEMPT = {"CP062": 0, "CP063": 0, "CP10": 0, "CP124": 0, "CP125": 0, "CP126": 0}
RATES = {
    "DE": {**EXEMPT, "CP011": 0.07, "CP044": 0.07, "CP073": 0.07, "CP095": 0.07, "CP112": 0.07, "CP094": 0.10,
           "CP111": 0.106},  # restaurant food 7% from 2026, drinks 19%: about 70/30
    "CH": {**EXEMPT, "CP011": 0.026, "CP012": 0.026, "CP061": 0.026, "CP095": 0.026, "CP112": 0.038, "CP094": 0.04},
    "UK": {**EXEMPT, "CP011": 0.03, "CP012": 0.20, "CP031": 0.17, "CP032": 0.17, "CP044": 0, "CP061": 0.10, "CP073": 0,
           "CP095": 0.02, "CP08": 0.19},  # most food zero-rated; children's clothes, books, transport zero
    "LU": {**EXEMPT, "CP011": 0.03, "CP012": 0.03, "CP021": 0.15, "CP044": 0.03, "CP061": 0.03, "CP073": 0.03, "CP094": 0.05,
           "CP095": 0.03, "CP111": 0.06, "CP112": 0.03, "CP121": 0.10, "CP031": 0.15},
    "IE": {**EXEMPT, "CP011": 0.08, "CP031": 0.19, "CP032": 0.19, "CP044": 0, "CP061": 0.05, "CP073": 0, "CP094": 0.09,
           "CP095": 0.03, "CP111": 0.1125, "CP112": 0.135, "CP121": 0.17},  # food services 13.5% -> 9% from July 2026
    "NO": {**EXEMPT, "CP011": 0.15, "CP012": 0.15, "CP073": 0.12, "CP094": 0.08, "CP095": 0.02, "CP112": 0.12},
    "DK": {**EXEMPT, "CP073": 0, "CP095": 0.20},
}
WEIGHTS_FROM = {"UK": "IE"}
out = {"generated": datetime.date.today().isoformat(), "weightsYear": 2025, "countries": {},
       "notes": ["VAT share of everyday spending (excluding rent, home energy, vehicles and fuel): Eurostat HICP 2025 spending weights by category, with each category's 2026 VAT rate.",
                 "Germany cut VAT on restaurant food to 7% from January 2026; Ireland cuts VAT on food services from 13.5% to 9% from July 2026.",
                 "The UK left the HICP after 2020, so Ireland's spending mix is used with UK VAT rates.",
                 "Health, education, insurance and financial services are exempt (no VAT charged), so their share lowers the effective rate."]}
for c in STD:
    g = WEIGHTS_FROM.get(c, c)
    tot = tax = 0.0
    for grp in GROUPS:
        w = W.get((g, grp)) or 0
        t = RATES[c].get(grp, STD[c])
        tot += w; tax += w * t / (1 + t)
    out["countries"][c] = {"standardRate": STD[c], "vatShareOfSpending": round(tax / tot, 4), "weightsFrom": g}
    print(c, STD[c], round(tax / tot * 100, 2))
OUT.write_text(json.dumps(out, indent=1))
