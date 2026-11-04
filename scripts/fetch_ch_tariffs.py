"""Sample the Swiss Federal Tax Administration's calculator (swisstaxcalculator.estv.admin.ch) for the
2026 federal income tax and the Zurich "simple tax" (einfache Staatssteuer) on taxable income and
taxable wealth, single and married. Canton and city multiply the simple tax by their Steuerfuss
(95% and 119% for Zurich city in 2026). Writes data/rules/ch/zh2026.json.
Usage: python3 scripts/fetch_ch_tariffs.py
"""
import json, subprocess, time, sys
U = "https://swisstaxcalculator.estv.admin.ch/delegate/ost-integration/v1/lg-proxy/operation/c3b67379_ESTV/API_calculateSimpleTaxes"
def call(rel, inc, fortune, children=None, conf=1):
    body = {"SimKey": None, "TaxYear": 2026, "TaxLocationID": 800000000, "Relationship": rel, "Confession1": conf,
            "Children": children or [], "Confession2": conf if rel == 2 else 0,
            "TaxableIncomeCanton": inc, "TaxableIncomeFed": inc, "TaxableFortune": fortune}
    for _ in range(4):
        r = subprocess.run(["curl", "-sS", "-m", "30", "-X", "POST", U, "-H", "Content-Type: application/json", "-d", json.dumps(body)], capture_output=True, text=True)
        try: return json.loads(r.stdout)["response"]
        except Exception: time.sleep(2)
    raise SystemExit(f"failed {body}")
incomes = list(range(0, 300001, 1000)) + list(range(320000, 1000001, 20000)) + [1500000, 2000000]
fortunes = list(range(0, 3000001, 10000))[:len(incomes)]
fortunes += [3000000 + 100000 * i for i in range(1, len(incomes) - len(fortunes) + 1)]
out = {}
for rel in (1, 2):
    rows = []
    for inc, fo in zip(incomes, fortunes):
        r = call(rel, inc, fo)
        rows.append([inc, r["IncomeSimpleTaxFed"], r["IncomeSimpleTaxCanton"], r["IncomeTaxCanton"], r["IncomeTaxCity"], r["IncomeTaxChurch"],
                     fo, r["FortuneSimpleTaxCanton"], r["FortuneTaxCanton"], r["FortuneTaxCity"], r["FortuneTaxChurch"], r["PersonalTax"]])
        time.sleep(0.05)
    out["single" if rel == 1 else "married"] = rows
    print(rel, len(rows), rows[100], file=sys.stderr)
# child credit check
a = call(2, 100000, 0); b = call(2, 100000, 0, children=[{"Age": 8}])
out["childCheck"] = [a["IncomeTaxFed"], b["IncomeTaxFed"], b["TaxCredit"]]
import pathlib
dest = pathlib.Path(__file__).resolve().parent.parent / "data" / "rules" / "ch" / "zh2026.json"
compact = {"source": "ESTV tax calculator API_calculateSimpleTaxes, tax year 2026, Zürich (TaxLocationID 800000000)",
           "columns": {"income": ["taxableIncome", "federalTax", "zurichSimpleTax"], "wealth": ["taxableWealth", "zurichSimpleWealthTax"]},
           "steuerfuss": {"canton": 0.95, "city": 1.19, "reformedChurch": 0.10}, "personalTax": 24, "federalChildCredit": 263}
for k in ("single", "married"):
    compact[k] = {"income": [[r[0], r[1], r[2]] for r in out[k]], "wealth": [[r[6], r[7]] for r in out[k]]}
compact["childCheck"] = out["childCheck"]
dest.write_text(json.dumps(compact))
print(out["childCheck"], file=sys.stderr)
