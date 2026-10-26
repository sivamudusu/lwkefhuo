"use client";

import { useState } from "react";

import type { DailyRow } from "@/lib/api";
import { clamp, formatDateShort, formatPercent } from "@/lib/format";

const WIDTH = 920;
const HEIGHT = 280;
const MARGIN = { top: 20, right: 20, bottom: 38, left: 48 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

export function CoverageChart({
  daily,
  confidence,
}: {
  daily: DailyRow[];
  confidence: number;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const rows = daily.filter((row) => row.coverage !== null);
  if (rows.length === 0) {
    return null;
  }

  const slot = PLOT_WIDTH / Math.max(rows.length, 1);
  const x = (index: number) => MARGIN.left + slot * index + slot / 2;
  const y = (value: number) => MARGIN.top + PLOT_HEIGHT - value * PLOT_HEIGHT;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const labelIndices = new Set([0, Math.floor(rows.length / 2), rows.length - 1]);
  const path = rows
    .map((row, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(row.coverage as number)}`)
    .join(" ");
  const hovered = hoverIndex === null ? null : rows[hoverIndex];
  const hoverX = hoverIndex === null ? null : x(hoverIndex);
  const tooltipWidth = 180;
  const tooltipHeight = 66;
  const tooltipX =
    hoverX === null
      ? 0
      : hoverX + 12 + tooltipWidth > WIDTH - MARGIN.right
        ? hoverX - tooltipWidth - 12
        : hoverX + 12;
  const tooltipY = MARGIN.top + 8;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label="Share of realised actuals inside the walk-forward forecast band, by delivery day"
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const svgX = ((event.clientX - rect.left) / rect.width) * WIDTH;
          const index = Math.floor((svgX - MARGIN.left) / slot);
          setHoverIndex(clamp(index, 0, rows.length - 1));
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
              {Math.round(tick * 100)}%
            </text>
          </g>
        ))}

        <line
          x1={MARGIN.left}
          x2={WIDTH - MARGIN.right}
          y1={y(confidence)}
          y2={y(confidence)}
          className="stroke-amber-500"
          strokeDasharray="5 4"
        />
        <text
          x={WIDTH - MARGIN.right}
          y={y(confidence) - 6}
          textAnchor="end"
          className="fill-amber-700 text-[10px] font-medium"
        >
          target {Math.round(confidence * 100)}%
        </text>

        <path
          d={path}
          fill="none"
          className="stroke-teal-600"
          strokeWidth={2.4}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {rows.map((row, index) => (
          <circle
            key={row.date}
            cx={x(index)}
            cy={y(row.coverage as number)}
            r={hoverIndex === index ? 4 : 2.5}
            className={row.provisional ? "fill-amber-500" : "fill-teal-600"}
          />
        ))}

        {rows.map((row, index) =>
          labelIndices.has(index) ? (
            <text
              key={`label-${row.date}`}
              x={x(index)}
              y={HEIGHT - 14}
              textAnchor="middle"
              className="fill-slate-500 text-[10px] tabular-nums"
            >
              {formatDateShort(row.date)}
            </text>
          ) : null,
        )}

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
            <rect
              x={tooltipX}
              y={tooltipY}
              width={tooltipWidth}
              height={tooltipHeight}
              rx={8}
              className="fill-background stroke-border"
              strokeWidth={1}
            />
            <text
              x={tooltipX + 10}
              y={tooltipY + 17}
              className="fill-foreground text-[11px] font-semibold"
            >
              {formatDateShort(hovered.date)}
            </text>
            <text x={tooltipX + 10} y={tooltipY + 35} className="fill-slate-600 text-[11px]">
              Coverage <tspan className="fill-slate-900 font-medium">{formatPercent(hovered.coverage, 1)}</tspan>
            </text>
            <text x={tooltipX + 10} y={tooltipY + 51} className="fill-slate-600 text-[11px]">
              Target <tspan className="fill-amber-700 font-medium">{formatPercent(confidence)}</tspan>
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}
