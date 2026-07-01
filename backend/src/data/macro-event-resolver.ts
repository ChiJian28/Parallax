import { callGeminiJson } from '../lib/gemini-client.js';
import { registerDynamicDefinition } from './event-definition-store.js';
import {
  getCalendarEvent,
  MACRO_EVENT_CALENDAR,
  type MacroCalendarEventDefinition,
  type MacroCalendarEventType,
} from './macro-event-calendar.js';
import { resolveCalendarEvent } from './macro-events.js';
import type {
  MacroEventBatchInputItem,
  MacroEventBatchResolveResponse,
  MacroEventBatchResultItem,
  MacroEventDiscoveredParams,
  MacroEventIntentClassification,
  MacroEventResolveRequest,
  MacroEventResolveResponse,
} from './types.js';

const SUPPORTED_EVENT_TYPES: MacroCalendarEventType[] = ['CPI', 'FED_RATE', 'IPO'];

/** Human-readable aliases for deterministic + LLM registry matching */
export const MACRO_EVENT_ALIASES: Record<string, string[]> = {
  'fomc-jan-2026': ['fomc jan 2026', 'fomc january 2026', 'fed january 2026', 'january fomc'],
  'cpi-feb-2026': ['cpi feb 2026', 'cpi february 2026', 'february cpi', 'feb cpi 2026'],
  'cpi-mar-2026': ['cpi mar 2026', 'cpi march 2026', 'march cpi', 'mar cpi 2026'],
  'fomc-mar-2026': [
    'fomc mar 2026',
    'fomc march 2026',
    'fed march 2026',
    'march fomc',
    'fomc meeting march 2026',
  ],
  'cpi-jun-2026': ['cpi jun 2026', 'cpi june 2026', 'june cpi'],
  'crcl-ipo-q2': ['circle ipo', 'crcl ipo', 'crcl listing'],
  'spacex-ipo-q1': [
    'spacex ipo',
    'space x ipo',
    'spcx ipo',
    'spcxx ipo',
    'spacex listing',
    'spacex public offering',
  ],
};

interface IntentClassification extends MacroEventIntentClassification {}

interface WebDiscoveredParams extends MacroEventDiscoveredParams {}

export interface MacroEventResolverOptions {
  geminiApiKey?: string;
  fredApiKey?: string;
  geminiModel?: string;
}

