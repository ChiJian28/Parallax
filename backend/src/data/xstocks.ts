import type { MantleMcpClient } from '../mcp/mantle-client.js';
import type { MantleNetwork } from '../mcp/mantle-client.js';
import { SPCXX_MOE_POOL } from './constants.js';
import {
  deterministicVolumeFromSurprise,
  fetchLbWindowPrices,
} from './merchant-moe-historical.js';
import { fetchMerchantMoeSpcxxSnapshot } from './merchant-moe-spcxx.js';
import { SPCXX_POOL_VOLUME_48H_SQL, build48HourWindow } from './queries/spcxx-volume.sql.js';
import type { PreflightResult, TimeWindow, XstocksVolumeResult } from './types.js';

interface SqlResult {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  row_count: number;
  endpoint: string;
  truncated: boolean;
  warnings: string[];
}

function parseVolumeFromSql(rows: Array<Record<string, unknown>>): { volume: number | null; swaps: number | null } {
  if (rows.length === 0) return { volume: null, swaps: null };
  const row = rows[0];
  const volume = row.volume_48h_usd;
  const swaps = row.swap_count;
  return {
    volume: typeof volume === 'number' ? volume : volume != null ? Number(volume) : null,
    swaps: typeof swaps === 'number' ? swaps : swaps != null ? Number(swaps) : null,
  };
}

function safePctChange(current: number | null, baseline: number | null): number | null {
  if (current == null || baseline == null || baseline === 0) return null;
  return ((current - baseline) / baseline) * 100;
}

function scale24hToWindow(volume24h: number | null, hours: number): number | null {
  if (volume24h == null) return null;
  return volume24h * (hours / 24);
}

function buildConclusion(params: {
  spot: number;
  tvl: number | null;
  vol24h: number | null;
  binStep: number;
  volumeSpikePct: number | null;
  priceShiftPct: number | null;
  priceSource: string;
  volumeSource: string;
}): string {
  const parts = [
    `SPCXx/USDT0 on Merchant Moe (bin_step ${params.binStep}): spot ${params.spot.toFixed(2)} USDT0`,
    params.tvl != null ? `TVL $${params.tvl.toFixed(0)}` : 'TVL n/a',
    params.vol24h != null ? `24h volume $${params.vol24h.toFixed(0)}` : '24h volume n/a',
  ];
  if (params.volumeSpikePct != null || params.priceShiftPct != null) {
    parts.push(
      `post-event volume ${params.volumeSpikePct == null ? 'n/a' : `${params.volumeSpikePct.toFixed(2)}%`}`,
      `price ${params.priceShiftPct == null ? 'n/a' : `${params.priceShiftPct.toFixed(2)}%`}`,
    );
  }
  parts.push(`price via ${params.priceSource}`, `volume via ${params.volumeSource}`);
  return `${parts.join(', ')}.`;
}

/**
 * Lightweight historical window read for calendar Pearson series (no live MCP pool discovery).
 */
export async function fetchXstocksHistoricalWindow(options: {
  preUnix: number;
  postUnix: number;
  macroSurprise?: number | null;
  windowHours: number;
}): Promise<XstocksVolumeResult> {
  const lbWindow = await fetchLbWindowPrices(options.preUnix, options.postUnix);
  const warnings = [...lbWindow.warnings];
  const caveats: string[] = [];

  let priceShiftPct: number | null = null;
  let prePrice: number | null = null;
  let postPrice: number | null = null;
  let preVol: number | null = null;
  let postVol: number | null = null;
  let volumeSpikePct: number | null = null;
  let lbHistorical: XstocksVolumeResult['lb_historical'] = null;
  let status: XstocksVolumeResult['status'] = 'partial';

  if (lbWindow.status === 'ok' && lbWindow.price_change_pct != null) {
    priceShiftPct = lbWindow.price_change_pct;
    prePrice = lbWindow.pre_price_usdt0;
    postPrice = lbWindow.post_price_usdt0;
    status = 'ok';
    lbHistorical = {
      pre_block: lbWindow.pre_block,
      post_block: lbWindow.post_block,
      pre_active_id: lbWindow.pre_active_id,
      post_active_id: lbWindow.post_active_id,
      price_source: 'historical_rpc',
      volume_source: 'deterministic_surprise_proxy',
    };
    const vol = deterministicVolumeFromSurprise(options.macroSurprise, options.windowHours);
    preVol = vol.pre_window_volume_usd;
    postVol = vol.post_window_volume_usd;
    volumeSpikePct = ((postVol - preVol) / preVol) * 100;
    caveats.push(
      'Price delta from Merchant Moe DLMM active bin ID at historical block heights (eth_call getActiveId).',
      `Volume spike ratio proxied as 1 + |macro_surprise|×5 (= ${vol.volume_spike_ratio}).`,
    );
  } else {
    caveats.push('LB pool not deployed at event window — no historical SPCXx price delta.');
  }

  return {
    status,
    pool_address: SPCXX_MOE_POOL.address,
    provider: 'merchant_moe',
    quote_token: 'USDT0',
    bin_step: SPCXX_MOE_POOL.bin_step,
    spot_price_usdt0: postPrice,
    time_window: {
      start_utc: new Date(options.preUnix * 1000).toISOString(),
      end_utc: new Date(options.postUnix * 1000).toISOString(),
      hours: options.windowHours,
    },
    volume_48h_usd: null,
    swap_count: null,
    source_type: priceShiftPct != null ? 'historical_rpc' : 'merchant_moe_rpc',
    source_endpoint: `eth_call:getActiveId@${SPCXX_MOE_POOL.address}`,
    pre_window_volume_usd: preVol,
    post_window_volume_usd: postVol,
    pre_window_price_usd: prePrice,
    post_window_price_usd: postPrice,
    volume_spike_pct: volumeSpikePct,
    price_shift_pct: priceShiftPct,
    lb_historical: lbHistorical,
    conclusion: priceShiftPct != null
      ? `SPCXx historical LB price ${priceShiftPct.toFixed(2)}% (blocks ${lbWindow.pre_block}/${lbWindow.post_block}).`
      : 'SPCXx historical LB price unavailable for this event window.',
    pool_liquidity: null,
    pool_opportunities: null,
    sql_rows: null,
    warnings,
    caveats,
  };
}

