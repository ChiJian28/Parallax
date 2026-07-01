import { SDK } from 'agent0-sdk';
import type { ServerResponse } from 'node:http';
import {
  MANTLE_SEPOLIA_CHAIN_ID,
  MANTLE_SEPOLIA_ERC8004_REGISTRIES,
  MANTLE_SEPOLIA_RPC_URL,
} from '../../config/mantle-sepolia.js';
import { fetchOnChainFeedbackRows } from '../../erc8004/on-chain-feedback.js';
import { sendJson } from '../http-utils.js';

function createReadOnlySdk(): SDK {
  return new SDK({
    chainId: MANTLE_SEPOLIA_CHAIN_ID,
    rpcUrl: process.env.RPC_URL ?? MANTLE_SEPOLIA_RPC_URL,
    registryOverrides: {
      [MANTLE_SEPOLIA_CHAIN_ID]: { ...MANTLE_SEPOLIA_ERC8004_REGISTRIES },
    },
  });
}

function shortenAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function shortenTxHash(hash: string): string {
  if (hash.length < 14) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

/** Map on-chain value (1–100) to 1–5 signal bars for HUD display */
function valueToSignalScore(value: number | undefined): number {
  if (value == null || Number.isNaN(value)) return 3;
  if (value <= 5) return Math.max(1, Math.min(5, Math.round(value)));
  return Math.max(1, Math.min(5, Math.round(value / 20)));
}

type FeedEntry = {
  reviewer: string;
  feedbackIndex?: number;
  value?: number;
  tags: string[];
  txHash?: string;
  createdAt: number;
  isRevoked: boolean;
  endpoint?: string;
  text?: string;
};

async function loadFeedEntries(agentId: string): Promise<FeedEntry[]> {
  const sdk = createReadOnlySdk();
  const subgraph = await sdk.searchFeedback({ agentId });
  if (subgraph.length > 0) {
    return subgraph.map((f) => ({
      reviewer: f.reviewer,
      value: f.value,
      tags: f.tags,
      txHash: f.txHash,
      createdAt: Number(f.createdAt),
      isRevoked: Boolean(f.isRevoked),
      endpoint: f.endpoint,
      text: f.text,
    }));
  }

  // Mantle Sepolia (5003) has no Agent0 subgraph — read ReputationRegistry directly.
  const onChain = await fetchOnChainFeedbackRows(agentId);
  return onChain.map((row) => ({
    reviewer: row.reviewer,
    feedbackIndex: row.feedbackIndex,
    value: row.value,
    tags: row.tags,
    txHash: row.txHash,
    createdAt: row.createdAt,
    isRevoked: row.isRevoked,
    endpoint: row.endpoint,
    text: row.text,
  }));
}

export async function handleGetReputation(res: ServerResponse, agentId: string): Promise<void> {
  const sdk = createReadOnlySdk();
  const summary = await sdk.getReputationSummary(agentId, 'macro_correlation', 'xstocks_accuracy');

  sendJson(res, 200, {
    agentId,
    count: summary.count,
    averageValue: summary.averageValue,
    tags: ['macro_correlation', 'xstocks_accuracy'],
  });
}

export async function handleGetFeedbackFeed(res: ServerResponse, agentId: string): Promise<void> {
  const feedbacks = await loadFeedEntries(agentId);

  const items = feedbacks
    .filter((f) => !f.isRevoked)
    .sort((a, b) => Number(a.createdAt) - Number(b.createdAt))
    .reverse()
    .slice(0, 20)
    .map((f) => {
      const signalScore = valueToSignalScore(f.value);
      const primaryTag = f.tags[0] ?? 'macro_correlation';
      const reviewerFull = f.reviewer;
      const feedbackKey =
        f.feedbackIndex != null
          ? `${reviewerFull.toLowerCase()}:${f.feedbackIndex}`
          : undefined;
      return {
        score: signalScore,
        maxScore: 5,
        tag: primaryTag.replace(/^#/, ''),
        comment: f.text?.trim() || `Validated via ${f.endpoint ?? 'Parallax HUD'}`,
        reviewer: shortenAddress(f.reviewer),
        reviewerFull,
        feedbackKey,
        feedbackIndex: f.feedbackIndex,
        txHash: f.txHash ? shortenTxHash(f.txHash) : 'pending',
        fullTxHash: f.txHash ?? undefined,
        createdAt: Number(f.createdAt),
        rawValue: f.value ?? null,
      };
    });

  const sortedForCurve = feedbacks
    .filter((f) => !f.isRevoked && f.value != null)
    .sort((a, b) => Number(a.createdAt) - Number(b.createdAt));

  const curve =
    sortedForCurve.length > 0
      ? sortedForCurve.map((f, i) => ({
          label: i === sortedForCurve.length - 1 ? 'Now' : `#${i + 1}`,
          score: f.value! <= 5 ? f.value! * 20 : f.value!,
        }))
      : [];

  sendJson(res, 200, { agentId, items, curve });
}
