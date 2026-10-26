import { CircleHelp, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DayResponse } from "@/lib/api";
import { formatGw, formatPercent, formatSignedGw } from "@/lib/format";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5 text-xs last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

export function DecisionSummary({
  day,
  confidence,
}: {
  day: DayResponse;
  confidence: string;
}) {
  const summary = day.summary;
  const hasBand = (summary.hours_with_band ?? 0) > 0;
  const provisional = day.calibration.provisional;
  const bias = summary.bias_mw ?? 0;

  return (
    <Card className="border-slate-900/10 bg-slate-950 text-white shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-white">
            <ShieldCheck className="size-4 text-teal-300" aria-hidden="true" />
            The call
          </CardTitle>
          <Badge
            variant="outline"
            className="border-white/20 bg-white/5 text-white"
          >
            {Math.round(Number(confidence) * 100)}% confidence
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasBand ? (
          <>
            <div>
              <p className="text-3xl font-semibold tracking-tight tabular-nums text-white">
                {formatGw(summary.reserve_peak_mw)}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                peak non-wind cover at the tightest hour
              </p>
            </div>
            <p className="text-xs leading-5 text-slate-300">
              If the day-ahead plan assumes the selected wind forecast, carry this much
              extra cover to reach the lower edge of the {Math.round(Number(confidence) * 100)}%
              band. Actual wind fell below the forecast by more than this in about{" "}
              {formatPercent((1 - Number(confidence)) / 2, 1)} of comparable January
              hours. This is a wind-cover margin, not a total procurement quantity.
            </p>
          </>
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs leading-5 text-slate-300">
            No prior calibration history exists for this delivery day, so no reserve
            band is shown. The forecast is still the vintage that was available at gate
            closure.
          </div>
        )}

        <div className="space-y-0.5 border-t border-white/10 pt-3">
          <Metric label="Mean forecast" value={formatGw(summary.mean_forecast_mw)} />
          <Metric label="Mean actual" value={formatGw(summary.mean_actual_mw)} />
          <Metric label="Bias (actual − forecast)" value={formatSignedGw(summary.bias_mw)} />
          <Metric label="MAE" value={formatGw(summary.mae_mw)} />
          <Metric label="RMSE" value={formatGw(summary.rmse_mw)} />
          <Metric
            label="Band coverage"
            value={formatPercent(day.calibration.coverage, 1)}
          />
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs leading-5 text-slate-300">
          <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-teal-300" aria-hidden="true" />
          <p>
            {provisional
              ? `Provisional: bands use only ${day.calibration.days_used} prior day${day.calibration.days_used === 1 ? "" : "s"} of residuals.`
              : `Bands are walk-forward, calibrated on ${day.calibration.days_used} prior days (${day.calibration.sample_count} hourly residuals).`}{" "}
            {bias < -250
              ? "On this day actuals came in below the selected forecast."
              : bias > 250
                ? "On this day actuals came in above the selected forecast."
                : "On this day the selected forecast was close to realised wind."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
