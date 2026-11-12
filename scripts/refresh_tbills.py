#!/usr/bin/env python3
"""Update tbills_daily in data/rates.json from Treasury daily bill rates XML."""
from __future__ import annotations
import json, time, urllib.error, urllib.request, xml.etree.ElementTree as ET
from datetime import date, datetime
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

# Treasury daily bill XML uses ROUND_B1_CLOSE_* for the rounded bank discount
# and ROUND_B1_YIELD_* for the rounded coupon-equivalent yield. CS_*_AVG fields
# are a separate average series and are not the daily quote.
TERMS = [
    ("4-Week", "4WK"),
    ("6-Week", "6WK"),
    ("8-Week", "8WK"),
    ("13-Week", "13WK"),
    ("17-Week", "17WK"),
    ("26-Week", "26WK"),
    ("52-Week", "52WK"),
]

# A quote older than this is not published over the current file. That blocks
# a January-style fallback from writing last December in the middle of the year
# when the current-year feed is down.
MAX_AGE_DAYS = 10

def fetch(year: int, urlopen=urllib.request.urlopen, attempts: int = 3, sleep=None) -> str:
    if sleep is None:
        sleep = time.sleep
    url = XML_TMPL.format(year=year)
    last = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "CashParkBot/1.0 (+https://cashscoreboard.com/)"},
            )
            with urlopen(req, timeout=90) as r:
                return r.read().decode("utf-8", errors="replace")
        except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
            last = exc
            if i + 1 >= attempts:
                break
            sleep(min(2 * (i + 1), 5))
    raise last

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

def _num(props: dict, key: str):
    raw = props.get(key)
    if raw is None:
        return None
    text = str(raw).strip()
    if text == "" or text.upper() in {"N/A", "NA", "NULL"}:
        return None
    try:
        value = float(text)
    except ValueError:
        return None
    if value != value:  # NaN
        return None
    return value

def parse(xml_text: str, year: int):
    entries = entries_from_xml(xml_text)
    if not entries:
        raise SystemExit("No ATOM entries in Treasury XML")
    entries.sort(key=date_of)
    latest = entries[-1]
    as_of = date_of(latest)
    rows = []
    for label, code in TERMS:
        # Only the rounded daily quotes. Do not substitute CS_*_AVG.
        discount = _num(latest, f"ROUND_B1_CLOSE_{code}_2")
        coupon = _num(latest, f"ROUND_B1_YIELD_{code}_2")
        if coupon is None and discount is None:
            continue
        maturity_raw = latest.get(f"MATURITY_DATE_{code}") or ""
        maturity = maturity_raw[:10] if maturity_raw else None
        if coupon is not None and discount is not None:
            metric = "Coupon equivalent yield and bank discount"
        elif coupon is not None:
            metric = "Coupon equivalent yield"
        else:
            metric = "Bank discount rate"
        row = {
            "term": label,
            "as_of": as_of,
            "source_name": SOURCE_NAME,
            "source_url": SOURCE_URL.format(year=year),
            "metric": metric,
        }
        if coupon is not None:
            row["coupon_equivalent_yield_pct"] = coupon
            # rate_pct is the coupon-equivalent yield only, never the discount.
            row["rate_pct"] = coupon
        if discount is not None:
            row["discount_pct"] = discount
        if maturity:
            row["maturity"] = maturity
        rows.append(row)
    if not rows:
        raise SystemExit("No T-bill fields in latest entry; keys=" + ",".join(sorted(latest)[:50]))
    return as_of, rows

def parse_as_of(as_of: str) -> date:
    return datetime.strptime(as_of[:10], "%Y-%m-%d").date()

def choose_daily_rows(today: date, fetch_text, max_age_days: int = MAX_AGE_DAYS):
    """Pick the newest year whose quote is present and not older than max_age_days.

    Network errors, empty feeds, and stale years are skipped. If nothing qualifies,
    raise SystemExit before the caller writes rates.json.
    """
    errors = []
    for year in (today.year, today.year - 1):
        try:
            as_of, rows = parse(fetch_text(year), year)
        except SystemExit as exc:
            errors.append(f"{year}: {exc}")
            continue
        except (OSError, ET.ParseError) as exc:
            errors.append(f"{year}: {exc}")
            continue
        try:
            quoted = parse_as_of(as_of)
        except ValueError:
            errors.append(f"{year}: bad as_of {as_of}")
            continue
        age = (today - quoted).days
        if age < 0 or age > max_age_days:
            errors.append(f"{year}: as_of {as_of} is {age} days from {today.isoformat()}")
            continue
        return as_of, rows
    raise SystemExit("Treasury daily bill feed failed; rates.json not updated. " + " | ".join(errors))

def write_json(path: Path, data) -> None:
    payload = json.dumps(data, indent=2) + "\n"
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(payload)
    tmp.replace(path)

def refresh_file(path: Path, fetch_text, now: datetime):
    as_of, rows = choose_daily_rows(now.date(), fetch_text)
    data = json.loads(path.read_text())
    data["tbills_daily"] = rows
    data["tbills_refreshed_at_et"] = now.strftime("%Y-%m-%d %H:%M %Z")
    write_json(path, data)
    return as_of, rows

def main():
    et = ZoneInfo("America/New_York")
    now = datetime.now(et)
    as_of, rows = refresh_file(OUT, fetch, now)
    print(f"ok as_of={as_of} rows={len(rows)}")

if __name__ == "__main__":
    main()
