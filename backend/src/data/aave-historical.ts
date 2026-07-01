import { createPublicClient, http, type Address } from 'viem';
import { mantle } from 'viem/chains';
import { STABLECOIN_ASSETS } from './constants.js';
import type { MantleNetwork } from '../mcp/mantle-client.js';
import type { PreflightResult } from './types.js';

const AAVE_DATA_PROVIDER = '0x487c5c669D9eee6057C44973207101276cf73b68' as Address;
const AAVE_ORACLE = '0x47a063CfDa980532267970d478EC340C0F80E8df' as Address;

const DATA_PROVIDER_ABI = [
  {
    type: 'function',
    name: 'getReserveData',
    stateMutability: 'view',
    inputs: [{ name: 'asset', type: 'address' }],
    outputs: [
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint40' },
    ],
  },
] as const;

const ORACLE_ABI = [
  {
    type: 'function',
    name: 'getAssetPrice',
    stateMutability: 'view',
    inputs: [{ name: 'asset', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'BASE_CURRENCY_UNIT',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

export interface AaveReserveSnapshot {
  asset: string;
  asset_address: string;
  block_number: number;
  block_timestamp: number;
  utilization_rate: number | null;
  supply_apy: number | null;
  borrow_apy: number | null;
  total_supplied_usd: number | null;
  total_borrowed_usd: number | null;
}

export interface AaveWindowSnapshots {
  status: 'ok' | 'partial' | 'blocked';
  pre: AaveReserveSnapshot[];
  post: AaveReserveSnapshot[];
  pre_block: number | null;
  post_block: number | null;
  pre_timestamp_utc: string | null;
  post_timestamp_utc: string | null;
  warnings: string[];
  source: 'historical_rpc';
}

const RAY = 10n ** 27n;

function rayToPercent(ray: bigint): number {
  return Number((ray * 10000n) / RAY) / 100;
}

function rpcUrl(): string {
  const url = process.env.MANTLE_RPC_URL;
  if (!url) throw new Error('MANTLE_RPC_URL is required for historical Aave reads.');
  return url;
}

function assetAddress(preflight: PreflightResult, symbol: string): Address | null {
  if (symbol === 'USDC') return preflight.addresses.usdc.address as Address;
  if (symbol === 'USDT0') return '0x779Ded0c9e1022225f8E0630b35a9b54bE713736' as Address;
  if (symbol === 'USDe') return '0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34' as Address;
  return null;
}

async function readReserveAtBlock(
  asset: string,
  assetAddr: Address,
  blockNumber: number,
  blockTimestamp: number,
  decimals: number,
): Promise<AaveReserveSnapshot> {
  const client = createPublicClient({ chain: mantle, transport: http(rpcUrl()) });
  const block = { blockNumber: BigInt(blockNumber) } as const;

  const [reserveData, assetPrice, baseUnit] = await Promise.all([
    client.readContract({
      address: AAVE_DATA_PROVIDER,
      abi: DATA_PROVIDER_ABI,
      functionName: 'getReserveData',
      args: [assetAddr],
      ...block,
    }),
    client.readContract({
      address: AAVE_ORACLE,
      abi: ORACLE_ABI,
      functionName: 'getAssetPrice',
      args: [assetAddr],
      ...block,
    }),
    client.readContract({
      address: AAVE_ORACLE,
      abi: ORACLE_ABI,
      functionName: 'BASE_CURRENCY_UNIT',
      ...block,
    }),
  ]);

  const totalAToken = reserveData[2] as bigint;
  const totalStableDebt = reserveData[3] as bigint;
  const totalVariableDebt = reserveData[4] as bigint;
  const liquidityRate = reserveData[5] as bigint;
  const variableBorrowRate = reserveData[6] as bigint;

  const totalBorrowedRaw = totalStableDebt + totalVariableDebt;
  const utilization =
    totalAToken > 0n
      ? Number((totalBorrowedRaw * 10000n) / totalAToken) / 100
      : null;

  const tokenUnit = 10n ** BigInt(decimals);
  const base = baseUnit as bigint;
  const price = assetPrice as bigint;
  const toUsd = (raw: bigint) =>
    base > 0n ? Number((raw * price) / tokenUnit / base) : null;

  return {
    asset,
    asset_address: assetAddr,
    block_number: blockNumber,
    block_timestamp: blockTimestamp,
    utilization_rate: utilization,
    supply_apy: rayToPercent(liquidityRate),
    borrow_apy: rayToPercent(variableBorrowRate),
    total_supplied_usd: toUsd(totalAToken),
    total_borrowed_usd: toUsd(totalBorrowedRaw),
  };
}

const DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT0: 6,
  USDe: 18,
};

/**
 * Read Aave V3 stablecoin reserve state at historical blocks (pre/post event windows).
 */
export async function fetchAaveWindowSnapshots(
  preUnix: number,
  postUnix: number,
  preflight: PreflightResult,
  _network: MantleNetwork = 'mainnet',
): Promise<AaveWindowSnapshots> {
  const warnings: string[] = [];

  try {
    const { resolveBlockAtTimestamp } = await import('./block-resolver.js');
    const [preBlock, postBlock] = await Promise.all([
      resolveBlockAtTimestamp(preUnix),
      resolveBlockAtTimestamp(postUnix),
    ]);

    const assets = STABLECOIN_ASSETS.filter((s) => assetAddress(preflight, s) != null);

    const pre = await Promise.all(
      assets.map(async (symbol) => {
        const addr = assetAddress(preflight, symbol)!;
        try {
          return await readReserveAtBlock(
            symbol,
            addr,
            preBlock.block_number,
            preBlock.block_timestamp,
            DECIMALS[symbol] ?? 18,
          );
        } catch (error) {
          warnings.push(
            `Aave pre-window read failed for ${symbol}: ${error instanceof Error ? error.message : String(error)}`,
          );
          return null;
        }
      }),
    );

    const post = await Promise.all(
      assets.map(async (symbol) => {
        const addr = assetAddress(preflight, symbol)!;
        try {
          return await readReserveAtBlock(
            symbol,
            addr,
            postBlock.block_number,
            postBlock.block_timestamp,
            DECIMALS[symbol] ?? 18,
          );
        } catch (error) {
          warnings.push(
            `Aave post-window read failed for ${symbol}: ${error instanceof Error ? error.message : String(error)}`,
          );
          return null;
        }
      }),
    );

    const preFiltered = pre.filter((r): r is AaveReserveSnapshot => r != null);
    const postFiltered = post.filter((r): r is AaveReserveSnapshot => r != null);

    return {
      status: preFiltered.length > 0 && postFiltered.length > 0 ? 'ok' : 'partial',
      pre: preFiltered,
      post: postFiltered,
      pre_block: preBlock.block_number,
      post_block: postBlock.block_number,
      pre_timestamp_utc: new Date(preBlock.block_timestamp * 1000).toISOString(),
      post_timestamp_utc: new Date(postBlock.block_timestamp * 1000).toISOString(),
      warnings,
      source: 'historical_rpc',
    };
  } catch (error) {
    return {
      status: 'blocked',
      pre: [],
      post: [],
      pre_block: null,
      post_block: null,
      pre_timestamp_utc: null,
      post_timestamp_utc: null,
      warnings: [error instanceof Error ? error.message : String(error)],
      source: 'historical_rpc',
    };
  }
}
