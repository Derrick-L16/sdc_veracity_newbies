"""Malaysia calendar boundaries and deterministic activity buckets."""
import re
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

LOCAL = ZoneInfo("Asia/Kuala_Lumpur")
PERIODS = ("daily", "weekly", "monthly", "yearly")


def timestamp(value):
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        raise ValueError("Report source timestamps must include a timezone.")
    return dt.astimezone(timezone.utc)


def monday(value):
    return value - timedelta(days=value.weekday())


def period_start(value, period):
    if period == "daily":
        return value
    if period == "weekly":
        return monday(value)
    if period == "monthly":
        return value.replace(day=1)
    return value.replace(month=1, day=1)


def next_period(value, period):
    if period == "daily":
        return value + timedelta(days=1)
    if period == "weekly":
        return value + timedelta(days=7)
    if period == "yearly":
        return value.replace(year=value.year + 1)
    return date(value.year + (value.month == 12), value.month % 12 + 1, 1)


def at_midnight(value):
    return datetime.combine(value, time.min, LOCAL)


def window(period, selection, now):
    if period not in PERIODS:
        raise ValueError("Choose daily, weekly, monthly or yearly.")
    today = now.astimezone(LOCAL).date()
    if selection is None:
        chosen = today
    else:
        if not isinstance(selection, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", selection):
            raise ValueError("Choose a date in YYYY-MM-DD format.")
        chosen = date.fromisoformat(selection)
    if chosen.year < 2000 or chosen > today:
        raise ValueError("Choose a date from 2000 through today, in Malaysia time.")
    start = period_start(chosen, period)
    # Week containing 1 January 2000 begins in 1999, outside the supported range.
    if start.year < 2000:
        raise ValueError("Choose a period beginning in 2000 or later.")
    return start, next_period(start, period), period_start(today, period)


def buckets(start, end, period, now):
    current = at_midnight(start)
    stop = at_midnight(end)
    result = []
    while current < stop:
        if period == "daily":
            following = current + timedelta(hours=1)
        elif period == "yearly":
            following = at_midnight(next_period(current.date(), "monthly"))
        else:
            following = current + timedelta(days=1)
        result.append({
            "start": current.isoformat(), "end": following.isoformat(),
            "counts": 0, "newCases": 0, "closedCases": 0,
            "future": current > now,
        })
        current = following
    return result
