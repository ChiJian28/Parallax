import { mantleMcp } from '../mcp/mantle-client.js';
import type { MantleNetwork } from '../mcp/mantle-client.js';
import { computeEventDelta } from '../agent/event-delta.js';
import { fetchAaveStablecoinRates } from './aave.js';
import { fetchAaveWindowSnapshots } from './aave-historical.js';
import {
  computeCrossEventCorrelation,
  type CalendarEventSnapshot,
  type CrossEventCorrelation,
} from './cross-event-correlation.js';
import { fetchInsightXMarkets, isInsightXOutputSkipped } from './insightx.js';
import { MACRO_EVENT_CALENDAR } from './macro-event-calendar.js';
import { detectMacroEventWindow, resolveAllCalendarEvents } from './macro-events.js';
import { runPreflight } from './preflight.js';
import type { AcquisitionSnapshot, MacroEventDetectionResult } from './types.js';
import { fetchXstocksHistoricalWindow, fetchXstocksVolume } from './xstocks.js';

export interface AcquisitionOptions {
  network?: MantleNetwork;
  hours?: number;
  insightxSearch?: string;
  sqlEndpoint?: string;
  fluxionSubgraphEndpoint?: string;
  insightxEndpoint?: string;
  fredApiKey?: string;
  fredSeriesId?: string;
  macroEventId?: string;
  macroEventName?: string;
  macroTargetToken?: string;
  macroMockTriggerTimeUtc?: string;
  macroReleaseHourUtc?: number;
  /** When true, resolve full calendar + per-event Aave windows for Pearson r */
  includeCalendar?: boolean;
}

async function collectCalendarEventSnapshots(
  macros: MacroEventDetectionResult[],
  preflight: Awaited<ReturnType<typeof runPreflight>>,
  network: MantleNetwork,
  sqlEndpoint?: string,
): Promise<CalendarEventSnapshot[]> {
  const snapshots: CalendarEventSnapshot[] = [];

  for (const macro of macros) {
    const preUnix =
      macro.pre_window.end_unix ?? Math.floor(Date.parse(macro.pre_window.end_utc) / 1000);
    const postUnix =
      macro.post_window.end_unix ?? Math.floor(Date.parse(macro.post_window.end_utc) / 1000);

    const includesSpcxx =
      macro.target_token === 'SPCXx' || macro.target_tokens?.includes('SPCXx') === true;

    let xstocks: Awaited<ReturnType<typeof fetchXstocksVolume>> | null = null;
    if (includesSpcxx) {
      try {
        xstocks = await fetchXstocksHistoricalWindow({
          preUnix,
          postUnix,
          macroSurprise: macro.surprise_magnitude,
          windowHours: macro.pre_window.hours,
        });
      } catch {
        xstocks = null;
      }
    }

    const aave_windows = await fetchAaveWindowSnapshots(preUnix, postUnix, preflight, network);

    const stubXstocks =
      xstocks ??
      ({
        status: 'partial',
        pool_address: null,
        provider: 'merchant_moe',
        time_window: macro.post_window,
        volume_48h_usd: null,
        swap_count: null,
        source_type: 'merchant_moe_rpc',
        source_endpoint: null,
        pool_liquidity: null,
        pool_opportunities: null,
        sql_rows: null,
        warnings: [`xStocks on-chain read skipped for token ${macro.target_token}`],
        caveats: ['Only SPCXx has live Merchant Moe pool integration in Module 2.'],
      } as import('./types.js').XstocksVolumeResult);

    const event_delta = computeEventDelta({
      macro,
      xstocks: stubXstocks,
      aaveWindows: aave_windows,
    });

    snapshots.push({ macro, aave_windows, event_delta });

    // Pace RPC historical reads to reduce rate-limit errors on public endpoints.
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  return snapshots;
}

/**
 * Module 2 orchestrator: preflight → xStocks volume → InsightX → Aave rates.
 */
export async function collectAcquisitionSnapshot(
  options: AcquisitionOptions = {},
): Promise<AcquisitionSnapshot> {
  const network = options.network ?? 'mainnet';
  const windowHours = options.hours ?? 48;

  const macro_event = await detectMacroEventWindow({
    apiKey: options.fredApiKey,
    seriesId: options.fredSeriesId,
    eventId: options.macroEventId,
    eventName: options.macroEventName,
    targetToken: options.macroTargetToken,
    mockTriggerTimeUtc: options.macroMockTriggerTimeUtc,
    windowHours,
    releaseHourUtc: options.macroReleaseHourUtc,
  });

  const preflight = await runPreflight(mantleMcp, network);

  let macro_calendar: MacroEventDetectionResult[] | undefined;
  let calendar_events: CalendarEventSnapshot[] | undefined;
  let cross_event_correlation: CrossEventCorrelation | undefined;

  if (options.includeCalendar) {
    macro_calendar = await resolveAllCalendarEvents(options.fredApiKey);
    calendar_events = await collectCalendarEventSnapshots(
      macro_calendar,
      preflight,
      network,
      options.sqlEndpoint,
    );
    cross_event_correlation = computeCrossEventCorrelation(calendar_events);
  }

  const [xstocks, insightx, aave, aave_windows] = await Promise.all([
    fetchXstocksVolume(mantleMcp, preflight, {
      network,
      hours: windowHours,
      sqlEndpoint: options.sqlEndpoint,
      preWindow: macro_event.pre_window,
      postWindow: macro_event.post_window,
      macroSurprise: macro_event.surprise_magnitude,
    }),
    fetchInsightXMarkets(mantleMcp, {
      endpoint: options.insightxEndpoint,
      search: options.insightxSearch,
    }),
    fetchAaveStablecoinRates(mantleMcp, network),
    fetchAaveWindowSnapshots(
      macro_event.pre_window.end_unix ?? Math.floor(Date.parse(macro_event.pre_window.end_utc) / 1000),
      macro_event.post_window.end_unix ?? Math.floor(Date.parse(macro_event.post_window.end_utc) / 1000),
      preflight,
      network,
    ),
  ]);

  const base: AcquisitionSnapshot = {
    objective: isInsightXOutputSkipped()
      ? 'macro-to-onchain correlation baseline (SPCXx / Aave)'
      : 'macro-to-onchain correlation baseline (SPCXx / InsightX / Aave)',
    network,
    collected_at_utc: new Date().toISOString(),
    macro_event,
    preflight,
    xstocks,
    insightx,
    aave,
    aave_windows,
    ...(macro_calendar ? { macro_calendar } : {}),
    ...(calendar_events ? { calendar_events } : {}),
    ...(cross_event_correlation ? { cross_event_correlation } : {}),
  };

  return base;
}

export { MACRO_EVENT_CALENDAR };
