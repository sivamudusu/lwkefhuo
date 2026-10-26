from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from reint.api import create_app
from reint.domain.models import Actual, Forecast, SnapshotMeta
from reint.store.sqlite import write_snapshot

START = date(2026, 1, 1)
DAYS = 10


@pytest.fixture()
def client(tmp_path: Path) -> TestClient:
    path = tmp_path / "snapshot.sqlite"
    actuals: list[Actual] = []
    forecasts: list[Forecast] = []

    for offset in range(-1, DAYS):
        delivery_date = START + timedelta(days=offset)
        for half_hour in range(48):
            hour = half_hour // 2
            delivery_at = datetime.combine(
                delivery_date,
                time(hour, 30 if half_hour % 2 else 0),
                tzinfo=UTC,
            )
            generation = 10_000 + hour * 100 + offset * 50
            actuals.append(
                Actual(
                    delivery_at=delivery_at,
                    settlement_date=delivery_date,
                    settlement_period=half_hour + 1,
                    generation_mw=generation,
                    publish_time=delivery_at + timedelta(minutes=30),
                )
            )

    for offset in range(DAYS):
        delivery_date = START + timedelta(days=offset)
        for hour in range(24):
            delivery_at = datetime.combine(delivery_date, time(hour), tzinfo=UTC)
            generation = 10_000 + hour * 100 + offset * 50
            for publish_hour, markup in ((7, 500.0), (9, 100.0)):
                forecasts.append(
                    Forecast(
                        delivery_at=delivery_at,
                        publish_time=datetime.combine(
                            delivery_date - timedelta(days=1),
                            time(publish_hour, 30),
                            tzinfo=UTC,
                        ),
                        generation_mw=generation + markup,
                    )
                )

    meta = SnapshotMeta(
        source="test",
        built_at=datetime(2026, 2, 1, tzinfo=UTC),
        delivery_from=START,
        delivery_to=START + timedelta(days=DAYS - 1),
        actual_from=START - timedelta(days=1),
        actual_to=START + timedelta(days=DAYS - 1),
        actual_rows=len(actuals),
        forecast_rows=len(forecasts),
        forecast_hours=DAYS * 24,
        missing_forecast_hours=0,
    )
    write_snapshot(path, actuals, forecasts, meta)
    return TestClient(create_app(path))


def test_health_and_meta(client: TestClient) -> None:
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    meta = client.get("/api/meta")
    assert meta.status_code == 200
    body = meta.json()
    assert body["gates"] == ["09:20", "15:30"]
    assert body["snapshot"]["forecast_rows"] == DAYS * 24 * 2


def test_days_are_complete(client: TestClient) -> None:
    response = client.get("/api/days")
    assert response.status_code == 200
    days = response.json()["days"]
    assert len(days) == DAYS
    assert all(day["complete"] for day in days)


def test_day_uses_latest_eligible_vintage(client: TestClient) -> None:
    response = client.get("/api/day/2026-01-09")
    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["hours_with_band"] == 24
    assert body["summary"]["reserve_peak_mw"] == 500.0
    assert body["provenance"]["publish_times"] == ["2026-01-08T07:30:00Z"]
    assert body["hours"][0]["forecast_mw"] == 10_900.0

    later = client.get("/api/day/2026-01-09", params={"gate": "15:30"})
    assert later.status_code == 200
    later_body = later.json()
    assert later_body["provenance"]["publish_times"] == ["2026-01-08T09:30:00Z"]
    assert later_body["summary"]["reserve_peak_mw"] == 100.0


def test_first_day_has_no_history_band(client: TestClient) -> None:
    response = client.get("/api/day/2026-01-01")
    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["hours_with_band"] == 0
    assert body["summary"]["reserve_peak_mw"] == 0.0
    assert body["calibration"]["provisional"] is True


def test_accuracy_reports_baseline_and_calibration(client: TestClient) -> None:
    response = client.get("/api/accuracy")
    assert response.status_code == 200
    body = response.json()
    assert body["overall"]["count"] == DAYS * 24
    assert len(body["daily"]) == DAYS
    assert body["calibration"]["coverage"] == 1.0
    assert body["calibration"]["provisional_days"] == 7
    assert body["baseline"]["count"] == DAYS * 24
    assert body["baseline"]["model_mae_mw"] == 500.0
    assert body["baseline"]["persistence_mae_mw"] == 50.0
    assert body["by_lead_bucket"]
    assert body["by_wind_level"]


def test_vintages_expose_selection(client: TestClient) -> None:
    response = client.get("/api/day/2026-01-09/vintages")
    assert response.status_code == 200
    body = response.json()
    assert len(body["hours"]) == 24
    assert body["hours"][0]["selected_publish_time"] == "2026-01-08T07:30:00Z"
    assert len(body["hours"][0]["vintages"]) == 2


def test_bad_inputs_are_rejected(client: TestClient) -> None:
    assert client.get("/api/day/2026-02-01").status_code == 404
    assert client.get("/api/day/2026-01-09", params={"gate": "10:00"}).status_code == 400
    assert (
        client.get(
            "/api/accuracy",
            params={"start": "2026-01-10", "end": "2026-01-09"},
        ).status_code
        == 400
    )


def test_missing_snapshot_returns_503(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "absent.sqlite"))
    response = client.get("/api/health")
    assert response.status_code == 503
    assert "make ingest" in response.json()["detail"]
