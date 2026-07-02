export interface ReportSummary {
  eventId: string;
  eventName: string;
  priceMNT: number;
  timestamp: number;
}

export interface ReportTeaser {
  eventId: string;
  eventName: string;
  teaser: string;
  priceMNT: number;
  x402Required?: boolean;
}

export interface CrossEventCorrelation {
  events_analyzed: number;
  pearson_macro_xstocks: number | null;
  pearson_xstocks_aave: number | null;
  pearson_macro_aave: number | null;
  series?: Array<{
    event_id: string;
    event_type: string;
    macro_surprise: number;
    xstocks_price_change_pct: number | null;
    aave_utilization_delta: number | null;
  }>;
}

export interface EventDeltaQuality {
  xstocks_source?: 'sql_indexer' | 'historical_rpc' | 'live_snapshot';
  aave_source?: 'historical_rpc' | 'live_snapshot';
  caveats?: string[];
}

export interface ReportFull extends ReportTeaser {
  fullContent: string;
  computedMetrics?: {
    macroSurprise: number;
    priceDelta: number;
    volumeSpike: number;
    insightXAccuracy?: number;
    aaveUtilizationDelta?: number | null;
    aaveBorrowApyDelta?: number | null;
    aaveSupplyDeltaUsd?: number | null;
    capitalFlowDirection?: string;
    liquidityChangePct?: number | null;
    pearsonMacroXstocks?: number | null;
    pearsonXstocksAave?: number | null;
    pearsonMacroAave?: number | null;
  };
  eventDelta?: {
    data_quality?: EventDeltaQuality;
    price_change_pct?: number | null;
    volume_spike_ratio?: number | null;
  };
  crossEventCorrelation?: CrossEventCorrelation;
  dataSources?: {
    baseline?: string;
    postEvent?: string;
    llm?: string;
    snapshot?: string;
  };
  x402Settlement?: {
    success: boolean;
    transaction?: string;
    payer?: string;
  };
}

export interface ReputationSummary {
  agentId: string;
  count: number;
  averageValue: number;
  tags?: string[];
}

export interface Erc8004FeedbackItem {
  score: number;
  maxScore: number;
  tag: string;
  comment: string;
  reviewer: string;
  reviewerFull?: string;
  feedbackKey?: string;
  feedbackIndex?: number;
  txHash: string;
  fullTxHash?: string;
  indexStatus?: 'pending' | 'verified';
  createdAt?: number;
  rawValue?: number | null;
}

export interface ReputationCurvePoint {
  label: string;
  score: number;
}

export interface FeedbackFeedResponse {
  agentId: string;
  items: Erc8004FeedbackItem[];
  curve: ReputationCurvePoint[];
}

