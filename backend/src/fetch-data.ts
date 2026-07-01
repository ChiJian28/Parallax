import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { collectAcquisitionSnapshot } from './data/acquisition-engine.js';
import { listCalendarEventIds } from './data/macro-event-calendar.js';
import { isInsightXOutputSkipped } from './data/insightx.js';

async function main(): Promise<void> {
  const includeCalendar = process.argv.includes('--calendar');
  const hours = process.env.VOLUME_WINDOW_HOURS
    ? Number(process.env.VOLUME_WINDOW_HOURS)
    : 48;

  console.log('Parallax Module 2 — Data Acquisition Engine');
  console.log(`Network: mainnet | Window: ${hours}h`);
  console.log(`Mode: ${includeCalendar ? 'active event + full calendar' : 'active event only'}\n`);

  if (includeCalendar) {
    console.log('Macro calendar events:');
    for (const id of listCalendarEventIds()) {
      console.log(`  - ${id}`);
    }
    console.log('');
  }

  const snapshot = await collectAcquisitionSnapshot({
    network: 'mainnet',
    hours,
    includeCalendar,
    sqlEndpoint: process.env.MANTLE_SQL_INDEXER_ENDPOINT,
    fluxionSubgraphEndpoint: process.env.FLUXION_SUBGRAPH_ENDPOINT,
    insightxEndpoint: process.env.INSIGHTX_SUBGRAPH_ENDPOINT,
    insightxSearch: process.env.INSIGHTX_MARKET_SEARCH,
    fredApiKey: process.env.FRED_API_KEY,
    fredSeriesId: process.env.FRED_SERIES_ID,
    macroEventId: process.env.MACRO_EVENT_ID,
    macroEventName: process.env.MACRO_EVENT_NAME,
    macroTargetToken: process.env.MACRO_TARGET_TOKEN,
    macroMockTriggerTimeUtc: process.env.MACRO_EVENT_TIME_UTC,
    macroReleaseHourUtc: process.env.FRED_RELEASE_HOUR_UTC
      ? Number(process.env.FRED_RELEASE_HOUR_UTC)
      : undefined,
  });

  const outputPath = resolve(process.cwd(), 'data-snapshot.json');
  const outputPayload = isInsightXOutputSkipped()
    ? (() => {
        const { insightx: _insightx, ...rest } = snapshot;
        return rest;
      })()
    : snapshot;
  writeFileSync(outputPath, `${JSON.stringify(outputPayload, null, 2)}\n`, 'utf8');

  console.log('Pre-flight addresses:');
  console.log(`  SPCXx:              ${snapshot.preflight.addresses.spcxx.address}`);
  console.log(`  USDC:               ${snapshot.preflight.addresses.usdc.address}`);

  console.log('\nActive Macro Event:');
  console.log(`  status:       ${snapshot.macro_event.status} (${snapshot.macro_event.source})`);
  console.log(`  event:        ${snapshot.macro_event.event_id} - ${snapshot.macro_event.event_name}`);
  console.log(`  type:         ${snapshot.macro_event.event_type ?? 'n/a'}`);
  console.log(`  trigger_utc:  ${snapshot.macro_event.trigger_time_utc}`);
  console.log(
    `  surprise:     ${snapshot.macro_event.surprise_magnitude ?? 'n/a'} (${snapshot.macro_event.surprise_method ?? 'n/a'})`,
  );
  console.log(
    `  pre_window:   ${snapshot.macro_event.pre_window.start_utc} -> ${snapshot.macro_event.pre_window.end_utc} (${snapshot.macro_event.pre_window.hours}h)`,
  );
  console.log(
    `  post_window:  ${snapshot.macro_event.post_window.start_utc} -> ${snapshot.macro_event.post_window.end_utc} (${snapshot.macro_event.post_window.hours}h)`,
  );

  if (snapshot.cross_event_correlation) {
    const c = snapshot.cross_event_correlation;
    console.log('\nCross-Event Correlation (Pearson r):');
    console.log(`  events_analyzed:       ${c.events_analyzed}`);
    console.log(`  pearson_macro_xstocks: ${c.pearson_macro_xstocks ?? 'n/a (need ≥2 valid pairs)'}`);
    console.log(`  pearson_xstocks_aave:  ${c.pearson_xstocks_aave ?? 'n/a (need ≥2 valid pairs)'}`);
    console.log(`  pearson_macro_aave:    ${c.pearson_macro_aave ?? 'n/a (need ≥2 valid pairs)'}`);
    console.log('\n  Per-event series:');
    for (const row of c.series) {
      console.log(
        `    ${row.event_id} [${row.event_type}]: surprise=${row.macro_surprise}, xstocks_px=${row.xstocks_price_change_pct ?? 'n/a'}%, aave_util_Δ=${row.aave_utilization_delta ?? 'n/a'} pp`,
      );
    }
  }

  if (snapshot.macro_calendar?.length) {
    console.log('\nMacro Calendar (resolved):');
    for (const ev of snapshot.macro_calendar) {
      console.log(
        `  ${ev.event_id} | ${ev.event_type} | ${ev.trigger_time_utc.slice(0, 10)} | surprise=${ev.surprise_magnitude} (${ev.surprise_method})`,
      );
    }
  }

  console.log(`\nSaved: ${outputPath}`);
}

main().catch((error: unknown) => {
  console.error('Data acquisition failed:', error);
  process.exit(1);
});
