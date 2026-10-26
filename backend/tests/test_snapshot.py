import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pytest

from reint.domain.models import Actual, Forecast
from reint.store.snapshot import build_snapshot, month_bounds
from reint.store.sqlite import read_snapshot


class FakeClient:
    def fetch_actuals(self, start: date, end: date) -> list[Actual]:
        rows: list[Actual] = []
        for offset in range((end - start).days + 1):
            delivery_date = start + timedelta(days=offset)
            for half_hour in range(48):
                delivery_at = datetime.combine(
                    delivery_date,
                    datetime.min.time(),
                    tzinfo=UTC,
                ) + timedelta(minutes=30 * half_hour)
                rows.append(
                    Actual(
                        delivery_at=delivery_at,
                        settlement_date=delivery_date,
                        settlement_period=half_hour + 1,
                        generation_mw=1000.0,
                        publish_time=delivery_at + timedelta(minutes=30),
                    )
                )
        return rows

    def fetch_vintages(self, delivery_hour: datetime) -> list[Forecast]:
        if delivery_hour == datetime(2026, 1, 3, tzinfo=UTC):
            return []
        return [
            Forecast(
                delivery_at=delivery_hour,
                publish_time=delivery_hour - timedelta(days=1, hours=1, minutes=30),
                generation_mw=900.0,
            )
        ]


def test_month_bounds() -> None:
    assert month_bounds("2026-01") == (date(2026, 1, 1), date(2026, 1, 31))
    assert month_bounds("2024-02") == (date(2024, 2, 1), date(2024, 2, 29))
    with pytest.raises(ValueError, match="YYYY-MM"):
        month_bounds("January")


def test_build_snapshot_records_coverage_and_missing_hours(tmp_path: Path) -> None:
    snapshot_path = tmp_path / "snapshot.sqlite"
    meta = build_snapshot("2026-01", FakeClient(), snapshot_path, concurrency=4)

    assert meta.actual_from == date(2025, 12, 31)
    assert meta.actual_rows == 32 * 48
    assert meta.forecast_hours == 743
    assert meta.forecast_rows == 743
    assert meta.missing_forecast_hours == 1

    snapshot = read_snapshot(snapshot_path)
    assert len(snapshot.actuals) == meta.actual_rows
    assert len(snapshot.forecasts) == meta.forecast_rows

    manifest = json.loads((tmp_path / "manifest.json").read_text())
    assert manifest["missing_hours"] == ["2026-01-03T00:00:00Z"]
