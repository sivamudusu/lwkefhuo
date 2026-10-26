"use client";

import { Database, Wind } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const navigation = [
  { href: "/", label: "Decision desk" },
  { href: "/performance", label: "Performance" },
  { href: "/method", label: "Method" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="group flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-slate-950 text-white shadow-sm">
              <Wind className="size-4.5" aria-hidden="true" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold tracking-tight">REint</span>
              <span className="block text-xs text-muted-foreground">GB wind desk</span>
            </span>
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground lg:hidden">
            <Database className="size-3" aria-hidden="true" />
            Jan 2026
          </span>
        </div>

        <nav aria-label="Primary" className="flex items-center gap-1 overflow-x-auto">
          {navigation.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <span className="ml-2 hidden items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground lg:inline-flex">
            <Database className="size-3" aria-hidden="true" />
            Committed snapshot · Jan 2026
          </span>
        </nav>
      </div>
    </header>
  );
}
