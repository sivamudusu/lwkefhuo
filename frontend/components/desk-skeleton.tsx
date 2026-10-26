import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DeskBodySkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="space-y-4 p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-28" />
              </div>
              <Skeleton className="size-9 rounded-lg" />
            </div>
            <Skeleton className="h-3 w-32" />
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="space-y-4 p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-[320px] w-full" />
        </Card>
        <div className="space-y-6">
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}

export function DeskSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <div className="space-y-3 border-b border-border/70 pb-6">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <Skeleton className="h-28 w-full rounded-xl" />
      <DeskBodySkeleton />
    </div>
  );
}
