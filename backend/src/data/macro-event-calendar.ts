export type MacroCalendarEventType = 'CPI' | 'FED_RATE' | 'IPO';

export interface MacroCalendarEventDefinition {
  event_id: string;
  name: string;
  type: MacroCalendarEventType;
  /** Unix seconds (UTC) — FOMC/CPI/IPO release instant */
  timestamp_unix: number;
  tokens: string[];
  fred_series?: string;
  window_pre_hours: number;
  window_post_hours: number;
  /** IPO events without FRED series */
  hardcoded_surprise?: number;
}

/** Hardcoded IPO pricing surprise vs. valuation range midpoint */
export const IPO_SURPRISES: Record<string, number> = {
  SPCX_IPO: 0.12,
  'spacex-ipo-q1': 0.12,
  CRCL_IPO: 0.05,
};

/**
 * Q1–Q2 2026 macro calendar for cross-event Pearson correlation.
 * FOMC uses DFF (daily); CPI uses CPIAUCSL YoY surprise proxy.
 */
export const MACRO_EVENT_CALENDAR: MacroCalendarEventDefinition[] = [
  {
    event_id: 'fomc-jan-2026',
    name: 'FOMC_JAN_2026',
    type: 'FED_RATE',
    timestamp_unix: 1769713200,
    tokens: ['SPCXx', 'TSLA_x', 'NVDA_x', 'AAPL_x', 'GOOGL_x'],
    fred_series: 'DFF',
    window_pre_hours: 48,
    window_post_hours: 12,
  },
  {
    event_id: 'cpi-feb-2026',
    name: 'CPI_FEB_2026',
    type: 'CPI',
    timestamp_unix: 1770903000,
    tokens: ['SPCXx', 'TSLA_x', 'NVDA_x', 'AAPL_x', 'GOOGL_x'],
    fred_series: 'CPIAUCSL',
    window_pre_hours: 24,
    window_post_hours: 6,
  },
  {
    event_id: 'cpi-mar-2026',
    name: 'CPI_MAR_2026',
    type: 'CPI',
    timestamp_unix: 1773322200,
    tokens: ['SPCXx', 'TSLA_x', 'NVDA_x', 'AAPL_x', 'GOOGL_x'],
    fred_series: 'CPIAUCSL',
    window_pre_hours: 24,
    window_post_hours: 6,
  },
  {
    event_id: 'fomc-mar-2026',
    name: 'FOMC_MAR_2026',
    type: 'FED_RATE',
    timestamp_unix: 1773946800,
    tokens: ['SPCXx', 'TSLA_x', 'NVDA_x', 'AAPL_x', 'GOOGL_x'],
    fred_series: 'DFF',
    window_pre_hours: 48,
    window_post_hours: 12,
  },
  {
    event_id: 'cpi-jun-2026',
    name: 'CPI_JUN_2026',
    type: 'CPI',
    timestamp_unix: 1781781000,
    tokens: ['SPCXx', 'TSLA_x', 'NVDA_x', 'AAPL_x', 'GOOGL_x'],
    fred_series: 'CPIAUCSL',
    window_pre_hours: 24,
    window_post_hours: 6,
  },
  {
    event_id: 'crcl-ipo-q2',
    name: 'CRCL_IPO',
    type: 'IPO',
    timestamp_unix: 1781536200,
    tokens: ['CRCL_x'],
    window_pre_hours: 48,
    window_post_hours: 48,
    hardcoded_surprise: IPO_SURPRISES.CRCL_IPO,
  },
  {
    event_id: 'spacex-ipo-q1',
    name: 'SPCX_IPO',
    type: 'IPO',
    timestamp_unix: 1781544600,
    tokens: ['SPCXx'],
    window_pre_hours: 48,
    window_post_hours: 48,
    hardcoded_surprise: IPO_SURPRISES.SPCX_IPO,
  },
].sort((a, b) => a.timestamp_unix - b.timestamp_unix);

export function getCalendarEvent(eventId: string): MacroCalendarEventDefinition | undefined {
  return MACRO_EVENT_CALENDAR.find((e) => e.event_id === eventId || e.name === eventId);
}

export function listCalendarEventIds(): string[] {
  return MACRO_EVENT_CALENDAR.map((e) => e.event_id);
}
