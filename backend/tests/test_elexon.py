from datetime import UTC, date, datetime

import httpx

from reint.providers.elexon import ElexonClient


def test_actuals_are_chunked_and_filtered() -> None:
    queries: list[dict[str, str]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        queries.append(dict(request.url.params))
        return httpx.Response(
            200,
            json=[
                {
                    "dataset": "FUELHH",
                    "fuelType": "WIND",
                    "startTime": "2026-01-01T00:00:00Z",
                    "settlementDate": "2026-01-01",
                    "settlementPeriod": 1,
                    "generation": 1200,
                    "publishTime": "2026-01-01T01:30:00Z",
                },
                {
                    "dataset": "FUELHH",
                    "fuelType": "WIND",
                    "startTime": "2026-01-01T00:00:00Z",
                    "settlementDate": "2026-01-01",
                    "settlementPeriod": 1,
                    "generation": 1201,
                    "publishTime": "2026-01-01T01:30:00Z",
                },
                {
                    "dataset": "FUELHH",
                    "fuelType": "OTHER",
                    "startTime": "2026-01-01T00:30:00Z",
                    "generation": 5,
                },
                {
                    "dataset": "FUELHH",
                    "fuelType": "WIND",
                    "startTime": "2026-01-01T00:30:00Z",
                    "settlementDate": "2026-01-01",
                    "settlementPeriod": 2,
                    "generation": 1300,
                    "publishTime": "2026-01-01T02:00:00Z",
                },
            ],
        )

    client = ElexonClient(http=httpx.Client(transport=httpx.MockTransport(handler)))
    actuals = client.fetch_actuals(date(2026, 1, 1), date(2026, 1, 20))

    assert len(queries) == 3
    assert [query["settlementDateFrom"] for query in queries] == [
        "2026-01-01",
        "2026-01-08",
        "2026-01-15",
    ]
    assert [actual.generation_mw for actual in actuals] == [1201, 1300]
    assert actuals[1].settlement_period == 2
    assert actuals[1].publish_time == datetime(2026, 1, 1, 2, tzinfo=UTC)


def test_vintages_skip_rows_without_publish_time() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "data": [
                    {
                        "dataset": "WINDFOR",
                        "startTime": "2026-01-15T00:00:00Z",
                        "publishTime": "2026-01-14T07:30:00Z",
                        "generation": 12000,
                    },
                    {
                        "dataset": "WINDFOR",
                        "startTime": "2026-01-15T01:00:00Z",
                        "generation": 12500,
                    },
                ]
            },
        )

    client = ElexonClient(http=httpx.Client(transport=httpx.MockTransport(handler)))
    forecasts = client.fetch_vintages(datetime(2026, 1, 15, tzinfo=UTC))

    assert len(forecasts) == 1
    assert forecasts[0].generation_mw == 12000
    assert forecasts[0].publish_time == datetime(2026, 1, 14, 7, 30, tzinfo=UTC)
