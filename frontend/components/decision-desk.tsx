"use client";

import { BatteryCharging, Gauge, ShieldCheck, Target } from "lucide-react";

import { DayChart } from "@/components/charts/day-chart";
import { DecisionSummary } from "@/components/decision-summary";
import { DeskBodySkeleton } from "@/components/desk-skeleton";
import { DeskControls } from "@/components/desk-controls";
import { HourlyTable } from "@/components/hourly-table";
import { KpiCard } from "@/components/kpi-card";
import { PageHeader } from "@/components/page-header";
import { ProvenancePanel } from "@/components/provenance-panel";
import { VintageAudit } from "@/components/vintage-audit";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorState } from "@/components/ui/states";
import {
  ApiError,
  type DayResponse,
  type MetaResponse,
  type VintagesResponse,
  useApi,
} from "@/lib/api";
import {
  bandLabel,
  bandRange,
  defaultDeskDate,
  formatGwh,
  formatGw,
  formatPercent,
  formatTime,
} from "@/lib/format";
import { useQueryFilters } from "@/lib/use-filters";

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 503) {
      return "The API is running but its snapshot is missing. Run `make ingest` in the repository, then reload.";
    }
    if (error.status === 404) {
      return "That delivery day is not present in the committed snapshot.";
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "The request failed before a response was received.";
}

function Legend({ confidence }: { confidence: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-0.5 w-5 rounded bg-slate-900" aria-hidden="true" />
        Actual
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-5 border-t-2 border-dashed border-teal-600" aria-hidden="true" />
        Selected forecast
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="size-2.5 rounded-sm border border-teal-500/30 bg-teal-500/15"
          aria-hidden="true"
        />
        {bandLabel(confidence)}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="size-2.5 rounded-sm border border-amber-400/50 bg-amber-400/25"
          aria-hidden="true"
        />
        Reserve
      </span>
    </div>
  );
}

