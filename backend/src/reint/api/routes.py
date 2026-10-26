from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from reint.api.deps import (
    get_confidence,
    get_gate,
    get_snapshot,
    resolve_range,
    settings,
)
from reint.domain.models import Snapshot
from reint.domain.timegrid import (
    AVAILABLE_GATES,
    GateRule,
    delivery_dates,
    hourly_actuals,
    hours_in_range,
    to_iso_z,
)
from reint.providers.elexon import vintages_by_hour
from reint.services.analytics import accuracy_view, calibration_view, daily_view, vintages_view

router = APIRouter()


def _meta(snapshot: Snapshot) -> dict[str, Any]:
    meta = snapshot.meta
    return {
        "service": "reint-api",
        "version": settings.version,
        "snapshot": {
            "source": meta.source,
            "built_at": to_iso_z(meta.built_at),
            "delivery_from": meta.delivery_from.isoformat(),
            "delivery_to": meta.delivery_to.isoformat(),
            "actual_from": meta.actual_from.isoformat(),
            "actual_to": meta.actual_to.isoformat(),
            "actual_rows": meta.actual_rows,
            "forecast_rows": meta.forecast_rows,
            "forecast_hours": meta.forecast_hours,
            "missing_forecast_hours": meta.missing_forecast_hours,
        },
        "default_gate": settings.default_gate,
        "gates": list(AVAILABLE_GATES),
        "default_confidence": settings.default_confidence,
        "confidences": [0.9, 0.95],
    }


@router.get("/health")
def health(snapshot: Snapshot = Depends(get_snapshot)) -> dict[str, Any]:
    return {
        "status": "ok",
        "version": settings.version,
        "snapshot_built_at": to_iso_z(snapshot.meta.built_at),
        "delivery_from": snapshot.meta.delivery_from.isoformat(),
        "delivery_to": snapshot.meta.delivery_to.isoformat(),
    }


@router.get("/meta")
def meta(snapshot: Snapshot = Depends(get_snapshot)) -> dict[str, Any]:
    return _meta(snapshot)


@router.get("/days")
def days(snapshot: Snapshot = Depends(get_snapshot)) -> dict[str, Any]:
    actuals = hourly_actuals(snapshot.actuals)
    grouped = vintages_by_hour(snapshot.forecasts)
    rows: list[dict[str, Any]] = []
    for delivery_date in delivery_dates(snapshot.meta.delivery_from, snapshot.meta.delivery_to):
        day_hours = hours_in_range(delivery_date, delivery_date)
        actual_hours = sum(1 for hour in day_hours if hour in actuals)
        forecast_hours = sum(1 for hour in day_hours if grouped.get(hour))
        rows.append(
            {
                "date": delivery_date.isoformat(),
                "actual_hours": actual_hours,
                "forecast_hours": forecast_hours,
                "complete": actual_hours == 24 and forecast_hours == 24,
            }
        )
    return {
        "from": snapshot.meta.delivery_from.isoformat(),
        "to": snapshot.meta.delivery_to.isoformat(),
        "days": rows,
    }


@router.get("/day/{delivery_date}")
def day(
    delivery_date: date,
    snapshot: Snapshot = Depends(get_snapshot),
    gate: GateRule = Depends(get_gate),
    confidence: float = Depends(get_confidence),
) -> dict[str, Any]:
    if not (snapshot.meta.delivery_from <= delivery_date <= snapshot.meta.delivery_to):
        raise HTTPException(
            status_code=404,
            detail=(
                f"{delivery_date} is outside the snapshot range "
                f"{snapshot.meta.delivery_from} to {snapshot.meta.delivery_to}"
            ),
        )
    try:
        return daily_view(snapshot, delivery_date, gate, confidence)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/day/{delivery_date}/vintages")
def day_vintages(
    delivery_date: date,
    snapshot: Snapshot = Depends(get_snapshot),
    gate: GateRule = Depends(get_gate),
) -> dict[str, Any]:
    if not (snapshot.meta.delivery_from <= delivery_date <= snapshot.meta.delivery_to):
        raise HTTPException(
            status_code=404,
            detail=(
                f"{delivery_date} is outside the snapshot range "
                f"{snapshot.meta.delivery_from} to {snapshot.meta.delivery_to}"
            ),
        )
    return vintages_view(snapshot, delivery_date, gate)


@router.get("/accuracy")
def accuracy(
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    snapshot: Snapshot = Depends(get_snapshot),
    gate: GateRule = Depends(get_gate),
    confidence: float = Depends(get_confidence),
) -> dict[str, Any]:
    resolved_start, resolved_end = resolve_range(snapshot, start, end)
    try:
        return accuracy_view(snapshot, resolved_start, resolved_end, gate, confidence)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/calibration")
def calibration(
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    snapshot: Snapshot = Depends(get_snapshot),
    gate: GateRule = Depends(get_gate),
    confidence: float = Depends(get_confidence),
) -> dict[str, Any]:
    resolved_start, resolved_end = resolve_range(snapshot, start, end)
    try:
        return calibration_view(snapshot, resolved_start, resolved_end, gate, confidence)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
