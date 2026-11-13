"""Auction selection: latest completed bill per term, without a live API call."""
from __future__ import annotations

import json
import tempfile
import unittest
import urllib.error
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from scripts.refresh_tbills import (
    TERMS,
    fetch_auctions,
    refresh_all,
    refresh_auctions,
    select_auctions,
)

TODAY = date(2026, 11, 13)
DAILY_XML = """<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices"
      xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata">
  <entry>
    <content type="application/xml">
      <m:properties>
        <d:INDEX_DATE>2026-11-12T00:00:00</d:INDEX_DATE>
        <d:ROUND_B1_CLOSE_4WK_2>3.97</d:ROUND_B1_CLOSE_4WK_2>
        <d:ROUND_B1_YIELD_4WK_2>4.04</d:ROUND_B1_YIELD_4WK_2>
        <d:MATURITY_DATE_4WK>2026-12-15T00:00:00</d:MATURITY_DATE_4WK>
      </m:properties>
    </content>
  </entry>
</feed>
"""


def auction(term, *, close, investment="4.000", high="3.900", cusip, maturity="2027-02-01", **extra):
    row = {
        "type": "Bill",
        "securityType": "Bill",
        "securityTerm": term,
        "cashManagementBill": "No",
        "competitiveAuctionCloseDate": f"{close}T00:00:00",
        "investmentRate": investment,
        "highRate": high,
        "cusip": cusip,
        "maturityDate": f"{maturity}T00:00:00",
    }
    row.update(extra)
    return row


def book(overrides=None, extras=None):
    overrides = overrides or {}
    rows = []
    for label, _code in TERMS:
        spec = {
            "close": "2026-11-12",
            "investment": "4.000",
            "high": "3.900",
            "cusip": "912797" + label.replace("-", "")[:3].upper(),
            "maturity": "2027-02-01",
        }
        spec.update(overrides.get(label, {}))
        rows.append(auction(label, **spec))
    rows.extend(extras or [])
    return rows


class Resp:
    def __init__(self, body):
        self.body = body

    def read(self):
        return self.body

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


