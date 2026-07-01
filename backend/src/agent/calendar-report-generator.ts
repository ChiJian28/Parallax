import { isInsightXOutputSkipped } from '../data/insightx.js';
import { SPCXX_MOE_POOL } from '../data/constants.js';
import type { CalendarEventSnapshot } from '../data/cross-event-correlation.js';
import type { CrossEventCorrelation } from '../data/cross-event-correlation.js';
import type { AaveWindowSnapshotsResult } from '../data/types.js';
import type { XstocksVolumeResult } from '../data/types.js';
import { computeCorrelationMetrics } from './correlation-calculator.js';
import { synthesizeReport } from './llm-synthesizer.js';
import type { ReportSynthesisContext } from './snapshot-adapter.js';
import type { FinalReport, MacroEvent, EventWindows, UtcWindow } from './types.js';

const DEFAULT_REPORT_PRICE_MNT = 2;

function toUtcWindow(window: {
  start_unix?: number;
  end_unix?: number;
  start_utc: string;
  end_utc: string;
}): UtcWindow {
  const start = window.start_unix != null ? window.start_unix * 1000 : Date.parse(window.start_utc);
  const end = window.end_unix != null ? window.end_unix * 1000 : Date.parse(window.end_utc);
  return { start, end, start_utc: window.start_utc, end_utc: window.end_utc };
}

function macroEventFromCalendar(snapshot: CalendarEventSnapshot): MacroEvent {
  const macro = snapshot.macro;
  return {
    eventId: macro.event_id,
    eventName: macro.event_name,
    targetToken: macro.target_token,
    triggerTimeUtc: macro.trigger_time_unix * 1000,
    surpriseMagnitude: macro.surprise_magnitude ?? 0,
  };
}

function eventWindowsFromCalendar(snapshot: CalendarEventSnapshot): EventWindows {
  const macro = snapshot.macro;
  return {
    trigger_utc: macro.trigger_time_utc,
    preWindow: toUtcWindow(macro.pre_window),
    postWindow: toUtcWindow(macro.post_window),
  };
}

function buildXstocksStub(snapshot: CalendarEventSnapshot): XstocksVolumeResult {
  const { macro, event_delta: delta } = snapshot;
  const preVol = delta.volume_spike_ratio != null && delta.volume_spike_ratio > 0 ? 1 : 0;
  const postVol = delta.volume_spike_ratio ?? 0;

  return {
    status: delta.data_quality.xstocks_source === 'historical_rpc' ? 'ok' : 'partial',
    pool_address: macro.target_token === 'SPCXx' ? SPCXX_MOE_POOL.address : null,
    provider: 'merchant_moe',
    time_window: macro.post_window,
    volume_48h_usd: postVol,
    swap_count: null,
    source_type: delta.data_quality.xstocks_source === 'historical_rpc' ? 'historical_rpc' : 'merchant_moe_rpc',
    source_endpoint: null,
    pre_window_volume_usd: preVol,
    post_window_volume_usd: postVol,
    price_shift_pct: delta.price_change_pct,
    volume_spike_pct: delta.volume_spike_ratio != null ? (delta.volume_spike_ratio - 1) * 100 : null,
    pool_liquidity: null,
    pool_opportunities: null,
    sql_rows: null,
    warnings: delta.data_quality.caveats,
    caveats: delta.data_quality.caveats,
  };
}

function buildAaveStub(aaveWindows: AaveWindowSnapshotsResult) {
  const markets = aaveWindows.post.map((post) => {
    const pre = aaveWindows.pre.find((row) => row.asset === post.asset);
    return {
      asset: post.asset,
      supply_apy: post.supply_apy,
      borrow_apy: post.borrow_apy,
      utilization_rate: post.utilization_rate,
      tvl_usd: post.total_supplied_usd,
      supply_delta_usd:
        pre?.total_supplied_usd != null && post.total_supplied_usd != null
          ? post.total_supplied_usd - pre.total_supplied_usd
          : null,
    };
  });

  return {
    status: aaveWindows.status,
    markets,
    warnings: aaveWindows.warnings,
  };
}

function buildSynthesisContextFromCalendar(
  snapshot: CalendarEventSnapshot,
  crossEventCorrelation?: CrossEventCorrelation,
): ReportSynthesisContext {
  return {
    collected_at_utc: new Date().toISOString(),
    macro: snapshot.macro,
    xstocks: buildXstocksStub(snapshot),
    aave: buildAaveStub(snapshot.aave_windows),
    aave_windows: snapshot.aave_windows,
    event_delta: snapshot.event_delta,
    cross_event_correlation: crossEventCorrelation,
    insightx_skipped: isInsightXOutputSkipped(),
    data_caveats: [...snapshot.event_delta.data_quality.caveats],
  };
}

/**
 * Live-generate a single-event report from an acquisition calendar snapshot.
 */
export async function generateReportFromCalendarSnapshot(
  snapshot: CalendarEventSnapshot,
  crossEventCorrelation?: CrossEventCorrelation,
  options?: { geminiApiKey?: string; reportPriceMNT?: number },
): Promise<FinalReport> {
  const event = macroEventFromCalendar(snapshot);
  const windows = eventWindowsFromCalendar(snapshot);
  const synthesisContext = buildSynthesisContextFromCalendar(snapshot, crossEventCorrelation);
  const delta = snapshot.event_delta;

  const prePrice = 100;
  const postPrice =
    delta.price_change_pct != null ? prePrice * (1 + delta.price_change_pct / 100) : prePrice;
  const preAvgVolume = 1;
  const postVolume = delta.volume_spike_ratio ?? 1;

  const metrics = computeCorrelationMetrics({
    macroSurprise: event.surpriseMagnitude,
    prePrice,
    postPrice,
    preAvgVolume,
    postVolume,
    preEventOdds: 0,
    actualOutcome: false,
    eventDelta: delta,
  });

  if (crossEventCorrelation) {
    metrics.pearsonMacroXstocks = crossEventCorrelation.pearson_macro_xstocks;
    metrics.pearsonXstocksAave = crossEventCorrelation.pearson_xstocks_aave;
    metrics.pearsonMacroAave = crossEventCorrelation.pearson_macro_aave;
  }

  const { synthesis, source } = await synthesizeReport(
    event,
    metrics,
    options?.geminiApiKey,
    synthesisContext,
  );

  return {
    eventId: event.eventId,
    eventName: event.eventName,
    timestamp: Date.now(),
    teaser: synthesis.teaser,
    fullContent: synthesis.full_analysis,
    priceMNT: options?.reportPriceMNT ?? DEFAULT_REPORT_PRICE_MNT,
    computedMetrics: metrics,
    eventDelta: delta,
    crossEventCorrelation,
    windows,
    dataSources: {
      baseline: 'live',
      postEvent: 'live',
      llm: source,
    },
  };
}
