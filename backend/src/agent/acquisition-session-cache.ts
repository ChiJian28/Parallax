import type { CalendarEventSnapshot } from '../data/cross-event-correlation.js';
import type { CrossEventCorrelation } from '../data/cross-event-correlation.js';

const TTL_MS = 10 * 60 * 1000;

interface AcquisitionSessionEntry {
  snapshots: CalendarEventSnapshot[];
  cross_event_correlation?: CrossEventCorrelation;
  primary_event_id: string;
  created_at: number;
}

const sessions = new Map<string, AcquisitionSessionEntry>();

function sessionKey(eventIds: string[]): string {
  return [...new Set(eventIds.map((id) => id.trim()).filter(Boolean))].sort().join('+');
}

export function storeAcquisitionSession(
  eventIds: string[],
  entry: Omit<AcquisitionSessionEntry, 'created_at'>,
): void {
  sessions.set(sessionKey(eventIds), { ...entry, created_at: Date.now() });
}

export function getAcquisitionSession(eventIds: string[]): AcquisitionSessionEntry | null {
  const key = sessionKey(eventIds);
  const entry = sessions.get(key);
  if (!entry) return null;
  if (Date.now() - entry.created_at > TTL_MS) {
    sessions.delete(key);
    return null;
  }
  return entry;
}
