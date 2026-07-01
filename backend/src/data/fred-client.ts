const FRED_V1_OBSERVATIONS = 'https://api.stlouisfed.org/fred/series/observations';

export interface FredObservation {
  date: string;
  value: string;
}

export interface FredFetchOptions {
  seriesId: string;
  apiKey: string;
  observationStart?: string;
  observationEnd?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  units?: string;
}

export function parseFredNumber(value: string): number | null {
  if (!value || value === '.') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * FRED API v1 observations.
 * Supports api_key query param (legacy) and Authorization Bearer header per FRED v2 docs.
 */
export async function fetchFredObservations(
  options: FredFetchOptions,
): Promise<FredObservation[]> {
  const url = new URL(FRED_V1_OBSERVATIONS);
  url.searchParams.set('series_id', options.seriesId);
  url.searchParams.set('file_type', 'json');
  url.searchParams.set('api_key', options.apiKey);

  if (options.observationStart) url.searchParams.set('observation_start', options.observationStart);
  if (options.observationEnd) url.searchParams.set('observation_end', options.observationEnd);
  if (options.sortOrder) url.searchParams.set('sort_order', options.sortOrder);
  if (options.limit != null) url.searchParams.set('limit', String(options.limit));
  if (options.units) url.searchParams.set('units', options.units);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`FRED request failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const payload = (await response.json()) as { observations?: FredObservation[] };
  return payload.observations ?? [];
}

export function eventDateFromUnix(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}