class AuctionSelectionTests(unittest.TestCase):
    def test_known_four_week_auction_beats_older_and_unpublished(self):
        records = book(
            {
                "4-Week": {
                    "close": "2026-11-12",
                    "investment": "4.022",
                    "high": "3.955",
                    "cusip": "912797WF0",
                    "maturity": "2026-12-15",
                }
            },
            extras=[
                auction(
                    "4-Week",
                    close="2026-11-05",
                    investment="3.956",
                    high="3.890",
                    cusip="912797WE3",
                    maturity="2026-12-08",
                ),
                auction(
                    "4-Week",
                    close="2026-11-13",
                    investment="N/A",
                    high="9.000",
                    cusip="912797NEW",
                    maturity="2026-12-16",
                ),
            ],
        )
        four = next(row for row in select_auctions(records, TODAY) if row["term"] == "4-Week")
        self.assertEqual(
            four,
            {
                "term": "4-Week",
                "investment_rate_pct": 4.022,
                "high_discount_rate_pct": 3.955,
                "auction_date": "2026-11-12",
                "maturity": "2026-12-15",
                "cusip": "912797WF0",
                "source_name": "TreasuryDirect auctioned securities API",
                "source_url": "https://www.treasurydirect.gov/TA_WS/securities/auctioned?format=json&type=Bill",
            },
        )

    def test_fifty_two_week_cycle_is_inside_its_window(self):
        records = book({"52-Week": {"close": "2026-10-27", "cusip": "912797WT0", "investment": "4.496", "high": "4.290"}})
        rows = select_auctions(records, TODAY)
        fifty = next(row for row in rows if row["term"] == "52-Week")
        self.assertEqual(fifty["auction_date"], "2026-10-27")
        self.assertEqual(fifty["cusip"], "912797WT0")
        self.assertEqual(fifty["investment_rate_pct"], 4.496)
        self.assertEqual(fifty["high_discount_rate_pct"], 4.29)

    def test_term_alias_and_close_date_preference(self):
        records = book()
        for record in records:
            record["term"] = record.pop("securityTerm")
            if record["term"] == "8-Week":
                record["auctionDate"] = "2026-10-01T00:00:00"
        rows = select_auctions(records, date(2026, 11, 12))
        self.assertEqual([row["term"] for row in rows], [label for label, _code in TERMS])
        eight = next(row for row in rows if row["term"] == "8-Week")
        self.assertEqual(eight["auction_date"], "2026-11-12")

    def test_auction_date_field_used_when_close_date_is_absent(self):
        records = book()
        for record in records:
            if record["securityTerm"] == "6-Week":
                record.pop("competitiveAuctionCloseDate")
                record["auctionDate"] = "2026-11-09"
        six = next(row for row in select_auctions(records, TODAY) if row["term"] == "6-Week")
        self.assertEqual(six["auction_date"], "2026-11-09")

    def test_high_discount_field_beats_high_rate(self):
        records = book({"17-Week": {"highDiscountRate": "4.225", "high": "1.000", "investment": "4.344"}})
        seventeen = next(row for row in select_auctions(records, TODAY) if row["term"] == "17-Week")
        self.assertEqual(seventeen["high_discount_rate_pct"], 4.225)
        self.assertEqual(seventeen["investment_rate_pct"], 4.344)

    def test_cash_management_bill_does_not_replace_the_term(self):
        records = book(
            extras=[
                auction(
                    "4-Week",
                    close="2026-11-12",
                    investment="9.999",
                    high="9.999",
                    cusip="912797ZZ9",
                    cashManagementBill="Yes",
                )
            ]
        )
        four = next(row for row in select_auctions(records, TODAY) if row["term"] == "4-Week")
        self.assertNotEqual(four["cusip"], "912797ZZ9")
        self.assertEqual(four["investment_rate_pct"], 4.0)

    def test_future_auction_is_refused(self):
        records = book({"4-Week": {"close": "2026-11-20", "investment": "4.022", "cusip": "912797WF0"}})
        with self.assertRaisesRegex(SystemExit, "4-Week"):
            select_auctions(records, TODAY)

    def test_stale_weekly_and_stale_fifty_two_week_are_refused(self):
        weekly = book({"8-Week": {"close": "2026-10-20"}})
        with self.assertRaisesRegex(SystemExit, "8-Week"):
            select_auctions(weekly, TODAY)
        aged = book({"52-Week": {"close": "2026-09-01"}})
        with self.assertRaisesRegex(SystemExit, "52-Week"):
            select_auctions(aged, TODAY)

    def test_missing_cusip_or_term_is_refused(self):
        with self.assertRaisesRegex(SystemExit, "13-Week"):
            select_auctions(book({"13-Week": {"cusip": "  "}}), TODAY)
        with self.assertRaisesRegex(SystemExit, "26-Week"):
            select_auctions(book({"26-Week": {"maturity": ""}}), TODAY)
        short = [row for row in book() if row["securityTerm"] != "52-Week"]
        with self.assertRaisesRegex(SystemExit, "52-Week"):
            select_auctions(short, TODAY)


