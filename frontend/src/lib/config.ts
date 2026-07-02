export const MANTLE_SEPOLIA_CHAIN_ID = 5003;
export const PARALLAX_AGENT_ID = process.env.NEXT_PUBLIC_PARALLAX_AGENT_ID ?? '5003:308';
export const DEFAULT_EVENT_ID = 'spacex-ipo-q1';
export const DEV_BYPASS = process.env.NEXT_PUBLIC_X402_DEV_BYPASS === 'true';
export const EXPLORER_URL = 'https://sepolia.mantlescan.xyz';

export const ERC8004_REGISTRIES = {
  IDENTITY: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
  REPUTATION: '0x8004B663056A597Dffe9eCcC1965A193B7388713',
} as const;

/** On-chain registerIPFS() tx — backend/registration.json */
export const PARALLAX_AGENT_REGISTRATION_TX =
  '0x41fba102cd28ee9182732c45e87203997c97ef6fa7807df50cc8c18264d8cce5' as const;

export function parseParallaxAgentTokenId(agentId: string = PARALLAX_AGENT_ID): string {
  const [, token] = agentId.split(':');
  return token ?? '308';
}

export const MACRO_EVENTS = [
  { id: 'spacex-ipo-q1', title: 'SpaceX IPO', subtitle: 'SPCXx · historical LB RPC', live: true },
  { id: 'cpi-jun-2026', title: 'CPI Jun 2026', subtitle: 'Post-listing Pearson leg', live: true },
  { id: 'fomc-jan-2026', title: 'FOMC Jan 2026', subtitle: 'Pre-listing · Aave only', live: false },
] as const;
