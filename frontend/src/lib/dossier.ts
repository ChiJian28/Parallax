import type { CrossEventCorrelation, ReportFull } from '@/lib/api';
import type { ResearchDossier, StagedEvent } from '@/components/hud/types';

const BASE_REPORT_PRICE_MNT = 2;

/** Batch pricing: n=1 → 2 MNT; n≥2 → (n×2)−1 MNT */
export function computeDossierPriceMNT(eventCount: number): number {
  const n = Math.max(1, eventCount);
  return n === 1 ? BASE_REPORT_PRICE_MNT : n * BASE_REPORT_PRICE_MNT - 1;
}

export function buildUnifiedTeaser(
  eventCount: number,
  eventReports?: Array<{ eventName: string; report: ReportFull }>,
): string {
  const n = Math.max(1, eventCount);
  if (n === 1 && eventReports?.[0]) {
    return eventReports[0].report.teaser;
  }
  return `Parallax has processed ${n} macro events and synthesized a cross-event correlation matrix across Mantle RWAs, Aave V3 stablecoin flows, and xStocks DLMM reactions.`;
}

function formatPearson(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? 'n/a' : value.toFixed(3);
}

function buildSynthesisMarkdown(
  stagedEvents: StagedEvent[],
  eventReports: ResearchDossier['eventReports'],
  crossEventCorrelation?: CrossEventCorrelation,
): string {
  const n = stagedEvents.length;
  const corr = crossEventCorrelation ?? eventReports[0]?.report.crossEventCorrelation;
  const eventList = stagedEvents.map((e) => `- **${e.title}** (\`${e.id}\`)`).join('\n');

  let body = `## Executive Synthesis\n\n`;
  body += `This dossier aggregates **${n}** macro trigger${n === 1 ? '' : 's'} staged in the Parallax correlation queue. `;
  body += `Each leg was resolved against FRED / registry calendars, historical Merchant Moe LB reads (where listed), and Aave V3 stablecoin windows on Mantle mainnet.\n\n`;
  body += `### Staged Events\n${eventList}\n\n`;

  if (corr && corr.events_analyzed >= 2) {
    body += `### Cross-Event Correlation Matrix\n\n`;
    body += `| Metric | Pearson r |\n|--------|-----------|\n`;
    body += `| Macro surprise ↔ xStocks price Δ | ${formatPearson(corr.pearson_macro_xstocks)} |\n`;
    body += `| xStocks price Δ ↔ Aave utilization Δ | ${formatPearson(corr.pearson_xstocks_aave)} |\n`;
    body += `| Macro surprise ↔ Aave utilization Δ | ${formatPearson(corr.pearson_macro_aave)} |\n\n`;

    if (corr.series?.length) {
      body += `### Per-Event Series\n\n`;
      body += `| Event | Type | Macro surprise | Price Δ % | Aave util Δ (pp) |\n`;
      body += `|-------|------|----------------|-----------|------------------|\n`;
      for (const row of corr.series) {
        body += `| ${row.event_id} | ${row.event_type} | ${row.macro_surprise} | ${row.xstocks_price_change_pct ?? 'n/a'} | ${row.aave_utilization_delta ?? 'n/a'} |\n`;
      }
      body += '\n';
    }
  } else if (n === 1) {
    const m = eventReports[0]?.report.computedMetrics;
    body += `### Single-Event Snapshot\n\n`;
    if (m) {
      body += `- Macro surprise: **${m.macroSurprise}**\n`;
      body += `- xStocks price Δ: **${m.priceDelta > 0 ? '+' : ''}${m.priceDelta}%**\n`;
      body += `- Volume spike: **${m.volumeSpike}×**\n`;
      if (m.aaveUtilizationDelta != null) {
        body += `- Aave utilization Δ: **${m.aaveUtilizationDelta} pp**\n`;
      }
      if (m.capitalFlowDirection) {
        body += `- Capital flow: **${m.capitalFlowDirection}**\n`;
      }
      body += '\n';
    }
    body += `_Cross-event Pearson requires ≥2 events in the staging tray._\n\n`;
  }

  body += `### Capital Flow Thesis\n\n`;
  const riskOn = eventReports.some((r) => r.report.computedMetrics?.capitalFlowDirection === 'risk-on');
  const riskOff = eventReports.some((r) => r.report.computedMetrics?.capitalFlowDirection === 'risk-off');
  if (riskOn && !riskOff) {
    body += `Aggregate positioning skews **risk-on**: stablecoin supply expanded into Mantle CeDeFi venues while macro catalysts propagated into xStocks bins where liquidity was live.\n`;
  } else if (riskOff && !riskOn) {
    body += `Aggregate positioning skews **risk-off**: utilization rose and borrow costs tightened as macro shocks compressed risk appetite on Mantle.\n`;
  } else {
    body += `Mixed capital flow signals across the batch — see individual event tabs for micro-structure (volume spike ratios, local price action, and per-asset Aave deltas).\n`;
  }

  body += `\n---\n\n_Use the **Event** tabs for instrument-level deep dives (DLMM bins, volume proxies, and event-local metrics)._`;

  return body;
}

