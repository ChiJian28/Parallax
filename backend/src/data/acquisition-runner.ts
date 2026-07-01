import { mantleMcp } from '../mcp/mantle-client.js';
import type { MantleNetwork } from '../mcp/mantle-client.js';
import { computeEventDelta } from '../agent/event-delta.js';
import { fetchAaveWindowSnapshots } from './aave-historical.js';
import {
  computeCrossEventCorrelation,
  type CalendarEventSnapshot,
  type CrossEventCorrelation,
} from './cross-event-correlation.js';
import { SPCXX_MOE_POOL } from './constants.js';
import {
  getEventDefinition,
  registerDynamicDefinitions,
} from './event-definition-store.js';
import type { MacroCalendarEventDefinition } from './macro-event-calendar.js';
import { resolveCalendarEvent } from './macro-events.js';
import { runPreflight } from './preflight.js';
import type { MacroEventDetectionResult } from './types.js';
import { fetchXstocksHistoricalWindow } from './xstocks.js';

export type AcquisitionTraceLevel = 'rpc' | 'info' | 'ok' | 'warn';

export interface AcquisitionTraceLog {
  timestamp: string;
  level: AcquisitionTraceLevel;
  message: string;
  node?: 'thinker' | 'worker' | 'verifier';
}

export interface AcquisitionRunResult {
  success: boolean;
  primary_event_id: string;
  event_ids: string[];
  logs: AcquisitionTraceLog[];
  cross_event_correlation?: CrossEventCorrelation;
  events_resolved: number;
  events_failed: number;
  /** Populated when acquisition completes — used for live report generation. */
  snapshots?: CalendarEventSnapshot[];
}

export interface AcquisitionRunOptions {
  eventIds: string[];
  /** Optional resolved definitions (e.g. from POST /macro-events/resolve) — survives server restart. */
  definitions?: MacroCalendarEventDefinition[];
  network?: MantleNetwork;
  fredApiKey?: string;
}

function nowStamp(): string {
  return new Date().toISOString().slice(11, 19);
}

function pushLog(
  logs: AcquisitionTraceLog[],
  level: AcquisitionTraceLevel,
  message: string,
  node?: AcquisitionTraceLog['node'],
): void {
  logs.push({ timestamp: nowStamp(), level, message, node });
}

async function collectEventSnapshot(
  macro: MacroEventDetectionResult,
  preflight: Awaited<ReturnType<typeof runPreflight>>,
  network: MantleNetwork,
  logs: AcquisitionTraceLog[],
): Promise<CalendarEventSnapshot> {
  const preUnix =
    macro.pre_window.end_unix ?? Math.floor(Date.parse(macro.pre_window.end_utc) / 1000);
  const postUnix =
    macro.post_window.end_unix ?? Math.floor(Date.parse(macro.post_window.end_utc) / 1000);

  const includesSpcxx =
    macro.target_token === 'SPCXx' || macro.target_tokens?.includes('SPCXx') === true;

  let xstocks: Awaited<ReturnType<typeof fetchXstocksHistoricalWindow>> | null = null;

  if (includesSpcxx) {
    pushLog(
      logs,
      'rpc',
      `eth_call getActiveId(pool=${SPCXX_MOE_POOL.address}, block=pre_window @ unix=${preUnix})`,
      'worker',
    );
    pushLog(
      logs,
      'rpc',
      `eth_call getActiveId(pool=${SPCXX_MOE_POOL.address}, block=post_window @ unix=${postUnix})`,
      'worker',
    );

    xstocks = await fetchXstocksHistoricalWindow({
      preUnix,
      postUnix,
      macroSurprise: macro.surprise_magnitude,
      windowHours: macro.pre_window.hours,
    });

    const lb = xstocks.lb_historical;
    if (lb?.pre_block != null && lb?.post_block != null) {
      pushLog(
        logs,
        xstocks.status === 'ok' ? 'ok' : 'warn',
        `${macro.event_id}: getActiveId pre_block=${lb.pre_block}→id=${lb.pre_active_id} post_block=${lb.post_block}→id=${lb.post_active_id} price_Δ=${xstocks.price_shift_pct ?? 'n/a'}%`,
        'worker',
      );
    } else {
      for (const warning of xstocks.warnings ?? []) {
        pushLog(logs, 'warn', warning, 'worker');
      }
      for (const caveat of xstocks.caveats ?? []) {
        pushLog(logs, 'info', caveat, 'worker');
      }
    }
  } else {
    pushLog(
      logs,
      'info',
      `${macro.event_id}: xStocks read skipped (target=${macro.target_token})`,
      'worker',
    );
  }

  pushLog(
    logs,
    'rpc',
    `getReserveData(USDC|USDT0|USDe) @ AaveDataProvider pre/post unix=${preUnix}/${postUnix}`,
    'worker',
  );

  const aave_windows = await fetchAaveWindowSnapshots(preUnix, postUnix, preflight, network);

  if (aave_windows.pre_block != null && aave_windows.post_block != null) {
    const preUtil =
      aave_windows.pre.length > 0
        ? (
            aave_windows.pre.reduce((sum, r) => sum + (r.utilization_rate ?? 0), 0) /
            aave_windows.pre.length
          ).toFixed(2)
        : 'n/a';
    const postUtil =
      aave_windows.post.length > 0
        ? (
            aave_windows.post.reduce((sum, r) => sum + (r.utilization_rate ?? 0), 0) /
            aave_windows.post.length
          ).toFixed(2)
        : 'n/a';
    pushLog(
      logs,
      aave_windows.status === 'ok' ? 'ok' : 'warn',
      `${macro.event_id}: Aave blocks pre=${aave_windows.pre_block} post=${aave_windows.post_block} avg_util ${preUtil}%→${postUtil}%`,
      'worker',
    );
  }

  for (const warning of aave_windows.warnings) {
    pushLog(logs, 'warn', warning, 'worker');
  }

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

  return { macro, aave_windows, event_delta };
}

