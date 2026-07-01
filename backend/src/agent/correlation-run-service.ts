import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildCombinedSynthesisInputs,
  generateCombinedSynthesis,
} from './combined-synthesizer.js';
import { generateReportFromCalendarSnapshot } from './calendar-report-generator.js';
import { reportStore } from './report-store.js';
import type { FinalReport } from './types.js';
import {
  computeCrossEventCorrelationFromSeries,
  type CrossEventCorrelation,
} from '../data/cross-event-correlation.js';
import {
  runAcquisitionTrace,
  type AcquisitionTraceLog,
} from '../data/acquisition-runner.js';
import { getAcquisitionSession } from './acquisition-session-cache.js';

export type CorrelationCacheStatus = 'cache_hit' | 'cache_miss' | 'live_generated';

export interface CombinedSynthesisCache {
  batchId: string;
  eventIds: string[];
  teaser: string;
  fullContent: string;
  cross_event_correlation?: CrossEventCorrelation;
  generated_at: string;
}

export interface CorrelationRunResult {
  status: CorrelationCacheStatus;
  animation_ms: number;
  batch_id: string;
  event_ids: string[];
  cache: {
    events_cached: string[];
    events_generated: string[];
    combined_cached: boolean;
  };
  logs: AcquisitionTraceLog[];
  cross_event_correlation?: CrossEventCorrelation;
  reports: Array<{
    eventId: string;
    eventName: string;
    teaser: string;
    priceMNT: number;
    cached: boolean;
  }>;
  combined_synthesis?: {
    teaser: string;
    fullContent: string;
  };
  primary_event_id: string;
  success: boolean;
}

const REPORTS_DIR = resolve(process.cwd(), 'reports');
const FAST_PATH_MS = 1500;
const SLOW_PATH_MS = 8000;

function nowStamp(): string {
  return new Date().toISOString().slice(11, 19);
}

function pushLog(
  logs: AcquisitionTraceLog[],
  level: AcquisitionTraceLog['level'],
  message: string,
  node?: AcquisitionTraceLog['node'],
): void {
  logs.push({ timestamp: nowStamp(), level, message, node });
}

function batchIdFromEventIds(eventIds: string[]): string {
  return [...new Set(eventIds.map((id) => id.trim()).filter(Boolean))].sort().join('+');
}

function combinedCachePath(batchId: string): string {
  return resolve(REPORTS_DIR, `combined_${batchId}.json`);
}

function loadCombinedCache(batchId: string): CombinedSynthesisCache | null {
  const filePath = combinedCachePath(batchId);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as CombinedSynthesisCache;
  } catch {
    return null;
  }
}

