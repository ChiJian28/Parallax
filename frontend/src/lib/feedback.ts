import { createPublicClient, http, type Hash, type WalletClient } from 'viem';
import { mantleSepoliaTestnet } from 'viem/chains';
import { ERC8004_REGISTRIES, PARALLAX_AGENT_ID } from './config';

const MANTLE_SEPOLIA_RPC = 'https://rpc.sepolia.mantle.xyz';

const publicClient = createPublicClient({
  chain: mantleSepoliaTestnet,
  transport: http(MANTLE_SEPOLIA_RPC),
});

const REPUTATION_ABI = [
  {
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'value', type: 'int128' },
      { name: 'valueDecimals', type: 'uint8' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
      { name: 'endpoint', type: 'string' },
      { name: 'feedbackURI', type: 'string' },
      { name: 'feedbackHash', type: 'bytes32' },
    ],
    name: 'giveFeedback',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export interface FeedbackSubmitInput {
  /** On-chain score 1–100 (signal bars × 20) */
  value: number;
  eventId: string;
  tag1?: string;
  tag2?: string;
  /** Consensus note — pinned to IPFS feedback file */
  text: string;
}

function parseAgentTokenId(agentId: string): bigint {
  const [, token] = agentId.split(':');
  if (!token) throw new Error(`Invalid agentId: ${agentId}`);
  return BigInt(token);
}

export interface PrepareFeedbackIpfsResult {
  feedbackURI: string;
  feedbackHash: `0x${string}`;
  gatewayUrl?: string;
}

async function prepareFeedbackIpfsOnServer(
  account: `0x${string}`,
  input: FeedbackSubmitInput,
): Promise<PrepareFeedbackIpfsResult> {
  const tag1 = stripTagHash(input.tag1 ?? 'macro_correlation');
  const tag2 = stripTagHash(input.tag2 ?? 'xstocks_accuracy');
  const endpoint = `/api/report/${input.eventId}`;

  const res = await fetch('/api/feedback/prepare-ipfs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId: PARALLAX_AGENT_ID,
      clientAddress: account,
      value: input.value,
      tag1,
      tag2,
      endpoint,
      text: input.text.trim(),
    }),
  });

  const data = (await res.json()) as PrepareFeedbackIpfsResult & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `IPFS prepare failed (${res.status})`);
  }
  return data;
}

function stripTagHash(tag: string): string {
  return tag.replace(/^#/, '');
}

export async function submitOnChainFeedback(
  walletClient: WalletClient,
  input: FeedbackSubmitInput,
): Promise<Hash> {
  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error('Wallet not connected');

  const tag1 = stripTagHash(input.tag1 ?? 'macro_correlation');
  const tag2 = stripTagHash(input.tag2 ?? 'xstocks_accuracy');

  const { feedbackURI, feedbackHash } = await prepareFeedbackIpfsOnServer(account, input);

  const hash = await walletClient.writeContract({
    address: ERC8004_REGISTRIES.REPUTATION as `0x${string}`,
    abi: REPUTATION_ABI,
    functionName: 'giveFeedback',
    args: [
      parseAgentTokenId(PARALLAX_AGENT_ID),
      BigInt(input.value),
      0,
      tag1,
      tag2,
      `/api/report/${input.eventId}`,
      feedbackURI,
      feedbackHash,
    ],
    account,
    chain: mantleSepoliaTestnet,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === 'reverted') {
    throw new Error(await fetchRevertReason(hash));
  }

  return hash;
}

async function fetchRevertReason(hash: Hash): Promise<string> {
  try {
    const txRes = await fetch(MANTLE_SEPOLIA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionByHash',
        params: [hash],
      }),
    });
    const txJson = (await txRes.json()) as {
      result?: { from: string; to: string; input: string };
    };
    const tx = txJson.result;
    if (!tx) return 'Transaction reverted on Mantle Sepolia';

    const block = await getReceiptBlock(hash);
    const callRes = await fetch(MANTLE_SEPOLIA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ from: tx.from, to: tx.to, data: tx.input }, `0x${(block - 1).toString(16)}`],
      }),
    });
    const callJson = (await callRes.json()) as { error?: { message: string } };
    const match = callJson.error?.message?.match(/execution reverted: (.+)/i);
    return match?.[1] ?? 'Transaction reverted on Mantle Sepolia';
  } catch {
    return 'Transaction reverted on Mantle Sepolia';
  }
}

async function getReceiptBlock(hash: Hash): Promise<number> {
  const res = await fetch(MANTLE_SEPOLIA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getTransactionReceipt',
      params: [hash],
    }),
  });
  const json = (await res.json()) as { result?: { blockNumber: string } };
  return json.result?.blockNumber ? parseInt(json.result.blockNumber, 16) : 0;
}

export async function getTxReceiptStatus(
  hash: string,
): Promise<'success' | 'failed' | 'pending'> {
  const res = await fetch(MANTLE_SEPOLIA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getTransactionReceipt',
      params: [hash],
    }),
  });
  const json = (await res.json()) as {
    result?: { status: string } | null;
  };
  if (!json.result) return 'pending';
  return json.result.status === '0x1' ? 'success' : 'failed';
}

export function signalScoreToOnChainValue(signalScore: number): number {
  return Math.max(20, Math.min(100, signalScore * 20));
}

export function shortenTxHash(hash: string): string {
  if (hash.length < 14) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

export function shortenAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