/**
 * Leg 2 — SPCXx on-chain reaction via Merchant Moe RPC + historical LB activeId reads.
 * Price delta: eth_call getActiveId() at pre/post blocks (100% on-chain).
 * Volume: SQL indexer when configured; else deterministic proxy from macro_surprise.
 */
export async function fetchXstocksVolume(
  mcp: MantleMcpClient,
  preflight: PreflightResult,
  options: {
    network?: MantleNetwork;
    hours?: number;
    sqlEndpoint?: string;
    preWindow?: TimeWindow;
    postWindow?: TimeWindow;
    macroSurprise?: number | null;
  } = {},
): Promise<XstocksVolumeResult> {
  const network = options.network ?? preflight.network;
  const windowHours = options.hours ?? 48;
  const timeWindow: TimeWindow = build48HourWindow(windowHours);
  const sqlEndpoint = options.sqlEndpoint ?? process.env.MANTLE_SQL_INDEXER_ENDPOINT;
  const warnings: string[] = [];
  const caveats: string[] = [];

  const snapshot = await fetchMerchantMoeSpcxxSnapshot(mcp, {
    network,
    spcxxAddress: preflight.addresses.spcxx.address,
  });

  if (!snapshot) {
    return {
      status: 'blocked',
      pool_address: null,
      provider: 'merchant_moe',
      quote_token: 'USDT0',
      time_window: timeWindow,
      volume_48h_usd: null,
      swap_count: null,
      source_type: 'merchant_moe_rpc',
      source_endpoint: null,
      pool_liquidity: null,
      pool_opportunities: null,
      sql_rows: null,
      warnings: ['No SPCXx/USDT0 Merchant Moe LB pool found via mantle_findPools.'],
      caveats: ['SPCXx liquidity is on Merchant Moe USDT0 pair, not Fluxion USDC.'],
    };
  }

  warnings.push(...snapshot.warnings);

  let preWindowVolume: number | null = null;
  let postWindowVolume: number | null = null;
  let preWindowPrice: number | null = null;
  let postWindowPrice: number | null = null;
  let swapCount: number | null = null;
  let sqlRows: unknown[] | null = null;
  let volumeSpikePct: number | null = null;
  let priceShiftPct: number | null = null;
  let sourceType: XstocksVolumeResult['source_type'] = 'merchant_moe_rpc';
  let sourceEndpoint = 'mantle_findPools+getSwapQuote+getLBPairState';
  let priceSource = 'live_rpc_snapshot';
  let volumeSource = 'live_rpc_scaled_24h';
  let lbHistorical: XstocksVolumeResult['lb_historical'] = null;

  const hasEventWindows = Boolean(options.preWindow && options.postWindow);
  const preUnix =
    options.preWindow?.end_unix ?? (options.preWindow ? Math.floor(Date.parse(options.preWindow.end_utc) / 1000) : null);
  const postUnix =
    options.postWindow?.end_unix ??
    (options.postWindow ? Math.floor(Date.parse(options.postWindow.end_utc) / 1000) : null);

  if (hasEventWindows && preUnix != null && postUnix != null) {
    const lbWindow = await fetchLbWindowPrices(preUnix, postUnix);
    warnings.push(...lbWindow.warnings);

    if (lbWindow.status === 'ok' && lbWindow.pre_price_usdt0 != null && lbWindow.post_price_usdt0 != null) {
      preWindowPrice = lbWindow.pre_price_usdt0;
      postWindowPrice = lbWindow.post_price_usdt0;
      priceShiftPct = lbWindow.price_change_pct;
      sourceType = 'historical_rpc';
      sourceEndpoint = `eth_call:getActiveId@${lbWindow.pool_address}`;
      priceSource = `historical_rpc blocks ${lbWindow.pre_block}/${lbWindow.post_block}`;
      lbHistorical = {
        pre_block: lbWindow.pre_block,
        post_block: lbWindow.post_block,
        pre_active_id: lbWindow.pre_active_id,
        post_active_id: lbWindow.post_active_id,
        price_source: 'historical_rpc',
        volume_source: 'deterministic_surprise_proxy',
      };
      caveats.push(
        'Price delta from Merchant Moe DLMM active bin ID at historical block heights (eth_call getActiveId).',
      );
    } else if (lbWindow.status === 'partial') {
      caveats.push(
        'LB pool not deployed at event window — price delta unavailable for pre-listing macro events.',
      );
    }
  }

  if (sqlEndpoint && options.preWindow && options.postWindow) {
    try {
      const [preSql, postSql] = await Promise.all([
        mcp.queryIndexerSql(sqlEndpoint, SPCXX_POOL_VOLUME_48H_SQL, {
          pool_address: snapshot.pool_address,
          window_start_utc: options.preWindow.start_utc,
          window_end_utc: options.preWindow.end_utc,
        }) as Promise<SqlResult>,
        mcp.queryIndexerSql(sqlEndpoint, SPCXX_POOL_VOLUME_48H_SQL, {
          pool_address: snapshot.pool_address,
          window_start_utc: options.postWindow.start_utc,
          window_end_utc: options.postWindow.end_utc,
        }) as Promise<SqlResult>,
      ]);

      const preParsed = parseVolumeFromSql(preSql.rows);
      const postParsed = parseVolumeFromSql(postSql.rows);
      preWindowVolume = preParsed.volume;
      postWindowVolume = postParsed.volume;
      swapCount = postParsed.swaps;
      sqlRows = [preSql.rows, postSql.rows];
      volumeSpikePct = safePctChange(postWindowVolume, preWindowVolume);
      volumeSource = 'sql_indexer';
      if (lbHistorical) lbHistorical.volume_source = 'sql_indexer';
      sourceType = sqlRows ? 'sql' : sourceType;
      warnings.push(...(preSql.warnings ?? []), ...(postSql.warnings ?? []));
    } catch (error) {
      warnings.push(`SQL indexer pre/post query failed: ${error instanceof Error ? error.message : String(error)}`);
      caveats.push('SQL indexer unavailable; using deterministic volume proxy from macro_surprise.');
    }
  } else if (hasEventWindows && priceShiftPct != null) {
    const vol = deterministicVolumeFromSurprise(options.macroSurprise, windowHours);
    preWindowVolume = vol.pre_window_volume_usd;
    postWindowVolume = vol.post_window_volume_usd;
    volumeSpikePct = safePctChange(postWindowVolume, preWindowVolume);
    volumeSource = 'deterministic_surprise_proxy';
    caveats.push(
      `Volume spike ratio proxied as 1 + |macro_surprise|×5 (= ${vol.volume_spike_ratio}); historical swap scan omitted to avoid RPC rate limits.`,
    );
  } else if (hasEventWindows && !sqlEndpoint && priceShiftPct == null) {
    caveats.push(
      'Historical LB price unavailable (pool not deployed at event window). Volume proxy skipped until price delta exists.',
    );
  } else if (!hasEventWindows) {
    preWindowVolume = scale24hToWindow(snapshot.volume_24h_usd, windowHours);
    postWindowVolume = scale24hToWindow(snapshot.volume_24h_usd, windowHours);
    preWindowPrice = snapshot.spot_price_usdt0;
    postWindowPrice = snapshot.spot_price_usdt0;
    caveats.push('No event windows — using live Merchant Moe RPC snapshot only.');
  }

  const conclusion = buildConclusion({
    spot: snapshot.spot_price_usdt0,
    tvl: snapshot.tvl_usd,
    vol24h: snapshot.volume_24h_usd,
    binStep: snapshot.bin_step,
    volumeSpikePct,
    priceShiftPct,
    priceSource,
    volumeSource,
  });

  return {
    status: priceShiftPct != null || snapshot ? 'ok' : 'partial',
    pool_address: snapshot.pool_address,
    provider: 'merchant_moe',
    quote_token: snapshot.quote_token,
    bin_step: snapshot.bin_step,
    spot_price_usdt0: snapshot.spot_price_usdt0,
    tvl_usd: snapshot.tvl_usd,
    volume_24h_usd: snapshot.volume_24h_usd,
    time_window: timeWindow,
    volume_48h_usd: scale24hToWindow(snapshot.volume_24h_usd, windowHours),
    swap_count: swapCount,
    source_type: sourceType,
    source_endpoint: sourceEndpoint,
    pre_window_volume_usd: preWindowVolume,
    post_window_volume_usd: postWindowVolume,
    pre_window_price_usd: preWindowPrice,
    post_window_price_usd: postWindowPrice,
    volume_spike_pct: volumeSpikePct,
    price_shift_pct: priceShiftPct,
    lb_historical: lbHistorical,
    conclusion,
    pool_liquidity: snapshot.lb_state,
    pool_opportunities: snapshot.find_pools as unknown as Record<string, unknown>,
    sql_rows: sqlRows,
    warnings,
    caveats,
  };
}
