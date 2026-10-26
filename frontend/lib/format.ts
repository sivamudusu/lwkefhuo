import type { MetaResponse } from "@/lib/api";

const oneDecimal = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const signedOneDecimal = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

export function formatGw(mw: number | null | undefined): string {
  if (mw === null || mw === undefined || Number.isNaN(mw)) {
    return "—";
  }
  return `${oneDecimal.format(mw / 1000)} GW`;
}

export function formatSignedGw(mw: number | null | undefined): string {
  if (mw === null || mw === undefined || Number.isNaN(mw)) {
    return "—";
  }
  return `${signedOneDecimal.format(mw / 1000)} GW`;
}

export function formatGwh(mwh: number | null | undefined): string {
  if (mwh === null || mwh === undefined || Number.isNaN(mwh)) {
    return "—";
  }
  return `${oneDecimal.format(mwh / 1000)} GWh`;
}

export function bandRange(confidence: string | number): string {
  const tail = Math.round(((1 - Number(confidence)) / 2) * 1000) / 10;
  const format = (value: number) =>
    Number.isInteger(value) ? `${value}` : value.toFixed(1);
  return `${format(tail)}–${format(100 - tail)}%`;
}

export function bandLabel(confidence: string | number): string {
  return `${bandRange(confidence)} band`;
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function formatDateShort(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(iso));
  return `${formatted} UTC`;
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function formatLead(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) {
    return "—";
  }
  return `${oneDecimal.format(hours)} h`;
}

export function formatGate(gate: string): string {
  return `${gate} D-1`;
}

export function defaultDeskDate(meta: MetaResponse): string {
  const from = new Date(`${meta.snapshot.delivery_from}T00:00:00Z`);
  const to = new Date(`${meta.snapshot.delivery_to}T00:00:00Z`);
  const candidate = new Date(from);
  candidate.setUTCDate(candidate.getUTCDate() + 14);
  const chosen = candidate > to ? to : candidate;
  return chosen.toISOString().slice(0, 10);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
