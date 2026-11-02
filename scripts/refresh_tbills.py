#!/usr/bin/env python3
"""Update tbills_daily in data/rates.json from Treasury daily bill rates XML."""
from __future__ import annotations
import json, urllib.request, xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

XML_TMPL = (
    "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/"
    "pages/xml?data=daily_treasury_bill_rates&field_tdr_date_value={year}"
)
OUT = Path("data/rates.json")
SOURCE_NAME = "U.S. Treasury Daily Treasury Bill Rates"
SOURCE_URL = (
    "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/"
    "pages/xml?data=daily_treasury_bill_rates&field_tdr_date_value={year}"
)

# Prefer coupon-equivalent fields; also capture bank discount when present.
TERMS = [
    ("4-Week", ["4WK", "4_WEEK", "4WEEK"], "4"),
    ("8-Week", ["8WK", "8_WEEK", "8WEEK"], "8"),
    ("13-Week", ["13WK", "13_WEEK", "13WEEK"], "13"),
    ("17-Week", ["17WK", "17_WEEK", "17WEEK"], "17"),
    ("26-Week", ["26WK", "26_WEEK", "26WEEK"], "26"),
    ("52-Week", ["52WK", "52_WEEK", "52WEEK"], "52"),
]

def fetch(year: int) -> str:
    req = urllib.request.Request(
        XML_TMPL.format(year=year),
        headers={"User-Agent": "CashParkBot/1.0 (+https://wilcaldrich-lab.github.io/cashpark/)"},
    )
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read().decode("utf-8", errors="replace")

def entries_from_xml(xml_text: str):
    root = ET.fromstring(xml_text)
    out = []
    for el in root.iter():
        if not el.tag.endswith("entry"):
            continue
        props = {}
        for child in el.iter():
            name = child.tag.split("}")[-1]
            if child.text and child.text.strip() and name.lower() not in {
                "entry", "content", "properties", "id", "title", "updated", "link", "author", "name", "category"
            }:
                props[name.upper()] = child.text.strip()
        if props:
            out.append(props)
    return out

def date_of(p: dict) -> str:
    for k in ("INDEX_DATE", "RECORD_DATE", "DATE", "INDEXDATE"):
        if k in p:
            return p[k][:10]
    return ""

def find_val(props: dict, needles, want_coupon: bool):
    for k, v in props.items():
        ku = k.upper()
        if want_coupon and ("COUPON" not in ku and "EQUIV" not in ku):
            continue
        if not want_coupon and ("DISCOUNT" not in ku and "CLOSE" not in ku):
            # still allow CLOSE_* discount fields
            if "COUPON" in ku:
                continue
        if any(n in ku for n in needles):
            try:
                return float(v)
            except ValueError:
                continue
    return None

def parse(xml_text: str, year: int):
    entries = entries_from_xml(xml_text)
    if not entries:
        raise SystemExit("No ATOM entries in Treasury XML")
    entries.sort(key=date_of)
    latest = entries[-1]
    as_of = date_of(latest)
    rows = []
    for label, needles, _ in TERMS:
        coupon = find_val(latest, needles, True)
        discount = None
        # discount: keys with WEEK + CLOSE, without COUPON
        for k, v in latest.items():
            ku = k.upper()
            if any(n in ku for n in needles) and "COUPON" not in ku and "EQUIV" not in ku:
                if "CLOSE" in ku or "DISCOUNT" in ku or "BANK" in ku:
                    try:
                        discount = float(v)
                        break
                    except ValueError:
                        pass
        if coupon is None and discount is None:
            continue
        row = {
            "term": label,
            "as_of": as_of,
            "source_name": SOURCE_NAME,
            "source_url": SOURCE_URL.format(year=year),
            "metric": "Coupon equivalent yield (bank discount also shown)",
        }
        if coupon is not None:
            row["coupon_equivalent_yield_pct"] = coupon
            row["rate_pct"] = coupon  # convenience for any UI that looks for rate_pct
        if discount is not None:
            row["discount_pct"] = discount
        rows.append(row)
    if not rows:
        raise SystemExit("No T-bill fields in latest entry; keys=" + ",".join(sorted(latest)[:50]))
    return as_of, rows

def main():
    et = ZoneInfo("America/New_York")
    now = datetime.now(et)
    year = now.year
    try:
        as_of, rows = parse(fetch(year), year)
    except SystemExit:
        year = year - 1
        as_of, rows = parse(fetch(year), year)
    data = json.loads(OUT.read_text())
    data["tbills_daily"] = rows
    data["tbills_refreshed_at_et"] = now.strftime("%Y-%m-%d %H:%M %Z")
    OUT.write_text(json.dumps(data, indent=2) + "\n")
    print(f"ok as_of={as_of} rows={len(rows)}")

if __name__ == "__main__":
    main()
