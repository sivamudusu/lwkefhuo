"use client";

import { useState } from "react";

import type { DailyRow } from "@/lib/api";
import { clamp, formatDateShort, formatGw, formatPercent } from "@/lib/format";

const WIDTH = 920;
const HEIGHT = 280;
const MARGIN = { top: 20, right: 20, bottom: 38, left: 56 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

export function DailyErrorChart({ daily }: { daily: DailyRow[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const rows = daily.filter((row) => row.mae_mw !== null);
  if (rows.length === 0) {
    return null;
  }

  const max = Math.max(...rows.map((row) => row.mae_mw as number), 1000) * 1.1;
  const ticks = Array.from({ length: 5 }, (_, index) => (max * index) / 4);
  const slot = PLOT_WIDTH / rows.length;
  const barWidth = Math.max(4, slot * 0.68);
  const y = (value: number) => MARGIN.top + PLOT_HEIGHT - (value / max) * PLOT_HEIGHT;
  const x = (index: number) => MARGIN.left + slot * index + slot / 2;
  const labelIndices = new Set([0, Math.floor(rows.length / 2), rows.length - 1]);
  const hovered = hoverIndex === null ? null : rows[hoverIndex];
  const hoverX = hoverIndex === null ? null : x(hoverIndex);
  const tooltipWidth = 180;
  const tooltipHeight = 76;
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
        aria-label="Mean absolute forecast error by delivery day"
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
              {(tick / 1000).toFixed(1)}
            </text>
          </g>
        ))}
        <text
          x={MARGIN.left - 10}
          y={MARGIN.top - 6}
          textAnchor="end"
          className="fill-slate-400 text-[10px] font-medium"
        >
          GW
        </text>

        {rows.map((row, index) => {
          const value = row.mae_mw as number;
          return (
            <g key={row.date}>
              <rect
                x={x(index) - barWidth / 2}
                y={y(value)}
                width={barWidth}
                height={y(0) - y(value)}
                rx={2}
                className={
                  hoverIndex === index
                    ? "fill-teal-700"
                    : row.provisional
                      ? "fill-amber-500/75"
                      : "fill-teal-600/80"
                }
              />
              {labelIndices.has(index) ? (
                <text
                  x={x(index)}
                  y={HEIGHT - 14}
                  textAnchor="middle"
                  className="fill-slate-500 text-[10px] tabular-nums"
                >
                  {formatDateShort(row.date)}
                </text>
              ) : null}
            </g>
          );
        })}

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
              MAE <tspan className="fill-slate-900 font-medium">{formatGw(hovered.mae_mw)}</tspan>
            </text>
            <text x={tooltipX + 10} y={tooltipY + 51} className="fill-slate-600 text-[11px]">
              RMSE <tspan className="fill-slate-900 font-medium">{formatGw(hovered.rmse_mw)}</tspan>
            </text>
            <text x={tooltipX + 10} y={tooltipY + 67} className="fill-slate-600 text-[11px]">
              Coverage <tspan className="fill-slate-900 font-medium">{formatPercent(hovered.coverage, 1)}</tspan>
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}