/**
 * Run Module 2 acquisition for selected registry event_ids and emit trace logs
 * suitable for the HUD right-panel terminal.
 */
export async function runAcquisitionTrace(
  options: AcquisitionRunOptions,
): Promise<AcquisitionRunResult> {
  const logs: AcquisitionTraceLog[] = [];
  const network = options.network ?? 'mainnet';
  const eventIds = [...new Set(options.eventIds.map((id) => id.trim()).filter(Boolean))];

  if (eventIds.length === 0) {
    return {
      success: false,
      primary_event_id: '',
      event_ids: [],
      logs: [{ timestamp: nowStamp(), level: 'warn', message: 'No event_ids provided.' }],
      events_resolved: 0,
      events_failed: 0,
    };
  }

  pushLog(logs, 'info', `> acquisition engine — ${eventIds.length} event(s)`, 'thinker');

  if (options.definitions?.length) {
    registerDynamicDefinitions(options.definitions);
    pushLog(
      logs,
      'info',
      `registered ${options.definitions.length} dynamic definition(s) from request`,
      'thinker',
    );
  }

  const macros: MacroEventDetectionResult[] = [];
  let failed = 0;

  for (const eventId of eventIds) {
    const definition = getEventDefinition(eventId);
    if (!definition) {
      failed += 1;
      pushLog(logs, 'warn', `Unknown event_id: ${eventId}`, 'thinker');
      continue;
    }

    pushLog(
      logs,
      'info',
      `resolve ${eventId} (${definition.type}) — FRED series ${definition.fred_series ?? 'hardcoded'}`,
      'thinker',
    );

    const macro = await resolveCalendarEvent(definition, options.fredApiKey);
    macros.push(macro);

    pushLog(
      logs,
      'ok',
      `${eventId}: surprise=${macro.surprise_magnitude ?? 'n/a'} (${macro.surprise_method ?? 'n/a'}) trigger=${macro.trigger_time_utc}`,
      'thinker',
    );
  }

  if (macros.length === 0) {
    return {
      success: false,
      primary_event_id: eventIds[0],
      event_ids: eventIds,
      logs,
      events_resolved: 0,
      events_failed: failed,
    };
  }

  pushLog(logs, 'info', 'mantle_validateAddress — SPCXx / USDC registry preflight', 'worker');
  const preflight = await runPreflight(mantleMcp, network);
  pushLog(
    logs,
    'ok',
    `preflight ok — SPCXx=${preflight.addresses.spcxx.address} USDC=${preflight.addresses.usdc.address}`,
    'worker',
  );

  const snapshots: CalendarEventSnapshot[] = [];
  for (const macro of macros) {
    snapshots.push(await collectEventSnapshot(macro, preflight, network, logs));
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  let cross_event_correlation: CrossEventCorrelation | undefined;
  if (snapshots.length >= 2) {
    pushLog(
      logs,
      'info',
      `Pearson r matrix — ${snapshots.length} events`,
      'verifier',
    );
    cross_event_correlation = computeCrossEventCorrelation(snapshots);
    pushLog(
      logs,
      'ok',
      `r(macro,xStocks)=${cross_event_correlation.pearson_macro_xstocks ?? 'n/a'} r(xStocks,aave)=${cross_event_correlation.pearson_xstocks_aave ?? 'n/a'} r(macro,aave)=${cross_event_correlation.pearson_macro_aave ?? 'n/a'}`,
      'verifier',
    );
  } else {
    pushLog(logs, 'info', 'single-event run — cross-event Pearson skipped (need ≥2)', 'verifier');
  }

  pushLog(logs, 'ok', 'acquisition trace complete', 'verifier');

  return {
    success: true,
    primary_event_id: macros[0].event_id,
    event_ids: macros.map((m) => m.event_id),
    logs,
    cross_event_correlation,
    events_resolved: macros.length,
    events_failed: failed,
    snapshots,
  };
}
