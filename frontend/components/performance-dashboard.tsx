"use client";

import {
  Activity,
  ArrowUpRight,
  Gauge,
  Scale,
  Target,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

import { BucketBars } from "@/components/charts/bucket-bars";
import { CoverageChart } from "@/components/charts/coverage-chart";
import { DailyErrorChart } from "@/components/charts/daily-error-chart";
import { DeskBodySkeleton } from "@/components/desk-skeleton";
import { KpiCard } from "@/components/kpi-card";
import { PageHeader } from "@/components/page-header";
import { PerformanceControls } from "@/components/performance-controls";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorState } from "@/components/ui/states";
import { ApiError, type AccuracyResponse, type MetaResponse, useApi } from "@/lib/api";
import {
  formatDateShort,
  formatGw,
  formatPercent,
  formatSignedGw,
} from "@/lib/format";
import { useQueryFilters } from "@/lib/use-filters";
import { cn } from "@/lib/utils";

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "The request failed before a response was received.";
}

function Headline({ accuracy }: { accuracy: AccuracyResponse }) {
  const bias = accuracy.overall.bias_mw ?? 0;
  const coverage = accuracy.calibration.coverage;
  const skill = accuracy.baseline.skill_score;
  const target = accuracy.confidence;

  return (
    <Card className="border-teal-200 bg-teal-50/50 p-5">
      <p className="text-sm leading-6 text-teal-950">
        <span className="font-semibold">What the numbers say.</span>{" "}
        {skill !== null ? (
          <>
            The point-in-time forecast beats a persistence baseline by{" "}
            <span className="font-semibold">{formatPercent(skill)}</span> on MAE.{" "}
          </>
        ) : null}
        It ran <span className="font-semibold">{formatGw(Math.abs(bias))}</span>{" "}
        {bias < 0 ? "high against realised wind" : "low against realised wind"} on
        average.{" "}
        {coverage !== null ? (
          <>
            The {Math.round(target * 100)}% band contained{" "}
            <span className="font-semibold">{formatPercent(coverage, 1)}</span> of actuals
            {coverage < target ? ", so it was narrower than its label." : "."}
          </>
        ) : null}
      </p>
    </Card>
  );
}

