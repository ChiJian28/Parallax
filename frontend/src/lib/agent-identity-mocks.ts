export interface ReputationDataPoint {
  label: string;
  accuracy: number;
}

export interface OnChainFeedbackRow {
  id: string;
  reviewer: string;
  score: number;
  maxScore: number;
  tag: string;
  comment: string;
  timestamp: string;
  txHash: string;
}

export const REPUTATION_CURVE_DATA: ReputationDataPoint[] = [
  { label: 'W1', accuracy: 70.0 },
  { label: 'W2', accuracy: 74.2 },
  { label: 'W3', accuracy: 78.5 },
  { label: 'W4', accuracy: 81.1 },
  { label: 'W5', accuracy: 84.8 },
  { label: 'W6', accuracy: 87.3 },
  { label: 'W7', accuracy: 89.6 },
  { label: 'W8', accuracy: 91.2 },
  { label: 'W9', accuracy: 92.8 },
  { label: 'W10', accuracy: 94.5 },
];

export const ON_CHAIN_FEEDBACK: OnChainFeedbackRow[] = [
  {
    id: 'fb-001',
    reviewer: '0x7a3f…c91e',
    score: 5,
    maxScore: 5,
    tag: '#macro_correlation',
    comment: 'SPCXx delta matched CPI surprise within 6h window.',
    timestamp: '2026-06-20 14:32 UTC',
    txHash: '0x8f2a…4b1c',
  },
  {
    id: 'fb-002',
    reviewer: '0x2c91…8d44',
    score: 5,
    maxScore: 5,
    tag: '#xstocks_accuracy',
    comment: 'Merchant Moe volume spike prediction was spot-on.',
    timestamp: '2026-06-18 09:17 UTC',
    txHash: '0x3e71…9f02',
  },
  {
    id: 'fb-003',
    reviewer: '0x9b04…1a77',
    score: 4,
    maxScore: 5,
    tag: '#macro_correlation',
    comment: 'Fed hold call correct; LP depth metric slightly early.',
    timestamp: '2026-06-15 21:05 UTC',
    txHash: '0x1c44…7e88',
  },
  {
    id: 'fb-004',
    reviewer: '0x4f18…6c32',
    score: 5,
    maxScore: 5,
    tag: '#aave_rotation',
    comment: 'Stablecoin APY compression signal validated post-CPI.',
    timestamp: '2026-06-12 16:48 UTC',
    txHash: '0x6d90…2a15',
  },
  {
    id: 'fb-005',
    reviewer: '0x1e55…f903',
    score: 5,
    maxScore: 5,
    tag: '#macro_correlation',
    comment: 'Pre-event baseline methodology is institutional-grade.',
    timestamp: '2026-06-10 11:22 UTC',
    txHash: '0x9a33…5d67',
  },
];

export const OASF_DOMAINS = [
  'finance_and_business/investment_services',
  'data_analysis',
] as const;

/** Passport-style display ID derived from chain agent id e.g. 5003:308 */
export function formatAgentPassportId(agentId: string): string {
  const [chainId, tokenId] = agentId.split(':');
  const padded = (tokenId ?? '0').padStart(3, '0');
  return `${chainId}:8004:0x${padded}…Mantle`;
}
