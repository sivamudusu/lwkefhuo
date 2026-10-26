import os
from dataclasses import dataclass
from pathlib import Path

from reint.version import __version__


@dataclass(frozen=True)
class Settings:
    snapshot_path: Path
    cors_origins: tuple[str, ...]
    default_gate: str
    default_confidence: float
    version: str


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _resolve_path(value: str) -> Path:
    path = Path(value).expanduser()
    return path if path.is_absolute() else (_project_root() / path).resolve()


def load_settings() -> Settings:
    default_snapshot = _project_root() / "data" / "snapshot.sqlite"
    snapshot_path = _resolve_path(os.environ.get("SNAPSHOT_PATH", str(default_snapshot)))
    origins = tuple(
        origin.strip()
        for origin in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
        if origin.strip()
    )
    return Settings(
        snapshot_path=snapshot_path,
        cors_origins=origins,
        default_gate=os.environ.get("DEFAULT_GATE", "09:20"),
        default_confidence=float(os.environ.get("DEFAULT_CONFIDENCE", "0.9")),
        version=__version__,
    )
