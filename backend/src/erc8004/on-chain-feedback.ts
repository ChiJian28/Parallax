import { createPublicClient, http, parseAbiItem, type Address } from 'viem';
import { mantleSepoliaTestnet } from 'viem/chains';
import {
  MANTLE_SEPOLIA_ERC8004_REGISTRIES,
  MANTLE_SEPOLIA_RPC_URL,
} from '../config/mantle-sepolia.js';
import { fetchFeedbackTextFromUri } from './ipfs-feedback.js';

const REPUTATION_REGISTRY_ABI = [
  {
    name: 'getClients',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    name: 'readAllFeedback',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddresses', type: 'address[]' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
      { name: 'includeRevoked', type: 'bool' },
    ],
    outputs: [
      { name: 'clients', type: 'address[]' },
      { name: 'feedbackIndexes', type: 'uint64[]' },
      { name: 'values', type: 'int128[]' },
      { name: 'valueDecimals', type: 'uint8[]' },
      { name: 'tag1s', type: 'string[]' },
      { name: 'tag2s', type: 'string[]' },
      { name: 'revokedStatuses', type: 'bool[]' },
    ],
  },
] as const;

const NEW_FEEDBACK_EVENT = parseAbiItem(
  'event NewFeedback(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex, int128 value, uint8 valueDecimals, string indexed indexedTag1, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)',
);

export interface OnChainFeedbackRow {
  reviewer: string;
  feedbackIndex: number;
  value: number;
  tags: string[];
  txHash?: string;
  createdAt: number;
  endpoint?: string;
  feedbackURI?: string;
  text?: string;
  isRevoked: boolean;
}

function parseTokenId(agentId: string): bigint {
  const [, token] = agentId.split(':');
  const n = Number(token);
  if (!Number.isFinite(n)) throw new Error(`Invalid agentId: ${agentId}`);
  return BigInt(n);
}

function decodeValue(raw: bigint, decimals: number): number {
  if (decimals === 0) return Number(raw);
  return Number(raw) / 10 ** decimals;
}

let cachedClient: ReturnType<typeof createPublicClient> | null = null;

function publicClient() {
  if (!cachedClient) {
    cachedClient = createPublicClient({
      chain: mantleSepoliaTestnet,
      transport: http(process.env.RPC_URL ?? MANTLE_SEPOLIA_RPC_URL),
    });
  }
  return cachedClient;
}

/** Mantle Sepolia has no Agent0 subgraph — read feedback directly from ReputationRegistry. */
export async function fetchOnChainFeedbackRows(agentId: string): Promise<OnChainFeedbackRow[]> {
  const tokenId = parseTokenId(agentId);
  const registry = MANTLE_SEPOLIA_ERC8004_REGISTRIES.REPUTATION as Address;
  const client = publicClient();

  const reviewers = await client.readContract({
    address: registry,
    abi: REPUTATION_REGISTRY_ABI,
    functionName: 'getClients',
    args: [tokenId],
  });

  if (!reviewers.length) return [];

  const [clients, indexes, values, decimals, tag1s, tag2s, revoked] =
    await client.readContract({
      address: registry,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: 'readAllFeedback',
      args: [tokenId, reviewers, '', '', true],
    });

  const rows: OnChainFeedbackRow[] = [];

  for (let i = 0; i < clients.length; i++) {
    const reviewer = clients[i] as Address;
    const feedbackIndex = Number(indexes[i]);
    const tag1 = tag1s[i] ?? '';
    const tag2 = tag2s[i] ?? '';
    const tags = [tag1, tag2].filter(Boolean);

    let txHash: string | undefined;
    let createdAt = Math.floor(Date.now() / 1000);
    let endpoint: string | undefined;
    let feedbackURI: string | undefined;

    try {
      const latest = await client.getBlockNumber();
      const fromBlock = latest > 10_000n ? latest - 10_000n : 0n;
      const logs = await client.getLogs({
        address: registry,
        event: NEW_FEEDBACK_EVENT,
        args: {
          agentId: tokenId,
          clientAddress: reviewer,
        },
        fromBlock,
        toBlock: 'latest',
      });

      const match = logs.find((log) => {
        const idx = log.args.feedbackIndex;
        return idx !== undefined && Number(idx) === feedbackIndex;
      });

      if (match?.transactionHash) {
        txHash = match.transactionHash;
        const ep = match.args.endpoint;
        if (typeof ep === 'string' && ep.length > 0) endpoint = ep;
        const uri = match.args.feedbackURI;
        if (typeof uri === 'string' && uri.startsWith('ipfs://')) feedbackURI = uri;
        const block = await client.getBlock({ blockNumber: match.blockNumber });
        createdAt = Number(block.timestamp);
      }
    } catch {
      // Non-fatal — feed still works without tx hash
    }

    rows.push({
      reviewer,
      feedbackIndex,
      value: decodeValue(values[i]!, Number(decimals[i] ?? 0)),
      tags,
      txHash,
      createdAt,
      endpoint,
      feedbackURI,
      isRevoked: Boolean(revoked[i]),
    });
  }

  await Promise.all(
    rows.map(async (row) => {
      if (row.feedbackURI) {
        row.text = await fetchFeedbackTextFromUri(row.feedbackURI);
      }
    }),
  );

  return rows
    .filter((r) => !r.isRevoked)
    .sort((a, b) => a.createdAt - b.createdAt);
}
