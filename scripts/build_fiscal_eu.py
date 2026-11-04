"""Build data/fiscal/eu.json: yearly borrowing, taxes, interest and net debt for each level of
government in the European countries (DE, CH, UK, LU, IE, NO, DK).

Usage: python3 scripts/build_fiscal_eu.py <dir from fetch_eu.sh>

Measures (same idea as Canada and the US):
  borrowing = net borrowing (ESA 2010 B.9, sign flipped): the increase in a government's financial
              liabilities minus its financial assets from transactions. It excludes revaluations,
              so market swings in asset values never count as borrowing or repayment.
  taxes     = taxes on production and imports + current taxes on income and wealth + capital taxes
              + actual social contributions received by that level (D.2 + D.5 + D.91 + D.611).
  interest  = interest payable (D.41).
  netDebt   = minus net financial worth (BF.90) from the financial balance sheets; Switzerland uses
              the Federal Finance Administration's net debt; the UK uses ONS net debt.
Social security funds (S.1314) are left out, like the CPP: several of them (Luxembourg,
Switzerland) build large pension reserves, and their surpluses must not hide what the
central government borrows. Calendar years, except the UK (fiscal years April-March, labelled by
the starting year, so 2024 = 2024-25).
"""
import csv, json, sys, pathlib, datetime
import pandas as pd

SRC = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "fiscal" / "eu.json"
FIRST, LAST = 2000, 2025


def load_jsonstat(path):
    d = json.loads(pathlib.Path(path).read_text())
    ids, size = d["id"], d["size"]
    cats = [sorted(d["dimension"][k]["category"]["index"].items(), key=lambda x: x[1]) for k in ids]
    out = {}
    for flat, v in d["value"].items():
        flat = int(flat)
        idx = []
        for s in reversed(size):
            idx.append(flat % s)
            flat //= s
        idx.reverse()
        key = {ids[i]: cats[i][j][0] for i, j in enumerate(idx)}
        out[(key["geo"], key["sector"], key["na_item"], key["time"])] = v
    return out


MAIN = load_jsonstat(SRC / "gov_10a_main.json")
BS = load_jsonstat(SRC / "nasa_10_f_bs.json")


def g(geo, sector, item, y):
    return MAIN.get((geo, sector, item, str(y)))


def taxes(geo, sector, y):
    parts = [g(geo, sector, i, y) for i in ("D2REC", "D5REC", "D91REC", "D611REC")]
    return None if parts[0] is None else sum(p or 0 for p in parts)


DK_OFF3 = {}
for r in csv.DictReader(open(SRC / "dk_off3.csv", encoding="utf-8-sig"), delimiter=";"):
    DK_OFF3[int(r["TID"])] = float(r["INDHOLD"])


def b9(geo, sector, y):
    v = g(geo, sector, "B9", y)
    if v is None and geo == "DK" and sector == "S1311" and y in DK_OFF3:
        # Eurostat withholds Denmark's central government balance for the latest years;
        # Statistics Denmark (table OFF3) publishes it.
        return DK_OFF3[y], True
    return v, False


EU_SERIES = {
    # id: (geo, sector, label, notes)
    "DE-federal": ("DE", "S1311", "German federal government (Bund)", None),
    "DE-BY": ("DE", "S1312", "All German Länder", "Bavaria is shown through all 16 Länder."),
    "DE-BY-local": ("DE", "S1313", "All German municipalities", None),
    "CH-federal": ("CH", "S1311", "Swiss Confederation", None),
    "CH-ZH": ("CH", "S1312", "All Swiss cantons", "Zurich is shown through all 26 cantons."),
    "CH-ZH-local": ("CH", "S1313", "All Swiss communes", None),
    "LU-federal": ("LU", "S1311", "Luxembourg central government", None),
    "LU-local": ("LU", "S1313", "Luxembourg communes", None),
    "IE-federal": ("IE", "S1311", "Irish central government", None),
    "IE-local": ("IE", "S1313", "Irish local authorities", None),
    "NO-federal": ("NO", "S1311", "Norwegian central government (incl. the oil fund)", None),
    "NO-local": ("NO", "S1313", "Norwegian municipalities and counties", None),
    "DK-federal": ("DK", "S1311", "Danish central government", None),
    "DK-local": ("DK", "S1313", "Danish municipalities and regions", None),
}

ch_debt = {}
_x = pd.read_excel(SRC / "ch_nettoschuld.xlsx", sheet_name="schuld", header=None)
_hdr = next(list(r) for _, r in _x.iterrows() if r[1] == "1 000 CHF")
for _, r in _x.iterrows():
    name = str(r[1]).strip()
    if name in ("Bund", "Kantone", "Gemeinden"):
        ch_debt[name] = {int(y): v / 1000 for y, v in zip(_hdr[2:], list(r)[2:]) if pd.notna(y) and pd.notna(v)}
CH_DEBT_KEY = {"S1311": "Bund", "S1312": "Kantone", "S1313": "Gemeinden"}

