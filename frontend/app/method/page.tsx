import type * as React from "react";
import {
  ArrowRight,
  Clock3,
  Database,
  FileWarning,
  Gauge,
  Layers,
  type LucideIcon,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Method",
};

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 text-teal-700" aria-hidden="true" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm leading-6 text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground">
      {children}
    </code>
  );
}

export default function MethodPage() {
  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-8 px-4 py-6 sm:px-6 lg:py-10">
      <PageHeader
        eyebrow="Method"
        title="What this desk does, and what it does not."
        description="A historical replay built around one defensible question: what wind forecast could the buyer actually see at gate closure, and how wrong was it? The answer is reproducible because the data is a committed snapshot, not a live API call."
      >
        <div className="flex flex-wrap gap-2">
          <Badge variant="success">No look-ahead</Badge>
          <Badge variant="info">Walk-forward bands</Badge>
          <Badge variant="outline">Read-only snapshot</Badge>
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          icon={Database}
          title="The data"
          description="Public Elexon Insights Solution, no API key, no synthetic demand."
        >
          <p>
            Actual wind comes from <Formula>FUELHH</Formula>, which is half-hourly and
            returns 48 rows per day. Historical queries use{" "}
            <Formula>settlementDateFrom</Formula> and{" "}
            <Formula>settlementDateTo</Formula>, with a maximum seven-day range per
            request.
          </p>
          <p className="mt-3">
            Forecasts come from <Formula>WINDFOR</Formula>, which is hourly. The latest
            vintage alone is not enough, so ingestion calls the wind evolution endpoint
            once per delivery hour and stores every published vintage. The January
            snapshot holds 744 delivery hours and roughly 24 vintages per hour.
          </p>
          <p className="mt-3">
            The API never calls Elexon. Ingestion is an explicit offline command, so the
            demo is deterministic and works when the upstream API is slow or down.
          </p>
        </SectionCard>

        <SectionCard
          icon={Clock3}
          title="The decision rule"
          description="Latest vintage published at or before gate closure, not the latest forecast overall."
        >
          <p>
            The default gate is <strong>09:20 D-1</strong>, the EPEX GB hourly day-ahead
            auction gate closure. A 15:30 option is available for the half-hourly
            auction. For each delivery hour, the engine selects the forecast with the
            greatest publication time that is still at or before the decision time.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2 text-emerald-900">
              <p className="font-semibold tabular-nums">07:30</p>
              <p>selected</p>
            </div>
            <div className="rounded-lg border border-slate-300 bg-slate-100 p-2 text-slate-900">
              <p className="font-semibold tabular-nums">09:20</p>
              <p>gate</p>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-2 text-rose-900">
              <p className="font-semibold tabular-nums">09:30</p>
              <p>excluded</p>
            </div>
          </div>
          <p className="mt-3">
            The 09:30 vintage is ten minutes too late. Showing that gap is the point:
            the product reports what was knowable, not what looks best in hindsight.
          </p>
        </SectionCard>

        <SectionCard
          icon={Layers}
          title="The comparison grid"
          description="Hourly means, because actuals and forecasts arrive on different clocks."
        >
          <p>
            Actuals are half-hourly and forecasts are hourly. Accuracy is evaluated on
            hourly means of the actuals. Repeating a forecast across two settlement
            periods or interpolating it to half-hours would invent intra-hour structure
            the source does not contain.
          </p>
          <p className="mt-3">
            The chart still draws the hourly actual because that is the honest comparison
            grid. Intra-hour forecast error is not measured and is not claimed.
          </p>
        </SectionCard>

        <SectionCard
          icon={ShieldCheck}
          title="The band and the reserve"
          description="Empirical residual quantiles, calibrated only on prior days."
        >
          <p>
            For a delivery day, the band is the 5th–95th percentile (or 2.5th–97.5th at
            95% confidence) of residuals from earlier days in the same lead-time bucket.
            If a bucket has fewer than five samples, the engine falls back to pooled
            residuals. The first seven days are marked provisional.
          </p>
          <p className="mt-3">
            Reserve is <Formula>max(0, −Q5(actual − forecast))</Formula>: the lower edge
            of the 90% band, the shortfall the forecast missed in about 5% of comparable
            cases. It is a wind-cover margin, not a total procurement quantity. The buyer
            combines it with their own demand view.
          </p>
          <p className="mt-3">
            Bands are asymmetric because forecast error is asymmetric. A symmetric
            ±MAE band would look tidy and would not answer the procurement question.
          </p>
        </SectionCard>

        <SectionCard
          icon={Gauge}
          title="The baseline"
          description="Persistence is the bar the forecast has to clear."
        >
          <p>
            The baseline predicts the same hour on the previous day. The performance
            page reports model MAE beside persistence MAE and a skill score of{" "}
            <Formula>1 − model MAE / persistence MAE</Formula>. A positive score means
            the point-in-time forecast adds value; a negative one means it does not.
          </p>
          <p className="mt-3">
            Error is also grouped by realised lead time and by realised wind level, so a
            reviewer can see where the aggregate hides weak pockets.
          </p>
        </SectionCard>

        <SectionCard
          icon={FileWarning}
          title="Known limitations"
          description="What a reviewer should not infer from this build."
        >
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Metering scope.</strong> FUELHH wind and WINDFOR GB wind may not
              cover the same population. The observed negative bias could be forecast
              error, scope mismatch, or both. No silent bias correction is applied.
            </li>
            <li>
              <strong>One month.</strong> January 2026 is the whole sample. Early-month
              bands are weaker evidence than late-month bands and are labelled.
            </li>
            <li>
              <strong>No demand, prices, or P&amp;L.</strong> The brief supplies only wind
              actuals and forecasts, so absolute thermal procurement and trading value
              are out of scope.
            </li>
            <li>
              <strong>Actual revisions.</strong> The snapshot stores the latest published
              actual for each settlement period, not every revision.
            </li>
          </ul>
        </SectionCard>
      </div>

      <Card className="border-slate-900/10 bg-slate-950 text-white">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">Reproduce it locally</h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-300">
              The snapshot is committed, so the API runs without network access. Rebuild
              it from Elexon with the ingest command when you want a fresh month.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-white/10 bg-black/30 p-3 text-xs leading-6 text-slate-200">
              <code>{`make install
make ingest MONTH=2026-01
make run`}</code>
            </pre>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-950 hover:bg-slate-100"
            >
              Open the decision desk
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/performance"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Check the evidence
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
