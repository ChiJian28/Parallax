import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getCalendarEvent,
  type MacroCalendarEventDefinition,
} from './macro-event-calendar.js';

const STORE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../discovered-events.json',
);

const dynamicById = new Map<string, MacroCalendarEventDefinition>();

function loadFromDisk(): void {
  if (!existsSync(STORE_PATH)) return;
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, 'utf8')) as MacroCalendarEventDefinition[];
    if (!Array.isArray(raw)) return;
    for (const def of raw) {
      if (def?.event_id) dynamicById.set(def.event_id, def);
    }
  } catch {
    // ignore corrupt file
  }
}

function persistToDisk(): void {
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  const entries = [...dynamicById.values()].sort((a, b) => a.timestamp_unix - b.timestamp_unix);
  writeFileSync(STORE_PATH, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
}

loadFromDisk();

/** Resolve event_id → definition from static calendar or dynamically discovered store. */
export function getEventDefinition(eventId: string): MacroCalendarEventDefinition | undefined {
  const trimmed = eventId.trim();
  if (!trimmed) return undefined;
  return getCalendarEvent(trimmed) ?? dynamicById.get(trimmed);
}

export function registerDynamicDefinition(definition: MacroCalendarEventDefinition): void {
  dynamicById.set(definition.event_id, definition);
  persistToDisk();
}

export function registerDynamicDefinitions(definitions: MacroCalendarEventDefinition[]): void {
  for (const def of definitions) {
    if (def?.event_id) dynamicById.set(def.event_id, def);
  }
  if (definitions.length > 0) persistToDisk();
}

export function listDynamicEventDefinitions(): MacroCalendarEventDefinition[] {
  return [...dynamicById.values()].sort((a, b) => a.timestamp_unix - b.timestamp_unix);
}

export function listDynamicEventIds(): string[] {
  return listDynamicEventDefinitions().map((e) => e.event_id);
}
