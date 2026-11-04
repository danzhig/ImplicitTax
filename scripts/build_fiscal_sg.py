"""Build data/fiscal/sg.json: Singapore government borrowing by financial year (April-March).

Usage: python3 scripts/build_fiscal_sg.py <dir>   (downloads SingStat tables M130561 and M130571 into <dir>)

Measure: borrowing = minus the official Overall Budget Surplus/(Deficit) (SingStat M130561, MOF). It
already includes the Net Investment Returns Contribution from the reserves (GIC, Temasek, MAS), in line
with decision D22 (state-owned funds that pay for the budget are part of the government), and it counts
infrastructure spending in full when it happens (the later "overall fiscal position" replaces part of it
with borrowing under the Significant Infrastructure Government Loan Act). Top-ups to statutory and trust
funds count as spending, as in the official balance.
Taxes = tax revenue + vehicle quota premiums (COE), because COE premiums are counted as a car tax.
Singapore issues bonds (SGS, SSGS) only to invest or to meet CPF demand, not to fund spending, and does
not publish its net assets, so there is no interest-on-debt or net debt series.
"""
import json, sys, pathlib, subprocess, datetime

SRC = pathlib.Path(sys.argv[1]); SRC.mkdir(parents=True, exist_ok=True)
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "fiscal" / "sg.json"
for t in ("M130561", "M130571"):
    subprocess.run(["curl", "-sS", "-f", "-m", "120", "-H", "User-Agent: research-script", "-o", str(SRC / f"{t}.json"),
                    f"https://tablebuilder.singstat.gov.sg/api/table/tabledata/{t}?limit=3000"], check=True)


def rows(t):
    d = json.loads((SRC / f"{t}.json").read_text())["Data"]
    out = {}
    for r in d["row"]:
        out[r["rowText"].strip()] = {int(c["key"]): (None if c["value"] in ("-", "", "na") else float(c["value"])) for c in r["columns"]}
    return out


fp = rows("M130561")
rev = rows("M130571")
balance = fp["Overall Budget Surplus/ (Deficit)"]
tax = rev["Tax Revenue"]
coe = rev["Vehicle Quota Premiums"]
years = {}
for y in sorted(balance):
    if y < 2000 or balance[y] is None or tax.get(y) is None:
        continue
    status = "actual" if y <= 2024 else "estimate"
    rec = {"taxes": tax[y] + (coe.get(y) or 0), "interest": None, "borrowing": -balance[y], "netDebt": None,
           "borrowingSource": "SingStat M130561 (MOF): Overall Budget Surplus/(Deficit), sign flipped", "status": status}
    if y == 2025:
        rec["notes"] = ["Revised estimate (Budget 2026)."]
    if y == 2026:
        rec["notes"] = ["Budget estimate."]
    years[str(y)] = rec
out = {
    "generated": datetime.date.today().isoformat(),
    "unit": "millions of SGD",
    "notes": [
        "Singapore: financial years April-March (2024 = FY2024-25). Borrowing = minus the official overall budget surplus, which includes the Net Investment Returns Contribution from the reserves (up to half of their expected long-term real returns).",
        "Singapore does not borrow to spend: government bonds (SGS, SSGS) are issued to invest or to meet CPF demand, and since 2021 some long-lived infrastructure is financed under SINGA. Deficits such as FY2020 (pandemic) were paid by drawing on past reserves, which shows here as positive borrowing.",
        "The reserves are not disclosed, so there is no net debt (or net asset) figure; interest on debt is not shown.",
        "Tax revenue includes COE vehicle quota premiums, which this tool counts as a car tax. Data before FY2005 are not published in this table.",
    ],
    "series": {"SG-federal": {"label": "Government of Singapore", "years": years}},
}
OUT.write_text(json.dumps(out, indent=1))
for y, v in years.items():
    if int(y) >= 2015:
        print(y, round(v["borrowing"]), round(v["taxes"]), f"{v['borrowing'] / v['taxes'] * 100:6.1f}%", v["status"])
