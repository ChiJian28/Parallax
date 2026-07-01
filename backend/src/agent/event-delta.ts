import type { AaveReserveSnapshot, AaveWindowSnapshots } from '../data/aave-historical.js';
import type { MacroEventDetectionResult, XstocksVolumeResult } from '../data/types.js';

export type CapitalFlowDirection = 'risk_on' | 'risk_off' | 'neutral';
export type PriceDirection = 'up' | 'down' | 'flat';
export type MacroEventType = 'CPI' | 'FED_RATE' | 'IPO' | 'OTHER';

export interface AaveReserveDelta {
  utilization_delta: number | null;
  borrow_apy_delta: number | null;
  supply_delta_usd: number | null;
}

export interface EventDelta {
  macro_surprise: number;
  event_type: MacroEventType;

  volume_spike_ratio: number | null;
  price_change_pct: number | null;
  price_direction: PriceDirection;
  liquidity_change_pct: number | null;

  aave_reserves: Record<string, AaveReserveDelta>;
  aave_avg_utilization_delta: number | null;
  aave_avg_borrow_apy_delta: number | null;
  aave_avg_supply_delta_usd: number | null;
  capital_flow_direction: CapitalFlowDirection;

  pearson_macro_xstocks: number | null;
  pearson_xstocks_aave: number | null;

  data_quality: {
    xstocks_source: 'sql_indexer' | 'historical_rpc' | 'live_snapshot';
    aave_source: 'historical_rpc' | 'live_snapshot';
    caveats: string[];
  };
}

function inferEventType(macro: MacroEventDetectionResult): MacroEventType {
  if (macro.event_type) return macro.event_type;
  const series = macro.fred_series_id?.toUpperCase() ?? '';
  const name = macro.event_name.toUpperCase();
  if (series.includes('CPI') || name.includes('CPI')) return 'CPI';
  if (series.includes('DFF') || series.includes('FED') || name.includes('FOMC')) return 'FED_RATE';
  if (name.includes('IPO') || name.includes('SPACEX') || name.includes('SPCX')) return 'IPO';
  return 'OTHER';
}

function findReserve(snapshots: AaveReserveSnapshot[], asset: string): AaveReserveSnapshot | undefined {
  return snapshots.find((s) => s.asset === asset);
}

function computeAaveReserveDelta(
  pre: AaveReserveSnapshot | undefined,
  post: AaveReserveSnapshot | undefined,
): AaveReserveDelta {
  if (!pre || !post) {
    return { utilization_delta: null, borrow_apy_delta: null, supply_delta_usd: null };
  }
  return {
    utilization_delta:
      pre.utilization_rate != null && post.utilization_rate != null
        ? post.utilization_rate - pre.utilization_rate
        : null,
    borrow_apy_delta:
      pre.borrow_apy != null && post.borrow_apy != null ? post.borrow_apy - pre.borrow_apy : null,
    supply_delta_usd:
      pre.total_supplied_usd != null && post.total_supplied_usd != null
        ? post.total_supplied_usd - pre.total_supplied_usd
        : null,
  };
}

