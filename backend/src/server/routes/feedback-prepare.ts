import type { IncomingMessage, ServerResponse } from 'node:http';
import { getAddress, isAddress } from 'viem';
import { prepareFeedbackIpfs } from '../../erc8004/ipfs-feedback.js';
import { readJsonBody, sendJson } from '../http-utils.js';

interface PrepareFeedbackBody {
  agentId?: string;
  clientAddress?: string;
  value?: number;
  tag1?: string;
  tag2?: string;
  endpoint?: string;
  text?: string;
}

export async function handlePrepareFeedbackIpfs(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const body = await readJsonBody<PrepareFeedbackBody>(req);

    if (!body.agentId?.includes(':')) {
      sendJson(res, 400, { error: 'agentId required (e.g. 5003:308)' });
      return;
    }
    if (!body.clientAddress || !isAddress(body.clientAddress)) {
      sendJson(res, 400, { error: 'clientAddress must be a valid wallet address' });
      return;
    }
    if (body.value == null || Number.isNaN(Number(body.value))) {
      sendJson(res, 400, { error: 'value required (1–100)' });
      return;
    }
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
      sendJson(res, 400, { error: 'text required — consensus note for IPFS feedback file' });
      return;
    }

    const tag1 = (body.tag1 ?? 'macro_correlation').replace(/^#/, '');
    const tag2 = (body.tag2 ?? 'xstocks_accuracy').replace(/^#/, '');
    const endpoint = body.endpoint?.trim() || '/api/report/unknown';

    const result = await prepareFeedbackIpfs({
      agentId: body.agentId,
      clientAddress: getAddress(body.clientAddress),
      value: Number(body.value),
      tag1,
      tag2,
      endpoint,
      text,
    });

    sendJson(res, 200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: message });
  }
}