series = {}
for sid, (geo, sector, label, note) in EU_SERIES.items():
    years = {}
    for y in range(FIRST, LAST + 1):
        t = taxes(geo, sector, y)
        b, derived = b9(geo, sector, y)
        if not t or b is None:
            continue
        if geo == "CH":
            nd = ch_debt[CH_DEBT_KEY[sector]].get(y)
        else:
            nfw = BS.get((geo, sector, "BF90", str(y)))
            nd = None if nfw is None else -nfw
        rec = {"taxes": t, "interest": g(geo, sector, "D41PAY", y), "borrowing": -b, "netDebt": nd,
               "borrowingSource": "Eurostat gov_10a_main, net borrowing (B.9)", "status": "actual"}
        if derived:
            rec["borrowingSource"] = "Statistics Denmark table OFF3, central government net lending"
        years[str(y)] = rec
    # Latest year without a published debt stock: last stock plus this year's borrowing.
    ys = sorted(years, key=int)
    for a, b in zip(ys, ys[1:]):
        if years[b]["netDebt"] is None and years[a]["netDebt"] is not None and b == ys[-1]:
            years[b]["netDebt"] = years[a]["netDebt"] + years[b]["borrowing"]
            years[b].setdefault("notes", []).append("Net debt not yet published: last year's figure plus this year's borrowing.")
    series[sid] = {"label": label, "years": years}

# ---------- UK: ONS public sector finances, fiscal years ----------
rows = [r for r in csv.reader(open(SRC / "pusf.csv", encoding="utf-8", errors="replace")) if r]
ix = {k: i for i, k in enumerate(rows[1])}
lab = {r[0]: r for r in rows}


def q(code, y, qq):
    r = lab.get(f"{y} Q{qq}")
    if not r:
        return None
    v = r[ix[code]].strip()
    return float(v) if v else None


def fy(code, y):
    vals = [q(code, y, 2), q(code, y, 3), q(code, y, 4), q(code, y + 1, 1)]
    return None if None in vals else sum(vals)


def stock(code, y):
    return q(code, y + 1, 1)  # end of March


uk = {"UK-federal": {}, "UK-local": {}}
for y in range(FIRST, LAST + 1):
    cg_b, lg_b = fy("NMFJ", y), fy("NMOE", y)
    if cg_b is None or lg_b is None:
        continue
    gg_nd, lg_debt, lg_liquid = stock("MDK2", y), stock("JM9T", y), stock("KSD6", y)
    lg_nd = None if lg_debt is None or lg_liquid is None else lg_debt - lg_liquid
    uk["UK-federal"][str(y)] = {
        "taxes": fy("MF73", y) + fy("AIIH", y), "interest": fy("NMFX", y), "borrowing": -cg_b,
        "netDebt": None if gg_nd is None or lg_nd is None else gg_nd - lg_nd,
        "borrowingSource": "ONS public sector finances: central government net borrowing (NMFJ)", "status": "actual"}
    uk["UK-local"][str(y)] = {
        "taxes": fy("MSF3", y), "interest": fy("NUGW", y), "borrowing": -lg_b, "netDebt": lg_nd,
        "borrowingSource": "ONS public sector finances: local government net borrowing (NMOE)", "status": "actual"}
series["UK-federal"] = {"label": "UK central government", "years": uk["UK-federal"]}
series["UK-London-local"] = {"label": "All UK local authorities", "years": uk["UK-local"]}

out = {
    "generated": datetime.date.today().isoformat(),
    "unit": "millions of national currency",
    "notes": [
        "Borrowing = net borrowing in the national accounts (ESA 2010 B.9): the increase in financial liabilities minus financial assets from transactions, so revaluations of assets never count.",
        "Social security funds are excluded, like the CPP. Luxembourg's and Switzerland's build large pension reserves whose surpluses would otherwise hide central government borrowing. Social contributions are therefore not allocated any borrowing.",
        "Norway's central government includes the oil fund (GPFG): petroleum revenue and fund returns are saved, so it shows large net lending (negative borrowing).",
        "Ireland 2010 includes the bank recapitalisations (about EUR 30bn of capital transfers).",
        "Bavaria and Zurich are shown through all German Länder and all Swiss cantons; every city through all local governments in its country.",
        "UK: ONS public sector finances, fiscal years April-March (2024 = 2024-25). Taxes include National Insurance, which is part of central government. Local interest excludes interest paid to central government (PWLB).",
        "Net debt: minus net financial worth from Eurostat financial balance sheets (market values); Switzerland: Federal Finance Administration net debt; UK: ONS general government net debt split by sector.",
        "Denmark: Eurostat withholds the central government balance for the latest years, so Statistics Denmark's own figure (table OFF3) is used.",
    ],
    "series": series,
}
OUT.write_text(json.dumps(out, indent=1))
print(f"wrote {OUT}")
for k, s in series.items():
    ys = s["years"]
    line = " ".join(f"{(v['borrowing']/v['taxes']*100):6.1f}" for y, v in sorted(ys.items()) if int(y) >= 2016)
    print(f"{k:16s} {min(ys)}-{max(ys)} 2016+: {line}")