function avgNullable(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function deriveCapitalFlowDirection(
  avgUtilDelta: number | null,
  volumeSpikeRatio: number | null,
): CapitalFlowDirection {
  if (avgUtilDelta == null || volumeSpikeRatio == null) return 'neutral';
  const utilDropped = avgUtilDelta < -0.1;
  const utilRose = avgUtilDelta > 0.1;
  const volumeSpiked = volumeSpikeRatio > 1.25;

  if (utilDropped && volumeSpiked) return 'risk_on';
  if (utilRose && volumeSpikeRatio < 0.9) return 'risk_off';
  return 'neutral';
}

function derivePriceDirection(priceChangePct: number | null): PriceDirection {
  if (priceChangePct == null || Math.abs(priceChangePct) < 0.01) return 'flat';
  return priceChangePct > 0 ? 'up' : 'down';
}

/**
 * Pearson r for two-variable sign/magnitude alignment on a single event.
 * With one observation pair, returns null — use multi-event series for true r.
 */
export function pearsonFromPairs(pairs: Array<{ x: number; y: number }>): number | null {
  if (pairs.length < 2) return null;
  const xs = pairs.map((p) => p.x);
  const ys = pairs.map((p) => p.y);
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  if (den === 0) return null;
  return Math.round((num / den) * 1000) / 1000;
}

export function computeEventDelta(input: {
  macro: MacroEventDetectionResult;
  xstocks: XstocksVolumeResult;
  aaveWindows?: AaveWindowSnapshots | null;
}): EventDelta {
  const { macro, xstocks, aaveWindows } = input;
  const caveats: string[] = [...(xstocks.caveats ?? [])];

  const preVol = xstocks.pre_window_volume_usd;
  const postVol = xstocks.post_window_volume_usd;
  const prePrice = xstocks.pre_window_price_usd;
  const postPrice = xstocks.post_window_price_usd;
  const preTvl = xstocks.pool_liquidity ? extractTvlFromLb(xstocks, 'pre') : null;
  const postTvl = xstocks.tvl_usd;

  let xstocksSource: EventDelta['data_quality']['xstocks_source'] = 'live_snapshot';
  if (xstocks.source_type === 'sql') xstocksSource = 'sql_indexer';
  else if (xstocks.source_type === 'historical_rpc' || xstocks.lb_historical?.price_source === 'historical_rpc') {
    xstocksSource = 'historical_rpc';
  }

  const volumeSpikeRatio =
    preVol != null && postVol != null && preVol > 0 ? postVol / preVol : null;
  const priceChangePct =
    xstocks.price_shift_pct ??
    (prePrice != null && postPrice != null && prePrice > 0
      ? ((postPrice - prePrice) / prePrice) * 100
      : null);

  if (volumeSpikeRatio != null && Math.abs(volumeSpikeRatio - 1) < 0.001 && xstocksSource !== 'historical_rpc') {
    caveats.push('xStocks pre/post volume identical — configure MANTLE_SQL_INDEXER_ENDPOINT for historical DEX volume.');
  }

  const liquidityChangePct =
    preTvl != null && postTvl != null && preTvl > 0 ? ((postTvl - preTvl) / preTvl) * 100 : null;

  const aaveReserves: Record<string, AaveReserveDelta> = {};
  let aaveSource: EventDelta['data_quality']['aave_source'] = 'live_snapshot';

  if (aaveWindows?.status === 'ok' || aaveWindows?.status === 'partial') {
    aaveSource = 'historical_rpc';
    const assets = new Set([
      ...aaveWindows.pre.map((r) => r.asset),
      ...aaveWindows.post.map((r) => r.asset),
    ]);
    for (const asset of assets) {
      aaveReserves[asset] = computeAaveReserveDelta(
        findReserve(aaveWindows.pre, asset),
        findReserve(aaveWindows.post, asset),
      );
    }
    caveats.push(...aaveWindows.warnings);
  } else {
    caveats.push('Aave historical pre/post unavailable; utilization delta not computed.');
  }

  const utilDeltas = Object.values(aaveReserves).map((r) => r.utilization_delta);
  const borrowDeltas = Object.values(aaveReserves).map((r) => r.borrow_apy_delta);
  const supplyDeltas = Object.values(aaveReserves).map((r) => r.supply_delta_usd);

  const avgUtilDelta = avgNullable(utilDeltas);
  const macroSurprise = macro.surprise_magnitude ?? 0;

  return {
    macro_surprise: macroSurprise,
    event_type: inferEventType(macro),
    volume_spike_ratio: volumeSpikeRatio,
    price_change_pct: priceChangePct,
    price_direction: derivePriceDirection(priceChangePct),
    liquidity_change_pct: liquidityChangePct,
    aave_reserves: aaveReserves,
    aave_avg_utilization_delta: avgUtilDelta,
    aave_avg_borrow_apy_delta: avgNullable(borrowDeltas),
    aave_avg_supply_delta_usd: avgNullable(supplyDeltas),
    capital_flow_direction: deriveCapitalFlowDirection(avgUtilDelta, volumeSpikeRatio),
    pearson_macro_xstocks: null,
    pearson_xstocks_aave: null,
    data_quality: {
      xstocks_source: xstocksSource,
      aave_source: aaveSource,
      caveats,
    },
  };
}

function extractTvlFromLb(_xstocks: XstocksVolumeResult, _which: 'pre' | 'post'): number | null {
  return _xstocks.tvl_usd ?? null;
}

/**
 * Compute cross-asset Pearson correlations when multiple asset-level pairs exist.
 */
export function enrichPearsonFromReserves(delta: EventDelta, macroSurprise: number): EventDelta {
  const priceChg = delta.price_change_pct;
  const utilPairs = Object.values(delta.aave_reserves)
    .map((r) => r.utilization_delta)
    .filter((v): v is number => v != null);

  if (priceChg != null && utilPairs.length >= 2) {
    delta.pearson_xstocks_aave = pearsonFromPairs(
      utilPairs.map((u) => ({ x: priceChg, y: u })),
    );
  }

  if (priceChg != null && macroSurprise !== 0) {
    delta.pearson_macro_xstocks = null;
  }

  return delta;
}
