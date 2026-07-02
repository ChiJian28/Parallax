import {
  ERC8004_REGISTRIES,
  EXPLORER_URL,
  PARALLAX_AGENT_ID,
  PARALLAX_AGENT_REGISTRATION_TX,
  parseParallaxAgentTokenId,
} from '@/lib/config';

const FULL_TX_RE = /^0x[a-fA-F0-9]{64}$/;

/** Resolve a 66-char tx hash from API full hash or an already-full display value. */
export function resolveFullTxHash(display?: string, full?: string): string | null {
  if (full && FULL_TX_RE.test(full)) return full;
  if (display && FULL_TX_RE.test(display)) return display;
  return null;
}

/** MantleScan tx URL — Parallax ERC-8004 lives on Mantle Sepolia (5003). */
export function explorerTxUrl(display?: string, full?: string): string | null {
  const hash = resolveFullTxHash(display, full);
  return hash ? `${EXPLORER_URL}/tx/${hash}` : null;
}

export function explorerAddressUrl(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}

/** ERC-8004 Identity Registry NFT for agent e.g. 5003:308 → token #308 */
export function explorerAgentNftUrl(agentId: string = PARALLAX_AGENT_ID): string {
  const tokenId = parseParallaxAgentTokenId(agentId);
  return `${EXPLORER_URL}/token/${ERC8004_REGISTRIES.IDENTITY}?a=${tokenId}`;
}

export const PARALLAX_AGENT_EXPLORER_LINKS = {
  registrationTx: explorerTxUrl(
    PARALLAX_AGENT_REGISTRATION_TX,
    PARALLAX_AGENT_REGISTRATION_TX,
  )!,
  agentNft: explorerAgentNftUrl(),
  identityRegistry: explorerAddressUrl(ERC8004_REGISTRIES.IDENTITY),
  reputationRegistry: explorerAddressUrl(ERC8004_REGISTRIES.REPUTATION),
} as const;