function saveCombinedCache(cache: CombinedSynthesisCache): void {
  mkdirSync(REPORTS_DIR, { recursive: true });
  writeFileSync(combinedCachePath(cache.batchId), `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}

function reportToTeaserPayload(report: FinalReport, cached: boolean) {
  return {
    eventId: report.eventId,
    eventName: report.eventName,
    teaser: report.teaser,
    priceMNT: report.priceMNT,
    cached,
  };
}

function buildCrossCorrelationFromReports(eventIds: string[]): CrossEventCorrelation | undefined {
  if (eventIds.length < 2) return undefined;

  const series = eventIds.map((eventId) => {
    const report = reportStore.get(eventId);
    return {
      event_id: eventId,
      event_type: report?.eventDelta?.event_type ?? 'OTHER',
      macro_surprise: report?.computedMetrics?.macroSurprise ?? 0,
      xstocks_price_change_pct: report?.computedMetrics?.priceDelta ?? null,
      aave_utilization_delta: report?.computedMetrics?.aaveUtilizationDelta ?? null,
    };
  });

  return computeCrossEventCorrelationFromSeries(series);
}

export interface CorrelationCacheProbe {
  batch_id: string;
  event_ids: string[];
  all_cached: boolean;
  events_cached: string[];
  events_missing: string[];
  combined_cached: boolean;
}

export function probeCorrelationCache(eventIds: string[]): CorrelationCacheProbe {
  const normalized = [...new Set(eventIds.map((id) => id.trim()).filter(Boolean))];
  const batchId = batchIdFromEventIds(normalized);
  const eventsCached = normalized.filter((id) => reportStore.get(id) != null);
  const eventsMissing = normalized.filter((id) => reportStore.get(id) == null);
  const combinedCached = normalized.length >= 2 ? loadCombinedCache(batchId) != null : true;

  return {
    batch_id: batchId,
    event_ids: normalized,
    all_cached: eventsMissing.length === 0 && combinedCached,
    events_cached: eventsCached,
    events_missing: eventsMissing,
    combined_cached: combinedCached,
  };
}

/**
 * Cache-first correlation run orchestrator for the HUD Initialize flow.
 *
 * Fast path: all per-event reports (and combined dossier when n≥2) exist on disk.
 * Slow path: runs live RPC acquisition + Gemini synthesis for cache misses.
 * skip_acquisition: reuse snapshots from POST /api/acquisition/run session cache.
 */
export async function runHudCorrelation(options: {
  eventIds: string[];
  fredApiKey?: string;
  geminiApiKey?: string;
  forceLive?: boolean;
  skipAcquisition?: boolean;
}): Promise<CorrelationRunResult> {
  const eventIds = [...new Set(options.eventIds.map((id) => id.trim()).filter(Boolean))];
  const batchId = batchIdFromEventIds(eventIds);
  const logs: AcquisitionTraceLog[] = [];

  if (eventIds.length === 0) {
    return {
      status: 'cache_miss',
      animation_ms: FAST_PATH_MS,
      batch_id: '',
      event_ids: [],
      cache: { events_cached: [], events_generated: [], combined_cached: false },
      logs: [{ timestamp: nowStamp(), level: 'warn', message: 'No event_ids provided.' }],
      reports: [],
      primary_event_id: '',
      success: false,
    };
  }

  pushLog(logs, 'info', `> correlation engine — scanning staging cache (${eventIds.length} event(s))`, 'thinker');
  pushLog(logs, 'info', 'Checking Staging Cache...', 'thinker');

  const eventsCached = eventIds.filter((id) => reportStore.get(id) != null);
  const eventsMissing = eventIds.filter((id) => reportStore.get(id) == null);
  const combinedCached = eventIds.length >= 2 ? loadCombinedCache(batchId) != null : true;
  const allEventsCached = eventsMissing.length === 0;
  const isFastPath = allEventsCached && combinedCached && !options.forceLive;

  for (const eventId of eventsCached) {
    pushLog(logs, 'ok', `Cache HIT: ${eventId} (reports/${eventId}.json)`, 'thinker');
  }
  for (const eventId of eventsMissing) {
    pushLog(logs, 'warn', `Cache MISS: ${eventId} — live generation required`, 'thinker');
  }

  if (eventIds.length >= 2) {
    pushLog(
      logs,
      combinedCached ? 'ok' : 'warn',
      combinedCached
        ? `Combined synthesis cache HIT — executive dossier (${batchId})`
        : `Combined synthesis cache MISS — will synthesize cross-event dossier`,
      'verifier',
    );
  }

  let cross_event_correlation: CrossEventCorrelation | undefined;
  let eventsGenerated: string[] = [];
  let status: CorrelationCacheStatus = isFastPath ? 'cache_hit' : 'cache_miss';

  if (isFastPath) {
    pushLog(logs, 'ok', 'Fast path — serving pre-baked quantitative dossier', 'verifier');
    cross_event_correlation =
      loadCombinedCache(batchId)?.cross_event_correlation ??
      buildCrossCorrelationFromReports(eventIds);
  } else {
    if (options.skipAcquisition) {
      pushLog(logs, 'info', 'Slow path — materializing reports from acquisition session', 'worker');
    } else {
      pushLog(logs, 'info', 'Slow path — invoking acquisition engine + Gemini synthesis', 'worker');
    }

    let acquisition:
      | Awaited<ReturnType<typeof runAcquisitionTrace>>
      | {
          success: boolean;
          primary_event_id: string;
          snapshots?: import('../data/cross-event-correlation.js').CalendarEventSnapshot[];
          cross_event_correlation?: CrossEventCorrelation;
        };

    if (options.skipAcquisition) {
      const session = getAcquisitionSession(eventIds);
      if (!session?.snapshots?.length) {
        pushLog(
          logs,
          'warn',
          'No acquisition session — run POST /api/acquisition/run first',
          'worker',
        );
        acquisition = { success: false, primary_event_id: eventIds[0] };
      } else {
        acquisition = {
          success: true,
          primary_event_id: session.primary_event_id,
          snapshots: session.snapshots,
          cross_event_correlation: session.cross_event_correlation,
        };
      }
    } else {
      acquisition = await runAcquisitionTrace({
        eventIds,
        fredApiKey: options.fredApiKey,
      });
      logs.push(...acquisition.logs);
    }

    cross_event_correlation = acquisition.cross_event_correlation;

    if (!acquisition.success || !acquisition.snapshots?.length) {
      return {
        status: 'cache_miss',
        animation_ms: SLOW_PATH_MS,
        batch_id: batchId,
        event_ids: eventIds,
        cache: {
          events_cached: eventsCached,
          events_generated: [],
          combined_cached: combinedCached,
        },
        logs,
        cross_event_correlation,
        reports: eventsCached
          .map((id) => reportStore.get(id))
          .filter((report): report is FinalReport => report != null)
          .map((report) => reportToTeaserPayload(report, true)),
        primary_event_id: acquisition.primary_event_id || eventIds[0],
        success: false,
      };
    }

    for (const snapshot of acquisition.snapshots) {
      const eventId = snapshot.macro.event_id;
      if (reportStore.get(eventId)) continue;

      pushLog(logs, 'info', `Gemini synthesis — generating report for ${eventId}`, 'verifier');
      const report = await generateReportFromCalendarSnapshot(
        snapshot,
        acquisition.cross_event_correlation,
        { geminiApiKey: options.geminiApiKey },
      );
      await reportStore.save(report);
      eventsGenerated.push(eventId);
      pushLog(logs, 'ok', `Live generated: reports/${eventId}.json`, 'verifier');
    }

    if (eventsGenerated.length > 0) {
      status = 'live_generated';
    }
  }

  let combined_synthesis: CorrelationRunResult['combined_synthesis'];
  let combinedCachedFinal = combinedCached;

  if (eventIds.length >= 2 && cross_event_correlation) {
    const existingCombined = loadCombinedCache(batchId);
    if (existingCombined && (isFastPath || eventsMissing.length === 0)) {
      combined_synthesis = {
        teaser: existingCombined.teaser,
        fullContent: existingCombined.fullContent,
      };
      combinedCachedFinal = true;
    } else {
      pushLog(logs, 'info', 'Synthesizing Cross-Correlation Matrix (summary ingestion)...', 'verifier');
      const teasersByEventId = Object.fromEntries(
        eventIds.map((id) => [id, reportStore.get(id)?.teaser ?? '']),
      );
      const { events, metrics } = buildCombinedSynthesisInputs(
        cross_event_correlation,
        teasersByEventId,
      );
      const output = await generateCombinedSynthesis(events, metrics, options.geminiApiKey);
      combined_synthesis = { teaser: output.teaser, fullContent: output.full_analysis };
      saveCombinedCache({
        batchId,
        eventIds,
        teaser: output.teaser,
        fullContent: output.full_analysis,
        cross_event_correlation,
        generated_at: new Date().toISOString(),
      });
      combinedCachedFinal = false;
      pushLog(logs, 'ok', `Executive dossier saved — reports/combined_${batchId}.json`, 'verifier');
    }
  }

  const reports = eventIds
    .map((id) => reportStore.get(id))
    .filter((report): report is FinalReport => report != null)
    .map((report) =>
      reportToTeaserPayload(report, !eventsGenerated.includes(report.eventId)),
    );

  pushLog(
    logs,
    'ok',
    `correlation run complete [${status}] — ${reports.length}/${eventIds.length} reports ready`,
    'verifier',
  );

  return {
    status,
    animation_ms: isFastPath ? FAST_PATH_MS : SLOW_PATH_MS,
    batch_id: batchId,
    event_ids: eventIds,
    cache: {
      events_cached: eventsCached,
      events_generated: eventsGenerated,
      combined_cached: combinedCachedFinal,
    },
    logs,
    cross_event_correlation,
    reports,
    combined_synthesis,
    primary_event_id: eventIds[0],
    success: reports.length > 0,
  };
}
