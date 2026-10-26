import { ExternalLink } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-border/80 bg-muted/20">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:px-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl space-y-2">
          <p className="font-medium text-foreground">REint wind desk</p>
          <p className="leading-6">
            A historical replay of the Elexon wind forecast that was actually available
            before day-ahead gate closure. Actuals and forecasts are from the public
            Elexon Insights Solution. FUELHH wind actuals and WINDFOR GB wind may not
            cover the same metering population; no bias correction is applied.
          </p>
        </div>
        <div className="flex flex-col gap-2 lg:items-end">
          <a
            href="https://bmrs.elexon.co.uk/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-foreground"
          >
            Elexon BMRS
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
          <a href="/api/docs" className="inline-flex items-center gap-1.5 hover:text-foreground">
            API reference
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
          <p className="text-xs">Built for the gridbricks full-stack challenge · October 2026</p>
        </div>
      </div>
    </footer>
  );
}
