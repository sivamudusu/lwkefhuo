from dataclasses import dataclass
from datetime import date, datetime


@dataclass(frozen=True)
class Actual:
    delivery_at: datetime
    settlement_date: date
    settlement_period: int
    generation_mw: float
    publish_time: datetime


@dataclass(frozen=True)
class Forecast:
    delivery_at: datetime
    publish_time: datetime
    generation_mw: float


@dataclass(frozen=True)
class HourPoint:
    delivery_at: datetime
    actual_mw: float | None
    forecast_mw: float | None
    publish_time: datetime | None
    lead_hours: float | None
    residual_mw: float | None
    band_low_mw: float | None = None
    band_high_mw: float | None = None
    reserve_mw: float | None = None


@dataclass(frozen=True)
class SnapshotMeta:
    source: str
    built_at: datetime
    delivery_from: date
    delivery_to: date
    actual_from: date
    actual_to: date
    actual_rows: int
    forecast_rows: int
    forecast_hours: int
    missing_forecast_hours: int


@dataclass(frozen=True)
class CalibrationInfo:
    days_used: int
    sample_count: int
    coverage: float | None
    provisional: bool


@dataclass(frozen=True)
class Snapshot:
    actuals: tuple[Actual, ...]
    forecasts: tuple[Forecast, ...]
    meta: SnapshotMeta
