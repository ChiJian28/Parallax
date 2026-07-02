import type { HistoryEntry } from '@/components/hud/types';

const STORAGE_KEY = 'parallax-correlation-history';
export const MAX_CORRELATION_HISTORY = 20;
const MAX_ENTRIES = MAX_CORRELATION_HISTORY;

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<HistoryEntry> & { unlockedAt?: number };
  return (
    typeof entry.id === 'string' &&
    typeof entry.batchId === 'string' &&
    typeof entry.eventCount === 'number' &&
    typeof (entry.savedAt ?? entry.unlockedAt) === 'number' &&
    entry.dossier != null &&
    typeof entry.dossier === 'object'
  );
}

function normalizeEntry(raw: unknown): HistoryEntry | null {
  if (!isHistoryEntry(raw)) return null;
  const legacy = raw as HistoryEntry & { unlockedAt?: number };
  return {
    id: legacy.id,
    batchId: legacy.batchId,
    eventCount: legacy.eventCount,
    savedAt: legacy.savedAt ?? legacy.unlockedAt ?? Date.now(),
    dossier: legacy.dossier,
  };
}

export function loadCorrelationHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeEntry)
      .filter((entry): entry is HistoryEntry => entry != null)
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function saveCorrelationHistory(entries: HistoryEntry[]): void {
  if (typeof window === 'undefined') return;

  try {
    const trimmed = entries.slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Quota exceeded or private mode — keep in-memory state only
  }
}
