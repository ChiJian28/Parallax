import { IPFSClient } from 'agent0-sdk';
import { keccak256, toBytes } from 'viem';
import {
  MANTLE_SEPOLIA_CHAIN_ID,
  MANTLE_SEPOLIA_ERC8004_REGISTRIES,
} from '../config/mantle-sepolia.js';

function requirePinataJwt(): string {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error('PINATA_JWT is required for IPFS feedback files');
  return jwt;
}

let cachedIpfs: IPFSClient | null = null;

function ipfsClient(): IPFSClient {
  if (!cachedIpfs) {
    cachedIpfs = new IPFSClient({
      pinataEnabled: true,
      pinataJwt: requirePinataJwt(),
    });
  }
  return cachedIpfs;
}

export interface PrepareFeedbackIpfsInput {
  agentId: string;
  clientAddress: string;
  value: number;
  tag1: string;
  tag2: string;
  endpoint: string;
  text: string;
}

export interface PrepareFeedbackIpfsResult {
  feedbackURI: string;
  feedbackHash: `0x${string}`;
  gatewayUrl: string;
}

function parseTokenId(agentId: string): number {
  const [, token] = agentId.split(':');
  const n = Number(token);
  if (!Number.isFinite(n)) throw new Error(`Invalid agentId: ${agentId}`);
  return n;
}

function encodeOnChainValue(value: number): { value: bigint; valueDecimals: number } {
  if (!Number.isFinite(value)) throw new Error('value must be finite');
  return { value: BigInt(Math.round(value)), valueDecimals: 0 };
}

/** Build ERC-8004 feedback file, pin to IPFS, return URI + keccak hash for giveFeedback. */
export async function prepareFeedbackIpfs(
  input: PrepareFeedbackIpfsInput,
): Promise<PrepareFeedbackIpfsResult> {
  const tokenId = parseTokenId(input.agentId);
  const encoded = encodeOnChainValue(input.value);
  const chainId = MANTLE_SEPOLIA_CHAIN_ID;
  const identityRegistry = MANTLE_SEPOLIA_ERC8004_REGISTRIES.IDENTITY;

  const fileForStorage: Record<string, unknown> = {
    agentRegistry: `eip155:${chainId}:${identityRegistry}`,
    agentId: tokenId,
    clientAddress: `eip155:${chainId}:${input.clientAddress}`,
    createdAt: new Date().toISOString(),
    value: Number(encoded.value),
    valueDecimals: encoded.valueDecimals,
    tag1: input.tag1,
    tag2: input.tag2,
    endpoint: input.endpoint,
    text: input.text,
  };

  const cid = await ipfsClient().addJson(fileForStorage, 'feedback.json');
  const feedbackURI = `ipfs://${cid}`;
  const sortedJson = JSON.stringify(fileForStorage, Object.keys(fileForStorage).sort());
  const feedbackHash = keccak256(toBytes(sortedJson));

  return {
    feedbackURI,
    feedbackHash,
    gatewayUrl: `https://gateway.pinata.cloud/ipfs/${cid}`,
  };
}

export async function fetchFeedbackTextFromUri(
  feedbackURI: string | undefined,
): Promise<string | undefined> {
  if (!feedbackURI?.startsWith('ipfs://')) return undefined;
  const cid = feedbackURI.slice('ipfs://'.length);
  if (!cid) return undefined;
  try {
    const data = (await ipfsClient().getJson(cid)) as { text?: unknown };
    return typeof data.text === 'string' && data.text.trim() ? data.text.trim() : undefined;
  } catch {
    return undefined;
  }
}
