export type MantleNetwork = 'mainnet' | 'sepolia';

export interface ResolvedAddress {
  identifier: string;
  address: string;
  label: string;
  category: string;
  status: string;
  confidence: string;
  source_url: string;
  validated: boolean;
  warnings: string[];
}

export interface PreflightResult {
  network: MantleNetwork;
  resolved_at_utc: string;
  addresses: {
    spcxx: ResolvedAddress;
    usdc: ResolvedAddress;
    fluxion_router: ResolvedAddress;
    merchant_moe_router: ResolvedAddress;
    merchant_moe_lb_router: ResolvedAddress;
  };
}

export interface TimeWindow {
  start_unix?: number;
  end_unix?: number;
  start_utc: string;
  end_utc: string;
  hours: number;
}

export interface MacroEventIntentClassification {
  match_type: 'known' | 'unknown';
  event_id: string | null;
  confidence: number;
  reasoning: string;
}

export interface MacroEventDiscoveredParams {
  found: boolean;
  event_name: string | null;
  event_type: 'CPI' | 'FED_RATE' | 'IPO' | 'OTHER' | null;
  trigger_time_utc: string | null;
  target_tokens: string[];
  fred_series: string | null;
  window_pre_hours: number | null;
  window_post_hours: number | null;
  hardcoded_surprise: number | null;
  confidence: number;
  reasoning: string;
  search_summary: string | null;
}

export interface MacroEventResolveResponse {
  success: boolean;
  resolution_path: 'registry' | 'web_search' | 'unsupported';
  user_prompt: string;
  classification?: MacroEventIntentClassification;
  registry_event_id?: string;
  discovered_params?: MacroEventDiscoveredParams;
  dynamic_definition?: {
    event_id: string;
    name: string;
    type: 'CPI' | 'FED_RATE' | 'IPO';
    timestamp_unix: number;
    tokens: string[];
  };
  event?: MacroEventDetectionResult;
  message?: string;
  warnings?: string[];
}

export interface MacroEventBatchInputItem {
  type: 'event_id' | 'prompt';
  value: string;
}

export interface MacroEventBatchResultItem {
  input: MacroEventBatchInputItem;
  success: boolean;
  result?: MacroEventResolveResponse;
  event?: MacroEventDetectionResult;
  message?: string;
}

export interface MacroEventBatchResolveResponse {
  mode: 'batch';
  success: boolean;
  total_requested: number;
  total_resolved: number;
  total_failed: number;
  results: MacroEventBatchResultItem[];
  /** Successful events sorted by trigger_time_unix ascending */
  events: MacroEventDetectionResult[];
  event_ids: string[];
}

export interface MacroEventResolveRequest {
  /** Single free-text prompt (backward compatible) */
  prompt?: string;
  /** Multiple free-text prompts */
  prompts?: string[];
  /** Multi-select registry event_ids from GET /api/macro-events */
  event_ids?: string[];
}

export interface MacroEventDetectionResult {
  status: 'ok' | 'mock';
  source: 'fred' | 'mock' | 'calendar' | 'web_search';
  event_id: string;
  event_name: string;
  event_type?: 'CPI' | 'FED_RATE' | 'IPO' | 'OTHER';
  target_token: string;
  target_tokens?: string[];
  trigger_time_unix: number;
  trigger_time_utc: string;
  pre_window: TimeWindow;
  post_window: TimeWindow;
  fred_series_id: string | null;
  fred_observation_date: string | null;
  current_value: number | null;
  previous_value: number | null;
  surprise_magnitude: number | null;
  surprise_method?: 'fred_dff' | 'fred_cpi_yoy' | 'hardcoded' | 'fred_level_delta';
  warnings: string[];
}

export interface XstocksVolumeResult {
  status: 'ok' | 'blocked' | 'partial';
  pool_address: string | null;
  provider: string;
  quote_token?: string;
  bin_step?: number | null;
  spot_price_usdt0?: number | null;
  tvl_usd?: number | null;
  volume_24h_usd?: number | null;
  time_window: TimeWindow;
  volume_48h_usd: number | null;
  swap_count: number | null;
  source_type: 'sql' | 'mcp_pool_read' | 'subgraph' | 'merchant_moe_rpc' | 'historical_rpc';
  source_endpoint: string | null;
  pre_window_volume_usd?: number | null;
  post_window_volume_usd?: number | null;
  pre_window_price_usd?: number | null;
  post_window_price_usd?: number | null;
  volume_spike_pct?: number | null;
  price_shift_pct?: number | null;
  lb_historical?: {
    pre_block: number | null;
    post_block: number | null;
    pre_active_id: number | null;
    post_active_id: number | null;
    price_source: 'historical_rpc';
    volume_source: 'sql_indexer' | 'deterministic_surprise_proxy';
  } | null;
  conclusion?: string | null;
  pre_window_daily_data?: Array<{ date: number; priceUSD: number | null; volumeUSD: number | null }>;
  post_window_daily_data?: Array<{ date: number; priceUSD: number | null; volumeUSD: number | null }>;
  pool_liquidity: Record<string, unknown> | null;
  pool_opportunities: Record<string, unknown> | null;
  sql_rows: unknown[] | null;
  warnings: string[];
  caveats: string[];
}

export interface InsightXMarketResult {
  status: 'ok' | 'blocked';
  source_endpoint: string | null;
  queried_at_utc: string;
  markets: unknown[] | null;
  raw_data: unknown;
  blocked_reason?: string;
  skipped?: boolean;
  warnings: string[];
}

export interface AaveStablecoinRatesResult {
  status: 'ok' | 'partial';
  queried_at_utc: string;
  markets: Array<{
    asset: string;
    supply_apy: number | null;
    borrow_apy: number | null;
    utilization: number | null;
    tvl_usd: number | null;
  }>;
  warnings: string[];
}

export interface AaveWindowSnapshotsResult {
  status: 'ok' | 'partial' | 'blocked';
  pre: Array<{
    asset: string;
    asset_address: string;
    block_number: number;
    block_timestamp: number;
    utilization_rate: number | null;
    supply_apy: number | null;
    borrow_apy: number | null;
    total_supplied_usd: number | null;
    total_borrowed_usd: number | null;
  }>;
  post: Array<{
    asset: string;
    asset_address: string;
    block_number: number;
    block_timestamp: number;
    utilization_rate: number | null;
    supply_apy: number | null;
    borrow_apy: number | null;
    total_supplied_usd: number | null;
    total_borrowed_usd: number | null;
  }>;
  pre_block: number | null;
  post_block: number | null;
  pre_timestamp_utc: string | null;
  post_timestamp_utc: string | null;
  warnings: string[];
  source: 'historical_rpc';
}

export interface AcquisitionSnapshot {
  objective: string;
  network: MantleNetwork;
  collected_at_utc: string;
  macro_event: MacroEventDetectionResult;
  macro_calendar?: MacroEventDetectionResult[];
  preflight: PreflightResult;
  xstocks: XstocksVolumeResult;
  insightx: InsightXMarketResult;
  aave: AaveStablecoinRatesResult;
  aave_windows?: AaveWindowSnapshotsResult;
  calendar_events?: Array<{
    macro: MacroEventDetectionResult;
    aave_windows: AaveWindowSnapshotsResult;
    event_delta: Record<string, unknown>;
  }>;
  cross_event_correlation?: {
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
  };
}
