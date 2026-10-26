import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from reint.domain.models import Forecast, SnapshotMeta
from reint.domain.timegrid import hours_in_range, to_iso_z
from reint.providers.elexon import ElexonSource, vintages_by_hour
from reint.store.sqlite import write_snapshot

logger = logging.getLogger(__name__)

SOURCE = "Elexon Insights Solution: FUELHH actuals and WINDFOR evolution"


def month_bounds(month: str) -> tuple[date, date]:
    try:
        start = datetime.strptime(month, "%Y-%m").date().replace(day=1)
    except ValueError as exc:
        raise ValueError("month must look like YYYY-MM") from exc
    next_month = (
        date(start.year + 1, 1, 1) if start.month == 12 else date(start.year, start.month + 1, 1)
    )
    return start, next_month - timedelta(days=1)


def build_snapshot(
    month: str,
    client: ElexonSource,
    path: Path,
    concurrency: int = 8,
) -> SnapshotMeta:
    start, end = month_bounds(month)
    actual_start = start - timedelta(days=1)
    logger.info("Fetching actual wind %s to %s", actual_start, end)
    actuals = client.fetch_actuals(actual_start, end)
    logger.info("Fetched %s actual half-hour rows", len(actuals))

    hours = hours_in_range(start, end)
    logger.info("Fetching forecast vintages for %s delivery hours", len(hours))
    forecasts: list[Forecast] = []
    failures: list[tuple[datetime, Exception]] = []

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = {executor.submit(client.fetch_vintages, hour): hour for hour in hours}
        for completed, future in enumerate(as_completed(futures), start=1):
            hour = futures[future]
            try:
                forecasts.extend(future.result())
            except Exception as exc:  # recorded and raised after collection
                failures.append((hour, exc))
            if completed % 50 == 0 or completed == len(hours):
                logger.info("Forecast hours %s/%s", completed, len(hours))

    if failures:
        hour, error = failures[0]
        raise RuntimeError(
            f"{len(failures)} forecast hour(s) failed; first at {to_iso_z(hour)}: {error}"
        ) from error

    grouped = vintages_by_hour(forecasts)
    missing_hours = [hour for hour in hours if not grouped.get(hour)]
    built_at = datetime.now(UTC)
    meta = SnapshotMeta(
        source=SOURCE,
        built_at=built_at,
        delivery_from=start,
        delivery_to=end,
        actual_from=actual_start,
        actual_to=end,
        actual_rows=len(actuals),
        forecast_rows=len(forecasts),
        forecast_hours=len(hours) - len(missing_hours),
        missing_forecast_hours=len(missing_hours),
    )

    write_snapshot(path, actuals, forecasts, meta)
    manifest = {
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
        "missing_hours": [to_iso_z(hour) for hour in missing_hours],
    }
    manifest_path = path.with_name("manifest.json")
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    logger.info("Wrote snapshot to %s", path)
    logger.info(
        "Coverage: %s actual rows, %s forecast rows across %s/%s hours",
        meta.actual_rows,
        meta.forecast_rows,
        meta.forecast_hours,
        len(hours),
    )
    return meta
