from datetime import UTC, datetime

from reint.domain.models import Forecast
from reint.domain.selection import build_hour_points, select_forecast
from reint.domain.timegrid import GateRule, hours_in_range


def _forecast(publish_hour: int, value: float) -> Forecast:
    return Forecast(
        delivery_at=datetime(2026, 1, 15, 12, tzinfo=UTC),
        publish_time=datetime(2026, 1, 14, publish_hour, 30, tzinfo=UTC),
        generation_mw=value,
    )


def test_0920_gate_does_not_use_0930_vintage() -> None:
    vintages = [_forecast(7, 1000.0), _forecast(9, 900.0), _forecast(11, 800.0)]
    selected = select_forecast(vintages, datetime(2026, 1, 14, 9, 20, tzinfo=UTC))
    assert selected is not None
    assert selected.publish_time.hour == 7
    assert selected.generation_mw == 1000.0


def test_1530_gate_uses_most_recent_eligible_vintage() -> None:
    vintages = [_forecast(7, 1000.0), _forecast(9, 900.0), _forecast(11, 800.0)]
    selected = select_forecast(vintages, datetime(2026, 1, 14, 15, 30, tzinfo=UTC))
    assert selected is not None
    assert selected.publish_time.hour == 11
    assert selected.generation_mw == 800.0


def test_no_eligible_vintage_yields_missing_forecast() -> None:
    vintages = [_forecast(9, 900.0)]
    assert select_forecast(vintages, datetime(2026, 1, 14, 9, 20, tzinfo=UTC)) is None


def test_build_hour_points_records_lead_and_residual() -> None:
    hour = datetime(2026, 1, 15, 12, tzinfo=UTC)
    points = build_hour_points(
        [hour],
        {hour: 700.0},
        {hour: [_forecast(7, 1000.0)]},
        GateRule.parse("09:20"),
    )
    assert points[0].forecast_mw == 1000.0
    assert points[0].residual_mw == -300.0
    assert points[0].lead_hours == 28.5


def test_hours_in_range_is_inclusive() -> None:
    hours = hours_in_range(datetime(2026, 1, 1).date(), datetime(2026, 1, 2).date())
    assert len(hours) == 48
    assert hours[0] == datetime(2026, 1, 1, tzinfo=UTC)
    assert hours[-1] == datetime(2026, 1, 2, 23, tzinfo=UTC)
