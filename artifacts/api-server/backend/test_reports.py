"""Report definitions, boundaries and snapshots use an isolated SQLite file."""
import json
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
import reports
import server as s


class WeeklyReportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.old_db = s.DB
        s.DB = str(Path(self.temp.name) / "reports.sqlite3")
        s.init()
        with s.connect() as db:
            db.executemany("INSERT INTO products(id,name,recorded) VALUES(?,?,?)",
                           [("A", "Tea", 20), ("B", "Coffee", 30)])

    def tearDown(self):
        s.DB = self.old_db
        self.temp.cleanup()

    def count(self, at, product="A"):
        with s.connect() as db:
            db.execute("INSERT INTO counts(product_id,counted,actor,at) VALUES(?,20,'Staff A',?)",
                       (product, at))

    def case(self, cid="C1", created="2026-10-20T02:00:00Z", state="incomplete",
             decided=None, action="approved", recorded=20, counted=15, versions=None, timeline=None):
        c = {
            "id": cid, "productId": "A", "product": "Tea", "recorded": recorded,
            "counted": counted, "createdAt": created, "createdBy": "Staff A",
            "status": "completed" if decided else "manual_review",
            "versions": versions or [{"createdAt": created, "evidenceState": state}],
            "timeline": timeline or [],
        }
        if decided:
            c["decision"] = {"at": decided, "action": action}
        with s.connect() as db:
            db.execute("INSERT INTO cases VALUES(?,?,?)", (cid, "A", s.dump(c)))
        return c

    def report(self, week="2026-10-19", clock="2026-10-21T10:00:00+00:00", role="manager"):
        with s.connect() as db:
            result = reports.weekly(db, s.USERS[role], week, s, datetime.fromisoformat(clock))
        return result

    def test_empty_and_no_snapshot_for_live_week(self):
        r = self.report()
        self.assertEqual(r["totals"]["countSubmissions"], 0)
        self.assertEqual(len(r["daily"]), 7)
        self.assertTrue(r["daily"][-1]["future"])
        self.assertFalse(r["isFinal"])
        with s.connect() as db:
            self.assertEqual(db.execute("SELECT count(*) FROM weekly_reports").fetchone()[0], 0)

    def test_matching_counts_included_and_products_deduplicated(self):
        # Matching counts do not create cases, but must count as work.
        self.count("2026-10-20T01:00:00Z")
        self.count("2026-10-20T02:00:00Z")
        self.count("2026-10-20T03:00:00Z", "B")
        r = self.report()
        self.assertEqual(r["totals"]["countSubmissions"], 3)
        self.assertEqual(r["totals"]["productsCounted"], 2)
        self.assertEqual(r["totals"]["newCases"], 0)
        self.assertEqual(r["daily"][1]["counts"], 3)

    def test_malaysia_monday_boundary_and_future_events(self):
        self.count("2026-10-18T15:59:59Z")  # Sunday local
        self.count("2026-10-18T16:00:00Z")  # Monday 00:00 local
        self.count("2026-10-20T16:00:00Z")  # Wednesday local
        self.count("2026-10-22T00:00:00Z")  # after report cutoff
        r = self.report()
        self.assertEqual(r["totals"]["countSubmissions"], 2)
        self.assertEqual([d["counts"] for d in r["daily"]], [1, 0, 1, 0, 0, 0, 0])

    def test_old_case_closed_this_week_and_backlog_balance(self):
        self.case("OLD", created="2026-10-11T00:00:00Z", decided="2026-10-20T01:00:00Z")
        self.case("AGED", created="2026-10-10T00:00:00Z")
        self.case("NEW")
        r = self.report()
        t = r["totals"]
        self.assertEqual((t["openingBacklog"], t["newCases"], t["closedCases"],
                          t["closingBacklog"], t["overdueCases"]), (2, 1, 1, 2, 1))
        self.assertEqual(t["openingBacklog"] + t["newCases"] - t["closedCases"],
                         t["closingBacklog"])
        self.assertEqual(r["decisions"]["approved"], 1)
        self.assertEqual(r["followUps"][0]["id"], "AGED")

    def test_decisions_all_actions_and_shortages_separate_from_surpluses(self):
        for i, action in enumerate(("approved", "overridden", "rejected")):
            self.case(str(i), decided="2026-10-20T03:00:00Z", action=action,
                      counted=25 if i == 1 else 15)
        r = self.report()
        self.assertEqual(r["decisions"], {"approved": 1, "overridden": 1, "rejected": 1})
        self.assertEqual(r["discrepancies"], {"shortageUnits": 10, "surplusUnits": 5})
        self.assertEqual(r["totals"]["closingBacklog"], 0)

    def test_historical_status_ignores_later_reassessment_and_decision(self):
        self.case(created="2026-10-15T00:00:00Z", decided="2026-10-20T00:00:00Z",
                  versions=[
                      {"createdAt": "2026-10-15T00:00:00Z", "evidenceState": "incomplete"},
                      {"createdAt": "2026-10-20T00:00:00Z", "evidenceState": "supported"},
                  ])
        r = self.report("2026-10-12")
        self.assertEqual(r["followUps"][0]["status"], "manual_review")
        self.assertEqual(r["totals"]["closedCases"], 0)
        self.assertEqual(r["totals"]["closingBacklog"], 1)
        self.assertTrue(r["isFinal"])

    def test_review_request_and_later_reassessment(self):
        self.case(created="2026-10-15T00:00:00Z", state="supported",
                  timeline=[{"at": "2026-10-16T00:00:00Z", "summary": "Review requested: Check receipt"}],
                  versions=[
                      {"createdAt": "2026-10-15T00:00:00Z", "evidenceState": "supported"},
                      {"createdAt": "2026-10-20T00:00:00Z", "evidenceState": "supported"},
                  ])
        self.assertEqual(self.report("2026-10-12")["followUps"][0]["status"], "needs_review")
        self.assertEqual(self.report()["followUps"][0]["status"], "pending_approval")

    def test_historical_snapshot_is_frozen_and_metadata_current_week_advances(self):
        self.count("2026-10-13T00:00:00Z")
        first = self.report("2026-10-12")
        self.count("2026-10-13T01:00:00Z")  # later imported/backdated event
        second = self.report("2026-10-12", clock="2026-11-01T00:00:00+00:00")
        self.assertEqual(second["totals"]["countSubmissions"], 1)
        self.assertEqual(first["generatedAt"], second["generatedAt"])
        self.assertNotEqual(first["currentWeek"], second["currentWeek"])
        self.assertEqual(second["snapshotKind"], "saved")
        self.assertTrue(any("first view" in note for note in second["notes"]))

    def test_end_boundary_is_exclusive(self):
        self.count("2026-10-18T15:59:59.999999Z")
        self.count("2026-10-18T16:00:00Z")
        r = self.report("2026-10-12")
        self.assertEqual(r["totals"]["countSubmissions"], 1)
        self.assertEqual(r["daily"][-1]["counts"], 1)

    def test_manager_owner_allowed_staff_denied_before_snapshot_read(self):
        self.report("2026-10-12", role="owner")
        with self.assertRaises(s.APIError) as err:
            self.report("2026-10-12", role="staff")
        self.assertEqual(err.exception.status, 403)

    def test_invalid_week_or_future_week(self):
        for week in ("", "2026-10-20", "2026-10-26", "2026-02-30", "2026-1-19",
                     "1999-12-27", "not-a-date"):
            with self.subTest(week=week), self.assertRaises(s.APIError):
                self.report(week)
        self.assertEqual(self.report(None)["weekStart"], "2026-10-19")


if __name__ == "__main__":
    unittest.main()
