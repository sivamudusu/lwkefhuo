"use client";

import { useState } from "react";

import type { HourPoint } from "@/lib/api";
import { clamp, formatDateShort, formatGw, formatTime } from "@/lib/format";

const WIDTH = 920;
const HEIGHT = 360;
const MARGIN = { top: 24, right: 24, bottom: 38, left: 58 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

function linePoints(
  points: HourPoint[],
  indexOf: (point: HourPoint) => number,
  value: (point: HourPoint) => number,
  x: (index: number) => number,
  y: (value: number) => number,
): string {
  return points
    .filter((point) => value(point) !== null && !Number.isNaN(value(point)))
    .map((point) => `${x(indexOf(point))},${y(value(point))}`)
    .join(" ");
}

export function DayChart({ points }: { points: HourPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const indexByPoint = new Map(points.map((point, index) => [point, index]));

  const values = points.flatMap((point) =>
    [point.actual_mw, point.forecast_mw, point.band_low_mw, point.band_high_mw].filter(
      (value): value is number => value !== null && !Number.isNaN(value),
    ),
  );
  if (values.length === 0) {
    return null;
  }

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = Math.max((rawMax - rawMin) * 0.08, 250);
  const min = Math.max(0, rawMin - padding);
  const max = rawMax + padding;
  const span = max - min || 1;

  const x = (index: number) => MARGIN.left + (index / Math.max(points.length - 1, 1)) * PLOT_WIDTH;
  const y = (value: number) => MARGIN.top + PLOT_HEIGHT - ((value - min) / span) * PLOT_HEIGHT;
  const indexOf = (point: HourPoint) => indexByPoint.get(point) ?? 0;

  const ticks = Array.from({ length: 5 }, (_, index) => min + (span * index) / 4);
  const xTickIndices = [0, 6, 12, 18, 23].filter((index) => index < points.length);

  const banded = points.filter(
    (point) => point.band_low_mw !== null && point.band_high_mw !== null,
  );
  const bandPolygon =
    banded.length > 1
      ? [
          ...banded.map(
            (point) =>
              `${x(indexOf(point))},${y(point.band_high_mw as number)}`,
          ),
          ...[...banded]
            .reverse()
            .map((point) => `${x(indexOf(point))},${y(point.band_low_mw as number)}`),
        ].join(" ")
      : null;

  const reserve = banded.filter(
    (point) => point.forecast_mw !== null && point.band_low_mw !== null,
  );
  const reservePolygon =
    reserve.length > 1
      ? [
          ...reserve.map(
            (point) => `${x(indexOf(point))},${y(point.forecast_mw as number)}`,
          ),
          ...[...reserve]
            .reverse()
            .map(
              (point) =>
                `${x(indexOf(point))},${y(
                  Math.min(point.forecast_mw as number, point.band_low_mw as number),
                )}`,
            ),
        ].join(" ")
      : null;

  const actualPoints = linePoints(
    points,
    indexOf,
    (point) => point.actual_mw as number,
    x,
    y,
  );
  const forecastPoints = linePoints(
    points,
    indexOf,
    (point) => point.forecast_mw as number,
    x,
    y,
  );

  const hovered = hoverIndex === null ? null : points[hoverIndex];
  const hoverX = hoverIndex === null ? null : x(hoverIndex);
  const tooltipWidth = 190;
  const tooltipHeight = 84;
  const tooltipX =
    hoverX === null
      ? 0
      : hoverX + 14 + tooltipWidth > WIDTH - MARGIN.right
        ? hoverX - tooltipWidth - 14
        : hoverX + 14;
  const tooltipY = MARGIN.top + 8;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label="Wind forecast, realised actuals and reserve band for the delivery day"
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const svgX = ((event.clientX - rect.left) / rect.width) * WIDTH;
          const index = Math.round(((svgX - MARGIN.left) / PLOT_WIDTH) * (points.length - 1));
          setHoverIndex(clamp(index, 0, points.length - 1));
        }}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={MARGIN.left}
              x2={WIDTH - MARGIN.right}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-slate-200"
              strokeDasharray="3 5"
            />
            <text
              x={MARGIN.left - 10}
              y={y(tick) + 3}
              textAnchor="end"
              className="fill-slate-500 text-[10px] tabular-nums"
            >
              {(tick / 1000).toFixed(1)}
            </text>
          </g>
        ))}
        <text
          x={MARGIN.left - 10}
          y={MARGIN.top - 8}
          textAnchor="end"
          className="fill-slate-400 text-[10px] font-medium"
        >
          GW
        </text>

        {bandPolygon ? (
          <>
            <polygon points={bandPolygon} className="fill-teal-500/10" />
            <polygon
              points={bandPolygon}
              className="fill-none stroke-teal-500/30"
              strokeWidth={1}
              strokeLinejoin="round"
            />
          </>
        ) : null}
        {reservePolygon ? (
          <polygon points={reservePolygon} className="fill-amber-400/25" />
        ) : null}

        {actualPoints ? (
          <polyline
            points={actualPoints}
            fill="none"
            className="stroke-slate-900"
            strokeWidth={2.4}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {forecastPoints ? (
          <polyline
            points={forecastPoints}
            fill="none"
            className="stroke-teal-600"
            strokeWidth={2.4}
            strokeDasharray="6 4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}

        {xTickIndices.map((index) => (
          <g key={index}>
            <line
              x1={x(index)}
              x2={x(index)}
              y1={MARGIN.top}
              y2={MARGIN.top + PLOT_HEIGHT}
              className="stroke-slate-200/70"
            />
            <text
              x={x(index)}
              y={HEIGHT - 14}
              textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
              className="fill-slate-500 text-[10px] tabular-nums"
            >
              {formatTime(points[index].hour)}
            </text>
          </g>
        ))}

        {hovered && hoverX !== null ? (
          <g pointerEvents="none">
            <line
              x1={hoverX}
              x2={hoverX}
              y1={MARGIN.top}
              y2={MARGIN.top + PLOT_HEIGHT}
              className="stroke-slate-400"
              strokeDasharray="3 4"
            />
            {hovered.actual_mw !== null ? (
              <circle
                cx={hoverX}
                cy={y(hovered.actual_mw)}
                r={4}
                className="fill-slate-900 stroke-background"
                strokeWidth={2}
              />
            ) : null}
            {hovered.forecast_mw !== null ? (
              <circle
                cx={hoverX}
                cy={y(hovered.forecast_mw)}
                r={4}
                className="fill-teal-600 stroke-background"
                strokeWidth={2}
              />
            ) : null}
            <rect
              x={tooltipX}
              y={tooltipY}
              width={tooltipWidth}
              height={tooltipHeight}
              rx={8}
              className="fill-background stroke-border"
              strokeWidth={1}
            />
            <text x={tooltipX + 10} y={tooltipY + 17} className="fill-foreground text-[11px] font-semibold">
              {formatDateShort(hovered.hour.slice(0, 10))} · {formatTime(hovered.hour)}
            </text>
            <text x={tooltipX + 10} y={tooltipY + 35} className="fill-slate-600 text-[11px]">
              Actual <tspan className="fill-slate-900 font-medium">{formatGw(hovered.actual_mw)}</tspan>
            </text>
            <text x={tooltipX + 10} y={tooltipY + 51} className="fill-slate-600 text-[11px]">
              Forecast <tspan className="fill-teal-700 font-medium">{formatGw(hovered.forecast_mw)}</tspan>
            </text>
            <text x={tooltipX + 10} y={tooltipY + 67} className="fill-slate-600 text-[11px]">
              Reserve <tspan className="fill-amber-700 font-medium">{formatGw(hovered.reserve_mw)}</tspan>
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}
