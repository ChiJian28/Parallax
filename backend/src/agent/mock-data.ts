import type { BaselineData, MacroEvent, PostEventData, UtcWindow } from './types.js';

/** Default SpaceX IPO macro event for hackathon demo pipeline. */
export const MOCK_SPACEX_EVENT: MacroEvent = {
  eventId: 'spacex-ipo-q1',
  eventName: 'SpaceX Initial Public Offering',
  targetToken: 'SPCXx',
  triggerTimeUtc: Date.parse('2026-03-15T13:30:00.000Z'),
  surpriseMagnitude: 1.5,
};

const SPCXX_ADDRESS = '0x68fa48B1C2FE52b3D776E1953e0E782b5044Ce28';

export function buildMockBaseline(preWindow: UtcWindow): BaselineData {
  return {
    tokenAddress: SPCXX_ADDRESS,
    tokenSymbol: 'SPCXx',
    preTwapUsd: 42.5,
    preAvgDailyVolumeUsd: 1_200_000,
    preInsightXOdds: 0.35,
    insightXMarketQuestion: 'Will SpaceX announce an IPO filing before Q2 2026?',
    window: preWindow,
    source: 'mock',
    warnings: ['Mock baseline — replace with mantle_queryIndexerSql when indexer is available.'],
  };
}

export function buildMockPostEvent(postWindow: UtcWindow, preAvgDailyVolumeUsd: number): PostEventData {
  const preTwap = 42.5;
  const postTwap = 38.75;

  return {
    postTwapUsd: postTwap,
    postVolumeUsd: 4_800_000,
    preAvgVolumeUsd: preAvgDailyVolumeUsd,
    priceDeltaUsd: postTwap - preTwap,
    insightXResolution: true,
    insightXResolvedLabel: 'Yes — IPO filing announced',
    window: postWindow,
    source: 'mock',
    warnings: ['Mock post-event data — replace with live indexer + InsightX subgraph.'],
  };
}
