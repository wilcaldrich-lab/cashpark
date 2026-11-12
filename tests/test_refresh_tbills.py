"""Treasury daily-bill parser: live file shape and missing yields."""
from __future__ import annotations

import json
import tempfile
import unittest
import urllib.error
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from scripts.refresh_tbills import choose_daily_rows, fetch, parse, refresh_file

ROOT = Path(__file__).resolve().parents[1]
RATES = ROOT / "data" / "rates.json"

BOTH = """<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices"
      xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata">
  <entry>
    <content type="application/xml">
      <m:properties>
        <d:INDEX_DATE>2026-11-06T00:00:00</d:INDEX_DATE>
        <d:ROUND_B1_CLOSE_4WK_2>3.88</d:ROUND_B1_CLOSE_4WK_2>
        <d:ROUND_B1_YIELD_4WK_2>3.95</d:ROUND_B1_YIELD_4WK_2>
        <d:MATURITY_DATE_4WK>2026-12-08T00:00:00</d:MATURITY_DATE_4WK>
        <d:CS_4WK_CLOSE_AVG>9.99</d:CS_4WK_CLOSE_AVG>
        <d:CS_4WK_YIELD_AVG>9.99</d:CS_4WK_YIELD_AVG>
        <d:ROUND_B1_CLOSE_13WK_2>4.01</d:ROUND_B1_CLOSE_13WK_2>
        <d:ROUND_B1_YIELD_13WK_2 m:null="true"></d:ROUND_B1_YIELD_13WK_2>
      </m:properties>
    </content>
  </entry>
</feed>
"""

AVG_ONLY = """<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices"
      xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata">
  <entry>
    <content type="application/xml">
      <m:properties>
        <d:INDEX_DATE>2026-11-06T00:00:00</d:INDEX_DATE>
        <d:CS_4WK_CLOSE_AVG>3.88</d:CS_4WK_CLOSE_AVG>
        <d:CS_4WK_YIELD_AVG>3.95</d:CS_4WK_YIELD_AVG>
      </m:properties>
    </content>
  </entry>
</feed>
"""


class RefreshTbillTests(unittest.TestCase):
    def test_rounded_quotes_not_averages(self):
        as_of, rows = parse(BOTH, 2026)
        self.assertEqual(as_of, "2026-11-06")
        by_term = {row["term"]: row for row in rows}
        four = by_term["4-Week"]
        self.assertEqual(four["discount_pct"], 3.88)
        self.assertEqual(four["coupon_equivalent_yield_pct"], 3.95)
        self.assertEqual(four["rate_pct"], 3.95)
        self.assertEqual(four["maturity"], "2026-12-08")
        self.assertIn("coupon", four["metric"].lower())
        self.assertIn("bank discount", four["metric"].lower())
        thirteen = by_term["13-Week"]
        self.assertEqual(thirteen["discount_pct"], 4.01)
        self.assertNotIn("coupon_equivalent_yield_pct", thirteen)
        self.assertNotIn("rate_pct", thirteen)
        self.assertEqual(thirteen["metric"], "Bank discount rate")
        self.assertNotIn("9.99", json.dumps(rows))

    def test_average_series_is_not_a_daily_quote(self):
        with self.assertRaises(SystemExit):
            parse(AVG_ONLY, 2026)

    def test_live_rates_file_shape(self):
        data = json.loads(RATES.read_text())
        rows = data["tbills_daily"]
        self.assertGreaterEqual(len(rows), 1)
        for row in rows:
            self.assertTrue(row.get("term"))
            self.assertRegex(row.get("as_of", ""), r"^\d{4}-\d{2}-\d{2}$")
            self.assertTrue(row.get("source_url"))
            numbers = [
                row.get("discount_pct"),
                row.get("coupon_equivalent_yield_pct"),
            ]
            present = [n for n in numbers if isinstance(n, (int, float))]
            self.assertTrue(present, row)
            for n in present:
                self.assertEqual(n, n)  # not NaN
            metric = (row.get("metric") or "").lower()
            if "coupon" in metric or "equivalent" in metric:
                self.assertIsInstance(row.get("coupon_equivalent_yield_pct"), (int, float))
            if row.get("rate_pct") is not None:
                self.assertEqual(row["rate_pct"], row.get("coupon_equivalent_yield_pct"))
            blob = json.dumps(row)
            self.assertNotIn("NaN", blob)
            self.assertNotIn("undefined", blob)

    def test_live_auctions_keep_rates_and_have_close_dates(self):
        data = json.loads(RATES.read_text())
        rows = data["tbills_auctions"]
        self.assertGreaterEqual(len(rows), 1)
        for row in rows:
            self.assertRegex(row.get("auction_date") or "", r"^\d{4}-\d{2}-\d{2}$")
            self.assertLessEqual(row["auction_date"], "2026-11-12")
            inv = row["investment_rate_pct"]
            disc = row["high_discount_rate_pct"]
            self.assertIsInstance(inv, (int, float))
            self.assertIsInstance(disc, (int, float))
            self.assertEqual(inv, inv)
            self.assertEqual(disc, disc)
            self.assertTrue(row.get("cusip"))
            self.assertTrue(row.get("maturity"))


class FeedFailureTests(unittest.TestCase):
    def test_current_year_wins_when_fresh(self):
        calls = []

        def fetch_text(year):
            calls.append(year)
            return BOTH

        as_of, rows = choose_daily_rows(datetime(2026, 11, 10).date(), fetch_text)
        self.assertEqual(calls, [2026])
        self.assertEqual(as_of, "2026-11-06")
        self.assertEqual(rows[0]["rate_pct"], 3.95)

    def test_empty_current_year_uses_a_fresh_prior_year(self):
        def fetch_text(year):
            if year == 2026:
                raise SystemExit("No ATOM entries in Treasury XML")
            return BOTH

        as_of, _rows = choose_daily_rows(datetime(2026, 11, 10).date(), fetch_text)
        self.assertEqual(as_of, "2026-11-06")

    def test_stale_fallback_does_not_publish(self):
        def fetch_text(year):
            if year == 2026:
                raise urllib.error.URLError("down")
            return BOTH

        with self.assertRaises(SystemExit):
            choose_daily_rows(datetime(2026, 12, 20).date(), fetch_text)

    def test_future_quote_is_rejected(self):
        def fetch_text(_year):
            return BOTH

        with self.assertRaises(SystemExit):
            choose_daily_rows(datetime(2026, 11, 1).date(), fetch_text)

    def test_failed_feed_does_not_touch_the_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "rates.json"
            original = '{"tbills_daily": []}\n'
            path.write_text(original)

            def fetch_text(_year):
                raise urllib.error.URLError("down")

            now = datetime(2026, 11, 12, 9, 30, tzinfo=ZoneInfo("America/New_York"))
            with self.assertRaises(SystemExit):
                refresh_file(path, fetch_text, now)
            self.assertEqual(path.read_text(), original)
            self.assertFalse(path.with_suffix(".json.tmp").exists())

    def test_fetch_retries_then_returns(self):
        calls = {"n": 0}

        class Resp:
            def read(self):
                return b"<ok/>"

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

        def urlopen(_req, timeout=0):
            calls["n"] += 1
            if calls["n"] < 3:
                raise urllib.error.URLError("nope")
            return Resp()

        text = fetch(2026, urlopen=urlopen, attempts=3, sleep=lambda _s: None)
        self.assertEqual(text, "<ok/>")
        self.assertEqual(calls["n"], 3)


if __name__ == "__main__":
    unittest.main()
