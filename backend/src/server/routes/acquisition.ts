import type { IncomingMessage, ServerResponse } from 'node:http';
import { storeAcquisitionSession } from '../../agent/acquisition-session-cache.js';
import { runAcquisitionTrace } from '../../data/acquisition-runner.js';
import type { X402ServerConfig } from '../config.js';
import { readJsonBody, sendJson } from '../http-utils.js';

interface AcquisitionRunRequest {
  event_ids?: string[];
}

export async function handleRunAcquisition(
  _config: X402ServerConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  let body: AcquisitionRunRequest;
  try {
    body = await readJsonBody<AcquisitionRunRequest>(req);
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
      example: { event_ids: ['fomc-mar-2026', 'spacex-ipo-q1'] },
    });
    return;
  }

  try {
    const result = await runAcquisitionTrace({
      eventIds,
      fredApiKey: process.env.FRED_API_KEY,
    });

    if (result.success && result.snapshots?.length) {
      storeAcquisitionSession(eventIds, {
        snapshots: result.snapshots,
        cross_event_correlation: result.cross_event_correlation,
        primary_event_id: result.primary_event_id,
      });
    }

    sendJson(res, result.success ? 200 : 422, result);
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'Acquisition failed',
    });
  }
}
