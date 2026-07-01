import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateReportsFromSnapshotCalendar } from './agent/batch-report-generator.js';
import { runCorrelationPipeline, runCorrelationPipelineFromSnapshot } from './agent/correlationEngine.js';
import { MOCK_SPACEX_EVENT } from './agent/mock-data.js';
import type { MacroEvent } from './agent/types.js';
import { listCalendarEventIds } from './data/macro-event-calendar.js';

function parseFlagValue(flag: string): string | undefined {
  const withEquals = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (withEquals) return withEquals.slice(flag.length + 1);

  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1];
  }
  return undefined;
}

/** --events id1,id2 | --events=id | --event id | positional event_id */
function parseEventIdsFromArgs(): string[] | null {
  const eventsRaw = parseFlagValue('--events');
  if (eventsRaw) {
    return eventsRaw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  const eventRaw = parseFlagValue('--event');
  if (eventRaw) return [eventRaw];

  const positionals = process.argv
    .slice(2)
    .filter((arg) => !arg.startsWith('--'))
    .flatMap((arg) => arg.split(',').map((value) => value.trim()))
    .filter(Boolean);

  return positionals.length > 0 ? positionals : null;
}

function parseMockEvent(eventIds: string[] | null): MacroEvent {
  const calendarIds = new Set(listCalendarEventIds());

  if (!eventIds || eventIds.length === 0) {
    return MOCK_SPACEX_EVENT;
  }

  if (eventIds.length > 1) {
    throw new Error(
      `Mock mode supports one --event only. For multiple calendar events use:\n` +
        `  npx tsx src/generate-report.ts --from-snapshot --events=${eventIds.join(',')}`,
    );
  }

  const eventId = eventIds[0]!;
  if (eventId === MOCK_SPACEX_EVENT.eventId) return MOCK_SPACEX_EVENT;

  if (calendarIds.has(eventId)) {
    throw new Error(
      `Calendar event "${eventId}" requires snapshot mode:\n` +
        `  npx tsx src/generate-report.ts --from-snapshot --events=${eventId}`,
    );
  }

  throw new Error(
    `Unknown event id: ${eventId}. Calendar events: ${listCalendarEventIds().join(', ')}`,
  );
}

function resolveMode(): 'mock' | 'snapshot' | 'live-rpc' {
  if (process.argv.includes('--live')) return 'snapshot';
  if (process.argv.includes('--from-snapshot')) return 'snapshot';
  if (process.env.CORRELATION_USE_MOCK === 'false') return 'snapshot';
  return 'mock';
}

function printReportSummary(result: Awaited<ReturnType<typeof runCorrelationPipelineFromSnapshot>>): void {
  console.log(`Event: ${result.event.eventName} (${result.event.eventId})`);
  console.log(`Snapshot: ${result.report.dataSources.snapshot ?? 'data-snapshot.json'}`);
  console.log('Step 1 — Event windows');
  console.log(`  Pre:  ${result.windows.preWindow.start_utc} → ${result.windows.preWindow.end_utc}`);
  console.log(`  Post: ${result.windows.postWindow.start_utc} → ${result.windows.postWindow.end_utc}`);

  console.log('\nStep 4 — Computed metrics (from snapshot + event delta)');
  console.log(`  macroSurprise:         ${result.metrics.macroSurprise}`);
  console.log(`  priceDelta:            ${result.metrics.priceDelta}%`);
  console.log(`  volumeSpike:           ${result.metrics.volumeSpike}x`);
  console.log(`  aaveUtilizationDelta:  ${result.metrics.aaveUtilizationDelta ?? 'n/a'} pp`);
  console.log(`  capitalFlowDirection:    ${result.metrics.capitalFlowDirection}`);
  console.log(`  xstocks data source:   ${result.eventDelta?.data_quality.xstocks_source ?? 'n/a'}`);
  console.log(`  aave data source:      ${result.eventDelta?.data_quality.aave_source ?? 'n/a'}`);

  console.log('\nStep 5 — LLM synthesis');
  console.log(`  source: ${result.report.dataSources.llm}`);
  console.log(`  teaser: ${result.report.teaser.slice(0, 120)}...`);
  console.log(`  words:  ~${result.report.fullContent.split(/\s+/).length}`);

  console.log('\nStep 6 — Report saved');
  console.log(`  priceMNT: ${result.report.priceMNT}`);
  console.log(`  file:     reports/${result.report.eventId}.json`);
}

async function main(): Promise<void> {
  const mode = resolveMode();
  const snapshotPathIdx = process.argv.indexOf('--snapshot');
  const snapshotPath =
    snapshotPathIdx !== -1 && process.argv[snapshotPathIdx + 1]
      ? process.argv[snapshotPathIdx + 1]
      : undefined;

  const batchEventIds = parseEventIdsFromArgs();
  const batchAll = process.argv.includes('--all');

  console.log('Parallax Module 3 — Correlation & Reporting Engine');

  if (mode === 'snapshot' && (batchAll || batchEventIds)) {
    console.log(
      `Mode:  snapshot batch (calendar_events[] → Gemini)\n` +
        `Filter: ${batchAll ? 'all calendar events' : batchEventIds!.join(', ')}\n`,
    );

    const batch = await generateReportsFromSnapshotCalendar({
      snapshotPath,
      all: batchAll,
      eventIds: batchEventIds ?? undefined,
      geminiApiKey: process.env.GEMINI_API_KEY,
      combinedSynthesis: process.argv.includes('--combined'),
    });

    for (const report of batch.reports) {
      console.log(`✓ reports/${report.eventId}.json — ${report.dataSources.llm} — ${report.teaser.slice(0, 80)}...`);
    }

    if (batch.combined_synthesis) {
      const combinedPath = resolve(
        process.cwd(),
        'reports',
        `combined_${batch.combined_synthesis.batchId}.json`,
      );
      mkdirSync(resolve(process.cwd(), 'reports'), { recursive: true });
      writeFileSync(
        combinedPath,
        `${JSON.stringify(
          {
            batchId: batch.combined_synthesis.batchId,
            eventIds: batch.reports.map((r) => r.eventId),
            teaser: batch.combined_synthesis.teaser,
            fullContent: batch.combined_synthesis.fullContent,
            cross_event_correlation: batch.cross_event_correlation,
            generated_at: new Date().toISOString(),
          },
          null,
          2,
        )}\n`,
        'utf8',
      );
      console.log(`\n✓ Combined synthesis: reports/combined_${batch.combined_synthesis.batchId}.json`);
    }

    console.log(`\nDone — ${batch.reports.length} report(s) written.`);
    return;
  }

  if (mode === 'snapshot') {
    console.log('Mode:  snapshot (data-snapshot.json → Gemini)');
    console.log('Note:  only macro_event (primary) is generated. For all events use --all or --events=id1,id2\n');

    const result = await runCorrelationPipelineFromSnapshot({ snapshotPath });
    printReportSummary(result);
    return;
  }

  const event = parseMockEvent(batchEventIds);
  const useMock = mode === 'mock';

  console.log(`Event: ${event.eventName} (${event.eventId})`);
  console.log(`Mode:  ${useMock ? 'mock data (Step 2/3 stubbed)' : 'live MCP/indexer'}\n`);

  const result = await runCorrelationPipeline(event, {
    useMockData: useMock,
  });

  console.log('Step 1 — Event windows');
  console.log(`  Pre:  ${result.windows.preWindow.start_utc} → ${result.windows.preWindow.end_utc}`);
  console.log(`  Post: ${result.windows.postWindow.start_utc} → ${result.windows.postWindow.end_utc}`);

  console.log('\nStep 4 — Computed metrics');
  console.log(`  macroSurprise:    ${result.metrics.macroSurprise}`);
  console.log(`  priceDelta:       ${result.metrics.priceDelta}%`);
  console.log(`  volumeSpike:      ${result.metrics.volumeSpike}x`);
  console.log(`  insightXAccuracy: ${result.metrics.insightXAccuracy}`);

  console.log('\nStep 5 — LLM synthesis');
  console.log(`  source: ${result.report.dataSources.llm}`);
  console.log(`  teaser: ${result.report.teaser.slice(0, 120)}...`);

  console.log('\nStep 6 — Report saved');
  console.log(`  priceMNT: ${result.report.priceMNT}`);
  console.log(`  file:     reports/${result.report.eventId}.json`);
}

main().catch((error: unknown) => {
  console.error('Correlation pipeline failed:', error);
  process.exit(1);
});
