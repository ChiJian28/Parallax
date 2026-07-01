import type { MantleMcpClient } from '../mcp/mantle-client.js';
import type { MantleNetwork } from '../mcp/mantle-client.js';
import { STABLECOIN_ASSETS } from './constants.js';
import type { AaveStablecoinRatesResult } from './types.js';

interface LendingMarket {
  asset: string;
  symbol?: string;
  supply_apy?: number | null;
  borrow_apy?: number | null;
  utilization?: number | null;
  tvl_usd?: number | null;
}

interface LendingMarketsResponse {
  markets: LendingMarket[];
  warnings?: string[];
  partial?: boolean;
}

/**
 * Optional: read Aave V3 stablecoin lending rates via mantle_getLendingMarkets.
 */
export async function fetchAaveStablecoinRates(
  mcp: MantleMcpClient,
  network: MantleNetwork = 'mainnet',
): Promise<AaveStablecoinRatesResult> {
  const warnings: string[] = [];

  try {
    const response = (await mcp.getLendingMarkets(network)) as LendingMarketsResponse;
    const markets = (response.markets ?? [])
      .filter((m) => STABLECOIN_ASSETS.includes((m.symbol ?? m.asset) as (typeof STABLECOIN_ASSETS)[number]))
      .map((m) => ({
        asset: m.symbol ?? m.asset,
        supply_apy: m.supply_apy ?? null,
        borrow_apy: m.borrow_apy ?? null,
        utilization: m.utilization ?? null,
        tvl_usd: m.tvl_usd ?? null,
      }));

    if (response.partial) {
      warnings.push('Aave market read returned partial data.');
    }
    warnings.push(...(response.warnings ?? []));

    return {
      status: response.partial ? 'partial' : 'ok',
      queried_at_utc: new Date().toISOString(),
      markets,
      warnings,
    };
  } catch (error) {
    return {
      status: 'partial',
      queried_at_utc: new Date().toISOString(),
      markets: [],
      warnings: [error instanceof Error ? error.message : String(error)],
    };
  }
}
