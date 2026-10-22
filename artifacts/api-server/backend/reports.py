"""Weekly activity, not a valuation or a live-stock health snapshot.

Historical weeks are reconstructed from immutable count/decision timestamps and
assessment timelines, then frozen on first read. No synthetic business data.
"""
import json
import re
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

LOCAL = ZoneInfo("Asia/Kuala_Lumpur")
OPEN = ("pending_approval", "needs_review", "manual_review")


def init(db):
    db.execute("""CREATE TABLE IF NOT EXISTS weekly_reports(
        week_start TEXT PRIMARY KEY, body TEXT NOT NULL)""")


def timestamp(value):
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        raise ValueError("Report source timestamps must include a timezone.")
    return dt.astimezone(timezone.utc)


def monday(value):
    return value - timedelta(days=value.weekday())


def status_at(case, cutoff):
    """State immediately before cutoff, never today's status for a past week."""
    if timestamp(case["createdAt"]) >= cutoff:
        return None
    decision = case.get("decision")
    if decision and timestamp(decision["at"]) < cutoff:
        return None
    versions = [v for v in case["versions"] if timestamp(v["createdAt"]) < cutoff]
    if not versions:
        return None
    version = versions[-1]
    status = {
        "supported": "pending_approval",
        "conflicting": "needs_review",
        "incomplete": "manual_review",
    }[version["evidenceState"]]
    for event in case["timeline"]:
        if (event.get("at") and event["summary"].startswith("Review requested:")
                and timestamp(version["createdAt"]) <= timestamp(event["at"]) < cutoff):
            status = "needs_review"
    return status


def weekly(db, user, week, api, clock=None):
    api.require(user, ("manager", "owner"))
    now = (clock or datetime.now(timezone.utc)).astimezone(timezone.utc)
    current = monday(now.astimezone(LOCAL).date()).isoformat()
    try:
        if week is None:
            week = current
        if not isinstance(week, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", week):
            raise ValueError()
        start_date = date.fromisoformat(week)
        if start_date.weekday() != 0 or start_date.year < 2000 or week > current:
            raise ValueError()
    except ValueError:
        raise api.APIError("Choose a Monday (YYYY-MM-DD), from 2000 through the current week.")

    start = datetime.combine(start_date, time.min, LOCAL).astimezone(timezone.utc)
    end = start + timedelta(days=7)
    is_final = end <= now
    if is_final:
        saved = db.execute("SELECT body FROM weekly_reports WHERE week_start=?", (week,)).fetchone()
        if saved:
            return {**json.loads(saved["body"]), "currentWeek": current}
    cutoff = end if is_final else now
    cases = [json.loads(r["body"]) for r in db.execute("SELECT body FROM cases")]
    counts = [dict(r) for r in db.execute("SELECT product_id,at FROM counts")
              if start <= timestamp(r["at"]) < cutoff]
    opened = [c for c in cases if start <= timestamp(c["createdAt"]) < cutoff]
    closed = [c for c in cases if c.get("decision")
              and start <= timestamp(c["decision"]["at"]) < cutoff]

    followups = []
    for case in cases:
        status = status_at(case, cutoff)
        if status not in OPEN:
            continue
        followups.append({
            "id": case["id"], "product": case["product"], "status": status,
            "createdAt": case["createdAt"],
            "ageDays": max(0, (cutoff - timestamp(case["createdAt"])).days),
            "recorded": case["recorded"], "counted": case["counted"],
            "difference": case["counted"] - case["recorded"],
        })
    followups.sort(key=lambda item: (timestamp(item["createdAt"]), item["id"]))
    daily = [{
        "date": (start_date + timedelta(days=i)).isoformat(),
        "counts": 0, "newCases": 0, "closedCases": 0,
        "future": start_date + timedelta(days=i) > now.astimezone(LOCAL).date(),
    } for i in range(7)]

    def increment(at, field):
        index = (timestamp(at).astimezone(LOCAL).date() - start_date).days
        daily[index][field] += 1

    for count in counts:
        increment(count["at"], "counts")
    for case in opened:
        increment(case["createdAt"], "newCases")
    decisions = {"approved": 0, "overridden": 0, "rejected": 0}
    for case in closed:
        increment(case["decision"]["at"], "closedCases")
        decisions[case["decision"]["action"]] += 1
    report = {
        "weekStart": week,
        "weekEnd": (start_date + timedelta(days=6)).isoformat(),
        "timezone": "Asia/Kuala_Lumpur", "asOf": cutoff.isoformat(),
        "generatedAt": now.isoformat(), "isFinal": is_final,
        "snapshotKind": "saved" if is_final else "live",
        "totals": {
            "countSubmissions": len(counts),
            "productsCounted": len({r["product_id"] for r in counts}),
            "newCases": len(opened), "closedCases": len(closed),
            "openingBacklog": sum(status_at(c, start) in OPEN for c in cases),
            "closingBacklog": len(followups),
            "overdueCases": sum(c["ageDays"] >= 7 for c in followups),
        },
        "decisions": decisions, "daily": daily,
        "discrepancies": {
            "shortageUnits": sum(max(0, c["recorded"] - c["counted"]) for c in opened),
            "surplusUnits": sum(max(0, c["counted"] - c["recorded"]) for c in opened),
        },
        "followUps": followups,
        "notes": [
            "Monday–Sunday in Asia/Kuala_Lumpur. Counts include matching submissions; "
            "products counted counts each product once per week.",
            "Cases closed uses decision time, including cases opened in earlier weeks. "
            "Backlog is outstanding at the reporting cutoff, including older cases. "
            "Aged cases are open for at least 7 days.",
            "Discrepancies sum the initial shortage/surplus observations on cases opened "
            "this week. Repeated counts can describe the same stock; these are not net "
            "inventory movements, confirmed losses or a financial valuation.",
            ("Closed weeks are reconstructed from saved count, assessment and decision "
             "events and frozen on first view, not automatically at week end. Case links "
             "show the current case; its status may now differ from this report."
             if is_final else
             "This week is still in progress. Figures update as counts and decisions "
             "are saved; future days have no activity yet."),
        ],
    }
    if is_final:
        db.execute("INSERT OR IGNORE INTO weekly_reports(week_start,body) VALUES(?,?)",
                   (week, api.dump(report)))
        # The HTTP route serializes report writes; also return the winning row
        # when called by another consumer in an existing write transaction.
        report = json.loads(db.execute(
            "SELECT body FROM weekly_reports WHERE week_start=?", (week,)).fetchone()["body"])
    return {**report, "currentWeek": current}
