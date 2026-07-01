import type { MantleMcpClient } from '../mcp/mantle-client.js';
import type { MantleNetwork } from '../mcp/mantle-client.js';
import { SPCXX_TOKEN, USDT0_TOKEN } from './constants.js';

interface FindPoolsResult {
  pools: Array<{
    provider: string;
    pool_address: string;
    bin_step?: number;
    tvl_usd?: number | null;
    volume_24h_usd?: number | null;
    fee_apr_pct?: number | null;
    has_liquidity?: boolean;
  }>;
  recommended_pool: {
    pool_address: string;
    provider: string;
    bin_step?: number;
    tvl_usd?: number | null;
    volume_24h_usd?: number | null;
  } | null;
  total_found: number;
}

interface SwapQuoteResult {
  estimated_out_decimal: string | number;
  token_in: { address: string; symbol: string; decimals: number };
  token_out: { address: string; symbol: string; decimals: number };
  resolved_pool_params?: { bin_step?: number } | null;
  route?: string;
}

export interface MerchantMoeSpcxxSnapshot {
  pool_address: string;
  provider: 'merchant_moe';
  quote_token: string;
  quote_token_address: string;
  bin_step: number;
  spot_price_usdt0: number;
  tvl_usd: number | null;
  volume_24h_usd: number | null;
  fee_apr_pct: number | null;
  lb_state: Record<string, unknown> | null;
  find_pools: FindPoolsResult;
  swap_quote: SwapQuoteResult;
  warnings: string[];
}

function parseDecimal(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Discover SPCXx/USDT0 on Merchant Moe LB and read spot price + liquidity via RPC tools.
 */
export async function fetchMerchantMoeSpcxxSnapshot(
  mcp: MantleMcpClient,
  options: {
    network?: MantleNetwork;
    spcxxAddress?: string;
    usdt0Address?: string;
  } = {},
): Promise<MerchantMoeSpcxxSnapshot | null> {
  const network = options.network ?? 'mainnet';
  const spcxxAddress = options.spcxxAddress ?? SPCXX_TOKEN.address;
  const usdt0Address = options.usdt0Address ?? USDT0_TOKEN.address;
  const warnings: string[] = [];

  const findPools = (await mcp.findPools(spcxxAddress, usdt0Address, network)) as FindPoolsResult;
  const pool =
    findPools.recommended_pool ??
    findPools.pools.find((p) => p.provider === 'merchant_moe' && p.has_liquidity !== false) ??
    findPools.pools[0];

  if (!pool?.pool_address) {
    return null;
  }

  const binStep = pool.bin_step;
  if (binStep == null) {
    warnings.push('Pool found but bin_step missing from findPools; cannot query LB state.');
    return null;
  }

  const swapQuote = (await mcp.getSwapQuote({
    tokenIn: spcxxAddress,
    tokenOut: usdt0Address,
    amountIn: '1',
    provider: 'merchant_moe',
    network,
  })) as SwapQuoteResult;

  const spotPrice = parseDecimal(swapQuote.estimated_out_decimal);
  if (spotPrice == null) {
    warnings.push('Swap quote returned no estimated_out_decimal.');
    return null;
  }

  let lbState: Record<string, unknown> | null = null;
  try {
    lbState = (await mcp.getLBPairState(spcxxAddress, usdt0Address, binStep, network)) as Record<
      string,
      unknown
    >;
  } catch (error) {
    warnings.push(
      `LB state read failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return {
    pool_address: pool.pool_address,
    provider: 'merchant_moe',
    quote_token: 'USDT0',
    quote_token_address: usdt0Address,
    bin_step: binStep,
    spot_price_usdt0: spotPrice,
    tvl_usd: pool.tvl_usd ?? null,
    volume_24h_usd: pool.volume_24h_usd ?? null,
    fee_apr_pct: pool.fee_apr_pct ?? null,
    lb_state: lbState,
    find_pools: findPools,
    swap_quote: swapQuote,
    warnings,
  };
}
