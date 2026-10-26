import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col items-start gap-4 px-4 py-20 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">That page is not on the desk.</h1>
      <p className="max-w-xl text-sm leading-6 text-muted-foreground">
        The link may be old, or the delivery day is outside the committed January 2026
        snapshot. Go back to the decision desk and pick a day from the calendar.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to the decision desk
      </Link>
    </div>
  );
}
