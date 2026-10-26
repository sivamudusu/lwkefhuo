import { History, LockKeyhole } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VintagesResponse } from "@/lib/api";
import { formatTime } from "@/lib/format";

function eligibleCount(
  vintages: VintagesResponse["hours"][number]["vintages"],
  decisionTime: string,
): number {
  const cutoff = new Date(decisionTime).getTime();
  return vintages.filter((vintage) => new Date(vintage.publish_time).getTime() <= cutoff).length;
}

function nextPublication(hour: VintagesResponse["hours"][number]): string | null {
  const cutoff = new Date(hour.decision_time).getTime();
  return (
    hour.vintages.find((vintage) => new Date(vintage.publish_time).getTime() > cutoff)
      ?.publish_time ?? null
  );
}

export function VintageAudit({
  vintages,
  className,
}: {
  vintages: VintagesResponse;
  className?: string;
}) {
  const hours = vintages.hours;
  const selectedTimes = new Set(
    hours.map((hour) => hour.selected_publish_time).filter((value): value is string => Boolean(value)),
  );
  const excluded = hours.reduce(
    (total, hour) => total + hour.vintages.length - eligibleCount(hour.vintages, hour.decision_time),
    0,
  );
  const nextTimes = new Set(
    hours.map(nextPublication).filter((value): value is string => Boolean(value)),
  );
  const uniform = selectedTimes.size === 1;
  const selected = [...selectedTimes][0] ?? null;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="size-4 text-muted-foreground" aria-hidden="true" />
              Vintage audit
            </CardTitle>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Every delivery hour is replayed against the same gate closure, not against
              the latest forecast.
            </p>
          </div>
          <Badge variant="success" className="gap-1">
            <LockKeyhole className="size-3" aria-hidden="true" />
            {uniform ? `${hours.length}/${hours.length} hours eligible` : "Per-hour selection"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
          {uniform && selected ? (
            <>
              All {hours.length} delivery hours use the{" "}
              <span className="font-medium text-foreground">{formatTime(selected)} UTC</span>{" "}
              vintage.
            </>
          ) : (
            <>Selected publication times vary by delivery hour; see the table.</>
          )}{" "}
          {excluded > 0 ? (
            <>
              <span className="font-medium text-foreground">{excluded}</span> later
              vintage{excluded === 1 ? "" : "s"} are excluded.
            </>
          ) : null}{" "}
          {nextTimes.size > 0 ? (
            <>
              The next publication,{" "}
              <span className="font-medium text-foreground">
                {formatTime([...nextTimes][0])} UTC
              </span>
              , arrived after the decision time.
            </>
          ) : null}
        </div>

        <div className="max-h-[320px] overflow-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] border-collapse text-xs">
            <caption className="sr-only">
              Forecast vintage selection and exclusion count for each delivery hour
            </caption>
            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
              <tr className="text-left uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-3 py-2 font-medium">Hour</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Selected vintage</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Eligible</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Excluded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {hours.map((hour) => {
                const eligible = eligibleCount(hour.vintages, hour.decision_time);
                return (
                  <tr key={hour.hour} className="hover:bg-muted/40">
                    <th scope="row" className="px-3 py-1.5 text-left font-medium tabular-nums">
                      {formatTime(hour.hour)}
                    </th>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {hour.selected_publish_time ? formatTime(hour.selected_publish_time) : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{eligible}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                      {hour.vintages.length - eligible}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
