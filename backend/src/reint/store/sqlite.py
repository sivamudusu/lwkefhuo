import sqlite3
from collections.abc import Sequence
from datetime import date
from pathlib import Path

from reint.domain.models import Actual, Forecast, Snapshot, SnapshotMeta
from reint.domain.timegrid import parse_iso, to_iso_z

SCHEMA_VERSION = "1"

SCHEMA = """
CREATE TABLE actuals (
    delivery_at TEXT PRIMARY KEY,
    settlement_date TEXT NOT NULL,
    settlement_period INTEGER NOT NULL,
    generation_mw REAL NOT NULL,
    publish_time TEXT NOT NULL
);

CREATE TABLE forecasts (
    delivery_at TEXT NOT NULL,
    publish_time TEXT NOT NULL,
    generation_mw REAL NOT NULL,
    PRIMARY KEY (delivery_at, publish_time)
);

CREATE INDEX idx_forecasts_delivery ON forecasts (delivery_at);
CREATE INDEX idx_forecasts_publish ON forecasts (publish_time);

CREATE TABLE meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


class SnapshotMissingError(RuntimeError):
    pass


def _meta_rows(meta: SnapshotMeta) -> list[tuple[str, str]]:
    return [
        ("schema_version", SCHEMA_VERSION),
        ("source", meta.source),
        ("built_at", to_iso_z(meta.built_at)),
        ("delivery_from", meta.delivery_from.isoformat()),
        ("delivery_to", meta.delivery_to.isoformat()),
        ("actual_from", meta.actual_from.isoformat()),
        ("actual_to", meta.actual_to.isoformat()),
        ("actual_rows", str(meta.actual_rows)),
        ("forecast_rows", str(meta.forecast_rows)),
        ("forecast_hours", str(meta.forecast_hours)),
        ("missing_forecast_hours", str(meta.missing_forecast_hours)),
    ]


def write_snapshot(
    path: Path,
    actuals: Sequence[Actual],
    forecasts: Sequence[Forecast],
    meta: SnapshotMeta,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f"{path.name}.tmp")
    temporary.unlink(missing_ok=True)

    connection = sqlite3.connect(temporary)
    try:
        connection.executescript(SCHEMA)
        connection.executemany(
            "INSERT INTO actuals VALUES (?, ?, ?, ?, ?)",
            [
                (
                    to_iso_z(actual.delivery_at),
                    actual.settlement_date.isoformat(),
                    actual.settlement_period,
                    actual.generation_mw,
                    to_iso_z(actual.publish_time),
                )
                for actual in actuals
            ],
        )
        connection.executemany(
            "INSERT INTO forecasts VALUES (?, ?, ?)",
            [
                (
                    to_iso_z(forecast.delivery_at),
                    to_iso_z(forecast.publish_time),
                    forecast.generation_mw,
                )
                for forecast in forecasts
            ],
        )
        connection.executemany("INSERT INTO meta VALUES (?, ?)", _meta_rows(meta))
        connection.commit()
    finally:
        connection.close()

    temporary.replace(path)


def _parse_meta(rows: dict[str, str]) -> SnapshotMeta:
    try:
        return SnapshotMeta(
            source=rows["source"],
            built_at=parse_iso(rows["built_at"]),
            delivery_from=date.fromisoformat(rows["delivery_from"]),
            delivery_to=date.fromisoformat(rows["delivery_to"]),
            actual_from=date.fromisoformat(rows["actual_from"]),
            actual_to=date.fromisoformat(rows["actual_to"]),
            actual_rows=int(rows["actual_rows"]),
            forecast_rows=int(rows["forecast_rows"]),
            forecast_hours=int(rows["forecast_hours"]),
            missing_forecast_hours=int(rows["missing_forecast_hours"]),
        )
    except KeyError as exc:
        raise SnapshotMissingError(f"Snapshot metadata is incomplete: missing {exc}") from exc


def read_snapshot(path: Path) -> Snapshot:
    if not path.exists():
        raise SnapshotMissingError(
            f"Snapshot not found at {path}. Run `make ingest` to build it before starting the API."
        )

    connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        meta_rows = {
            row["key"]: row["value"] for row in connection.execute("SELECT key, value FROM meta")
        }
        if meta_rows.get("schema_version") != SCHEMA_VERSION:
            raise SnapshotMissingError(
                f"Snapshot schema {meta_rows.get('schema_version')} does not match {SCHEMA_VERSION}"
            )
        actuals = tuple(
            Actual(
                delivery_at=parse_iso(row["delivery_at"]),
                settlement_date=date.fromisoformat(row["settlement_date"]),
                settlement_period=row["settlement_period"],
                generation_mw=row["generation_mw"],
                publish_time=parse_iso(row["publish_time"]),
            )
            for row in connection.execute("SELECT * FROM actuals ORDER BY delivery_at")
        )
        forecasts = tuple(
            Forecast(
                delivery_at=parse_iso(row["delivery_at"]),
                publish_time=parse_iso(row["publish_time"]),
                generation_mw=row["generation_mw"],
            )
            for row in connection.execute(
                "SELECT delivery_at, publish_time, generation_mw FROM forecasts "
                "ORDER BY delivery_at, publish_time"
            )
        )
    finally:
        connection.close()

    return Snapshot(actuals=actuals, forecasts=forecasts, meta=_parse_meta(meta_rows))
