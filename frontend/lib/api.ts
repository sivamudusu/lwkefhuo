import useSWR, { type SWRConfiguration } from "swr";

export interface SnapshotMeta {
  source: string;
  built_at: string;
  delivery_from: string;
  delivery_to: string;
  actual_from: string;
  actual_to: string;
  actual_rows: number;
  forecast_rows: number;
  forecast_hours: number;
  missing_forecast_hours: number;
}

export interface MetaResponse {
  service: string;
  version: string;
  snapshot: SnapshotMeta;
  default_gate: string;
  gates: string[];
  default_confidence: number;
  confidences: number[];
}

export interface Summary {
  count: number;
  mae_mw: number | null;
  rmse_mw: number | null;
  bias_mw: number | null;
  p90_abs_mw: number | null;
  mean_actual_mw: number | null;
  mean_forecast_mw: number | null;
  hours?: number;
  hours_with_band?: number;
  forecast_mwh?: number;
  actual_mwh?: number;
  reserve_peak_mw?: number;
  reserve_mwh?: number;
}

export interface HourPoint {
  hour: string;
  actual_mw: number | null;
  forecast_mw: number | null;
  publish_time: string | null;
  lead_hours: number | null;
  residual_mw: number | null;
  band_low_mw: number | null;
  band_high_mw: number | null;
  reserve_mw: number | null;
}

export interface CalibrationInfo {
  days_used: number;
  sample_count: number;
  coverage: number | null;
  provisional: boolean;
}

export interface Provenance {
  gate: string;
  decision_time: string;
  publish_times: string[];
  lead_hours_min: number | null;
  lead_hours_max: number | null;
  look_ahead_guard: string;
  source: string;
  snapshot_built_at: string;
}

export interface DayResponse {
  delivery_date: string;
  gate: string;
  decision_time: string;
  hours: HourPoint[];
  summary: Summary;
  calibration: CalibrationInfo;
  provenance: Provenance;
}

export interface DayInfo {
  date: string;
  actual_hours: number;
  forecast_hours: number;
  complete: boolean;
}

export interface DaysResponse {
  from: string;
  to: string;
  days: DayInfo[];
}

export interface Vintage {
  publish_time: string;
  generation_mw: number;
}

export interface VintageHour {
  hour: string;
  decision_time: string;
  selected_publish_time: string | null;
  vintages: Vintage[];
}

export interface VintagesResponse {
  delivery_date: string;
  gate: string;
  hours: VintageHour[];
}

export interface DailyRow {
  date: string;
  count: number;
  mae_mw: number | null;
  rmse_mw: number | null;
  bias_mw: number | null;
  p90_abs_mw: number | null;
  coverage: number | null;
  provisional: boolean;
}

export interface BucketRow {
  bucket: string;
  count: number;
  mae_mw: number | null;
  rmse_mw: number | null;
  bias_mw: number | null;
  p90_abs_mw: number | null;
}

export interface Baseline {
  count: number;
  model_mae_mw: number | null;
  persistence_mae_mw: number | null;
  skill_score: number | null;
}

export interface CalibrationDay {
  date: string;
  days_used: number;
  sample_count: number;
  coverage: number | null;
  provisional: boolean;
}

export interface AccuracyResponse {
  from: string;
  to: string;
  gate: string;
  confidence: number;
  overall: Summary;
  daily: DailyRow[];
  by_lead_bucket: BucketRow[];
  by_wind_level: BucketRow[];
  baseline: Baseline;
  calibration: {
    coverage: number | null;
    hours_with_band: number;
    provisional_days: number;
    days: CalibrationDay[];
  };
  series: HourPoint[];
}

export interface CalibrationResponse {
  from: string;
  to: string;
  confidence: number;
  days: CalibrationDay[];
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string") {
        detail = body.detail;
      }
    } catch {
      // Keep the status-based message when the body is not JSON.
    }
    throw new ApiError(detail, response.status);
  }
  return (await response.json()) as T;
}

export function useApi<T>(path: string | null, config?: SWRConfiguration<T, ApiError>) {
  return useSWR<T, ApiError>(path, (url: string) => fetchJson<T>(url), {
    revalidateOnFocus: false,
    keepPreviousData: true,
    ...config,
  });
}
