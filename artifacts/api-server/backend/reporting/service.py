"""Daily/monthly/yearly reports and an adapter for preserved weekly snapshots."""
import json
from datetime import datetime, timedelta, timezone
import reports as legacy_weekly
from .activity import aggregate
from .periods import LOCAL, at_midnight, buckets, window


def init(db):
    db.execute("""CREATE TABLE IF NOT EXISTS summary_reports(
        period TEXT NOT NULL, period_start TEXT NOT NULL, body TEXT NOT NULL,
        PRIMARY KEY(period,period_start))""")


def summary(db, user, period, selection, api, clock=None):
    api.require(user, ("manager", "owner"))
    now = (clock or datetime.now(timezone.utc)).astimezone(timezone.utc)
    period = "weekly" if period is None else period
    try:
        first, following, current = window(period, selection, now)
    except (ValueError, TypeError) as error:
        raise api.APIError(str(error) or "Choose a valid reporting period.")
    if period == "weekly":
        # Existing saved weeks remain authoritative; never recompute their frozen data.
        saved = legacy_weekly.weekly(db, user, first.isoformat(), api, clock=now)
        days = buckets(first, following, period, now)
        for target, source in zip(days, saved["daily"]):
            for key in ("counts", "newCases", "closedCases", "future"):
                target[key] = source[key]
        return {
            **{k: saved[k] for k in ("timezone", "asOf", "generatedAt", "isFinal",
                                    "snapshotKind", "totals", "decisions",
                                    "discrepancies", "followUps")},
            "period": period, "periodStart": first.isoformat(),
            "periodEnd": (following - timedelta(days=1)).isoformat(),
            "currentPeriodStart": current.isoformat(), "buckets": days,
            "notes": _notes(saved["isFinal"]),
        }
    start = at_midnight(first).astimezone(timezone.utc)
    end = at_midnight(following).astimezone(timezone.utc)
    final = end <= now
    if final:
        row = db.execute(
            "SELECT body FROM summary_reports WHERE period=? AND period_start=?",
            (period, first.isoformat()),
        ).fetchone()
        if row:
            return {**json.loads(row["body"]), "currentPeriodStart": current.isoformat()}
    cutoff = end if final else now
    result = {
        "period": period, "periodStart": first.isoformat(),
        "periodEnd": (following - timedelta(days=1)).isoformat(),
        "currentPeriodStart": current.isoformat(), "timezone": "Asia/Kuala_Lumpur",
        "asOf": cutoff.isoformat(), "generatedAt": now.isoformat(),
        "isFinal": final, "snapshotKind": "saved" if final else "live",
        **aggregate(db, start, cutoff, buckets(first, following, period, now)),
        "notes": _notes(final),
    }
    if final:
        db.execute(
            "INSERT OR IGNORE INTO summary_reports(period,period_start,body) VALUES(?,?,?)",
            (period, first.isoformat(), api.dump(result)),
        )
        result = json.loads(db.execute(
            "SELECT body FROM summary_reports WHERE period=? AND period_start=?",
            (period, first.isoformat()),
        ).fetchone()["body"])
    return result


def _notes(final):
    return [
        "Counts include matching submissions. Products counted counts each product once in this period.",
        "Closed cases use the decision time. Outstanding cases include earlier periods; aged cases are open at least 7 days.",
        ("Historical figures are saved on first view. Linked cases show their current state."
         if final else "Current figures refresh while this page is visible. All periods use Malaysia time."),
    ]