export function PerformanceDashboard() {
  const { searchParams, setParam, setParams } = useQueryFilters();
  const metaState = useApi<MetaResponse>("/api/meta");
  const meta = metaState.data;

  const requestedStart = searchParams.get("start");
  const requestedEnd = searchParams.get("end");
  const initialStart =
    meta && requestedStart && requestedStart >= meta.snapshot.delivery_from && requestedStart <= meta.snapshot.delivery_to
      ? requestedStart
      : (meta?.snapshot.delivery_from ?? "");
  const initialEnd =
    meta && requestedEnd && requestedEnd >= meta.snapshot.delivery_from && requestedEnd <= meta.snapshot.delivery_to
      ? requestedEnd
      : (meta?.snapshot.delivery_to ?? "");
  const start =
    initialStart && initialEnd && initialStart > initialEnd ? initialEnd : initialStart;
  const end =
    initialStart && initialEnd && initialStart > initialEnd ? initialStart : initialEnd;

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

  const query = new URLSearchParams({ start, end, gate, confidence }).toString();
  const accuracyState = useApi<AccuracyResponse>(
    meta && start && end ? `/api/accuracy?${query}` : null,
  );

  if (!meta) {
    if (metaState.error) {
      return (
        <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:py-8">
          <ErrorState
            title="API unavailable"
            message={describeError(metaState.error)}
            onRetry={() => void metaState.mutate()}
          />
        </div>
      );
    }
    return <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:py-8"><DeskBodySkeleton /></div>;
  }

  const accuracy = accuracyState.data;

  return (
    <div className="mx-auto w-full max-w-[1440px] min-w-0 space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <PageHeader
        eyebrow="Forecast performance"
        title="How wrong was the forecast?"
        description="Measured error, persistence baseline, and walk-forward band calibration for the selected period. Every band uses only residuals from days before the day being scored."
      >
        <PerformanceControls
          meta={meta}
          start={start}
          end={end}
          gate={gate}
          confidence={confidence}
          onStart={(value) =>
            setParams(value > end ? { start: value, end: value } : { start: value })
          }
          onEnd={(value) =>
            setParams(value < start ? { start: value, end: value } : { end: value })
          }
          onGate={(value) => setParam("gate", value)}
          onConfidence={(value) => setParam("confidence", value)}
        />
      </PageHeader>

      {accuracyState.error ? (
        <ErrorState
          title="No performance data"
          message={describeError(accuracyState.error)}
          onRetry={() => void accuracyState.mutate()}
        />
      ) : accuracy ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard
              label="MAE"
              value={formatGw(accuracy.overall.mae_mw)}
              hint={`${accuracy.overall.count} hourly points`}
              icon={Gauge}
              tone="teal"
            />
            <KpiCard
              label="RMSE"
              value={formatGw(accuracy.overall.rmse_mw)}
              hint="penalises large misses"
              icon={Activity}
              tone="sky"
            />
            <KpiCard
              label="Bias"
              value={formatSignedGw(accuracy.overall.bias_mw)}
              hint="actual − forecast"
              icon={Scale}
              tone="slate"
            />
            <KpiCard
              label="Skill vs persistence"
              value={formatPercent(accuracy.baseline.skill_score)}
              hint={`persistence ${formatGw(accuracy.baseline.persistence_mae_mw)}`}
              icon={TrendingUp}
              tone={
                (accuracy.baseline.skill_score ?? 0) > 0 ? "teal" : "rose"
              }
            />
            <KpiCard
              label="Band coverage"
              value={formatPercent(accuracy.calibration.coverage, 1)}
              hint={`target ${formatPercent(accuracy.confidence)}`}
              icon={Target}
              tone="amber"
              badge={
                accuracy.calibration.coverage !== null &&
                accuracy.calibration.coverage >= accuracy.confidence - 0.05 ? (
                  <Badge variant="success">On target</Badge>
                ) : (
                  <Badge variant="warning">Below target</Badge>
                )
              }
            />
          </div>

          <Headline accuracy={accuracy} />

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Daily mean absolute error</CardTitle>
                <CardDescription>
                  Amber bars are provisional days with less than seven days of prior
                  calibration history.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DailyErrorChart daily={accuracy.daily} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Band coverage by day</CardTitle>
                <CardDescription>
                  Share of hourly actuals inside the walk-forward band. The dashed line
                  is the selected confidence target.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CoverageChart
                  daily={accuracy.daily}
                  confidence={Number(confidence)}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Error by lead time</CardTitle>
                <CardDescription>
                  Realised lead time, not a fixed horizon. Later vintages usually mean a
                  shorter lead and a smaller error.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BucketBars
                  rows={accuracy.by_lead_bucket}
                  emptyLabel="No residuals in this range."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Error by wind level</CardTitle>
                <CardDescription>
                  Error is bucketed by realised hourly wind, so the buyer can see where
                  the forecast is weakest.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BucketBars
                  rows={accuracy.by_wind_level}
                  emptyLabel="No residuals in this range."
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Calibration</CardTitle>
                <CardDescription>
                  Walk-forward residual bands. Early days are labelled provisional and
                  use pooled residuals when a bucket is thin.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-baseline justify-between border-b border-border/60 pb-3">
                  <span className="text-sm text-muted-foreground">Achieved coverage</span>
                  <span className="text-2xl font-semibold tabular-nums">
                    {formatPercent(accuracy.calibration.coverage, 1)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between border-b border-border/60 pb-3">
                  <span className="text-sm text-muted-foreground">Target</span>
                  <span className="font-medium tabular-nums">
                    {formatPercent(accuracy.confidence)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between border-b border-border/60 pb-3">
                  <span className="text-sm text-muted-foreground">Hours with a band</span>
                  <span className="font-medium tabular-nums">
                    {accuracy.calibration.hours_with_band}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Provisional days</span>
                  <span className="font-medium tabular-nums">
                    {accuracy.calibration.provisional_days}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Daily results</CardTitle>
                <CardDescription>
                  Open any day in the Decision Desk with the same gate and confidence.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[440px] overflow-auto rounded-lg border border-border">
                  <table className="w-full min-w-[680px] border-collapse text-sm">
                    <caption className="sr-only">Daily forecast error and band coverage</caption>
                    <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                      <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th scope="col" className="px-3 py-2 font-medium">Day</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">MAE</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">RMSE</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Bias</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Coverage</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Status</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Desk</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {accuracy.daily.map((row) => (
                        <tr key={row.date} className="hover:bg-muted/40">
                          <th scope="row" className="px-3 py-2 text-left font-medium tabular-nums">
                            {formatDateShort(row.date)}
                          </th>
                          <td className="px-3 py-2 text-right tabular-nums">{formatGw(row.mae_mw)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {formatGw(row.rmse_mw)}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2 text-right tabular-nums",
                              (row.bias_mw ?? 0) < 0 ? "text-rose-700" : "text-emerald-700",
                            )}
                          >
                            {formatSignedGw(row.bias_mw)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatPercent(row.coverage, 1)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {row.provisional ? (
                              <Badge variant="warning">Provisional</Badge>
                            ) : (
                              <Badge variant="success">Calibrated</Badge>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Link
                              href={`/?date=${row.date}&gate=${gate}&confidence=${confidence}`}
                              className="inline-flex items-center gap-0.5 text-xs font-medium text-teal-700 hover:text-teal-900"
                            >
                              Open
                              <ArrowUpRight className="size-3" aria-hidden="true" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          <p className="text-xs leading-5 text-muted-foreground">
            Metrics use hourly means of half-hourly actuals. Persistence predicts the
            same hour on the previous day. Bands are empirical 5th–95th (or 2.5th–97.5th
            for 95%) percentiles of prior residuals by lead-time bucket, with a minimum
            of seven prior days and five samples.
          </p>
        </>
      ) : (
        <DeskBodySkeleton />
      )}
    </div>
  );
}
