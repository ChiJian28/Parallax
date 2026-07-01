import { computeCorrelationMetrics } from './correlation-calculator.js';
import { extractBaseline } from './baseline-extractor.js';
import { buildEventWindows } from './event-window.js';
import { synthesizeReport } from './llm-synthesizer.js';
import { MOCK_SPACEX_EVENT } from './mock-data.js';
import { measurePostEventReaction } from './reaction-measurer.js';
import { reportStore } from './report-store.js';
import { loadAcquisitionSnapshot } from './snapshot-loader.js';
import { pipelineDataFromSnapshot } from './snapshot-adapter.js';
import type {
  CorrelationEngineOptions,
  CorrelationPipelineResult,
  FinalReport,
  MacroEvent,
} from './types.js';

export type { MacroEvent, FinalReport, CorrelationPipelineResult, CorrelationEngineOptions };

const DEFAULT_WINDOW_HOURS = 48;
const DEFAULT_REPORT_PRICE_MNT = 2;

function resolveUseMockData(options: CorrelationEngineOptions): boolean {
  if (options.useMockData !== undefined) return options.useMockData;
  return process.env.CORRELATION_USE_MOCK !== 'false';
}

/**
 * Module 3 pipeline using Module 2 output (data-snapshot.json) — real macro/xstocks/aave data.
 */
export async function runCorrelationPipelineFromSnapshot(
  options: CorrelationEngineOptions = {},
): Promise<CorrelationPipelineResult> {
  const snapshotPath = options.snapshotPath ?? process.env.DATA_SNAPSHOT_PATH;
  const snapshot = loadAcquisitionSnapshot(snapshotPath);
  const reportPriceMNT = options.reportPriceMNT ?? Number(process.env.REPORT_PRICE_MNT ?? DEFAULT_REPORT_PRICE_MNT);

  const { event, windows, baseline, postEvent, metrics, eventDelta, synthesisContext } =
    pipelineDataFromSnapshot(snapshot);

  const { synthesis, source: llmSource } = await synthesizeReport(
    event,
    metrics,
    options.geminiApiKey,
    synthesisContext,
  );

  const report: FinalReport = {
    eventId: event.eventId,
    eventName: event.eventName,
    timestamp: Date.now(),
    teaser: synthesis.teaser,
    fullContent: synthesis.full_analysis,
    priceMNT: reportPriceMNT,
    computedMetrics: metrics,
    eventDelta,
    crossEventCorrelation: snapshot.cross_event_correlation as import('../data/cross-event-correlation.js').CrossEventCorrelation | undefined,
    windows,
    dataSources: {
      baseline: 'snapshot',
      postEvent: 'snapshot',
      llm: llmSource,
      snapshot: snapshotPath ?? 'data-snapshot.json',
    },
  };

  await reportStore.save(report);

  return {
    event,
    windows,
    baseline,
    postEvent,
    metrics,
    eventDelta,
    synthesis,
    report,
  };
}

/**
 * Module 3 main pipeline: Event Window → Baseline → Post-Event → Metrics → LLM → Report.
 */
export async function runCorrelationPipeline(
  event: MacroEvent = MOCK_SPACEX_EVENT,
  options: CorrelationEngineOptions = {},
): Promise<CorrelationPipelineResult> {
  const windowHours = options.windowHours ?? Number(process.env.VOLUME_WINDOW_HOURS ?? DEFAULT_WINDOW_HOURS);
  const useMockData = resolveUseMockData(options);
  const reportPriceMNT = options.reportPriceMNT ?? Number(process.env.REPORT_PRICE_MNT ?? DEFAULT_REPORT_PRICE_MNT);

  // Step 1 — Event Window Manager
  const windows = buildEventWindows(event, windowHours);

  const dataOptions = {
    useMockData,
    sqlEndpoint: options.sqlEndpoint ?? process.env.MANTLE_SQL_INDEXER_ENDPOINT,
    insightxEndpoint: options.insightxEndpoint ?? process.env.INSIGHTX_SUBGRAPH_ENDPOINT,
    insightxSearch: options.insightxSearch ?? process.env.INSIGHTX_MARKET_SEARCH,
    network: options.network ?? 'mainnet',
  };

  // Step 2 — Baseline Extractor
  const baseline = await extractBaseline(event, windows, dataOptions);

  // Step 3 — Post-event Reaction Measurer
  const postEvent = await measurePostEventReaction(baseline, windows, dataOptions);

  // Step 4 — Correlation Calculator (pure math, no LLM)
  const metrics = computeCorrelationMetrics({
    macroSurprise: event.surpriseMagnitude,
    prePrice: baseline.preTwapUsd,
    postPrice: postEvent.postTwapUsd,
    preAvgVolume: baseline.preAvgDailyVolumeUsd,
    postVolume: postEvent.postVolumeUsd,
    preEventOdds: baseline.preInsightXOdds,
    actualOutcome: postEvent.insightXResolution,
  });

  // Step 5 — LLM Synthesizer
  const { synthesis, source: llmSource } = await synthesizeReport(
    event,
    metrics,
    options.geminiApiKey,
  );

  // Step 6 — Report Builder & persist
  const report: FinalReport = {
    eventId: event.eventId,
    eventName: event.eventName,
    timestamp: Date.now(),
    teaser: synthesis.teaser,
    fullContent: synthesis.full_analysis,
    priceMNT: reportPriceMNT,
    computedMetrics: metrics,
    windows,
    dataSources: {
      baseline: baseline.source,
      postEvent: postEvent.source,
      llm: llmSource,
    },
  };

  await reportStore.save(report);

  return {
    event,
    windows,
    baseline,
    postEvent,
    metrics,
    synthesis,
    report,
  };
}
