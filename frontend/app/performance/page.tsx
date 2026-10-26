import { Suspense } from "react";

import { DeskSkeleton } from "@/components/desk-skeleton";
import { PerformanceDashboard } from "@/components/performance-dashboard";

export const metadata = {
  title: "Forecast performance",
};

export default function PerformancePage() {
  return (
    <Suspense fallback={<DeskSkeleton />}>
      <PerformanceDashboard />
    </Suspense>
  );
}
