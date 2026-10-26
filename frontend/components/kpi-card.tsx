import type { LucideIcon } from "lucide-react";
import type * as React from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const tones = {
  teal: "bg-teal-50 text-teal-700 ring-teal-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-100",
  rose: "bg-rose-50 text-rose-700 ring-rose-100",
} as const;

export type KpiTone = keyof typeof tones;

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "slate",
  badge,
}: {
  label: string;
  value: string;
  hint: React.ReactNode;
  icon: LucideIcon;
  tone?: KpiTone;
  badge?: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        </div>
        <span className={cn("flex size-9 items-center justify-center rounded-lg ring-1", tones[tone])}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs leading-5 text-muted-foreground">
        <span>{hint}</span>
        {badge}
      </div>
    </Card>
  );
}
