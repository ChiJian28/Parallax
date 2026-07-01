import type { MacroCalendarEventDefinition } from './macro-event-calendar.js';
import { getCalendarEvent, MACRO_EVENT_CALENDAR } from './macro-event-calendar.js';
import { computeSurpriseForEvent } from './macro-surprise.js';
import type { MacroEventDetectionResult, TimeWindow } from './types.js';
import { fetchFredObservations, parseFredNumber } from './fred-client.js';

export interface MacroEventOptions {
  apiKey?: string;
  seriesId?: string;
  eventId?: string;
  eventName?: string;
  targetToken?: string;
  mockTriggerTimeUtc?: string;
  windowHours?: number;
  releaseHourUtc?: number;
}

function buildWindows(
  triggerUnix: number,
  preHours: number,
  postHours: number,
): { pre_window: TimeWindow; post_window: TimeWindow } {
  const preSeconds = preHours * 3600;
  const postSeconds = postHours * 3600;

  return {
    pre_window: {
      start_unix: triggerUnix - preSeconds,
      end_unix: triggerUnix,
      start_utc: new Date((triggerUnix - preSeconds) * 1000).toISOString(),
      end_utc: new Date(triggerUnix * 1000).toISOString(),
      hours: preHours,
    },
    post_window: {
      start_unix: triggerUnix,
      end_unix: triggerUnix + postSeconds,
      start_utc: new Date(triggerUnix * 1000).toISOString(),
      end_utc: new Date((triggerUnix + postSeconds) * 1000).toISOString(),
      hours: postHours,
    },
  };
}

function buildResult(params: {
  status: 'ok' | 'mock';
  source: 'fred' | 'mock' | 'calendar';
  eventId: string;
  eventName: string;
  eventType: MacroEventDetectionResult['event_type'];
  targetToken: string;
  targetTokens: string[];
  triggerUnix: number;
  preHours: number;
  postHours: number;
  seriesId: string | null;
  fredDate: string | null;
  currentValue: number | null;
  previousValue: number | null;
  surpriseMagnitude: number | null;
  surpriseMethod: MacroEventDetectionResult['surprise_method'];
  warnings: string[];
}): MacroEventDetectionResult {
  const windows = buildWindows(params.triggerUnix, params.preHours, params.postHours);

  return {
    status: params.status,
    source: params.source,
    event_id: params.eventId,
    event_name: params.eventName,
    event_type: params.eventType,
    target_token: params.targetToken,
    target_tokens: params.targetTokens,
    trigger_time_unix: params.triggerUnix,
    trigger_time_utc: new Date(params.triggerUnix * 1000).toISOString(),
    pre_window: windows.pre_window,
    post_window: windows.post_window,
    fred_series_id: params.seriesId,
    fred_observation_date: params.fredDate,
    current_value: params.currentValue,
    previous_value: params.previousValue,
    surprise_magnitude: params.surpriseMagnitude,
    surprise_method: params.surpriseMethod,
    warnings: params.warnings,
  };
}

/**
 * Resolve a calendar-defined macro event with type-specific FRED surprise.
 */
export async function resolveCalendarEvent(
  definition: MacroCalendarEventDefinition,
  apiKey?: string,
): Promise<MacroEventDetectionResult> {
  const surprise = await computeSurpriseForEvent(apiKey, {
    type: definition.type,
    timestamp_unix: definition.timestamp_unix,
    fred_series: definition.fred_series,
    hardcoded_surprise: definition.hardcoded_surprise,
  });

  const hasFred = definition.type !== 'IPO' && apiKey != null;
  return buildResult({
    status: hasFred || definition.type === 'IPO' ? 'ok' : 'mock',
    source: 'calendar',
    eventId: definition.event_id,
    eventName: definition.name,
    eventType: definition.type,
    targetToken: definition.tokens[0],
    targetTokens: definition.tokens,
    triggerUnix: definition.timestamp_unix,
    preHours: definition.window_pre_hours,
    postHours: definition.window_post_hours,
    seriesId: definition.fred_series ?? null,
    fredDate: surprise.fred_observation_date,
    currentValue: surprise.current_value,
    previousValue: surprise.previous_value,
    surpriseMagnitude: surprise.surprise_magnitude,
    surpriseMethod: surprise.method,
    warnings: surprise.warnings,
  });
}

