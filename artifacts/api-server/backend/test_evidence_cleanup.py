"""Only disposable SQLite fixtures: never inspect or mutate walkthrough storage."""
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

import evidence_cleanup as cleanup


def key(kind, digit="a"):
    return f"{kind}/" + digit * 32


class CleanupTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.addCleanup(self.db.close)
        self.db.executescript("""
            CREATE TABLE cases(body TEXT);
            CREATE TABLE evidence_uploads(body TEXT);
            CREATE TABLE audit(detail TEXT);
            CREATE TABLE ledger(detail TEXT);
        """)

    def insert(self, table, body):
        self.db.execute(f"INSERT INTO {table} VALUES(?)", (json.dumps(body),))

    def ticket(self, digit="a"):
        return {"objectKey": key("case-evidence", digit), "stagingKey": key("evidence-staging", digit)}

    def test_unfinished_uploads_protected_without_invented_expiry(self):
        ticket = self.ticket()
        self.insert("evidence_uploads", ticket)
        refs = cleanup.read_references(self.db)
        self.assertEqual(refs[ticket["objectKey"]], {"retryable-upload"})
        self.assertIn(ticket["stagingKey"], refs)

    def test_finalized_link_and_history_protected_staging_may_be_cleaned(self):
        ticket = self.ticket()
        self.insert("cases", {"status": "closed", "attachments": [{"objectKey": ticket["objectKey"]}]})
        self.insert("evidence_uploads", ticket)
        self.insert("audit", {"old": {"objectKey": key("case-evidence", "b")}})
        self.insert("ledger", {"objectKey": key("case-evidence", "c")})
        refs = cleanup.read_references(self.db)
        self.assertIn(ticket["objectKey"], refs)
        self.assertNotIn(ticket["stagingKey"], refs)
        self.assertIn(key("case-evidence", "b"), refs)
        self.assertIn(key("case-evidence", "c"), refs)

    def test_backup_keeps_both_ticket_objects_even_after_finalize(self):
        ticket = self.ticket()
        self.insert("cases", {"attachments": [{"objectKey": ticket["objectKey"]}]})
        self.insert("evidence_uploads", ticket)
        refs = cleanup.read_references(self.db, backup=True)
        self.assertIn("backup-reference", refs[ticket["objectKey"]])
        self.assertIn("backup-upload", refs[ticket["stagingKey"]])

    def test_old_backup_without_upload_table_is_supported_but_not_active_db(self):
        self.db.execute("DROP TABLE evidence_uploads")
        self.assertEqual(cleanup.read_references(self.db, backup=True), {})
        with self.assertRaises(ValueError):
            cleanup.read_references(self.db)

    def test_historical_snapshot_ids_keep_files_when_full_metadata_is_missing(self):
        self.insert("cases", {"versions": [{"attachmentIds": ["b" * 32]}]})
        self.assertIn(key("case-evidence", "b"), cleanup.read_references(self.db))

    def test_corrupt_metadata_fails_closed(self):
        for body in ["not JSON", '{"attachments":[{}]}', '{"attachments":false}']:
            with self.subTest(body=body):
                self.db.execute("DELETE FROM cases")
                self.db.execute("INSERT INTO cases VALUES(?)", (body,))
                with self.assertRaises((ValueError, KeyError, TypeError)):
                    cleanup.read_references(self.db)

    def test_short_retention_and_missing_apply_confirmations_never_start_worker(self):
        with patch.object(cleanup.subprocess, "run") as worker:
            for extra in [["--report", "unused", "--retention-days", "0"],
                          ["--apply", "unused"], ["--apply", "unused", "--backups-complete"]]:
                with self.assertRaises(ValueError):
                    cleanup.main(["--db", "missing", *extra])
            worker.assert_not_called()

    def test_apply_holds_writer_lock_for_entire_worker_without_mutating_rows(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "db.sqlite3"
            db = sqlite3.connect(path)
            db.executescript("CREATE TABLE cases(body TEXT); CREATE TABLE evidence_uploads(body TEXT);")
            db.commit()
            db.close()

            def worker(*args, **kwargs):
                config = json.loads(kwargs["input"])
                self.assertTrue(config["backupsComplete"])
                other = sqlite3.connect(path, timeout=0)
                try:
                    with self.assertRaises(sqlite3.OperationalError):
                        other.execute("INSERT INTO cases VALUES('{}')")
                finally:
                    other.close()
                return type("Result", (), {"returncode": 0})()

            with patch.object(cleanup.subprocess, "run", side_effect=worker):
                cleanup.main(["--db", str(path), "--apply", "plan.json", "--backups-complete",
                              "--offline-confirmation", cleanup.CONFIRM_OFFLINE, "--confirm", "test"])
            other = sqlite3.connect(path)
            self.assertEqual(other.execute("SELECT COUNT(*) FROM cases").fetchone()[0], 0)
            other.execute("INSERT INTO cases VALUES('{}')")
            other.rollback()
            other.close()

    def test_missing_backup_aborts_instead_of_ignoring_it(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "db.sqlite3"
            sqlite3.connect(path).close()
            with patch.object(cleanup.subprocess, "run") as worker:
                with self.assertRaises(FileNotFoundError):
                    cleanup.main(["--db", str(path), "--backup", str(path) + ".missing", "--report", "unused"])
                worker.assert_not_called()