function DeskContent({
  day,
  vintages,
  vintagesError,
  onRetryVintages,
  confidence,
}: {
  day: DayResponse;
  vintages: VintagesResponse | undefined;
  vintagesError: unknown;
  onRetryVintages: () => void;
  confidence: string;
}) {
  const summary = day.summary;
  const hasBand = (summary.hours_with_band ?? 0) > 0;
  const peak = day.hours.reduce(
    (best, hour) => ((hour.reserve_mw ?? 0) > (best.reserve_mw ?? 0) ? hour : best),
    day.hours[0],
  );

  return (
    <div className="min-w-0 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Peak reserve"
          value={hasBand ? formatGw(summary.reserve_peak_mw) : "—"}
          hint={hasBand ? `tightest at ${formatTime(peak.hour)} UTC` : "no prior calibration"}
          icon={ShieldCheck}
          tone="amber"
          badge={<Badge variant="warning">{Math.round(Number(confidence) * 100)}% band</Badge>}
        />
        <KpiCard
          label="Reserve energy"
          value={hasBand ? formatGwh(summary.reserve_mwh) : "—"}
          hint="sum of hourly lower-edge shortfall"
          icon={BatteryCharging}
          tone="teal"
        />
        <KpiCard
          label="Forecast MAE"
          value={formatGw(summary.mae_mw)}
          hint={`${summary.count} hourly points`}
          icon={Gauge}
          tone="slate"
        />
        <KpiCard
          label="Band coverage"
          value={formatPercent(day.calibration.coverage, 1)}
          hint={`${day.calibration.days_used} prior day${day.calibration.days_used === 1 ? "" : "s"}`}
          icon={Target}
          tone="sky"
          badge={
            day.calibration.provisional ? (
              <Badge variant="warning">Provisional</Badge>
            ) : (
              <Badge variant="success">Walk-forward</Badge>
            )
          }
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="xl:col-start-1 xl:row-start-1">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle>Delivery-day wind</CardTitle>
                <CardDescription>
                  Selected forecast against realised wind, with the empirical{" "}
                  {bandRange(confidence)} residual band and the implied reserve.
                </CardDescription>
              </div>
              <Badge variant="outline">{day.hours.length} hours</Badge>
            </div>
            <Legend confidence={confidence} />
          </CardHeader>
          <CardContent>
            <DayChart points={day.hours} />
          </CardContent>
          <CardFooter className="border-t border-border/60 pt-3">
            <p className="text-xs leading-5 text-muted-foreground">
              The selected vintage is the latest forecast published at or before{" "}
              {formatTime(day.provenance.decision_time)} UTC. Actuals are half-hourly in
              the source and averaged to the hour here.
            </p>
          </CardFooter>
        </Card>

        <div className="min-w-0 space-y-6 xl:col-start-2 xl:row-span-2 xl:row-start-1">
          <DecisionSummary day={day} confidence={confidence} />
          <ProvenancePanel day={day} />
        </div>

        {vintages ? (
          <VintageAudit
            vintages={vintages}
            className="xl:col-start-1 xl:row-start-2"
          />
        ) : vintagesError ? (
          <div className="xl:col-start-1 xl:row-start-2">
            <ErrorState
              title="Vintage audit unavailable"
              message={describeError(vintagesError)}
              onRetry={onRetryVintages}
            />
          </div>
        ) : (
          <Card className="p-5 xl:col-start-1 xl:row-start-2">
            <p className="text-sm text-muted-foreground">Loading vintage audit…</p>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hourly detail</CardTitle>
          <CardDescription>
            Every hour of the delivery day, including the reserve at the lower edge of
            the calibrated band. The tightest hour is highlighted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HourlyTable hours={day.hours} confidence={confidence} />
        </CardContent>
      </Card>
    </div>
  );
}

export function DecisionDesk() {
  const { searchParams, setParam } = useQueryFilters();
  const metaState = useApi<MetaResponse>("/api/meta");
  const meta = metaState.data;

  const fallbackDate = meta ? defaultDeskDate(meta) : null;
  const requestedDate = searchParams.get("date");
  const date =
    meta &&
    requestedDate &&
    requestedDate >= meta.snapshot.delivery_from &&
    requestedDate <= meta.snapshot.delivery_to
      ? requestedDate
      : fallbackDate;

  const requestedGate = searchParams.get("gate");
  const gate =
    meta && requestedGate && meta.gates.includes(requestedGate)
      ? requestedGate
      : (meta?.default_gate ?? "09:20");

  const requestedConfidence = searchParams.get("confidence");
  const confidence =
    meta && requestedConfidence && meta.confidences.map(String).includes(requestedConfidence)
      ? requestedConfidence
      : String(meta?.default_confidence ?? 0.9);

  const query = new URLSearchParams({ gate, confidence }).toString();
  const dayState = useApi<DayResponse>(date ? `/api/day/${date}?${query}` : null);
  const vintagesState = useApi<VintagesResponse>(
    date ? `/api/day/${date}/vintages?gate=${encodeURIComponent(gate)}` : null,
  );

  if (!meta) {
    if (metaState.error) {
      return (
        <div className="mx-auto w-full max-w-[1440px] min-w-0 px-4 py-6 sm:px-6 lg:py-8">
          <ErrorState
            title="API unavailable"
            message={describeError(metaState.error)}
            onRetry={() => void metaState.mutate()}
          />
        </div>
      );
    }
    return <div className="mx-auto w-full max-w-[1440px] min-w-0 px-4 py-6 sm:px-6 lg:py-8"><DeskBodySkeleton /></div>;
  }

  const day = dayState.data;

  return (
    <div className="mx-auto w-full max-w-[1440px] min-w-0 space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <PageHeader
        eyebrow="Day-ahead decision"
        title="Decision desk"
        description="Replay the wind forecast that was actually available before gate closure, see it against realised wind, and size the non-wind cover the measured error implies."
      >
        <DeskControls
          meta={meta}
          date={date ?? fallbackDate ?? meta.snapshot.delivery_from}
          gate={gate}
          confidence={confidence}
          onDate={(value) => setParam("date", value)}
          onGate={(value) => setParam("gate", value)}
          onConfidence={(value) => setParam("confidence", value)}
        />
      </PageHeader>

      {dayState.error ? (
        <ErrorState
          title="No decision data"
          message={describeError(dayState.error)}
          onRetry={() => void dayState.mutate()}
        />
      ) : day ? (
        <DeskContent
          day={day}
          vintages={vintagesState.data}
          vintagesError={vintagesState.error}
          onRetryVintages={() => void vintagesState.mutate()}
          confidence={confidence}
        />
      ) : (
        <DeskBodySkeleton />
      )}
    </div>
  );
}