export async function resolveAllCalendarEvents(apiKey?: string): Promise<MacroEventDetectionResult[]> {
  return Promise.all(MACRO_EVENT_CALENDAR.map((def) => resolveCalendarEvent(def, apiKey)));
}

/**
 * Legacy single-event detector — prefers calendar match, else latest FRED CPI observation.
 */
export async function detectMacroEventWindow(
  options: MacroEventOptions = {},
): Promise<MacroEventDetectionResult> {
  const eventId = options.eventId ?? 'spacex-ipo-q1';
  const calendarDef = getCalendarEvent(eventId);

  if (calendarDef) {
    return resolveCalendarEvent(calendarDef, options.apiKey);
  }

  const eventName = options.eventName ?? 'SpaceX Initial Public Offering (Mock Trigger)';
  const targetToken = options.targetToken ?? 'SPCXx';
  const windowHours = options.windowHours ?? 48;
  const mockTriggerIso = options.mockTriggerTimeUtc ?? '2026-06-15T13:30:00.000Z';
  const seriesId = options.seriesId ?? 'CPIAUCSL';
  const releaseHourUtc = options.releaseHourUtc ?? 12;

  if (!options.apiKey) {
    const triggerUnix = Math.floor(Date.parse(mockTriggerIso) / 1000);
    return buildResult({
      status: 'mock',
      source: 'mock',
      eventId,
      eventName,
      eventType: 'OTHER',
      targetToken,
      targetTokens: [targetToken],
      triggerUnix,
      preHours: windowHours,
      postHours: windowHours,
      seriesId: null,
      fredDate: null,
      currentValue: null,
      previousValue: null,
      surpriseMagnitude: null,
      surpriseMethod: undefined,
      warnings: [
        'FRED_API_KEY is not set; fallback to mock macro trigger time.',
        `Set FRED_API_KEY to pull live macro releases (series: ${seriesId}).`,
      ],
    });
  }

  try {
    const observations = await fetchFredObservations({
      apiKey: options.apiKey,
      seriesId,
      sortOrder: 'desc',
      limit: 2,
    });

    const current = observations[0];
    const previous = observations[1];
    if (!current) throw new Error('FRED returned no observations');

    const currentValue = parseFredNumber(current.value);
    const previousValue = previous ? parseFredNumber(previous.value) : null;
    const surpriseMagnitude =
      currentValue !== null && previousValue !== null ? currentValue - previousValue : null;

    const releaseDate = `${current.date}T${String(releaseHourUtc).padStart(2, '0')}:00:00.000Z`;
    const triggerUnix = Math.floor(Date.parse(releaseDate) / 1000);

    return buildResult({
      status: 'ok',
      source: 'fred',
      eventId,
      eventName: options.eventName ?? `FRED ${seriesId} Macro Release`,
      eventType: seriesId.includes('CPI') ? 'CPI' : 'OTHER',
      targetToken,
      targetTokens: [targetToken],
      triggerUnix,
      preHours: windowHours,
      postHours: windowHours,
      seriesId,
      fredDate: current.date,
      currentValue,
      previousValue,
      surpriseMagnitude,
      surpriseMethod: 'fred_level_delta',
      warnings: [],
    });
  } catch (error) {
    const triggerUnix = Math.floor(Date.parse(mockTriggerIso) / 1000);
    return buildResult({
      status: 'mock',
      source: 'mock',
      eventId,
      eventName,
      eventType: 'OTHER',
      targetToken,
      targetTokens: [targetToken],
      triggerUnix,
      preHours: windowHours,
      postHours: windowHours,
      seriesId,
      fredDate: null,
      currentValue: null,
      previousValue: null,
      surpriseMagnitude: null,
      surpriseMethod: undefined,
      warnings: [
        `FRED fetch failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        'Fallback to mock macro trigger time.',
      ],
    });
  }
}