function buildRegistrySummary(): string {
  return MACRO_EVENT_CALENDAR.map((event) => {
    const aliases = MACRO_EVENT_ALIASES[event.event_id] ?? [];
    return [
      `- event_id: ${event.event_id}`,
      `  name: ${event.name}`,
      `  type: ${event.type}`,
      `  trigger_utc: ${new Date(event.timestamp_unix * 1000).toISOString()}`,
      `  tokens: ${event.tokens.join(', ')}`,
      aliases.length > 0 ? `  aliases: ${aliases.join('; ')}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }).join('\n');
}

function normalizePrompt(prompt: string): string {
  return prompt.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Fast deterministic match against registry IDs, names, and aliases.
 */
export function matchKnownEventFromPrompt(prompt: string): string | null {
  const normalized = normalizePrompt(prompt);

  for (const event of MACRO_EVENT_CALENDAR) {
    if (normalized.includes(event.event_id)) return event.event_id;

    const nameSpaced = event.name.toLowerCase().replace(/_/g, ' ');
    if (normalized.includes(nameSpaced)) return event.event_id;
  }

  for (const [eventId, aliases] of Object.entries(MACRO_EVENT_ALIASES)) {
    for (const alias of aliases) {
      if (normalized.includes(alias)) return eventId;
    }
  }

  return null;
}

async function classifyIntentWithLlm(
  prompt: string,
  apiKey: string,
  model?: string,
): Promise<IntentClassification> {
  const registry = buildRegistrySummary();

  const result = await callGeminiJson<IntentClassification>({
    apiKey,
    model,
    systemInstruction:
      'You classify macro finance event prompts for the Parallax onchain correlation agent. ' +
      'Known events must map to an exact event_id from the registry. ' +
      'If the user describes an event not in the registry, return match_type "unknown".',
    prompt: `User prompt:
"${prompt}"

Known macro event registry:
${registry}

Return JSON:
{
  "match_type": "known" | "unknown",
  "event_id": "<registry event_id or null>",
  "confidence": 0.0-1.0,
  "reasoning": "<brief explanation>"
}

Rules:
- match_type "known" only when the prompt clearly refers to a registry event (by name, alias, or event_id).
- For ambiguous prompts, prefer "unknown".
- event_id must be null when match_type is "unknown".`,
    responseSchema: {
      type: 'object',
      properties: {
        match_type: { type: 'string', enum: ['known', 'unknown'] },
        event_id: { type: 'string', nullable: true },
        confidence: { type: 'number' },
        reasoning: { type: 'string' },
      },
      required: ['match_type', 'event_id', 'confidence', 'reasoning'],
    },
  });

  if (!result.ok) {
    throw new Error(`Gemini intent classification failed (${result.status}): ${result.body.slice(0, 300)}`);
  }

  return result.data;
}

async function discoverParamsViaWebSearch(
  prompt: string,
  apiKey: string,
  model?: string,
): Promise<WebDiscoveredParams> {
  const result = await callGeminiJson<WebDiscoveredParams>({
    apiKey,
    model,
    useGoogleSearch: true,
    systemInstruction:
      'You research macro finance events using web search. ' +
      'Extract only factual, verifiable scheduling details. ' +
      'Supported event types for downstream APIs: CPI, FED_RATE, IPO. ' +
      'If the event is not one of these or you cannot find a reliable UTC trigger time, set found=false.',
    prompt: `User is asking about this macro event:
"${prompt}"

Use web search to find:
1. Official event type: CPI | FED_RATE | IPO | OTHER
2. Canonical event name
3. Trigger/release datetime in UTC (ISO 8601, e.g. 2026-03-19T18:00:00.000Z)
4. Relevant Mantle xStock tickers (prefer SPCXx for equity IPOs; use standard symbols like TSLA_x, NVDA_x for macro)
5. FRED series if applicable (DFF for Fed, CPIAUCSL for CPI)
6. Suggested pre/post measurement windows in hours (defaults: FED_RATE 48/12, CPI 24/6, IPO 48/48)

Return JSON only:
{
  "found": boolean,
  "event_name": string | null,
  "event_type": "CPI" | "FED_RATE" | "IPO" | "OTHER" | null,
  "trigger_time_utc": string | null,
  "target_tokens": string[],
  "fred_series": string | null,
  "window_pre_hours": number | null,
  "window_post_hours": number | null,
  "hardcoded_surprise": number | null,
  "confidence": 0.0-1.0,
  "reasoning": string,
  "search_summary": string | null
}

Set found=false if:
- Event type is OTHER or unsupported
- No reliable trigger_time_utc found
- Confidence below 0.5`,
    maxOutputTokens: 8192,
  });

  if (!result.ok) {
    throw new Error(`Gemini web search failed (${result.status}): ${result.body.slice(0, 300)}`);
  }

  return result.data;
}

function defaultWindows(type: MacroCalendarEventType): { pre: number; post: number } {
  switch (type) {
    case 'FED_RATE':
      return { pre: 48, post: 12 };
    case 'CPI':
      return { pre: 24, post: 6 };
    case 'IPO':
      return { pre: 48, post: 48 };
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function webParamsToDefinition(params: WebDiscoveredParams): MacroCalendarEventDefinition | null {
  if (
    !params.found ||
    !params.event_name ||
    !params.event_type ||
    params.event_type === 'OTHER' ||
    !params.trigger_time_utc
  ) {
    return null;
  }

  if (!SUPPORTED_EVENT_TYPES.includes(params.event_type)) return null;

  const triggerUnix = Math.floor(Date.parse(params.trigger_time_utc) / 1000);
  if (!Number.isFinite(triggerUnix)) return null;

  const windows = defaultWindows(params.event_type);
  const dateSlug = params.trigger_time_utc.slice(0, 10);

  const definition: MacroCalendarEventDefinition = {
    event_id: `discovered-${slugify(params.event_name)}-${dateSlug}`,
    name: params.event_name.toUpperCase().replace(/\s+/g, '_'),
    type: params.event_type,
    timestamp_unix: triggerUnix,
    tokens: params.target_tokens.length > 0 ? params.target_tokens : ['SPCXx'],
    window_pre_hours: params.window_pre_hours ?? windows.pre,
    window_post_hours: params.window_post_hours ?? windows.post,
  };

  if (params.event_type === 'FED_RATE') {
    definition.fred_series = params.fred_series ?? 'DFF';
  } else if (params.event_type === 'CPI') {
    definition.fred_series = params.fred_series ?? 'CPIAUCSL';
  } else if (params.hardcoded_surprise != null) {
    definition.hardcoded_surprise = params.hardcoded_surprise;
  }

  return definition;
}

function unsupportedResponse(
  userPrompt: string,
  classification: IntentClassification | undefined,
  message: string,
  extra?: Partial<MacroEventResolveResponse>,
): MacroEventResolveResponse {
  return {
    success: false,
    resolution_path: 'unsupported',
    user_prompt: userPrompt,
    classification,
    message,
    ...extra,
  };
}

/**
 * Resolve a known registry event by event_id (multi-select fast path — no LLM).
 */
export async function resolveMacroEventById(
  eventId: string,
  options: MacroEventResolverOptions = {},
): Promise<MacroEventResolveResponse> {
  const trimmed = eventId.trim();
  if (!trimmed) {
    return unsupportedResponse(trimmed, undefined, 'Please provide a valid event_id.');
  }

  const definition = getCalendarEvent(trimmed);
  if (!definition) {
    return unsupportedResponse(
      trimmed,
      undefined,
      `Unknown event_id "${trimmed}". Use GET /api/macro-events to list selectable events.`,
      { registry_event_id: trimmed },
    );
  }

  const event = await resolveCalendarEvent(definition, options.fredApiKey);
  return {
    success: true,
    resolution_path: 'registry',
    user_prompt: trimmed,
    classification: {
      match_type: 'known',
      event_id: definition.event_id,
      confidence: 1,
      reasoning: 'Direct registry selection by event_id.',
    },
    registry_event_id: definition.event_id,
    event,
  };
}

function buildBatchTasks(request: MacroEventResolveRequest): MacroEventBatchInputItem[] {
  const tasks: MacroEventBatchInputItem[] = [];
  const seenEventIds = new Set<string>();
  const seenPrompts = new Set<string>();

  for (const id of request.event_ids ?? []) {
    const trimmed = id.trim();
    if (!trimmed || seenEventIds.has(trimmed)) continue;
    seenEventIds.add(trimmed);
    tasks.push({ type: 'event_id', value: trimmed });
  }

  const promptList = [...(request.prompts ?? [])];
  if (request.prompt?.trim()) {
    promptList.unshift(request.prompt.trim());
  }

  for (const prompt of promptList) {
    const trimmed = prompt.trim();
    if (!trimmed || seenPrompts.has(trimmed)) continue;
    seenPrompts.add(trimmed);
    tasks.push({ type: 'prompt', value: trimmed });
  }

  return tasks;
}

export function isBatchMacroEventRequest(request: MacroEventResolveRequest): boolean {
  const hasEventIds = (request.event_ids?.length ?? 0) > 0;
  const hasMultiplePrompts = (request.prompts?.length ?? 0) > 0;
  const hasPromptAndEventIds = Boolean(request.prompt?.trim()) && hasEventIds;
  return hasEventIds || hasMultiplePrompts || hasPromptAndEventIds;
}

/**
 * Resolve multiple macro events from registry event_ids and/or free-text prompts.
 */
export async function resolveMacroEventsBatch(
  request: MacroEventResolveRequest,
  options: MacroEventResolverOptions = {},
): Promise<MacroEventBatchResolveResponse> {
  const tasks = buildBatchTasks(request);

  if (tasks.length === 0) {
    return {
      mode: 'batch',
      success: false,
      total_requested: 0,
      total_resolved: 0,
      total_failed: 0,
      results: [],
      events: [],
      event_ids: [],
    };
  }

  const results: MacroEventBatchResultItem[] = await Promise.all(
    tasks.map(async (input): Promise<MacroEventBatchResultItem> => {
      try {
        const result =
          input.type === 'event_id'
            ? await resolveMacroEventById(input.value, options)
            : await resolveMacroEventFromPrompt(input.value, options);

        return {
          input,
          success: result.success,
          result,
          event: result.event,
          message: result.message,
        };
      } catch (error) {
        return {
          input,
          success: false,
          message: error instanceof Error ? error.message : 'Resolution failed',
        };
      }
    }),
  );

  const events = results
    .filter((item): item is MacroEventBatchResultItem & { event: NonNullable<MacroEventBatchResultItem['event']> } =>
      Boolean(item.success && item.event),
    )
    .map((item) => item.event)
    .sort((a, b) => a.trigger_time_unix - b.trigger_time_unix);

  const event_ids = [...new Set(events.map((event) => event.event_id))];

  return {
    mode: 'batch',
    success: results.some((item) => item.success),
    total_requested: tasks.length,
    total_resolved: results.filter((item) => item.success).length,
    total_failed: results.filter((item) => !item.success).length,
    results,
    events,
    event_ids,
  };
}

/**
 * Unified entry: single prompt → MacroEventResolveResponse; multi-select → batch response.
 */
export async function resolveMacroEvents(
  request: MacroEventResolveRequest,
  options: MacroEventResolverOptions = {},
): Promise<MacroEventResolveResponse | MacroEventBatchResolveResponse> {
  if (isBatchMacroEventRequest(request)) {
    return resolveMacroEventsBatch(request, options);
  }

  const prompt = request.prompt?.trim();
  if (!prompt) {
    return unsupportedResponse('', undefined, 'Provide prompt, prompts[], or event_ids[].');
  }

  return resolveMacroEventFromPrompt(prompt, options);
}

/**
 * Resolve a user prompt into a fully parameterized macro event.
 *
 * Flow:
 * 1. Deterministic registry match (fast path)
 * 2. LLM intent classification (known vs unknown)
 * 3. Known → calendar registry; Unknown → Gemini web search → dynamic params
 */
export async function resolveMacroEventFromPrompt(
  userPrompt: string,
  options: MacroEventResolverOptions = {},
): Promise<MacroEventResolveResponse> {
  const trimmed = userPrompt.trim();
  if (!trimmed) {
    return unsupportedResponse(trimmed, undefined, 'Please provide an event description.');
  }

  const geminiKey = options.geminiApiKey ?? process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return unsupportedResponse(
      trimmed,
      undefined,
      'GEMINI_API_KEY is not configured. Event detection requires Gemini for intent classification.',
    );
  }

  const deterministicId = matchKnownEventFromPrompt(trimmed);
  let classification: IntentClassification | undefined;

  if (deterministicId) {
    classification = {
      match_type: 'known',
      event_id: deterministicId,
      confidence: 1,
      reasoning: 'Matched pre-coded registry alias or event_id.',
    };
  } else {
    classification = await classifyIntentWithLlm(trimmed, geminiKey, options.geminiModel);
  }

  if (classification.match_type === 'known' && classification.event_id) {
    const definition = getCalendarEvent(classification.event_id);
    if (!definition) {
      return unsupportedResponse(
        trimmed,
        classification,
        'Current API not supported: matched event_id is not in the registry.',
      );
    }

    const event = await resolveCalendarEvent(definition, options.fredApiKey);
    return {
      success: true,
      resolution_path: 'registry',
      user_prompt: trimmed,
      classification,
      registry_event_id: definition.event_id,
      event,
    };
  }

  const discovered = await discoverParamsViaWebSearch(trimmed, geminiKey, options.geminiModel);

  if (!discovered.found || discovered.confidence < 0.5) {
    return unsupportedResponse(
      trimmed,
      classification,
      'Current API not supported: could not find reliable parameters for this event via web search.',
      { discovered_params: discovered },
    );
  }

  if (!discovered.event_type || discovered.event_type === 'OTHER') {
    return unsupportedResponse(
      trimmed,
      classification,
      'Current API not supported: event type is not CPI, FED_RATE, or IPO.',
      { discovered_params: discovered },
    );
  }

  const definition = webParamsToDefinition(discovered);
  if (!definition) {
    return unsupportedResponse(
      trimmed,
      classification,
      'Current API not supported: missing trigger time or required parameters.',
      { discovered_params: discovered },
    );
  }

  registerDynamicDefinition(definition);

  const event = await resolveCalendarEvent(definition, options.fredApiKey);
  return {
    success: true,
    resolution_path: 'web_search',
    user_prompt: trimmed,
    classification,
    discovered_params: discovered,
    dynamic_definition: definition,
    event,
    warnings: [
      'Parameters discovered via LLM web search — verify trigger time and tokens before production use.',
      ...(event.warnings ?? []),
    ],
  };
}

export function listRegistryEventsForApi(): Array<{
  event_id: string;
  name: string;
  type: MacroCalendarEventType;
  trigger_time_utc: string;
  tokens: string[];
  aliases: string[];
}> {
  return MACRO_EVENT_CALENDAR.map((event) => ({
    event_id: event.event_id,
    name: event.name,
    type: event.type,
    trigger_time_utc: new Date(event.timestamp_unix * 1000).toISOString(),
    tokens: event.tokens,
    aliases: MACRO_EVENT_ALIASES[event.event_id] ?? [],
  }));
}
