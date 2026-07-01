import { createPublicClient, http } from 'viem';
import { mantle } from 'viem/chains';

function rpcUrl(): string {
  const url = process.env.MANTLE_RPC_URL;
  if (!url) throw new Error('MANTLE_RPC_URL is required for historical block resolution.');
  return url;
}

function publicClient() {
  return createPublicClient({
    chain: mantle,
    transport: http(rpcUrl()),
  });
}

/**
 * Map a unix timestamp (seconds) to the earliest Mantle block at or after that time.
 */
export async function resolveBlockAtTimestamp(unixSeconds: number): Promise<{
  block_number: number;
  block_timestamp: number;
}> {
  const client = publicClient();
  const latest = await client.getBlock({ blockTag: 'latest' });
  let lo = 0n;
  let hi = latest.number;

  const target = BigInt(unixSeconds);

  while (lo < hi) {
    const mid = lo + (hi - lo) / 2n;
    const block = await client.getBlock({ blockNumber: mid });
    if (block.timestamp < target) {
      lo = mid + 1n;
    } else {
      hi = mid;
    }
  }

  const resolved = await client.getBlock({ blockNumber: lo });
  return {
    block_number: Number(resolved.number),
    block_timestamp: Number(resolved.timestamp),
  };
}
