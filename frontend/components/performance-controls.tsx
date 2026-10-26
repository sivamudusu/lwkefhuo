"use client";

import { CalendarRange, SlidersHorizontal } from "lucide-react";

import { Segmented } from "@/components/ui/segmented";
import type { MetaResponse } from "@/lib/api";
import { formatGate } from "@/lib/format";

export function PerformanceControls({
  meta,
  start,
  end,
  gate,
  confidence,
  onStart,
  onEnd,
  onGate,
  onConfidence,
}: {
  meta: MetaResponse;
  start: string;
  end: string;
  gate: string;
  confidence: string;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
  onGate: (value: string) => void;
  onConfidence: (value: string) => void;
}) {
  const { delivery_from: from, delivery_to: to } = meta.snapshot;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
          <CalendarRange className="size-3.5" aria-hidden="true" />
          Date range
        </span>
        <label className="sr-only" htmlFor="start-date">
          Start date
        </label>
        <input
          id="start-date"
          type="date"
          value={start}
          min={from}
          max={to}
          onChange={(event) => {
            if (event.target.value) {
              onStart(event.target.value);
            }
          }}
          className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <label className="sr-only" htmlFor="end-date">
          End date
        </label>
        <input
          id="end-date"
          type="date"
          value={end}
          min={from}
          max={to}
          onChange={(event) => {
            if (event.target.value) {
              onEnd(event.target.value);
            }
          }}
          className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border/70 pt-3">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <SlidersHorizontal className="size-3.5" aria-hidden="true" />
          Assumptions
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Gate</span>
          <Segmented
            label="Gate closure"
            value={gate}
            onChange={onGate}
            options={meta.gates.map((value) => ({
              value,
              label: formatGate(value),
            }))}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Confidence</span>
          <Segmented
            label="Confidence level"
            value={confidence}
            onChange={onConfidence}
            options={meta.confidences.map((value) => ({
              value: String(value),
              label: `${Math.round(value * 100)}%`,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
