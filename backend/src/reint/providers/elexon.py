import logging
import time
from collections.abc import Iterable, Mapping
from datetime import date, datetime, timedelta
from typing import Any, Protocol

import httpx

from reint.domain.models import Actual, Forecast
from reint.domain.timegrid import parse_iso, to_iso_z

logger = logging.getLogger(__name__)

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"
MAX_ACTUAL_RANGE_DAYS = 7


class ElexonError(RuntimeError):
    pass


class ElexonSource(Protocol):
    def fetch_actuals(self, start: date, end: date) -> list[Actual]: ...

    def fetch_vintages(self, delivery_hour: datetime) -> list[Forecast]: ...


def _rows(payload: Any) -> list[Mapping[str, Any]]:
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, Mapping)]
    if isinstance(payload, Mapping):
        data = payload.get("data", [])
        if isinstance(data, list):
            return [row for row in data if isinstance(row, Mapping)]
    return []


def _generation(row: Mapping[str, Any]) -> float | None:
    value = row.get("generation")
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


class ElexonClient:
    def __init__(
        self,
        http: httpx.Client | None = None,
        base_url: str = BASE_URL,
        max_retries: int = 3,
    ) -> None:
        self._http = http or httpx.Client(timeout=30.0, headers={"Accept": "application/json"})
        self._owns_http = http is None
        self._base_url = base_url.rstrip("/")
        self._max_retries = max_retries

    def __enter__(self) -> "ElexonClient":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def close(self) -> None:
        if self._owns_http:
            self._http.close()

    def _get(self, path: str, params: Mapping[str, str]) -> Any:
        url = f"{self._base_url}{path}"
        for attempt in range(self._max_retries):
            try:
                response = self._http.get(url, params=params)
                if response.status_code == 400:
                    raise ElexonError(f"Elexon rejected {url}: {response.text[:300]}")
                response.raise_for_status()
                return response.json()
            except ElexonError:
                raise
            except (httpx.HTTPError, ValueError) as exc:
                if attempt == self._max_retries - 1:
                    raise ElexonError(f"Elexon request failed after retries: {url} {exc}") from exc
                delay = 2**attempt
                logger.warning("Elexon request failed (%s); retrying in %ss", exc, delay)
                time.sleep(delay)
        raise ElexonError(f"Elexon request failed: {url}")

    def fetch_actuals(self, start: date, end: date) -> list[Actual]:
        if start > end:
            raise ValueError("start must be before or equal to end")

        actuals: dict[datetime, Actual] = {}
        chunk_start = start
        while chunk_start <= end:
            chunk_end = min(chunk_start + timedelta(days=MAX_ACTUAL_RANGE_DAYS - 1), end)
            payload = self._get(
                "/datasets/FUELHH",
                {
                    "settlementDateFrom": chunk_start.isoformat(),
                    "settlementDateTo": chunk_end.isoformat(),
                    "fuelType": "WIND",
                },
            )
            for row in _rows(payload):
                if row.get("fuelType") != "WIND":
                    continue
                generation = _generation(row)
                start_time = row.get("startTime")
                if generation is None or not isinstance(start_time, str):
                    continue
                delivery_at = parse_iso(start_time)
                publish_raw = row.get("publishTime") or start_time
                publish_time = (
                    parse_iso(publish_raw) if isinstance(publish_raw, str) else delivery_at
                )
                settlement_date_raw = row.get("settlementDate")
                settlement_date = (
                    date.fromisoformat(settlement_date_raw)
                    if isinstance(settlement_date_raw, str)
                    else delivery_at.date()
                )
                try:
                    settlement_period = int(row.get("settlementPeriod", 0))
                except (TypeError, ValueError):
                    settlement_period = 0
                actuals[delivery_at] = Actual(
                    delivery_at=delivery_at,
                    settlement_date=settlement_date,
                    settlement_period=settlement_period,
                    generation_mw=generation,
                    publish_time=publish_time,
                )
            logger.info("Fetched actuals %s to %s", chunk_start, chunk_end)
            chunk_start = chunk_end + timedelta(days=1)

        return sorted(actuals.values(), key=lambda actual: actual.delivery_at)

    def fetch_vintages(self, delivery_hour: datetime) -> list[Forecast]:
        payload = self._get(
            "/forecast/generation/wind/evolution",
            {"startTime": to_iso_z(delivery_hour)},
        )
        forecasts: dict[tuple[datetime, datetime], Forecast] = {}
        for row in _rows(payload):
            generation = _generation(row)
            start_time = row.get("startTime")
            publish_time_raw = row.get("publishTime")
            if generation is None or not isinstance(start_time, str):
                continue
            if not isinstance(publish_time_raw, str):
                continue
            delivery_at = parse_iso(start_time)
            publish_time = parse_iso(publish_time_raw)
            forecasts[(delivery_at, publish_time)] = Forecast(
                delivery_at=delivery_at,
                publish_time=publish_time,
                generation_mw=generation,
            )
        return sorted(
            forecasts.values(), key=lambda forecast: (forecast.delivery_at, forecast.publish_time)
        )


def vintages_by_hour(forecasts: Iterable[Forecast]) -> dict[datetime, list[Forecast]]:
    grouped: dict[datetime, list[Forecast]] = {}
    for forecast in forecasts:
        grouped.setdefault(forecast.delivery_at, []).append(forecast)
    for values in grouped.values():
        values.sort(key=lambda forecast: forecast.publish_time)
    return grouped
