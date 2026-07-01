import type { EventDelta } from './event-delta.js';
import { generateReportFromCalendarSnapshot } from './calendar-report-generator.js';
import {
  buildCombinedSynthesisInputs,
  generateCombinedSynthesis,
} from './combined-synthesizer.js';
import { reportStore } from './report-store.js';
import { loadAcquisitionSnapshot } from './snapshot-loader.js';
import type { CalendarEventSnapshot } from '../data/cross-event-correlation.js';
import type { CrossEventCorrelation } from '../data/cross-event-correlation.js';
import type { FinalReport } from './types.js';

function asCalendarSnapshot(
  raw: NonNullable<ReturnType<typeof loadAcquisitionSnapshot>['calendar_events']>[number],
): CalendarEventSnapshot {
  return {
    macro: raw.macro,
    aave_windows: raw.aave_windows,
    event_delta: raw.event_delta as EventDelta,
  };
}

export async function generateReportsFromSnapshotCalendar(options: {
  snapshotPath?: string;
  eventIds?: string[];
  all?: boolean;
  geminiApiKey?: string;
  reportPriceMNT?: number;
  combinedSynthesis?: boolean;
}): Promise<{
  reports: FinalReport[];
  cross_event_correlation?: CrossEventCorrelation;
  combined_synthesis?: { batchId: string; teaser: string; fullContent: string };
}> {
  const snapshot = loadAcquisitionSnapshot(options.snapshotPath);
  const calendarRaw = snapshot.calendar_events ?? [];

  if (calendarRaw.length === 0) {
    throw new Error(
      'No calendar_events[] in snapshot. Run: npm run fetch-data -- --calendar',
    );
  }

  const calendarSnapshots = calendarRaw.map(asCalendarSnapshot);
  let targets: CalendarEventSnapshot[];

  if (options.all) {
    targets = calendarSnapshots;
  } else if (options.eventIds?.length) {
    const wanted = new Set(options.eventIds);
    targets = calendarSnapshots.filter((entry) => wanted.has(entry.macro.event_id));
    const missing = options.eventIds.filter(
      (id) => !targets.some((entry) => entry.macro.event_id === id),
    );
    if (missing.length > 0) {
      throw new Error(
        `Event(s) not found in snapshot calendar_events: ${missing.join(', ')}`,
      );
    }
  } else {
    throw new Error('Provide eventIds[] or all: true');
  }

  const cross = snapshot.cross_event_correlation as CrossEventCorrelation | undefined;
  const reports: FinalReport[] = [];

  for (const entry of targets) {
    const report = await generateReportFromCalendarSnapshot(entry, cross, {
      geminiApiKey: options.geminiApiKey,
      reportPriceMNT: options.reportPriceMNT,
    });
    await reportStore.save(report);
    reports.push(report);
  }

  let combined_synthesis: { batchId: string; teaser: string; fullContent: string } | undefined;
  if (options.combinedSynthesis && reports.length >= 2 && cross) {
    const batchId = reports.map((r) => r.eventId).sort().join('+');
    const teasersByEventId = Object.fromEntries(reports.map((r) => [r.eventId, r.teaser]));
    const { events, metrics } = buildCombinedSynthesisInputs(cross, teasersByEventId);
    const output = await generateCombinedSynthesis(events, metrics, options.geminiApiKey);
    combined_synthesis = {
      batchId,
      teaser: output.teaser,
      fullContent: output.full_analysis,
    };
  }

  return { reports, cross_event_correlation: cross, combined_synthesis };
}
