"use client";

import { CalendarDays, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import type { MetaResponse } from "@/lib/api";
import { formatDate, formatGate } from "@/lib/format";

function addDays(iso: string, days: number): string {
  const value = new Date(`${iso}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function DeskControls({
  meta,
  date,
  gate,
  confidence,
  onDate,
  onGate,
  onConfidence,
}: {
  meta: MetaResponse;
  date: string;
  gate: string;
  confidence: string;
  onDate: (value: string) => void;
  onGate: (value: string) => void;
  onConfidence: (value: string) => void;
}) {
  const { delivery_from: from, delivery_to: to } = meta.snapshot;
  const previous = addDays(date, -1);
  const next = addDays(date, 1);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          Delivery day
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous delivery day"
            disabled={date <= from}
            onClick={() => onDate(previous)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <label className="sr-only" htmlFor="delivery-date">
            Delivery day
          </label>
          <input
            id="delivery-date"
            type="date"
            value={date}
            min={from}
            max={to}
            onChange={(event) => {
              if (event.target.value) {
                onDate(event.target.value);
              }
            }}
            className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next delivery day"
            disabled={date >= to}
            onClick={() => onDate(next)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <span className="hidden text-xs text-muted-foreground md:inline">
          {formatDate(date)}
        </span>
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
