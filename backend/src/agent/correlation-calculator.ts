import type { EventDelta } from './event-delta.js';

export interface ComputedMetrics {
  macroSurprise: number;
  priceDelta: number;
  volumeSpike: number;
  /** @deprecated InsightX leg replaced by Aave utilization delta */
  insightXAccuracy: number;
  aaveUtilizationDelta: number | null;
  aaveBorrowApyDelta: number | null;
  aaveSupplyDeltaUsd: number | null;
  capitalFlowDirection: EventDelta['capital_flow_direction'];
  liquidityChangePct: number | null;
  pearsonMacroXstocks: number | null;
  pearsonXstocksAave: number | null;
  pearsonMacroAave?: number | null;
}

/**
 * Calibration score derived from Brier score (1 - Brier).
 * Returns 0–1 where 1 = perfect probabilistic calibration.
 */
export function calculateCalibration(preEventOdds: number, actualOutcome: boolean): number {
  const predicted = Math.min(1, Math.max(0, preEventOdds));
  const actual = actualOutcome ? 1 : 0;
  const brier = Math.pow(predicted - actual, 2);
  return Math.round((1 - brier) * 1000) / 1000;
}

export function computeCorrelationMetrics(input: {
  macroSurprise: number;
  prePrice: number;
  postPrice: number;
  preAvgVolume: number;
  postVolume: number;
  preEventOdds: number;
  actualOutcome: boolean;
  eventDelta?: EventDelta;
}): ComputedMetrics {
  const delta = input.eventDelta;

  const priceDeltaPercent =
    delta?.price_change_pct ??
    (input.prePrice > 0 ? ((input.postPrice - input.prePrice) / input.prePrice) * 100 : 0);

  const volumeSpikeRatio =
    delta?.volume_spike_ratio ??
    (input.preAvgVolume > 0 ? input.postVolume / input.preAvgVolume : 0);

  return {
    macroSurprise: input.macroSurprise,
    priceDelta: Math.round(priceDeltaPercent * 100) / 100,
    volumeSpike: Math.round(volumeSpikeRatio * 100) / 100,
    insightXAccuracy: calculateCalibration(input.preEventOdds, input.actualOutcome),
    aaveUtilizationDelta: delta?.aave_avg_utilization_delta ?? null,
    aaveBorrowApyDelta: delta?.aave_avg_borrow_apy_delta ?? null,
    aaveSupplyDeltaUsd: delta?.aave_avg_supply_delta_usd ?? null,
    capitalFlowDirection: delta?.capital_flow_direction ?? 'neutral',
    liquidityChangePct: delta?.liquidity_change_pct ?? null,
    pearsonMacroXstocks: delta?.pearson_macro_xstocks ?? null,
    pearsonXstocksAave: delta?.pearson_xstocks_aave ?? null,
  };
}
