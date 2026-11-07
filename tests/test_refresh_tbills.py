"""Treasury daily-bill parser: live file shape and missing yields."""
from __future__ import annotations

import json
import unittest
from pathlib import Path

from scripts.refresh_tbills import parse

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


if __name__ == "__main__":
    unittest.main()
