"""Offline administrator entrypoint. Never import the server or initialize its DB."""
import argparse
from contextlib import ExitStack
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import subprocess
import sys

KEY = re.compile(r"^(?:case-evidence|evidence-staging)/[a-f0-9]{32}$")
CONFIRM_OFFLINE = "ALL-EVIDENCE-SERVICES-STOPPED"


class CleanupRefused(ValueError):
    """Safe, operator-facing error (no raw database or cloud error content)."""


def keys_in(value):
    if isinstance(value, str):
        if KEY.fullmatch(value):
            yield value
    elif isinstance(value, dict):
        # Historical assessment snapshots may keep only attachment IDs.
        if "attachmentIds" in value:
            ids = value["attachmentIds"]
            if not isinstance(ids, list) or any(
                not isinstance(uid, str) or not re.fullmatch(r"[a-f0-9]{32}", uid) for uid in ids
            ):
                raise CleanupRefused("Invalid historical attachment identifiers.")
            for uid in ids:
                yield "case-evidence/" + uid
        for child in value.values():
            yield from keys_in(child)
    elif isinstance(value, list):
        for child in value:
            yield from keys_in(child)


def read_references(db, backup=False):
    """Fail closed on unreadable metadata; never infer an upload has expired."""
    if db.execute("PRAGMA quick_check").fetchall() != [("ok",)]:
        raise CleanupRefused("Database integrity check failed.")
    tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if "cases" not in tables or (not backup and "evidence_uploads" not in tables):
        raise CleanupRefused("Unsupported database schema; no cleanup is safe.")
    protected = {}

    def protect(key, reason):
        protected.setdefault(key, set()).add(reason)

    linked = set()
    for (body,) in db.execute("SELECT body FROM cases"):
        case = json.loads(body)
        if not isinstance(case, dict) or not isinstance(case.get("attachments", []), list):
            raise CleanupRefused("Invalid case metadata.")
        for attachment in case.get("attachments", []):
            key = attachment["objectKey"]
            if not isinstance(key, str) or not KEY.fullmatch(key):
                raise CleanupRefused("Invalid attachment storage key.")
            linked.add(key)
        for key in keys_in(case):
            protect(key, "backup-reference" if backup else "attachment-reference")
    # Keep historical audit/ledger references even if a case was removed manually.
    for table in ("audit", "ledger"):
        if table in tables:
            for (detail,) in db.execute(f"SELECT detail FROM {table}"):
                for key in keys_in(json.loads(detail)):
                    protect(key, "backup-reference" if backup else "historical-reference")
    if "evidence_uploads" in tables:
        for (body,) in db.execute("SELECT body FROM evidence_uploads"):
            ticket = json.loads(body)
            for field, prefix in (("objectKey", "case-evidence/"), ("stagingKey", "evidence-staging/")):
                key = ticket[field]
                if not isinstance(key, str) or not KEY.fullmatch(key) or not key.startswith(prefix):
                    raise CleanupRefused("Invalid upload storage key.")
            # Finalized live tickets no longer need staging. Backups stay conservative.
            if backup or ticket["objectKey"] not in linked:
                for key in keys_in(ticket):
                    protect(key, "backup-upload" if backup else "retryable-upload")
            else:
                protect(ticket["objectKey"], "attachment-reference")
    return protected


def parser():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--db", action="append", required=True, help="Every active SQLite DB sharing this storage; repeatable")
    p.add_argument("--backup", action="append", default=[], help="Every retained/restorable SQLite backup; repeatable")
    p.add_argument("--retention-days", type=int, default=90, help="Minimum age; default 90, minimum 30 days")
    mode = p.add_mutually_exclusive_group(required=True)
    mode.add_argument("--report", help="Dry-run: create a new JSON plan (never overwrites)")
    mode.add_argument("--apply", help="Apply only candidates from this dry-run JSON plan")
    p.add_argument("--backups-complete", action="store_true", help="Confirm all retained backups and active DBs are listed")
    p.add_argument("--offline-confirmation", help=f"Apply requires {CONFIRM_OFFLINE}")
    p.add_argument("--confirm", help="Apply requires DELETE-EVIDENCE-<plan SHA256> printed by dry-run")
    return p


def main(argv=None):
    args = parser().parse_args(argv)
    if args.retention_days < 30:
        raise CleanupRefused("Retention must be at least 30 days.")
    if args.apply and (not args.backups_complete or args.offline_confirmation != CONFIRM_OFFLINE or not args.confirm):
        raise CleanupRefused("Apply requires complete backup inventory, offline confirmation and the exact plan confirmation.")
    if args.report and (args.confirm or args.offline_confirmation):
        raise CleanupRefused("Deletion confirmations are only valid with --apply.")
    active = sorted({Path(p).resolve(strict=True) for p in args.db})
    backups = sorted({Path(p).resolve(strict=True) for p in args.backup})
    if set(active) & set(backups):
        raise CleanupRefused("A backup must not also be an active database.")
    protected = {}
    with ExitStack() as stack:
        # Acquire all writer locks before reading any metadata; held through deletion.
        # No rows are changed. Read-only dry-run does not block normal uploads.
        for path, backup in [(p, False) for p in active] + [(p, True) for p in backups]:
            mode = "rw" if args.apply and not backup else "ro"
            db = sqlite3.connect(path.as_uri() + f"?mode={mode}", uri=True, timeout=1)
            stack.callback(db.close)
            db.execute("BEGIN IMMEDIATE" if mode == "rw" else "BEGIN")
            for key, reasons in read_references(db, backup).items():
                protected.setdefault(key, set()).update(reasons)
        config = {
            "protected": {key: sorted(reasons) for key, reasons in protected.items()},
            "inventory": hashlib.sha256(json.dumps({
                "active": [str(p) for p in active], "backups": [str(p) for p in backups],
            }, sort_keys=True).encode()).hexdigest(),
            "retentionDays": args.retention_days,
            "backupsComplete": args.backups_complete,
            "report": args.report, "apply": args.apply, "confirm": args.confirm,
        }
        worker = Path(__file__).resolve().parents[1] / "tools" / "evidence-cleanup.mjs"
        result = subprocess.run(["node", str(worker)], input=json.dumps(config), text=True, check=False)
        if result.returncode:
            raise CleanupRefused("Cleanup stopped. Inspect its report/output; do not retry deletion without a fresh dry-run.")


if __name__ == "__main__":
    try:
        main()
    except CleanupRefused as error:
        print(f"Cleanup refused: {error}", file=sys.stderr)
        sys.exit(1)
    except (ValueError, OSError, sqlite3.Error, KeyError, TypeError) as error:
        # Never print storage SDK exceptions, credentials, DB content or signed URLs.
        print(f"Cleanup refused: {type(error).__name__}. Check arguments, database schema/integrity and backup inventory.", file=sys.stderr)
        sys.exit(1)
