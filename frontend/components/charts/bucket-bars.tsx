import type { BucketRow } from "@/lib/api";
import { formatGw } from "@/lib/format";

export function BucketBars({
  rows,
  emptyLabel,
}: {
  rows: BucketRow[];
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  const max = Math.max(...rows.map((row) => row.mae_mw ?? 0), 1);

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const width = Math.max(((row.mae_mw ?? 0) / max) * 100, 2);
        return (
          <div key={row.bucket} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="font-medium text-foreground">{row.bucket}</span>
              <span className="tabular-nums text-muted-foreground">
                {formatGw(row.mae_mw)} MAE · {row.count} h
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-teal-600/80"
                style={{ width: `${width}%` }}
                aria-hidden="true"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
