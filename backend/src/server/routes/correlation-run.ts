import type { IncomingMessage, ServerResponse } from 'node:http';
import { probeCorrelationCache, runHudCorrelation } from '../../agent/correlation-run-service.js';
import type { X402ServerConfig } from '../config.js';
import { readJsonBody, sendJson } from '../http-utils.js';

interface CorrelationRunRequest {
  event_ids?: string[];
  force_live?: boolean;
  skip_acquisition?: boolean;
  mode?: 'probe' | 'run';
}

export async function handleRunCorrelation(
  _config: X402ServerConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  let body: CorrelationRunRequest;
  try {
    body = await readJsonBody<CorrelationRunRequest>(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  const eventIds = Array.isArray(body.event_ids)
    ? body.event_ids.filter((value): value is string => typeof value === 'string')
    : [];

  if (eventIds.length === 0) {
    sendJson(res, 400, {
      error: 'Missing event_ids[]. Provide registry event_ids from GET /api/macro-events.',
      example: { event_ids: ['cpi-jun-2026', 'spacex-ipo-q1'] },
    });
    return;
  }

  try {
    if (body.mode === 'probe') {
      sendJson(res, 200, probeCorrelationCache(eventIds));
      return;
    }

    const result = await runHudCorrelation({
      eventIds,
      fredApiKey: process.env.FRED_API_KEY,
      geminiApiKey: process.env.GEMINI_API_KEY,
      forceLive: body.force_live === true,
      skipAcquisition: body.skip_acquisition === true,
    });

    sendJson(res, result.success ? 200 : 422, result);
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'Correlation run failed',
    });
  }
}