class AuctionWriteTests(unittest.TestCase):
    def _path(self, directory):
        path = Path(directory) / "rates.json"
        original = {
            "hysa": [{"name": "Keep me", "rate_pct": 3.2}],
            "tbills_daily": [{"term": "4-Week", "rate_pct": 1.11, "as_of": "2026-11-01"}],
            "tbills_auctions": [
                {
                    "term": "4-Week",
                    "investment_rate_pct": 1.0,
                    "auction_date": "2026-01-01",
                    "cusip": "OLD",
                }
            ],
        }
        path.write_text(json.dumps(original, indent=2) + "\n")
        return path, path.read_text()

    def test_failed_feed_leaves_auction_rows_and_other_rates(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, original = self._path(tmp)

            def fetch_records():
                raise urllib.error.URLError("reset")

            now = datetime(2026, 11, 13, 9, 30, tzinfo=ZoneInfo("America/New_York"))
            with self.assertRaises(SystemExit):
                refresh_auctions(path, fetch_records, now)
            self.assertEqual(path.read_text(), original)
            self.assertFalse(path.with_suffix(".json.tmp").exists())

    def test_stale_payload_does_not_write(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, original = self._path(tmp)
            now = datetime(2026, 11, 13, tzinfo=ZoneInfo("America/New_York"))
            with self.assertRaises(SystemExit):
                refresh_auctions(path, lambda: book({"4-Week": {"close": "2026-10-01"}}), now)
            self.assertEqual(path.read_text(), original)

    def test_success_replaces_auctions_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, _original = self._path(tmp)
            now = datetime(2026, 11, 13, tzinfo=ZoneInfo("America/New_York"))
            rows = refresh_auctions(path, lambda: book({"4-Week": {"cusip": "912797WF0", "investment": "4.022"}}), now)
            saved = json.loads(path.read_text())
            self.assertEqual(saved["hysa"][0]["rate_pct"], 3.2)
            self.assertEqual(saved["tbills_daily"][0]["rate_pct"], 1.11)
            self.assertEqual(saved["tbills_auctions"][0]["cusip"], "912797WF0")
            self.assertEqual(saved["tbills_auctions"][0]["investment_rate_pct"], 4.022)
            self.assertEqual(len(saved["tbills_auctions"]), len(rows))

    def test_fetch_retries_network_errors(self):
        calls = {"n": 0}
        body = json.dumps(book()).encode()

        def urlopen(req, timeout=0):
            calls["n"] += 1
            self.assertIn("/TA_WS/securities/auctioned", req.full_url)
            self.assertEqual(timeout, 90)
            if calls["n"] < 3:
                raise urllib.error.URLError("reset")
            return Resp(body)

        records = fetch_auctions(urlopen=urlopen, attempts=3, sleep=lambda _s: None)
        self.assertEqual(calls["n"], 3)
        self.assertEqual(len(records), len(TERMS))

    def test_daily_update_survives_an_auction_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, original = self._path(tmp)
            now = datetime(2026, 11, 13, 9, 30, tzinfo=ZoneInfo("America/New_York"))

            def fetch_records():
                raise urllib.error.URLError("down")

            daily, auctions, errors = refresh_all(path, lambda _year: DAILY_XML, fetch_records, now)
            saved = json.loads(path.read_text())
            self.assertIsNotNone(daily)
            self.assertIsNone(auctions)
            self.assertTrue(errors)
            self.assertEqual(saved["tbills_daily"][0]["rate_pct"], 4.04)
            self.assertEqual(saved["tbills_auctions"][0]["cusip"], "OLD")
            self.assertEqual(saved["hysa"][0]["rate_pct"], 3.2)
            self.assertNotEqual(path.read_text(), original)

    def test_auction_update_survives_a_daily_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, _original = self._path(tmp)
            now = datetime(2026, 11, 13, 9, 30, tzinfo=ZoneInfo("America/New_York"))

            def fetch_text(_year):
                raise urllib.error.URLError("down")

            daily, auctions, errors = refresh_all(
                path,
                fetch_text,
                lambda: book({"4-Week": {"cusip": "912797WF0"}}),
                now,
            )
            saved = json.loads(path.read_text())
            self.assertIsNone(daily)
            self.assertIsNotNone(auctions)
            self.assertTrue(errors)
            self.assertEqual(saved["tbills_daily"][0]["rate_pct"], 1.11)
            self.assertEqual(saved["tbills_auctions"][0]["cusip"], "912797WF0")
            self.assertEqual(saved["hysa"][0]["name"], "Keep me")

    def test_both_feeds_failing_leaves_the_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, original = self._path(tmp)
            now = datetime(2026, 11, 13, 9, 30, tzinfo=ZoneInfo("America/New_York"))

            def boom(_year=None):
                raise urllib.error.URLError("down")

            with self.assertRaises(SystemExit):
                refresh_all(path, boom, boom, now)
            self.assertEqual(path.read_text(), original)


if __name__ == "__main__":
    unittest.main()
