#!/usr/bin/env python3
"""Update T-bill rows in data/rates.json from Treasury feeds.

Daily quotes still come from the daily Treasury bill XML. Auction rows come
from the TreasuryDirect auctioned-securities API: the latest completed
auction for each tracked bill term. A failed auction fetch does not replace
those rows, and it does not roll back a daily quote update.
"""
from __future__ import annotations
import json, sys, time, urllib.error, urllib.request, xml.etree.ElementTree as ET
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

XML_TMPL = (
    "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/"
    "pages/xml?data=daily_treasury_bill_rates&field_tdr_date_value={year}"
)
AUCTION_URL = "https://www.treasurydirect.gov/TA_WS/securities/auctioned?format=json&type=Bill"
OUT = Path("data/rates.json")
SOURCE_NAME = "U.S. Treasury Daily Treasury Bill Rates"
SOURCE_URL = (
    "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/"
    "pages/xml?data=daily_treasury_bill_rates&field_tdr_date_value={year}"
)
AUCTION_SOURCE_NAME = "TreasuryDirect auctioned securities API"
AUCTION_SOURCE_URL = AUCTION_URL

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

# Weekly bills should have a completed auction inside two weeks. The 52-week
# bill is auctioned every four weeks, so its latest close can sit past the
# weekly window without being a stuck feed. Older than that, refuse the
# update and leave the stored auction rows alone.
AUCTION_MAX_AGE_DAYS = {
    "4-Week": 14,
    "6-Week": 14,
    "8-Week": 14,
    "13-Week": 14,
    "17-Week": 14,
    "26-Week": 14,
    "52-Week": 35,
}

def _read_url(url, urlopen, attempts, sleep) -> bytes:
    last = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "CashParkBot/1.0 (+https://cashscoreboard.com/)"},
            )
            with urlopen(req, timeout=90) as r:
                return r.read()
        except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
            last = exc
            if i + 1 >= attempts:
                break
            sleep(min(2 * (i + 1), 5))
    raise last

def fetch(year: int, urlopen=urllib.request.urlopen, attempts: int = 3, sleep=None) -> str:
    if sleep is None:
        sleep = time.sleep
    url = XML_TMPL.format(year=year)
    return _read_url(url, urlopen, attempts, sleep).decode("utf-8", errors="replace")

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

def _parse_num(raw):
    if isinstance(raw, bool):
        return None
    if isinstance(raw, (int, float)):
        value = float(raw)
    else:
        if raw is None:
            return None
        text = str(raw).strip()
        if text == "" or text.upper() in {"N/A", "NA", "NULL", "NONE"}:
            return None
        try:
            value = float(text)
        except ValueError:
            return None
    if value != value or value in (float("inf"), float("-inf")):
        return None
    return value

def _num(props: dict, key: str):
    if key not in props:
        return None
    return _parse_num(props.get(key))

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

def _lookup(record: dict, key: str):
    if key in record:
        return record[key]
    for existing, value in record.items():
        if existing.lower() == key.lower():
            return value
    return None

def _first_number(record: dict, keys):
    for key in keys:
        if not any(existing.lower() == key.lower() for existing in record):
            continue
        number = _parse_num(_lookup(record, key))
        if number is not None:
            return number
    return None

def _iso_date(raw) -> str:
    if raw is None:
        return ""
    text = str(raw).strip()
    if len(text) < 10:
        return ""
    day = text[:10]
    try:
        datetime.strptime(day, "%Y-%m-%d")
    except ValueError:
        return ""
    return day

def auction_close_date(record: dict) -> str:
    """Competitive close date, then auctionDate when that is all the record has."""
    for key in ("competitiveAuctionCloseDate", "auctionDate"):
        day = _iso_date(_lookup(record, key))
        if day:
            return day
    return ""

