import { createPublicClient, http, type Address } from 'viem';
import { mantle } from 'viem/chains';
import { resolveBlockAtTimestamp } from './block-resolver.js';
import { SPCXX_MOE_POOL } from './constants.js';

const LB_PAIR_ABI = [
  {
    type: 'function',
    name: 'getActiveId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint24' }],
  },
  {
    type: 'function',
    name: 'getBinStep',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint16' }],
  },
  {
    type: 'function',
    name: 'getTokenX',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const;

/** Trader Joe LB reference bin id (2^23). */
const REAL_ID_SHIFT = 2 ** 23;

const TOKEN_DECIMALS = {
  spcxx: 18,
  usdt0: 6,
} as const;

/** Verified on-chain: SPCXx is tokenX in the SPCXx/USDT0 LB pair. */
const SPCXX_IS_TOKEN_X = true;

let cachedClient: ReturnType<typeof createPublicClient> | null = null;

function publicClient() {
  if (!cachedClient) {
    cachedClient = createPublicClient({ chain: mantle, transport: http(rpcUrl()) });
  }
  return cachedClient;
}

async function withRpcRetry<T>(fn: () => Promise<T>, retries = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('429') && !message.includes('Too Many Requests')) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
    }
  }
  throw lastError;
}

export interface LbHistoricalWindowResult {
  status: 'ok' | 'partial' | 'blocked';
  pool_address: string;
  bin_step: number;
  pre_block: number | null;
  post_block: number | null;
  pre_active_id: number | null;
  post_active_id: number | null;
  pre_price_usdt0: number | null;
  post_price_usdt0: number | null;
  price_change_pct: number | null;
  warnings: string[];
  source: 'historical_rpc';
}

function rpcUrl(): string {
  const url = process.env.MANTLE_RPC_URL;
  if (!url) throw new Error('MANTLE_RPC_URL is required for historical Merchant Moe LB reads.');
  return url;
}

/**
 * Convert LB active bin id → human-readable USDT0 per 1 SPCXx (decimal-adjusted).
 */
export function spotUsdt0FromActiveId(
  activeId: number,
  binStep: number,
  spcxxIsTokenX: boolean,
  decimalsX = TOKEN_DECIMALS.spcxx,
  decimalsY = TOKEN_DECIMALS.usdt0,
): number {
  const yPerXRaw = (1 + binStep / 10_000) ** (activeId - REAL_ID_SHIFT);
  const adjusted = yPerXRaw * 10 ** (decimalsX - decimalsY);
  return spcxxIsTokenX ? adjusted : 1 / adjusted;
}

function pctChange(current: number, baseline: number): number {
  return ((current - baseline) / baseline) * 100;
}

async function poolHasCode(blockNumber: number): Promise<boolean> {
  const code = await withRpcRetry(() =>
    publicClient().getCode({
      address: SPCXX_MOE_POOL.address as Address,
      blockNumber: BigInt(blockNumber),
    }),
  );
  return Boolean(code && code !== '0x');
}

async function readActiveIdAtBlock(blockNumber: number): Promise<number> {
  const activeId = await withRpcRetry(() =>
    publicClient().readContract({
      address: SPCXX_MOE_POOL.address as Address,
      abi: LB_PAIR_ABI,
      functionName: 'getActiveId',
      blockNumber: BigInt(blockNumber),
    }),
  );
  return Number(activeId);
}

/**
 * Read SPCXx/USDT0 Merchant Moe LB active bin at pre/post event blocks.
 * Price delta is 100% on-chain; returns partial when pool not yet deployed.
 */
export async function fetchLbWindowPrices(
  preUnix: number,
  postUnix: number,
): Promise<LbHistoricalWindowResult> {
  const warnings: string[] = [];
  const poolAddress = SPCXX_MOE_POOL.address;
  const binStep = SPCXX_MOE_POOL.bin_step;

  try {
    const [preBlock, postBlock] = await Promise.all([
      resolveBlockAtTimestamp(preUnix),
      resolveBlockAtTimestamp(postUnix),
    ]);
    const spcxxIsTokenX = SPCXX_IS_TOKEN_X;

    const [preDeployed, postDeployed] = await Promise.all([
      poolHasCode(preBlock.block_number),
      poolHasCode(postBlock.block_number),
    ]);

    if (!preDeployed || !postDeployed) {
      const missing = [
        !preDeployed ? `pre-window block ${preBlock.block_number}` : null,
        !postDeployed ? `post-window block ${postBlock.block_number}` : null,
      ].filter(Boolean);
      warnings.push(
        `SPCXx/USDT0 LB pool not deployed at ${missing.join(' and ')} (${new Date(preBlock.block_timestamp * 1000).toISOString()} / ${new Date(postBlock.block_timestamp * 1000).toISOString()}).`,
      );
      return {
        status: 'partial',
        pool_address: poolAddress,
        bin_step: binStep,
        pre_block: preBlock.block_number,
        post_block: postBlock.block_number,
        pre_active_id: null,
        post_active_id: null,
        pre_price_usdt0: null,
        post_price_usdt0: null,
        price_change_pct: null,
        warnings,
        source: 'historical_rpc',
      };
    }

    const [preActiveId, postActiveId] = await Promise.all([
      readActiveIdAtBlock(preBlock.block_number),
      readActiveIdAtBlock(postBlock.block_number),
    ]);

    const prePrice = spotUsdt0FromActiveId(preActiveId, binStep, spcxxIsTokenX);
    const postPrice = spotUsdt0FromActiveId(postActiveId, binStep, spcxxIsTokenX);
    const priceChangePct =
      prePrice > 0 ? Math.round(pctChange(postPrice, prePrice) * 10000) / 10000 : null;

    return {
      status: 'ok',
      pool_address: poolAddress,
      bin_step: binStep,
      pre_block: preBlock.block_number,
      post_block: postBlock.block_number,
      pre_active_id: preActiveId,
      post_active_id: postActiveId,
      pre_price_usdt0: Math.round(prePrice * 10000) / 10000,
      post_price_usdt0: Math.round(postPrice * 10000) / 10000,
      price_change_pct: priceChangePct,
      warnings,
      source: 'historical_rpc',
    };
  } catch (error) {
    return {
      status: 'blocked',
      pool_address: poolAddress,
      bin_step: binStep,
      pre_block: null,
      post_block: null,
      pre_active_id: null,
      post_active_id: null,
      pre_price_usdt0: null,
      post_price_usdt0: null,
      price_change_pct: null,
      warnings: [error instanceof Error ? error.message : String(error)],
      source: 'historical_rpc',
    };
  }
}

/**
 * Deterministic volume proxy when historical DEX volume is unavailable via RPC.
 * volume_spike_ratio = 1 + |macro_surprise| × 5
 */
export function deterministicVolumeFromSurprise(
  macroSurprise: number | null | undefined,
  windowHours: number,
): {
  pre_window_volume_usd: number;
  post_window_volume_usd: number;
  volume_spike_ratio: number;
} {
  const baseline = 100_000 * (windowHours / 48);
  const ratio = 1 + Math.abs(macroSurprise ?? 0) * 5;
  return {
    pre_window_volume_usd: baseline,
    post_window_volume_usd: baseline * ratio,
    volume_spike_ratio: Math.round(ratio * 10000) / 10000,
  };
}

export { USDT0_TOKEN } from './constants.js';
