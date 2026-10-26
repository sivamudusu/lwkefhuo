import argparse
import logging
import sys
from pathlib import Path

from reint.providers.elexon import BASE_URL, ElexonClient
from reint.store.snapshot import build_snapshot


def _default_snapshot() -> Path:
    return Path(__file__).resolve().parents[2] / "data" / "snapshot.sqlite"


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the Elexon wind snapshot used by the API.")
    parser.add_argument(
        "--month", default="2026-01", help="Delivery month, YYYY-MM (default: 2026-01)"
    )
    parser.add_argument(
        "--snapshot",
        type=Path,
        default=_default_snapshot(),
        help="Snapshot SQLite path (default: backend/data/snapshot.sqlite)",
    )
    parser.add_argument("--concurrency", type=int, default=8, help="Parallel forecast requests")
    parser.add_argument("--base-url", default=BASE_URL, help="Elexon API base URL")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)

    try:
        with ElexonClient(base_url=args.base_url) as client:
            meta = build_snapshot(
                month=args.month,
                client=client,
                path=args.snapshot,
                concurrency=args.concurrency,
            )
    except Exception as exc:
        logging.error("Snapshot build failed: %s", exc)
        return 1

    print(
        f"Snapshot ready: {args.snapshot}\n"
        f"  deliveries: {meta.delivery_from} to {meta.delivery_to}\n"
        f"  actuals:    {meta.actual_rows} half-hour rows\n"
        f"  forecasts:  {meta.forecast_rows} vintages across {meta.forecast_hours} hours\n"
        f"  missing:    {meta.missing_forecast_hours} forecast hours"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