export async function fetchReportList(): Promise<ReportSummary[]> {
  const res = await fetch('/api/reports', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load reports (${res.status})`);
  const data = (await res.json()) as { reports: ReportSummary[] };
  return data.reports;
}

export async function fetchReportTeaser(eventId: string): Promise<ReportTeaser> {
  const res = await fetch(`/api/report/${eventId}`, { cache: 'no-store' });
  return res.json() as Promise<ReportTeaser>;
}

export async function fetchReportUnlocked(eventId: string): Promise<ReportFull> {
  const res = await fetch(`/api/report/${eventId}`, {
    headers: { 'PAYMENT-SIGNATURE': 'dev-test-payment' },
    cache: 'no-store',
  });
  const data = (await res.json()) as ReportFull;
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data;
}

export async function fetchReputation(agentId: string): Promise<ReputationSummary> {
  const res = await fetch(`/api/reputation/${encodeURIComponent(agentId)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load reputation (${res.status})`);
  return res.json() as Promise<ReputationSummary>;
}

export async function fetchFeedbackFeed(agentId: string): Promise<FeedbackFeedResponse> {
  const res = await fetch(`/api/reputation/${encodeURIComponent(agentId)}/feedback`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to load feedback feed (${res.status})`);
  return res.json() as Promise<FeedbackFeedResponse>;
}

export interface MacroRegistryEvent {
  event_id: string;
  name: string;
  type: 'CPI' | 'FED_RATE' | 'IPO';
  trigger_time_utc: string;
  tokens: string[];
  aliases: string[];
}

export interface MacroEventsListResponse {
  events: MacroRegistryEvent[];
  multi_select: {
    enabled: boolean;
    max_events: number;
    input_field: string;
    resolve_endpoint: string;
  };
}

export interface MacroEventBatchResolveResponse {
  mode: 'batch';
  success: boolean;
  total_requested: number;
  total_resolved: number;
  total_failed: number;
  event_ids: string[];
  events: Array<{
    event_id: string;
    event_name: string;
    event_type?: string;
    trigger_time_utc: string;
    surprise_magnitude: number | null;
    target_token: string;
  }>;
}

export async function fetchMacroEvents(): Promise<MacroEventsListResponse> {
  const res = await fetch('/api/macro-events', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load macro events (${res.status})`);
  return res.json() as Promise<MacroEventsListResponse>;
}

export async function resolveMacroEvents(eventIds: string[]): Promise<MacroEventBatchResolveResponse> {
  const res = await fetch('/api/macro-events/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_ids: eventIds }),
  });
  const data = (await res.json()) as MacroEventBatchResolveResponse & { error?: string };
  if (!res.ok && !data.events?.length) {
    throw new Error(data.error ?? `Resolve failed (${res.status})`);
  }
  return data;
}

export async function resolveMacroPrompt(prompt: string): Promise<MacroEventBatchResolveResponse | { success: boolean; event?: { event_id: string; event_name: string } }> {
  const res = await fetch('/api/macro-events/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  return res.json() as Promise<MacroEventBatchResolveResponse | { success: boolean; event?: { event_id: string; event_name: string } }>;
}

export interface AcquisitionTraceLog {
  timestamp: string;
  level: 'rpc' | 'info' | 'ok' | 'warn';
  message: string;
  node?: 'thinker' | 'worker' | 'verifier';
}

export interface AcquisitionRunResponse {
  success: boolean;
  primary_event_id: string;
  event_ids: string[];
  logs: AcquisitionTraceLog[];
  cross_event_correlation?: CrossEventCorrelation;
  events_resolved: number;
  events_failed: number;
}

export async function runAcquisitionTrace(eventIds: string[]): Promise<AcquisitionRunResponse> {
  const res = await fetch('/api/acquisition/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_ids: eventIds }),
  });
  const data = (await res.json()) as AcquisitionRunResponse & { error?: string };
  if (!res.ok && !data.logs?.length) {
    throw new Error(data.error ?? `Acquisition failed (${res.status})`);
  }
  return data;
}

export type CorrelationCacheStatus = 'cache_hit' | 'cache_miss' | 'live_generated';

export interface CorrelationCacheProbe {
  batch_id: string;
  event_ids: string[];
  all_cached: boolean;
  events_cached: string[];
  events_missing: string[];
  combined_cached: boolean;
}

export interface CorrelationRunResponse {
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
  error?: string;
}

/** Fast cache probe — no RPC, no Gemini. */
export async function probeCorrelationCache(eventIds: string[]): Promise<CorrelationCacheProbe> {
  const res = await fetch('/api/run-correlation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_ids: eventIds, mode: 'probe' }),
    cache: 'no-store',
  });
  const data = (await res.json()) as CorrelationCacheProbe & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Cache probe failed (${res.status})`);
  return data;
}

/** Cache-first correlation run — acquisition + optional live Gemini generation. */
export async function runHudCorrelation(
  eventIds: string[],
  options?: { skipAcquisition?: boolean },
): Promise<CorrelationRunResponse> {
  const res = await fetch('/api/run-correlation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_ids: eventIds,
      skip_acquisition: options?.skipAcquisition === true,
    }),
    cache: 'no-store',
  });
  const data = (await res.json()) as CorrelationRunResponse;
  if (!res.ok && !data.logs?.length) {
    throw new Error(data.error ?? `Correlation run failed (${res.status})`);
  }
  return data;
}
