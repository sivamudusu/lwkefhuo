from datetime import date
from pathlib import Path
from threading import Lock

from fastapi import Depends, HTTPException, Query, Request

from reint.config import Settings, load_settings
from reint.domain.models import Snapshot
from reint.domain.timegrid import GateRule
from reint.store.sqlite import SnapshotMissingError, read_snapshot

settings: Settings = load_settings()


class SnapshotStore:
    def __init__(self, path: Path) -> None:
        self.path = Path(path)
        self._snapshot: Snapshot | None = None
        self._mtime: int | None = None
        self._lock = Lock()

    def load(self) -> Snapshot:
        try:
            mtime = self.path.stat().st_mtime_ns
        except FileNotFoundError as exc:
            raise SnapshotMissingError(
                f"Snapshot not found at {self.path}. Run `make ingest` to build it."
            ) from exc

        with self._lock:
            if self._snapshot is None or mtime != self._mtime:
                self._snapshot = read_snapshot(self.path)
                self._mtime = mtime
            return self._snapshot


def get_store(request: Request) -> SnapshotStore:
    return request.app.state.snapshot_store


def get_snapshot(store: SnapshotStore = Depends(get_store)) -> Snapshot:
    return store.load()


def get_gate(
    gate: str | None = Query(default=None, description="Gate closure: 09:20 or 15:30"),
) -> GateRule:
    try:
        return GateRule.parse(gate or settings.default_gate)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def get_confidence(
    confidence: float | None = Query(default=None, ge=0.5, le=0.99),
) -> float:
    return confidence if confidence is not None else settings.default_confidence


def resolve_range(snapshot: Snapshot, start: date | None, end: date | None) -> tuple[date, date]:
    resolved_start = start or snapshot.meta.delivery_from
    resolved_end = end or snapshot.meta.delivery_to
    if resolved_start > resolved_end:
        raise HTTPException(status_code=400, detail="start must be before or equal to end")
    if resolved_start < snapshot.meta.delivery_from or resolved_end > snapshot.meta.delivery_to:
        raise HTTPException(
            status_code=400,
            detail=(
                f"date range must fall within {snapshot.meta.delivery_from} "
                f"to {snapshot.meta.delivery_to}"
            ),
        )
    return resolved_start, resolved_end
