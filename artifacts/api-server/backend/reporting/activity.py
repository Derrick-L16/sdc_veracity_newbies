"""Aggregate saved inventory events; reports never change stock or case state."""
import json
from .periods import timestamp
from reports import OPEN, status_at


def aggregate(db, start, cutoff, buckets):
    cases = [json.loads(row["body"]) for row in db.execute("SELECT body FROM cases")]
    counts = [
        dict(row) for row in db.execute("SELECT product_id,at FROM counts")
        if start <= timestamp(row["at"]) < cutoff
    ]
    opened = [c for c in cases if start <= timestamp(c["createdAt"]) < cutoff]
    closed = [
        c for c in cases if c.get("decision")
        and start <= timestamp(c["decision"]["at"]) < cutoff
    ]
    followups = []
    for case in cases:
        status = status_at(case, cutoff)
        if status in OPEN:
            followups.append({
                "id": case["id"], "product": case["product"], "status": status,
                "createdAt": case["createdAt"],
                "ageDays": max(0, (cutoff - timestamp(case["createdAt"])).days),
                "recorded": case["recorded"], "counted": case["counted"],
                "difference": case["counted"] - case["recorded"],
            })
    followups.sort(key=lambda item: (timestamp(item["createdAt"]), item["id"]))
    boundaries = [(timestamp(b["start"]), timestamp(b["end"])) for b in buckets]

    def increment(at, field):
        value = timestamp(at)
        for index, (lower, upper) in enumerate(boundaries):
            if lower <= value < upper:
                buckets[index][field] += 1
                return

    for count in counts:
        increment(count["at"], "counts")
    for case in opened:
        increment(case["createdAt"], "newCases")
    decisions = {"approved": 0, "overridden": 0, "rejected": 0}
    for case in closed:
        increment(case["decision"]["at"], "closedCases")
        decisions[case["decision"]["action"]] += 1
    return {
        "totals": {
            "countSubmissions": len(counts),
            "productsCounted": len({row["product_id"] for row in counts}),
            "newCases": len(opened), "closedCases": len(closed),
            "openingBacklog": sum(status_at(c, start) in OPEN for c in cases),
            "closingBacklog": len(followups),
            "overdueCases": sum(c["ageDays"] >= 7 for c in followups),
        },
        "decisions": decisions, "buckets": buckets, "followUps": followups,
        "discrepancies": {
            "shortageUnits": sum(max(0, c["recorded"] - c["counted"]) for c in opened),
            "surplusUnits": sum(max(0, c["counted"] - c["recorded"]) for c in opened),
        },
    }
