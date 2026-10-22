"""Calendar reports are verified against temporary SQLite data, never the demo."""
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
import reports
import server as s
from reporting.service import summary


class SummaryReportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.old_db = s.DB
        s.DB = str(Path(self.temp.name) / "summary.sqlite3")
        s.init()
        with s.connect() as db:
            db.executemany("INSERT INTO products(id,name,recorded) VALUES(?,?,?)",
                           [("A", "Water", 50), ("B", "Biscuits", 40)])

    def tearDown(self):
        s.DB = self.old_db
        self.temp.cleanup()

    def count(self, at, product="A"):
        with s.connect() as db:
            db.execute("INSERT INTO counts(product_id,counted,actor,at) VALUES(?,43,'Staff A',?)",
                       (product, at))

    def report(self, period="daily", date=None, now="2026-10-22T12:00:00+00:00", role="manager"):
        with s.connect() as db:
            return summary(db, s.USERS[role], period, date, s, datetime.fromisoformat(now))

    def test_daily_hourly_buckets_use_malaysia_midnight(self):
        self.count("2026-10-21T15:59:59Z")  # yesterday in Malaysia
        self.count("2026-10-21T16:00:00Z")  # midnight
        self.count("2026-10-22T11:59:59Z")
        self.count("2026-10-22T12:00:00Z")  # exclusive live cutoff
        r = self.report()
        self.assertEqual((r["periodStart"], r["periodEnd"]), ("2026-10-22", "2026-10-22"))
        self.assertEqual(len(r["buckets"]), 24)
        self.assertEqual(r["totals"]["countSubmissions"], 2)
        self.assertEqual(r["buckets"][0]["counts"], 1)
        self.assertEqual(r["buckets"][19]["counts"], 1)
        self.assertTrue(r["buckets"][21]["future"])
        self.assertEqual(sum(b["counts"] for b in r["buckets"]), 2)

    def test_monthly_leap_year_and_last_day(self):
        self.count("2024-02-28T16:00:00Z")  # leap day midnight
        self.count("2024-02-29T15:59:59Z")  # end of leap day
        self.count("2024-02-29T16:00:00Z")  # next month
        r = self.report("monthly", "2024-02-18")
        self.assertEqual((r["periodStart"], r["periodEnd"]), ("2024-02-01", "2024-02-29"))
        self.assertEqual(len(r["buckets"]), 29)
        self.assertEqual(r["totals"]["countSubmissions"], 2)
        self.assertEqual(r["buckets"][-1]["counts"], 2)

    def test_yearly_month_buckets_and_product_deduplication(self):
        self.count("2025-12-31T15:59:59Z")
        self.count("2025-12-31T16:00:00Z")
        self.count("2026-01-31T16:00:00Z")
        self.count("2026-10-22T00:00:00Z", "B")
        r = self.report("yearly", "2026-09-15")
        self.assertEqual((r["periodStart"], r["periodEnd"]), ("2026-01-01", "2026-12-31"))
        self.assertEqual(len(r["buckets"]), 12)
        self.assertEqual(r["totals"]["countSubmissions"], 3)
        self.assertEqual(r["totals"]["productsCounted"], 2)
        self.assertEqual([b["counts"] for b in r["buckets"][:2]], [1, 1])
        self.assertTrue(r["buckets"][-1]["future"])

    def test_historical_period_snapshots_do_not_change_after_backdated_import(self):
        for period in ("daily", "monthly", "yearly"):
            first = self.report(period, "2025-10-01")
            self.count("2025-10-01T00:00:00Z")
            second = self.report(period, "2025-10-01")
            self.assertEqual(first, second)
            self.assertTrue(second["isFinal"])
            self.assertEqual(second["snapshotKind"], "saved")

    def test_live_periods_do_not_freeze(self):
        for period in ("daily", "monthly", "yearly"):
            self.assertFalse(self.report(period)["isFinal"])
        with s.connect() as db:
            self.assertEqual(db.execute("SELECT count(*) FROM summary_reports").fetchone()[0], 0)
        self.count("2026-10-22T01:00:00Z")
        self.assertEqual(self.report()["totals"]["countSubmissions"], 1)

    def test_weekly_adapter_preserves_existing_saved_week(self):
        self.count("2026-10-20T01:00:00Z")
        with s.connect() as db:
            old = reports.weekly(db, s.USERS["manager"], "2026-10-19", s,
                                 datetime.fromisoformat("2026-10-27T00:00:00+00:00"))
        self.count("2026-10-20T02:00:00Z")
        new = self.report("weekly", "2026-10-21", now="2026-10-27T00:00:00+00:00")
        self.assertEqual(new["totals"], old["totals"])
        self.assertEqual([b["counts"] for b in new["buckets"]], [d["counts"] for d in old["daily"]])

    def test_permissions_invalid_periods_and_future_dates(self):
        for period in ("daily", "weekly", "monthly", "yearly"):
            self.assertEqual(self.report(period, role="owner")["period"], period)
            with self.assertRaises(s.APIError) as ctx:
                self.report(period, role="staff")
            self.assertEqual(ctx.exception.status, 403)
        for period, selection in (("", None), ("quarterly", None), ("daily", ""),
                                  ("daily", "2026-02-30"), ("yearly", "2027-01-01"),
                                  ("daily", "1999-12-31"), ("weekly", "2000-01-01")):
            with self.assertRaises(s.APIError):
                self.report(period, selection)

    def test_opening_and_closing_backlog_use_period_cutoff(self):
        case = {"id": "OLD", "productId": "A", "product": "Water", "recorded": 50,
                "counted": 43, "createdAt": "2026-09-10T01:00:00Z",
                "versions": [{"createdAt": "2026-09-10T01:00:00Z", "evidenceState": "incomplete"}],
                "timeline": [], "decision": {"at": "2026-10-22T01:00:00Z", "action": "approved"}}
        with s.connect() as db:
            db.execute("INSERT INTO cases VALUES(?,?,?)", ("OLD", "A", s.dump(case)))
        month = self.report("monthly")
        self.assertEqual(month["totals"]["openingBacklog"], 1)
        self.assertEqual(month["totals"]["newCases"], 0)
        self.assertEqual(month["totals"]["closedCases"], 1)
        previous = self.report("monthly", "2026-09-01")
        self.assertEqual(previous["totals"]["closingBacklog"], 1)
        self.assertEqual(previous["followUps"][0]["ageDays"], 20)
