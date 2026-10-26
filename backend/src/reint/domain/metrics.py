from collections import defaultdict
from collections.abc import Sequence
from dataclasses import replace
from datetime import date
from math import ceil, floor, sqrt

from reint.domain.models import CalibrationInfo, HourPoint
from reint.domain.timegrid import lead_bucket


def mean(values: Sequence[float]) -> float | None:
    return sum(values) / len(values) if values else None


def quantile(values: Sequence[float], probability: float) -> float | None:
    if not values:
        return None
    if not 0 <= probability <= 1:
        raise ValueError("probability must be between 0 and 1")
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    index = (len(ordered) - 1) * probability
    lower = floor(index)
    upper = ceil(index)
    if lower == upper:
        return ordered[lower]
    fraction = index - lower
    return ordered[lower] + (ordered[upper] - ordered[lower]) * fraction


def mae(residuals: Sequence[float]) -> float | None:
    if not residuals:
        return None
    return sum(abs(value) for value in residuals) / len(residuals)


def rmse(residuals: Sequence[float]) -> float | None:
    if not residuals:
        return None
    return sqrt(sum(value * value for value in residuals) / len(residuals))


def bias(residuals: Sequence[float]) -> float | None:
    return mean(residuals)


def p90_abs(residuals: Sequence[float]) -> float | None:
    return quantile([abs(value) for value in residuals], 0.9)


def summarize(residuals: Sequence[float]) -> dict[str, float | int | None]:
    return {
        "count": len(residuals),
        "mae_mw": mae(residuals),
        "rmse_mw": rmse(residuals),
        "bias_mw": bias(residuals),
        "p90_abs_mw": p90_abs(residuals),
    }


def coverage(points: Sequence[HourPoint]) -> float | None:
    checked = [
        point
        for point in points
        if point.actual_mw is not None
        and point.band_low_mw is not None
        and point.band_high_mw is not None
    ]
    if not checked:
        return None
    inside = 0
    for point in checked:
        low = point.band_low_mw
        high = point.band_high_mw
        actual = point.actual_mw
        if low is not None and high is not None and actual is not None and low <= actual <= high:
            inside += 1
    return inside / len(checked)


def apply_walk_forward_bands(
    points: Sequence[HourPoint],
    confidence: float = 0.9,
    min_history_days: int = 7,
    min_samples: int = 5,
) -> tuple[list[HourPoint], dict[date, CalibrationInfo]]:
    if not 0 < confidence < 1:
        raise ValueError("confidence must be between 0 and 1")

    grouped: dict[date, list[HourPoint]] = defaultdict(list)
    for point in points:
        grouped[point.delivery_at.date()].append(point)

    prior_points: list[HourPoint] = []
    calibrated: list[HourPoint] = []
    by_day: dict[date, CalibrationInfo] = {}
    tail = (1 - confidence) / 2

    for delivery_date in sorted(grouped):
        prior_residuals = [
            point.residual_mw
            for point in prior_points
            if point.residual_mw is not None and point.lead_hours is not None
        ]
        prior_by_bucket: dict[str, list[float]] = defaultdict(list)
        for point in prior_points:
            if point.residual_mw is not None and point.lead_hours is not None:
                prior_by_bucket[lead_bucket(point.lead_hours)].append(point.residual_mw)
        prior_days = len({point.delivery_at.date() for point in prior_points})

        day_points: list[HourPoint] = []
        for point in grouped[delivery_date]:
            if point.forecast_mw is None or point.lead_hours is None or point.residual_mw is None:
                day_points.append(point)
                continue

            sample = prior_by_bucket.get(lead_bucket(point.lead_hours), [])
            if len(sample) < min_samples:
                sample = prior_residuals
            if len(sample) < min_samples:
                day_points.append(point)
                continue

            low_residual = quantile(sample, tail)
            high_residual = quantile(sample, 1 - tail)
            if low_residual is None or high_residual is None:
                day_points.append(point)
                continue

            day_points.append(
                replace(
                    point,
                    band_low_mw=point.forecast_mw + low_residual,
                    band_high_mw=point.forecast_mw + high_residual,
                    reserve_mw=max(0.0, -low_residual),
                )
            )

        day_coverage = coverage(day_points)
        by_day[delivery_date] = CalibrationInfo(
            days_used=prior_days,
            sample_count=len(prior_residuals),
            coverage=day_coverage,
            provisional=prior_days < min_history_days,
        )
        calibrated.extend(day_points)
        prior_points.extend(day_points)

    return calibrated, by_day
