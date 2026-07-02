import type { Erc8004Feedback, ReputationCurvePoint } from '@/components/hud/types';

export type MacroVerdict = 'UP' | 'DOWN' | 'HOLD';

export interface MacroSentimentState {
  verdict: MacroVerdict;
  score: string;
  newReview: Erc8004Feedback;
}

export const AGENT_DISPLAY_ID = '0xParallax...8004';

export const CURRENT_REPUTATION_SCORE = 94.5;

/** Historical prediction accuracy — drives the reputation sparkline */
export const REPUTATION_CURVE: ReputationCurvePoint[] = [
  { label: 'Jan', score: 72.1 },
  { label: 'Feb', score: 78.4 },
  { label: 'Mar', score: 83.6 },
  { label: 'Apr', score: 87.2 },
  { label: 'May', score: 90.8 },
  { label: 'Jun', score: 92.3 },
  { label: 'Now', score: 94.5 },
];

export const ERC8004_FEEDBACK_FEED: Erc8004Feedback[] = [
  {
    score: 5,
    maxScore: 5,
    tag: 'macro_correlation',
    comment: 'SPCXx delta matched CPI surprise within 6h window.',
    reviewer: '0x7a3f...8c12',
    txHash: '0x8f2a...e91d',
  },
  {
    score: 5,
    maxScore: 5,
    tag: 'xstocks_accuracy',
    comment: 'Merchant Moe volume spike prediction was spot-on.',
    reviewer: '0x2c91...4f7a',
    txHash: '0x3e71...b02c',
  },
  {
    score: 4,
    maxScore: 5,
    tag: 'macro_correlation',
    comment: 'Fed hold call correct; LP depth metric slightly early.',
    reviewer: '0x9b04...1d88',
    txHash: '0x1c44...9a6f',
  },
];

/** Rotating macro sentiment snapshots — drives the live indicator + ERC-8004 feed */
export const MOCK_MACRO_SENTIMENT_STATES: MacroSentimentState[] = [
  {
    verdict: 'UP',
    score: '94.5%',
    newReview: {
      score: 5,
      maxScore: 5,
      tag: 'macro_correlation',
      comment: 'SPCXx delta matched CPI surprise within 6h window.',
      reviewer: '0x7a3f...8c12',
      txHash: '0x8f2a...e91d',
    },
  },
  {
    verdict: 'DOWN',
    score: '73.4%',
    newReview: {
      score: 4,
      maxScore: 5,
      tag: 'risk_off_signal',
      comment: 'MNT/USDC depth contracted 12% ahead of FOMC — early warning validated.',
      reviewer: '0x4e22...9b01',
      txHash: '0x6d18...f3a2',
    },
  },
  {
    verdict: 'HOLD',
    score: '81.2%',
    newReview: {
      score: 5,
      maxScore: 5,
      tag: 'regime_neutral',
      comment: 'Cross-asset correlation flat; no actionable macro divergence detected.',
      reviewer: '0x1f88...c4de',
      txHash: '0x2b90...7c11',
    },
  },
  {
    verdict: 'UP',
    score: '88.9%',
    newReview: {
      score: 5,
      maxScore: 5,
      tag: 'xstocks_accuracy',
      comment: 'Merchant Moe volume spike prediction was spot-on.',
      reviewer: '0x2c91...4f7a',
      txHash: '0x3e71...b02c',
    },
  },
  {
    verdict: 'DOWN',
    score: '68.1%',
    newReview: {
      score: 3,
      maxScore: 5,
      tag: 'liquidity_stress',
      comment: 'Pearson r decayed post-event; LP rebalance lagged by ~2 blocks.',
      reviewer: '0x9b04...1d88',
      txHash: '0x1c44...9a6f',
    },
  },
];
