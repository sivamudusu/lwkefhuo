from datetime import UTC, date, datetime
from pathlib import Path

import pytest

from reint.domain.models import Actual, Forecast, SnapshotMeta
from reint.store.sqlite import SnapshotMissingError, read_snapshot, write_snapshot


def _meta() -> SnapshotMeta:
    return SnapshotMeta(
        source="test",
        built_at=datetime(2026, 2, 1, tzinfo=UTC),
        delivery_from=date(2026, 1, 1),
        delivery_to=date(2026, 1, 2),
        actual_from=date(2025, 12, 31),
        actual_to=date(2026, 1, 2),
        actual_rows=2,
        forecast_rows=2,
        forecast_hours=2,
        missing_forecast_hours=0,
    )


def test_snapshot_round_trip(tmp_path: Path) -> None:
    path = tmp_path / "snapshot.sqlite"
    actuals = [
        Actual(
            delivery_at=datetime(2026, 1, 1, 0, tzinfo=UTC),
            settlement_date=date(2026, 1, 1),
            settlement_period=1,
            generation_mw=1200.0,
            publish_time=datetime(2026, 1, 1, 1, 30, tzinfo=UTC),
        )
    ]
    forecasts = [
        Forecast(
            delivery_at=datetime(2026, 1, 1, 0, tzinfo=UTC),
            publish_time=datetime(2025, 12, 31, 7, 30, tzinfo=UTC),
            generation_mw=1300.0,
        )
    ]
    write_snapshot(path, actuals, forecasts, _meta())

    snapshot = read_snapshot(path)
    assert snapshot.meta.source == "test"
    assert snapshot.meta.built_at == datetime(2026, 2, 1, tzinfo=UTC)
    assert snapshot.actuals == tuple(actuals)
    assert snapshot.forecasts == tuple(forecasts)


def test_missing_snapshot_is_reported(tmp_path: Path) -> None:
    with pytest.raises(SnapshotMissingError, match="make ingest"):
        read_snapshot(tmp_path / "nope.sqlite")
