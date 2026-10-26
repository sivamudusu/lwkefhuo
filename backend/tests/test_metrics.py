from datetime import UTC, datetime, timedelta

from reint.domain.metrics import (
    apply_walk_forward_bands,
    coverage,
    mae,
    quantile,
    rmse,
    summarize,
)
from reint.domain.models import HourPoint


def test_quantile_interpolates() -> None:
    assert quantile([0.0, 10.0], 0.1) == 1.0
    assert quantile([0.0, 10.0], 0.5) == 5.0
    assert quantile([5.0], 0.9) == 5.0
    assert quantile([], 0.9) is None


def test_error_metrics() -> None:
    residuals = [-100.0, 200.0, -300.0]
    assert mae(residuals) == 200.0
    error = rmse(residuals)
    assert error is not None
    assert round(error, 6) == round((140000 / 3) ** 0.5, 6)
    summary = summarize(residuals)
    assert summary["count"] == 3
    assert summary["bias_mw"] == -200 / 3


def test_walk_forward_bands_use_only_prior_days() -> None:
    start = datetime(2026, 1, 1, tzinfo=UTC)
    points = [
        HourPoint(
            delivery_at=start + timedelta(days=day),
            actual_mw=1000.0,
            forecast_mw=1500.0,
            publish_time=start + timedelta(days=day - 1, hours=7, minutes=30),
            lead_hours=16.5,
            residual_mw=-500.0,
        )
        for day in range(1, 4)
    ]
    calibrated, by_day = apply_walk_forward_bands(points, min_history_days=1, min_samples=1)

    assert calibrated[0].band_low_mw is None
    assert calibrated[1].band_low_mw == 1000.0
    assert calibrated[1].band_high_mw == 1000.0
    assert calibrated[2].band_low_mw == 1000.0
    assert calibrated[2].reserve_mw == 500.0
    assert by_day[points[1].delivery_at.date()].days_used == 1
    assert by_day[points[1].delivery_at.date()].provisional is False
    assert coverage(calibrated) == 1.0
