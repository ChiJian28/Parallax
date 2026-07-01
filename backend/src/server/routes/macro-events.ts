import type { IncomingMessage, ServerResponse } from 'node:http';
import { MACRO_EVENT_CALENDAR } from '../../data/macro-event-calendar.js';
import { listDynamicEventDefinitions } from '../../data/event-definition-store.js';
import {
  isBatchMacroEventRequest,
  listRegistryEventsForApi,
  resolveMacroEvents,
} from '../../data/macro-event-resolver.js';
import type { MacroEventResolveRequest } from '../../data/types.js';
import type { X402ServerConfig } from '../config.js';
import { readJsonBody, sendJson } from '../http-utils.js';

function parseResolveRequest(body: MacroEventResolveRequest): MacroEventResolveRequest {
  return {
    prompt: typeof body.prompt === 'string' ? body.prompt : undefined,
    prompts: Array.isArray(body.prompts)
      ? body.prompts.filter((value): value is string => typeof value === 'string')
      : undefined,
    event_ids: Array.isArray(body.event_ids)
      ? body.event_ids.filter((value): value is string => typeof value === 'string')
      : undefined,
  };
}

function hasResolveInput(request: MacroEventResolveRequest): boolean {
  return Boolean(
    request.prompt?.trim() ||
      (request.prompts?.length ?? 0) > 0 ||
      (request.event_ids?.length ?? 0) > 0,
  );
}

function batchStatusCode(result: { success: boolean; total_failed: number }): number {
  if (result.success && result.total_failed === 0) return 200;
  if (result.success && result.total_failed > 0) return 207;
  return 422;
}

export function handleListMacroEvents(_config: X402ServerConfig, res: ServerResponse): void {
  const registry = listRegistryEventsForApi();
  const discovered = listDynamicEventDefinitions().map((event) => ({
    event_id: event.event_id,
    name: event.name,
    type: event.type,
    trigger_time_utc: new Date(event.timestamp_unix * 1000).toISOString(),
    tokens: event.tokens,
    aliases: [] as string[],
    source: 'discovered' as const,
  }));

  sendJson(res, 200, {
    events: [...registry, ...discovered],
    supported_types: ['CPI', 'FED_RATE', 'IPO'],
    multi_select: {
      enabled: true,
      max_events: MACRO_EVENT_CALENDAR.length,
      input_field: 'event_ids',
      resolve_endpoint: 'POST /api/macro-events/resolve',
    },
    detection_flow: {
      known: 'event_ids[] → pre-coded registry (fast, no LLM)',
      prompt: 'prompt / prompts[] → intent classification → registry | web search',
      unsupported: 'Returns per-item message when parameters cannot be resolved',
    },
    request_examples: {
      single_prompt: { prompt: 'FOMC March 2026' },
      multi_select: { event_ids: ['fomc-mar-2026', 'spacex-ipo-q1', 'cpi-jun-2026'] },
      mixed: {
        event_ids: ['fomc-mar-2026'],
        prompts: ['CPI April 2026 release'],
      },
    },
  });
}

export async function handleResolveMacroEvent(
  _config: X402ServerConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  let body: MacroEventResolveRequest;
  try {
    body = await readJsonBody<MacroEventResolveRequest>(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  const request = parseResolveRequest(body);
  if (!hasResolveInput(request)) {
    sendJson(res, 400, {
      error: 'Missing input. Provide one of: prompt, prompts[], or event_ids[].',
      examples: {
        single: { prompt: 'SpaceX IPO' },
        multi_select: { event_ids: ['fomc-mar-2026', 'spacex-ipo-q1'] },
      },
    });
    return;
  }

  const result = await resolveMacroEvents(request, {
    geminiApiKey: process.env.GEMINI_API_KEY,
    fredApiKey: process.env.FRED_API_KEY,
    geminiModel: process.env.GEMINI_MODEL,
  });

  if ('mode' in result && result.mode === 'batch') {
    sendJson(res, batchStatusCode(result), result);
    return;
  }

  const status = result.success ? 200 : result.resolution_path === 'unsupported' ? 422 : 500;
  sendJson(res, status, result);
}
