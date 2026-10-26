from collections.abc import Mapping, Sequence
from datetime import datetime

from reint.domain.models import Forecast, HourPoint
from reint.domain.timegrid import GateRule


def select_forecast(vintages: Sequence[Forecast], decision_time: datetime) -> Forecast | None:
    eligible = [forecast for forecast in vintages if forecast.publish_time <= decision_time]
    if not eligible:
        return None
    return max(eligible, key=lambda forecast: forecast.publish_time)


def build_hour_points(
    hours: Sequence[datetime],
    actuals_by_hour: Mapping[datetime, float],
    forecasts_by_hour: Mapping[datetime, Sequence[Forecast]],
    gate: GateRule,
) -> list[HourPoint]:
    points: list[HourPoint] = []
    for hour in hours:
        decision_time = gate.decision_time(hour)
        selected = select_forecast(forecasts_by_hour.get(hour, ()), decision_time)
        actual_mw = actuals_by_hour.get(hour)
        if selected is None:
            points.append(
                HourPoint(
                    delivery_at=hour,
                    actual_mw=actual_mw,
                    forecast_mw=None,
                    publish_time=None,
                    lead_hours=None,
                    residual_mw=None,
                )
            )
            continue
        lead = (hour - selected.publish_time).total_seconds() / 3600
        residual = None if actual_mw is None else actual_mw - selected.generation_mw
        points.append(
            HourPoint(
                delivery_at=hour,
                actual_mw=actual_mw,
                forecast_mw=selected.generation_mw,
                publish_time=selected.publish_time,
                lead_hours=lead,
                residual_mw=residual,
            )
        )
    return points
