from collections import defaultdict
from collections.abc import Callable, Sequence
from datetime import date, timedelta
from typing import Any

from reint.domain.metrics import (
    apply_walk_forward_bands,
    coverage,
    summarize,
)
from reint.domain.models import CalibrationInfo, HourPoint, Snapshot
from reint.domain.selection import build_hour_points
from reint.domain.timegrid import (
    GateRule,
    day_start,
    hourly_actuals,
    hours_in_range,
    lead_bucket,
    to_iso_z,
    wind_bucket,
)
from reint.providers.elexon import vintages_by_hour

LEAD_BUCKET_ORDER = ("<18h", "18-24h", "24-30h", "30-36h", "36-42h", ">=42h")
WIND_BUCKET_ORDER = ("<5 GW", "5-10 GW", "10-15 GW", "15-20 GW", ">=20 GW")


def _point_dict(point: HourPoint) -> dict[str, Any]:
    return {
        "hour": to_iso_z(point.delivery_at),
        "actual_mw": point.actual_mw,
        "forecast_mw": point.forecast_mw,
        "publish_time": to_iso_z(point.publish_time) if point.publish_time else None,
        "lead_hours": point.lead_hours,
        "residual_mw": point.residual_mw,
        "band_low_mw": point.band_low_mw,
        "band_high_mw": point.band_high_mw,
        "reserve_mw": point.reserve_mw,
    }


def _calibration_dict(info: CalibrationInfo) -> dict[str, Any]:
    return {
        "days_used": info.days_used,
        "sample_count": info.sample_count,
        "coverage": info.coverage,
        "provisional": info.provisional,
    }


def _points(
    snapshot: Snapshot,
    start: date,
    end: date,
    gate: GateRule,
) -> list[HourPoint]:
    if start > end:
        raise ValueError("start must be before or equal to end")
    if start < snapshot.meta.delivery_from or end > snapshot.meta.delivery_to:
        raise ValueError(
            f"date range must fall within {snapshot.meta.delivery_from} to {snapshot.meta.delivery_to}"
        )
    actuals = hourly_actuals(snapshot.actuals)
    return build_hour_points(
        hours_in_range(start, end),
        actuals,
        vintages_by_hour(snapshot.forecasts),
        gate,
    )


def _summarize_points(points: Sequence[HourPoint]) -> dict[str, Any]:
    valid = [point for point in points if point.residual_mw is not None]
    residuals = [point.residual_mw for point in valid if point.residual_mw is not None]
    summary = summarize(residuals)
    actuals = [point.actual_mw for point in valid if point.actual_mw is not None]
    forecasts = [point.forecast_mw for point in valid if point.forecast_mw is not None]
    summary["mean_actual_mw"] = sum(actuals) / len(actuals) if actuals else None
    summary["mean_forecast_mw"] = sum(forecasts) / len(forecasts) if forecasts else None
    return summary


def daily_view(
    snapshot: Snapshot,
    delivery_date: date,
    gate: GateRule,
    confidence: float,
) -> dict[str, Any]:
    points = _points(snapshot, snapshot.meta.delivery_from, delivery_date, gate)
    calibrated, by_day = apply_walk_forward_bands(points, confidence=confidence)
    day_points = [point for point in calibrated if point.delivery_at.date() == delivery_date]
    if not day_points:
        raise ValueError(f"No delivery data for {delivery_date}")

    summary = _summarize_points(day_points)
    summary["hours"] = len(day_points)
    summary["hours_with_band"] = sum(1 for point in day_points if point.band_low_mw is not None)
    summary["forecast_mwh"] = sum(
        point.forecast_mw for point in day_points if point.forecast_mw is not None
    )
    summary["actual_mwh"] = sum(
        point.actual_mw for point in day_points if point.actual_mw is not None
    )
    summary["reserve_peak_mw"] = max((point.reserve_mw or 0.0) for point in day_points)
    summary["reserve_mwh"] = sum(point.reserve_mw or 0.0 for point in day_points)

    publish_times = sorted(
        {point.publish_time for point in day_points if point.publish_time is not None}
    )
    leads = [point.lead_hours for point in day_points if point.lead_hours is not None]
    info = by_day.get(delivery_date)
    calibration = (
        _calibration_dict(info)
        if info
        else _calibration_dict(
            CalibrationInfo(days_used=0, sample_count=0, coverage=None, provisional=True)
        )
    )

    return {
        "delivery_date": delivery_date.isoformat(),
        "gate": gate.label,
        "decision_time": to_iso_z(gate.decision_time(day_start(delivery_date))),
        "hours": [_point_dict(point) for point in day_points],
        "summary": summary,
        "calibration": calibration,
        "provenance": {
            "gate": gate.label,
            "decision_time": to_iso_z(gate.decision_time(day_start(delivery_date))),
            "publish_times": [to_iso_z(value) for value in publish_times],
            "lead_hours_min": min(leads) if leads else None,
            "lead_hours_max": max(leads) if leads else None,
            "look_ahead_guard": "latest forecast with publish_time <= decision_time",
            "source": snapshot.meta.source,
            "snapshot_built_at": to_iso_z(snapshot.meta.built_at),
        },
    }


