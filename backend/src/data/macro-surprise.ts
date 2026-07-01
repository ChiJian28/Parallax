import { eventDateFromUnix, fetchFredObservations, parseFredNumber } from './fred-client.js';

export interface MacroSurpriseResult {
  surprise_magnitude: number;
  current_value: number | null;
  previous_value: number | null;
  fred_observation_date: string | null;
  method: 'fred_dff' | 'fred_cpi_yoy' | 'hardcoded' | 'fred_level_delta';
  warnings: string[];
}

function validObs(obs: Array<{ date: string; value: string }>) {
  return obs.filter((o) => parseFredNumber(o.value) != null);
}

/**
 * FOMC surprise via DFF (daily federal funds rate).
 * Surprise = rate change around the meeting (0 = hold, ±0.25 = 25bp).
 */
export async function computeFedSurprise(
  apiKey: string,
  eventDate: string,
  seriesId = 'DFF',
): Promise<MacroSurpriseResult> {
  const warnings: string[] = [];
  const start = shiftDate(eventDate, -14);
  const obs = validObs(
    await fetchFredObservations({
      apiKey,
      seriesId,
      observationStart: start,
      observationEnd: eventDate,
      sortOrder: 'desc',
      limit: 10,
    }),
  );

  if (obs.length < 2) {
    return {
      surprise_magnitude: 0,
      current_value: null,
      previous_value: null,
      fred_observation_date: null,
      method: 'fred_dff',
      warnings: [`Insufficient ${seriesId} observations around ${eventDate}`],
    };
  }

  const current = parseFredNumber(obs[0].value)!;
  const prior = parseFredNumber(obs[1].value)!;
  const surprise = Math.round((current - prior) * 10000) / 10000;

  return {
    surprise_magnitude: surprise,
    current_value: current,
    previous_value: prior,
    fred_observation_date: obs[0].date,
    method: 'fred_dff',
    warnings,
  };
}

/**
 * CPI surprise proxy: YoY% deviation from trailing 3-month average (no consensus feed).
 */
export async function computeCpiSurprise(apiKey: string, eventDate: string): Promise<MacroSurpriseResult> {
  const warnings: string[] = [];
  const start = shiftDate(eventDate, -180);
  const obs = validObs(
    await fetchFredObservations({
      apiKey,
      seriesId: 'CPIAUCSL',
      observationStart: start,
      observationEnd: eventDate,
      sortOrder: 'asc',
      units: 'pc1',
    }),
  );

  if (obs.length < 4) {
    return {
      surprise_magnitude: 0,
      current_value: null,
      previous_value: null,
      fred_observation_date: null,
      method: 'fred_cpi_yoy',
      warnings: [`Insufficient CPIAUCSL YoY observations before ${eventDate}`],
    };
  }

  const tail = obs.slice(-4);
  const actual = parseFredNumber(tail[tail.length - 1].value)!;
  const priorThree = tail.slice(0, 3).map((o) => parseFredNumber(o.value)!);
  const expected = priorThree.reduce((a, b) => a + b, 0) / priorThree.length;
  const surprise = Math.round((actual - expected) * 10000) / 10000;

  return {
    surprise_magnitude: surprise,
    current_value: actual,
    previous_value: expected,
    fred_observation_date: tail[tail.length - 1].date,
    method: 'fred_cpi_yoy',
    warnings,
  };
}

export async function computeSurpriseForEvent(
  apiKey: string | undefined,
  params: {
    type: 'CPI' | 'FED_RATE' | 'IPO';
    timestamp_unix: number;
    fred_series?: string;
    hardcoded_surprise?: number;
  },
): Promise<MacroSurpriseResult> {
  if (params.type === 'IPO') {
    const surprise = params.hardcoded_surprise ?? 0;
    return {
      surprise_magnitude: surprise,
      current_value: surprise,
      previous_value: 0,
      fred_observation_date: eventDateFromUnix(params.timestamp_unix),
      method: 'hardcoded',
      warnings: ['IPO surprise is hardcoded (pricing vs. valuation range midpoint).'],
    };
  }

  if (!apiKey) {
    return {
      surprise_magnitude: 0,
      current_value: null,
      previous_value: null,
      fred_observation_date: null,
      method: params.type === 'FED_RATE' ? 'fred_dff' : 'fred_cpi_yoy',
      warnings: ['FRED_API_KEY not set; surprise defaults to 0.'],
    };
  }

  const eventDate = eventDateFromUnix(params.timestamp_unix);
  if (params.type === 'FED_RATE') {
    return computeFedSurprise(apiKey, eventDate, params.fred_series ?? 'DFF');
  }
  return computeCpiSurprise(apiKey, eventDate);
}

function shiftDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