export function buildResearchDossier(params: {
  stagedEvents: StagedEvent[];
  eventReports: Array<{ eventId: string; eventName: string; report: ReportFull }>;
  crossEventCorrelation?: CrossEventCorrelation;
  combinedSynthesis?: { teaser: string; fullContent: string };
  unlocked?: boolean;
}): ResearchDossier {
  const { stagedEvents, eventReports, crossEventCorrelation, combinedSynthesis, unlocked = false } = params;
  const eventCount = stagedEvents.length;
  const priceMNT = computeDossierPriceMNT(eventCount);
  const synthesisContent =
    combinedSynthesis?.fullContent ??
    buildSynthesisMarkdown(stagedEvents, eventReports, crossEventCorrelation);
  const synthesisTeaser =
    combinedSynthesis?.teaser ?? buildUnifiedTeaser(eventCount, eventReports);

  const synthesis: ReportFull = {
    eventId: 'executive-synthesis',
    eventName: 'Executive Synthesis',
    teaser: synthesisTeaser,
    priceMNT,
    fullContent: eventCount > 1 ? synthesisContent : '',
    crossEventCorrelation,
    computedMetrics: eventReports[0]?.report.computedMetrics
      ? {
          ...eventReports[0].report.computedMetrics,
          pearsonMacroXstocks: crossEventCorrelation?.pearson_macro_xstocks ?? eventReports[0].report.computedMetrics.pearsonMacroXstocks,
          pearsonXstocksAave: crossEventCorrelation?.pearson_xstocks_aave ?? eventReports[0].report.computedMetrics.pearsonXstocksAave,
          pearsonMacroAave: crossEventCorrelation?.pearson_macro_aave ?? eventReports[0].report.computedMetrics.pearsonMacroAave,
        }
      : undefined,
  };

  return {
    batchId: stagedEvents.map((e) => e.id).join('+'),
    eventCount,
    priceMNT,
    unifiedTeaser: buildUnifiedTeaser(eventCount, eventReports),
    stagedEvents,
    synthesis,
    eventReports: eventReports.map((r) => ({
      ...r,
      report: {
        ...r.report,
        fullContent: unlocked ? r.report.fullContent : '',
      },
    })),
    crossEventCorrelation,
    unlocked,
  };
}

/** Preview markdown shown blurred behind the paywall before unlock. */
export function buildDossierPaywallPreview(dossier: ResearchDossier): string {
  if (dossier.eventCount === 1) {
    const event = dossier.eventReports[0];
    if (!event) return dossier.unifiedTeaser;
    return [event.report.teaser, '', `## ${event.eventName}`, '', event.report.teaser].join('\n');
  }

  const lines = [
    dossier.unifiedTeaser,
    '',
    '## Executive Synthesis (locked)',
    '',
    `Events in batch: ${dossier.eventCount}`,
    ...dossier.eventReports.map((e) => `- ${e.eventName}: institutional correlation narrative`),
  ];
  if (dossier.crossEventCorrelation && dossier.eventCount >= 2) {
    lines.push(
      '',
      `Pearson r(macro,xStocks) = ${formatPearson(dossier.crossEventCorrelation.pearson_macro_xstocks)}`,
    );
  }
  return lines.join('\n');
}

export function mockCrossEventCorrelation(eventIds: string[]): CrossEventCorrelation | undefined {
  if (eventIds.length < 2) return undefined;
  return {
    events_analyzed: eventIds.length,
    pearson_macro_xstocks: -0.317,
    pearson_xstocks_aave: 0.412,
    pearson_macro_aave: -0.281,
    series: eventIds.map((event_id) => ({
      event_id,
      event_type: event_id.includes('fomc') ? 'FED_RATE' : event_id.includes('cpi') ? 'CPI' : 'IPO',
      macro_surprise: event_id.includes('crcl') ? 0.05 : event_id.includes('spacex') ? 0.12 : 0,
      xstocks_price_change_pct: event_id.includes('spacex') || event_id.includes('cpi-jun') ? 8.29 : null,
      aave_utilization_delta: -7.51,
    })),
  };
}

export function unlockDossier(
  dossier: ResearchDossier,
  fullReports: ResearchDossier['eventReports'],
): ResearchDossier {
  return buildResearchDossier({
    stagedEvents: dossier.stagedEvents,
    eventReports: fullReports,
    crossEventCorrelation: dossier.crossEventCorrelation,
    combinedSynthesis:
      dossier.eventCount > 1 && dossier.synthesis.fullContent
        ? { teaser: dossier.synthesis.teaser, fullContent: dossier.synthesis.fullContent }
        : undefined,
    unlocked: true,
  });
}