def vintages_view(snapshot: Snapshot, delivery_date: date, gate: GateRule) -> dict[str, Any]:
    hours = hours_in_range(delivery_date, delivery_date)
    grouped = vintages_by_hour(snapshot.forecasts)
    rows: list[dict[str, Any]] = []
    for hour in hours:
        decision_time = gate.decision_time(hour)
        vintages = grouped.get(hour, [])
        eligible = [forecast for forecast in vintages if forecast.publish_time <= decision_time]
        selected = max(eligible, key=lambda forecast: forecast.publish_time) if eligible else None
        rows.append(
            {
                "hour": to_iso_z(hour),
                "decision_time": to_iso_z(decision_time),
                "selected_publish_time": to_iso_z(selected.publish_time) if selected else None,
                "vintages": [
                    {
                        "publish_time": to_iso_z(forecast.publish_time),
                        "generation_mw": forecast.generation_mw,
                    }
                    for forecast in sorted(vintages, key=lambda forecast: forecast.publish_time)
                ],
            }
        )
    return {
        "delivery_date": delivery_date.isoformat(),
        "gate": gate.label,
        "hours": rows,
    }


def _daily_rows(
    points: Sequence[HourPoint],
    by_day: dict[date, CalibrationInfo],
) -> list[dict[str, Any]]:
    grouped: dict[date, list[HourPoint]] = defaultdict(list)
    for point in points:
        grouped[point.delivery_at.date()].append(point)

    rows: list[dict[str, Any]] = []
    for delivery_date in sorted(grouped):
        residuals = [
            point.residual_mw for point in grouped[delivery_date] if point.residual_mw is not None
        ]
        row = {"date": delivery_date.isoformat(), **summarize(residuals)}
        row["coverage"] = coverage(grouped[delivery_date])
        info = by_day.get(delivery_date)
        row["provisional"] = info.provisional if info else True
        rows.append(row)
    return rows


def _bucket_rows(
    points: Sequence[HourPoint],
    bucket_fn: Callable[[float], str],
    order: Sequence[str],
    key: str,
) -> list[dict[str, Any]]:
    grouped: dict[str, list[float]] = defaultdict(list)
    for point in points:
        if point.residual_mw is None:
            continue
        if key == "lead" and point.lead_hours is not None:
            grouped[bucket_fn(point.lead_hours)].append(point.residual_mw)
        elif key == "wind" and point.actual_mw is not None:
            grouped[bucket_fn(point.actual_mw)].append(point.residual_mw)
    rows = [
        {"bucket": bucket, **summarize(grouped[bucket])} for bucket in order if grouped.get(bucket)
    ]
    return rows


def accuracy_view(
    snapshot: Snapshot,
    start: date,
    end: date,
    gate: GateRule,
    confidence: float,
) -> dict[str, Any]:
    points = _points(snapshot, snapshot.meta.delivery_from, end, gate)
    calibrated, by_day = apply_walk_forward_bands(points, confidence=confidence)
    range_points = [point for point in calibrated if start <= point.delivery_at.date() <= end]
    valid = [point for point in range_points if point.residual_mw is not None]

    actuals = hourly_actuals(snapshot.actuals)
    paired: list[tuple[HourPoint, float]] = []
    for point in valid:
        previous = actuals.get(point.delivery_at - timedelta(days=1))
        if previous is not None and point.actual_mw is not None:
            paired.append((point, previous))
    model_paired = [point.residual_mw for point, _ in paired if point.residual_mw is not None]
    persistence_paired = [
        point.actual_mw - previous for point, previous in paired if point.actual_mw is not None
    ]
    model_mae = (
        sum(abs(value) for value in model_paired) / len(model_paired) if model_paired else None
    )
    persistence_mae = (
        sum(abs(value) for value in persistence_paired) / len(persistence_paired)
        if persistence_paired
        else None
    )
    skill = (
        1 - model_mae / persistence_mae
        if model_mae is not None and persistence_mae not in (None, 0)
        else None
    )

    overall = _summarize_points(range_points)
    calibration_by_day = [
        {"date": delivery_date.isoformat(), **_calibration_dict(info)}
        for delivery_date, info in sorted(by_day.items())
        if start <= delivery_date <= end
    ]
    provisional_days = sum(1 for row in calibration_by_day if row["provisional"])

    return {
        "from": start.isoformat(),
        "to": end.isoformat(),
        "gate": gate.label,
        "confidence": confidence,
        "overall": overall,
        "daily": _daily_rows(range_points, by_day),
        "by_lead_bucket": _bucket_rows(valid, lead_bucket, LEAD_BUCKET_ORDER, "lead"),
        "by_wind_level": _bucket_rows(valid, wind_bucket, WIND_BUCKET_ORDER, "wind"),
        "baseline": {
            "count": len(paired),
            "model_mae_mw": model_mae,
            "persistence_mae_mw": persistence_mae,
            "skill_score": skill,
        },
        "calibration": {
            "coverage": coverage(range_points),
            "hours_with_band": sum(1 for point in range_points if point.band_low_mw is not None),
            "provisional_days": provisional_days,
            "days": calibration_by_day,
        },
        "series": [_point_dict(point) for point in range_points],
    }


def calibration_view(
    snapshot: Snapshot,
    start: date,
    end: date,
    gate: GateRule,
    confidence: float,
) -> dict[str, Any]:
    points = _points(snapshot, snapshot.meta.delivery_from, end, gate)
    _, by_day = apply_walk_forward_bands(points, confidence=confidence)
    return {
        "from": start.isoformat(),
        "to": end.isoformat(),
        "confidence": confidence,
        "days": [
            {"date": delivery_date.isoformat(), **_calibration_dict(info)}
            for delivery_date, info in sorted(by_day.items())
            if start <= delivery_date <= end
        ],
    }
