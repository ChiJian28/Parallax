import type { AaveWindowSnapshotsResult } from '../data/types.js';
import { isInsightXOutputSkipped } from '../data/insightx.js';
import { computeEventDelta, enrichPearsonFromReserves } from './event-delta.js';
import type { LoadedAcquisitionSnapshot } from './snapshot-loader.js';
import type { CrossEventCorrelation } from '../data/cross-event-correlation.js';
import { computeCorrelationMetrics } from './correlation-calculator.js';
import type { EventDelta } from './event-delta.js';
import type {
  BaselineData,
  EventWindows,
  MacroEvent,
  PostEventData,
  UtcWindow,
} from './types.js';
import type { ComputedMetrics } from './correlation-calculator.js';
import type { XstocksVolumeResult } from '../data/types.js';

export interface ReportSynthesisContext {
  collected_at_utc: string;
  macro: LoadedAcquisitionSnapshot['macro_event'];
  xstocks: LoadedAcquisitionSnapshot['xstocks'];
  aave: LoadedAcquisitionSnapshot['aave'];
  aave_windows?: AaveWindowSnapshotsResult;
  event_delta: EventDelta;
  cross_event_correlation?: CrossEventCorrelation;
  insightx_skipped: boolean;
  data_caveats: string[];
}

function safePctChange(current: number | null | undefined, baseline: number | null | undefined): number | null {
  if (current == null || baseline == null || baseline === 0) return null;
  return ((current - baseline) / baseline) * 100;
}

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

function resolveReaction(xstocks: XstocksVolumeResult) {
  const preVol = xstocks.pre_window_volume_usd ?? xstocks.volume_48h_usd ?? 0;
  const postVol = xstocks.post_window_volume_usd ?? xstocks.volume_48h_usd ?? 0;
  const prePrice = xstocks.pre_window_price_usd ?? xstocks.spot_price_usdt0 ?? 0;
  const postPrice = xstocks.post_window_price_usd ?? xstocks.spot_price_usdt0 ?? 0;

  const volumeSpikePct = xstocks.volume_spike_pct ?? safePctChange(postVol, preVol);
  const priceShiftPct = xstocks.price_shift_pct ?? safePctChange(postPrice, prePrice);

  return { preVol, postVol, prePrice, postPrice, volumeSpikePct, priceShiftPct };
}

export function macroEventFromSnapshot(snapshot: LoadedAcquisitionSnapshot): MacroEvent {
  const macro = snapshot.macro_event;
  return {
    eventId: macro.event_id,
    eventName: macro.event_name,
    targetToken: macro.target_token,
    triggerTimeUtc: macro.trigger_time_unix * 1000,
    surpriseMagnitude: macro.surprise_magnitude ?? 0,
  };
}

export function eventWindowsFromSnapshot(snapshot: LoadedAcquisitionSnapshot): EventWindows {
  const macro = snapshot.macro_event;
  return {
    trigger_utc: macro.trigger_time_utc,
    preWindow: toUtcWindow(macro.pre_window),
    postWindow: toUtcWindow(macro.post_window),
  };
}

export function buildSynthesisContext(snapshot: LoadedAcquisitionSnapshot): ReportSynthesisContext {
  const insightxSkipped = isInsightXOutputSkipped() || snapshot.insightx?.skipped === true;
  const reaction = resolveReaction(snapshot.xstocks);

  const eventDelta = enrichPearsonFromReserves(
    computeEventDelta({
      macro: snapshot.macro_event,
      xstocks: snapshot.xstocks,
      aaveWindows: snapshot.aave_windows ?? null,
    }),
    snapshot.macro_event.surprise_magnitude ?? 0,
  );

  const dataCaveats = [...eventDelta.data_quality.caveats];

  return {
    collected_at_utc: snapshot.collected_at_utc,
    macro: snapshot.macro_event,
    xstocks: {
      ...snapshot.xstocks,
      volume_spike_pct: reaction.volumeSpikePct,
      price_shift_pct: reaction.priceShiftPct,
      pre_window_volume_usd: reaction.preVol,
      post_window_volume_usd: reaction.postVol,
      pre_window_price_usd: reaction.prePrice,
      post_window_price_usd: reaction.postPrice,
    },
    aave: snapshot.aave,
    aave_windows: snapshot.aave_windows,
    event_delta: eventDelta,
    cross_event_correlation: snapshot.cross_event_correlation as CrossEventCorrelation | undefined,
    insightx_skipped: insightxSkipped,
    data_caveats: dataCaveats,
  };
}

export function pipelineDataFromSnapshot(snapshot: LoadedAcquisitionSnapshot): {
  event: MacroEvent;
  windows: EventWindows;
  baseline: BaselineData;
  postEvent: PostEventData;
  metrics: ComputedMetrics;
  eventDelta: EventDelta;
  synthesisContext: ReportSynthesisContext;
} {
  const event = macroEventFromSnapshot(snapshot);
  const windows = eventWindowsFromSnapshot(snapshot);
  const synthesisContext = buildSynthesisContext(snapshot);
  const { xstocks, event_delta: eventDelta } = synthesisContext;
  const reaction = resolveReaction(xstocks);

  const preAvgDailyVolumeUsd = reaction.preVol > 0 ? reaction.preVol / 2 : 0;

  const baseline: BaselineData = {
    tokenAddress: snapshot.preflight.addresses.spcxx.address,
    tokenSymbol: event.targetToken,
    preTwapUsd: reaction.prePrice,
    preAvgDailyVolumeUsd,
    preInsightXOdds: 0,
    insightXMarketQuestion: null,
    window: windows.preWindow,
    source: 'live',
    warnings: xstocks.warnings,
  };

  const postEvent: PostEventData = {
    postTwapUsd: reaction.postPrice,
    postVolumeUsd: reaction.postVol,
    preAvgVolumeUsd: preAvgDailyVolumeUsd,
    priceDeltaUsd: reaction.postPrice - reaction.prePrice,
    insightXResolution: false,
    insightXResolvedLabel: null,
    window: windows.postWindow,
    source: 'live',
    warnings: xstocks.warnings,
  };

  const metrics = computeCorrelationMetrics({
    macroSurprise: event.surpriseMagnitude,
    prePrice: reaction.prePrice,
    postPrice: reaction.postPrice,
    preAvgVolume: preAvgDailyVolumeUsd,
    postVolume: reaction.postVol,
    preEventOdds: 0,
    actualOutcome: false,
    eventDelta,
  });

  const cross = snapshot.cross_event_correlation as CrossEventCorrelation | undefined;
  if (cross) {
    metrics.pearsonMacroXstocks = cross.pearson_macro_xstocks;
    metrics.pearsonXstocksAave = cross.pearson_xstocks_aave;
    metrics.pearsonMacroAave = cross.pearson_macro_aave;
  }

  return { event, windows, baseline, postEvent, metrics, eventDelta, synthesisContext };
}
