import type { HourPoint } from "@/lib/api";
import { bandLabel, bandRange, formatGw, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function HourlyTable({
  hours,
  confidence,
}: {
  hours: HourPoint[];
  confidence: string;
}) {
  const maxReserve = Math.max(...hours.map((hour) => hour.reserve_mw ?? 0));

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <caption className="sr-only">
            Hourly actual wind, selected forecast, error, uncertainty band and reserve
          </caption>
          <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-2.5 font-medium">Hour</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Actual</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Forecast</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Error</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                {bandLabel(confidence)}
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Reserve</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {hours.map((hour) => {
              const positiveReserve = (hour.reserve_mw ?? 0) > 0;
              const tightest = maxReserve > 0 && hour.reserve_mw === maxReserve;
              return (
                <tr
                  key={hour.hour}
                  className={cn(
                    "transition-colors hover:bg-muted/40",
                    tightest && "bg-amber-50/70",
                  )}
                >
                  <th scope="row" className="px-4 py-2 text-left font-medium tabular-nums">
                    {formatTime(hour.hour)}
                  </th>
                  <td className="px-4 py-2 text-right tabular-nums">{formatGw(hour.actual_mw)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-teal-800">
                    {formatGw(hour.forecast_mw)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2 text-right tabular-nums",
                      (hour.residual_mw ?? 0) < 0 ? "text-rose-700" : "text-emerald-700",
                    )}
                  >
                    {formatGw(hour.residual_mw)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {hour.band_low_mw === null || hour.band_high_mw === null
                      ? "—"
                      : `${formatGw(hour.band_low_mw)} – ${formatGw(hour.band_high_mw)}`}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2 text-right tabular-nums",
                      positiveReserve ? "font-medium text-amber-800" : "text-muted-foreground",
                    )}
                  >
                    {formatGw(hour.reserve_mw)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border bg-muted/30 px-4 py-2.5 text-xs leading-5 text-muted-foreground">
        Actuals are half-hourly in the source and averaged to the hour for error and
        reserve calculations. The band is the empirical {bandRange(confidence)}{" "}
        percentile of prior residuals for the same lead-time bucket, using only days
        before the selected day.
      </p>
    </div>
  );
}
