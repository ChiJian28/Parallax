import type { ComputedMetrics } from './correlation-calculator.js';
import type { EventDelta } from './event-delta.js';

export interface MacroEvent {
  eventId: string;
  eventName: string;
  targetToken: string;
  triggerTimeUtc: number;
  surpriseMagnitude: number;
}

export interface UtcWindow {
  start: number;
  end: number;
  start_utc: string;
  end_utc: string;
}

export interface EventWindows {
  preWindow: UtcWindow;
  postWindow: UtcWindow;
  trigger_utc: string;
}

export interface BaselineData {
  tokenAddress: string;
  tokenSymbol: string;
  preTwapUsd: number;
  preAvgDailyVolumeUsd: number;
  preInsightXOdds: number;
  insightXMarketQuestion: string | null;
  window: UtcWindow;
  source: 'mock' | 'live';
  warnings: string[];
}

export interface PostEventData {
  postTwapUsd: number;
  postVolumeUsd: number;
  preAvgVolumeUsd: number;
  priceDeltaUsd: number;
  insightXResolution: boolean;
  insightXResolvedLabel: string | null;
  window: UtcWindow;
  source: 'mock' | 'live';
  warnings: string[];
}

export interface LlmSynthesis {
  teaser: string;
  full_analysis: string;
}

export interface FinalReport {
  eventId: string;
  eventName: string;
  timestamp: number;
  teaser: string;
  fullContent: string;
  priceMNT: number;
  computedMetrics: ComputedMetrics;
  eventDelta?: EventDelta;
  crossEventCorrelation?: import('../data/cross-event-correlation.js').CrossEventCorrelation;
  windows: EventWindows;
  dataSources: {
    baseline: BaselineData['source'] | 'snapshot';
    postEvent: PostEventData['source'] | 'snapshot';
    llm: 'gemini' | 'mock';
    snapshot?: string;
  };
}

export interface CorrelationEngineOptions {
  useMockData?: boolean;
  snapshotPath?: string;
  windowHours?: number;
  reportPriceMNT?: number;
  sqlEndpoint?: string;
  insightxEndpoint?: string;
  insightxSearch?: string;
  geminiApiKey?: string;
  network?: 'mainnet' | 'sepolia';
}

export interface CorrelationPipelineResult {
  event: MacroEvent;
  windows: EventWindows;
  baseline: BaselineData;
  postEvent: PostEventData;
  metrics: ComputedMetrics;
  eventDelta?: EventDelta;
  synthesis: LlmSynthesis;
  report: FinalReport;
}
