import { Suspense } from "react";

import { DecisionDesk } from "@/components/decision-desk";
import { DeskSkeleton } from "@/components/desk-skeleton";

export default function Home() {
  return (
    <Suspense fallback={<DeskSkeleton />}>
      <DecisionDesk />
    </Suspense>
  );
}
