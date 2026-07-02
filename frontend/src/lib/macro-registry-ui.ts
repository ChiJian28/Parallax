import type { MacroRegistryEvent } from '@/lib/api';
import { MACRO_EVENT_FEED } from '@/lib/command-center-mocks';

export type RegistryFilterType = 'All' | 'FED_RATE' | 'CPI' | 'IPO';

export const REGISTRY_FILTER_TABS: Array<{ id: RegistryFilterType; label: string }> = [
  { id: 'All', label: 'All' },
  { id: 'FED_RATE', label: 'FOMC' },
  { id: 'CPI', label: 'CPI' },
  { id: 'IPO', label: 'IPO' },
];

const EVENT_CODE: Record<string, string> = {
  'fomc-jan-2026': 'DFF',
  'fomc-mar-2026': 'DFF',
  'cpi-feb-2026': 'CPIAUCSL',
  'cpi-mar-2026': 'CPIAUCSL',
  'cpi-jun-2026': 'CPIAUCSL',
  'spacex-ipo-q1': 'SPCXx',
  'crcl-ipo-q2': 'CRCL_x',
};

const EVENT_EMOJI: Record<MacroRegistryEvent['type'], string> = {
  FED_RATE: '🏦',
  CPI: '📉',
  IPO: '🚀',
};

export function registryEventCode(event: MacroRegistryEvent): string {
  return EVENT_CODE[event.event_id] ?? event.tokens[0] ?? event.type;
}

export function registryEventEmoji(event: MacroRegistryEvent): string {
  return EVENT_EMOJI[event.type] ?? '•';
}

export function registryEventTitle(event: MacroRegistryEvent): string {
  const feed = MACRO_EVENT_FEED.find((e) => e.id === event.event_id);
  return feed?.title ?? event.name.replace(/_/g, ' ');
}

export function registryEventSubtitle(event: MacroRegistryEvent): string {
  const feed = MACRO_EVENT_FEED.find((e) => e.id === event.event_id);
  return feed?.subtitle ?? `${event.type} · ${event.tokens.join(', ')}`;
}

export function registryEventHasReport(eventId: string): boolean {
  return MACRO_EVENT_FEED.find((e) => e.id === eventId)?.hasReport === true;
}

export function filterRegistryEvents(
  events: MacroRegistryEvent[],
  category: RegistryFilterType,
  searchQuery: string,
): MacroRegistryEvent[] {
  const q = searchQuery.trim().toLowerCase();
  return events.filter((event) => {
    if (category !== 'All' && event.type !== category) return false;
    if (!q) return true;
    const haystack = [
      event.event_id,
      event.name,
      registryEventTitle(event),
      registryEventSubtitle(event),
      ...event.aliases,
      ...event.tokens,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function macroFeedToRegistryEvent(
  feed: (typeof MACRO_EVENT_FEED)[number],
): MacroRegistryEvent {
  const typeMap: Record<string, MacroRegistryEvent['type']> = {
    'Monetary Policy': 'FED_RATE',
    Inflation: 'CPI',
    'Equity Catalyst': 'IPO',
  };
  return {
    event_id: feed.id,
    name: feed.title.replace(/\s+/g, '_').toUpperCase(),
    type: typeMap[feed.category] ?? 'IPO',
    trigger_time_utc: new Date().toISOString(),
    tokens: feed.id.includes('crcl') ? ['CRCL_x'] : ['SPCXx'],
    aliases: [],
  };
}
