from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta

from reint.domain.models import Actual

DEFAULT_GATE = "09:20"
AVAILABLE_GATES = ("09:20", "15:30")


def parse_iso(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def to_iso_z(value: datetime) -> str:
    return value.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def hour_floor(value: datetime) -> datetime:
    return value.astimezone(UTC).replace(minute=0, second=0, microsecond=0)


def day_start(value: date) -> datetime:
    return datetime.combine(value, time(0, 0), tzinfo=UTC)


def delivery_dates(start: date, end: date) -> list[date]:
    return [start + timedelta(days=offset) for offset in range((end - start).days + 1)]


def hours_in_range(start: date, end: date) -> list[datetime]:
    first = day_start(start)
    last = day_start(end) + timedelta(hours=23)
    return [
        first + timedelta(hours=offset)
        for offset in range(int((last - first).total_seconds() // 3600) + 1)
    ]


@dataclass(frozen=True)
class GateRule:
    label: str
    hour: int
    minute: int

    @classmethod
    def parse(cls, value: str) -> "GateRule":
        if value not in AVAILABLE_GATES:
            raise ValueError(f"Unsupported gate closure: {value}")
        parsed = datetime.strptime(value, "%H:%M")
        return cls(label=value, hour=parsed.hour, minute=parsed.minute)

    def decision_time(self, delivery_hour: datetime) -> datetime:
        previous_day = delivery_hour.astimezone(UTC) - timedelta(days=1)
        return previous_day.replace(hour=self.hour, minute=self.minute, second=0, microsecond=0)


def hourly_actuals(actuals: tuple[Actual, ...] | list[Actual]) -> dict[datetime, float]:
    grouped: dict[datetime, list[float]] = defaultdict(list)
    for actual in actuals:
        grouped[hour_floor(actual.delivery_at)].append(actual.generation_mw)
    return {hour: sum(values) / len(values) for hour, values in grouped.items()}


def lead_bucket(lead_hours: float) -> str:
    if lead_hours < 18:
        return "<18h"
    if lead_hours < 24:
        return "18-24h"
    if lead_hours < 30:
        return "24-30h"
    if lead_hours < 36:
        return "30-36h"
    if lead_hours < 42:
        return "36-42h"
    return ">=42h"


def wind_bucket(actual_mw: float) -> str:
    if actual_mw < 5_000:
        return "<5 GW"
    if actual_mw < 10_000:
        return "5-10 GW"
    if actual_mw < 15_000:
        return "10-15 GW"
    if actual_mw < 20_000:
        return "15-20 GW"
    return ">=20 GW"
