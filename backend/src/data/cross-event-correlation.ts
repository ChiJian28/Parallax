import { pearsonFromPairs } from '../agent/event-delta.js';
import type { EventDelta } from '../agent/event-delta.js';
import type { MacroEventDetectionResult } from './types.js';
import type { AaveWindowSnapshotsResult } from './types.js';

export interface CalendarEventSnapshot {
  macro: MacroEventDetectionResult;
  aave_windows: AaveWindowSnapshotsResult;
  event_delta: EventDelta;
}

export interface CrossEventCorrelation {
  events_analyzed: number;
  pearson_macro_xstocks: number | null;
  pearson_xstocks_aave: number | null;
  pearson_macro_aave: number | null;
  series: Array<{
    event_id: string;
    event_type: string;
    macro_surprise: number;
    xstocks_price_change_pct: number | null;
    aave_utilization_delta: number | null;
  }>;
}

function buildSeriesFromSnapshots(events: CalendarEventSnapshot[]): CrossEventCorrelation['series'] {
  return events.map((e) => ({
    event_id: e.macro.event_id,
    event_type: e.macro.event_type ?? 'OTHER',
    macro_surprise: e.event_delta.macro_surprise,
    xstocks_price_change_pct: e.event_delta.price_change_pct,
    aave_utilization_delta: e.event_delta.aave_avg_utilization_delta,
  }));
}

function pearsonFromSeries(series: CrossEventCorrelation['series']): Omit<CrossEventCorrelation, 'series'> {

  const macroXstocksPairs = series
    .filter((s) => s.xstocks_price_change_pct != null)
    .map((s) => ({ x: s.macro_surprise, y: s.xstocks_price_change_pct! }));

  const xstocksAavePairs = series
    .filter((s) => s.xstocks_price_change_pct != null && s.aave_utilization_delta != null)
    .map((s) => ({ x: s.xstocks_price_change_pct!, y: s.aave_utilization_delta! }));

  const macroAavePairs = series
    .filter((s) => s.aave_utilization_delta != null)
    .map((s) => ({ x: s.macro_surprise, y: s.aave_utilization_delta! }));

  return {
    events_analyzed: series.length,
    pearson_macro_xstocks: pearsonFromPairs(macroXstocksPairs),
    pearson_xstocks_aave: pearsonFromPairs(xstocksAavePairs),
    pearson_macro_aave: pearsonFromPairs(macroAavePairs),
  };
}

/**
 * Compute Pearson r across calendar events (requires ≥2 events with valid pairs).
 */
export function computeCrossEventCorrelation(
  events: CalendarEventSnapshot[],
): CrossEventCorrelation {
  const series = buildSeriesFromSnapshots(events);
  return { ...pearsonFromSeries(series), series };
}

/** Recompute Pearson matrix from a cached per-event series (cache-hit fast path). */
export function computeCrossEventCorrelationFromSeries(
  series: CrossEventCorrelation['series'],
): CrossEventCorrelation {
  return { ...pearsonFromSeries(series), series };
}
