import { AlertTriangle, ArrowUpRight, Database, EyeOff } from "lucide-react";
import type * as React from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DayResponse } from "@/lib/api";
import { formatDateTime, formatGate, formatLead } from "@/lib/format";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-b border-border/60 py-2 text-xs last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export function ProvenancePanel({ day }: { day: DayResponse }) {
  const publishTimes = day.provenance.publish_times;
  const selected =
    publishTimes.length === 0
      ? "No eligible vintage"
      : publishTimes.length === 1
        ? formatDateTime(publishTimes[0])
        : `${formatDateTime(publishTimes[0])} and ${publishTimes.length - 1} other publication${publishTimes.length > 2 ? "s" : ""}`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Database className="size-4 text-muted-foreground" aria-hidden="true" />
            Audit trail
          </CardTitle>
          <Badge variant="success" className="gap-1">
            <EyeOff className="size-3" aria-hidden="true" />
            No look-ahead
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl>
          <Row label="Gate closure" value={formatGate(day.provenance.gate)} />
          <Row label="Decision time" value={formatDateTime(day.provenance.decision_time)} />
          <Row label="Used vintage" value={selected} />
          <Row
            label="Lead time"
            value={
              day.provenance.lead_hours_min === null
                ? "—"
                : `${formatLead(day.provenance.lead_hours_min)} – ${formatLead(day.provenance.lead_hours_max)}`
            }
          />
          <Row label="Snapshot built" value={formatDateTime(day.provenance.snapshot_built_at)} />
        </dl>

        <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
          Selection rule: the latest forecast whose publication time is at or before
          the decision time. Later vintages are discarded.
        </div>

        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-xs leading-5 text-amber-900">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <p>
            FUELHH wind actuals may not cover the same metering population as WINDFOR
            GB wind. No bias correction is applied.
          </p>
        </div>

        <Link
          href="/method"
          className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900"
        >
          Read the method and limitations
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}
