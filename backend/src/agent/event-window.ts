import type { EventWindows, MacroEvent, UtcWindow } from './types.js';

function toUtcWindow(start: number, end: number): UtcWindow {
  return {
    start,
    end,
    start_utc: new Date(start).toISOString(),
    end_utc: new Date(end).toISOString(),
  };
}

/**
 * Step 1 — Event Window Manager
 * Maps a macro event to strict UTC pre/post windows around triggerTimeUtc.
 */
export function buildEventWindows(event: MacroEvent, windowHours = 48): EventWindows {
  const windowMs = windowHours * 3600 * 1000;
  const trigger = event.triggerTimeUtc;

  return {
    trigger_utc: new Date(trigger).toISOString(),
    preWindow: toUtcWindow(trigger - windowMs, trigger),
    postWindow: toUtcWindow(trigger, trigger + windowMs),
  };
}