def _record_term(record: dict) -> str:
    for key in ("securityTerm", "term"):
        value = _lookup(record, key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""

def _is_cash_management_bill(record: dict) -> bool:
    flag = _lookup(record, "cashManagementBill")
    return str(flag or "").strip().lower() in {"yes", "true", "y", "1"}

def _is_bill(record: dict) -> bool:
    for key in ("securityType", "type"):
        value = _lookup(record, key)
        if value is None or str(value).strip() == "":
            continue
        return str(value).strip().lower() == "bill"
    return True

def _auction_max_age(term: str, max_age_days) -> int:
    if max_age_days is None:
        return AUCTION_MAX_AGE_DAYS[term]
    if isinstance(max_age_days, int):
        return max_age_days
    return int(max_age_days.get(term, AUCTION_MAX_AGE_DAYS[term]))

def _auction_records(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for value in payload.values():
            if isinstance(value, list):
                return value
    raise SystemExit("Treasury auction feed was not a list of securities")

def fetch_auctions(urlopen=urllib.request.urlopen, attempts: int = 3, sleep=None):
    if sleep is None:
        sleep = time.sleep
    raw = _read_url(AUCTION_URL, urlopen, attempts, sleep)
    try:
        payload = json.loads(raw.decode("utf-8", errors="replace"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Treasury auction feed was not JSON. {exc}") from exc
    return _auction_records(payload)

def select_auctions(records, today: date, max_age_days=None):
    """Latest completed auction per tracked term.

    A completed auction has a published investment rate. Records without one
    are skipped. The chosen close date cannot be in the future or older than
    the term's window, and the row needs a high discount, CUSIP, and maturity.
    Any gap refuses the whole set so a partial write cannot drop a term.
    """
    grouped = {label: [] for label, _code in TERMS}
    for record in _auction_records(records):
        if not isinstance(record, dict):
            continue
        if not _is_bill(record) or _is_cash_management_bill(record):
            continue
        term = _record_term(record)
        if term not in grouped:
            continue
        if _first_number(record, ("investmentRate", "investment_rate")) is None:
            continue
        if not auction_close_date(record):
            continue
        grouped[term].append(record)
    rows = []
    errors = []
    for label, _code in TERMS:
        chosen = _choose_auction(label, grouped[label], today, max_age_days)
        if isinstance(chosen, str):
            errors.append(chosen)
        else:
            rows.append(chosen)
    if errors:
        raise SystemExit("Treasury auction rows not updated. " + " | ".join(errors))
    return rows

def _choose_auction(label: str, records, today: date, max_age_days):
    if not records:
        return f"{label}: no auction with a published investment rate"
    def sort_key(record):
        return (auction_close_date(record), str(_lookup(record, "cusip") or ""))
    latest = max(records, key=sort_key)
    close = auction_close_date(latest)
    quoted = datetime.strptime(close, "%Y-%m-%d").date()
    age = (today - quoted).days
    if age < 0:
        return f"{label}: auction date {close} is after {today.isoformat()}"
    limit = _auction_max_age(label, max_age_days)
    if age > limit:
        return f"{label}: auction date {close} is {age} days before {today.isoformat()}"
    investment = _first_number(latest, ("investmentRate", "investment_rate"))
    discount = _first_number(latest, ("highDiscountRate", "high_discount_rate", "highRate"))
    cusip = str(_lookup(latest, "cusip") or "").strip()
    maturity = _iso_date(_lookup(latest, "maturityDate")) or _iso_date(_lookup(latest, "maturity"))
    if investment is None:
        return f"{label}: missing investment rate"
    if discount is None:
        return f"{label}: missing high discount rate"
    if not cusip:
        return f"{label}: missing CUSIP"
    if not maturity:
        return f"{label}: missing maturity"
    return {
        "term": label,
        "investment_rate_pct": investment,
        "high_discount_rate_pct": discount,
        "auction_date": close,
        "maturity": maturity,
        "cusip": cusip,
        "source_name": AUCTION_SOURCE_NAME,
        "source_url": AUCTION_SOURCE_URL,
    }

def refresh_auctions(path: Path, fetch_records, now: datetime, max_age_days=None):
    try:
        records = fetch_records()
    except SystemExit:
        raise
    except (OSError, TimeoutError, ValueError) as exc:
        raise SystemExit(f"Treasury auction feed failed; auction rows not updated. {exc}") from exc
    rows = select_auctions(records, now.date(), max_age_days=max_age_days)
    data = json.loads(path.read_text())
    data["tbills_auctions"] = rows
    write_json(path, data)
    return rows

def refresh_all(path: Path, fetch_text, fetch_records, now: datetime):
    """Update daily quotes and auction rows. Each feed can fail on its own.

    Daily XML selection is unchanged. Auction validation runs only after a
    successful read, and a failure leaves the auction array already on disk.
    """
    daily = None
    auctions = None
    errors = []
    try:
        daily = refresh_file(path, fetch_text, now)
    except SystemExit as exc:
        errors.append(str(exc))
    try:
        auctions = refresh_auctions(path, fetch_records, now)
    except SystemExit as exc:
        errors.append(str(exc))
    if daily is None and auctions is None:
        raise SystemExit("Treasury feeds failed; rates.json not updated. " + " | ".join(errors))
    return daily, auctions, errors

def main():
    et = ZoneInfo("America/New_York")
    now = datetime.now(et)
    daily, auctions, errors = refresh_all(OUT, fetch, fetch_auctions, now)
    if daily:
        as_of, rows = daily
        print(f"ok as_of={as_of} rows={len(rows)}")
    if auctions:
        summary = ",".join(
            f"{row['term']}:{row['auction_date']}:{row['cusip']}:{row['investment_rate_pct']}"
            for row in auctions
        )
        print(f"ok auctions={summary}")
    for err in errors:
        print(err, file=sys.stderr)

if __name__ == "__main__":
    main()
