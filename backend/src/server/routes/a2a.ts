import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { reportStore } from '../../agent/report-store.js';
import type { X402ServerConfig } from '../config.js';
import {
  buildPaymentRequiredPayload,
  buildPaymentResponseHeader,
  encodePaymentRequiredHeader,
} from '../x402/build-payment-required.js';
import { hasPaymentHeader, verifyPayment } from '../x402/verify-payment.js';
import {
  extractEventIdFromText,
  extractMessageText,
  normalizeHeaders,
  readJsonBody,
  sendJson,
} from '../http-utils.js';

interface A2AMessageBody {
  message?: {
    role?: string;
    parts?: Array<{ text?: string; kind?: string }>;
    content?: string;
    messageId?: string;
    contextId?: string;
    taskId?: string;
  };
  params?: { message?: { parts?: Array<{ text?: string }> } };
}

const tasks = new Map<
  string,
  {
    taskId: string;
    contextId: string;
    eventId: string;
    status: { state: string };
    result?: string;
  }
>();

function buildA2AMessageResponse(text: string, contextId?: string) {
  return {
    message: {
      role: 'ROLE_AGENT',
      parts: [{ kind: 'text', text }],
      contextId: contextId ?? randomUUID(),
    },
  };
}

function buildA2ATaskResponse(taskId: string, contextId: string, state: string) {
  return {
    task: {
      id: taskId,
      taskId,
      contextId,
      status: { state },
    },
  };
}

async function resolveReportContent(
  config: X402ServerConfig,
  req: IncomingMessage,
  eventId: string,
  resourceUrl: string,
): Promise<{ paid: boolean; text: string; settlementHeader?: string }> {
  const report = reportStore.get(eventId);
  if (!report) {
    return { paid: false, text: `Report not found for eventId: ${eventId}` };
  }

  const headers = normalizeHeaders(req);
  if (!hasPaymentHeader(headers)) {
    return {
      paid: false,
      text: `${report.teaser}\n\n[Full report locked — x402 payment of ${report.priceMNT} MNT tier required. Use sdk.request() or messageA2A with x402Payment.pay().]`,
    };
  }

  const verification = await verifyPayment(config, headers, resourceUrl);
  if (!verification.valid) {
    return {
      paid: false,
      text: `${report.teaser}\n\n[Payment rejected: ${verification.reason ?? 'invalid'}]`,
    };
  }

  const settlementHeader = buildPaymentResponseHeader({
    success: true,
    transaction: verification.transaction,
    network: config.network,
    payer: verification.payer,
  });

  return {
    paid: true,
    text: report.fullContent,
    settlementHeader,
  };
}

export async function handleMessageSend(
  config: X402ServerConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await readJsonBody<A2AMessageBody>(req);
  const text = extractMessageText(body);
  const eventId = extractEventIdFromText(text) ?? 'spacex-ipo-q1';
  const resourceUrl = `${config.publicBaseUrl}/api/report/${eventId}`;
  const headers = normalizeHeaders(req);

  // Unpaid → HTTP 402 with PAYMENT-REQUIRED (Agent0 SDK x402 + A2A flow)
  if (!hasPaymentHeader(headers)) {
    const report = reportStore.get(eventId);
    const paymentRequired = buildPaymentRequiredPayload(config, resourceUrl);
    sendJson(
      res,
      402,
      {
        error: 'x402 payment required',
        eventId,
        teaser: report?.teaser ?? null,
        priceMNT: report?.priceMNT ?? config.priceMNT,
      },
      {
        'PAYMENT-REQUIRED': encodePaymentRequiredHeader(paymentRequired),
      },
    );
    return;
  }

  const verification = await verifyPayment(config, headers, resourceUrl);
  if (!verification.valid) {
    const paymentRequired = buildPaymentRequiredPayload(config, resourceUrl);
    sendJson(
      res,
      402,
      { error: verification.reason ?? 'Payment verification failed', eventId },
      { 'PAYMENT-REQUIRED': encodePaymentRequiredHeader(paymentRequired) },
    );
    return;
  }

  // Optional async task path when message asks for "generate" / "analyze"
  if (/\b(generate|analyze|research)\b/i.test(text)) {
    const taskId = `task-${randomUUID()}`;
    const contextId = body.message?.contextId ?? randomUUID();
    const { text: content, settlementHeader } = await resolveReportContent(
      config,
      req,
      eventId,
      resourceUrl,
    );

    tasks.set(taskId, {
      taskId,
      contextId,
      eventId,
      status: { state: 'completed' },
      result: content,
    });

    const extraHeaders = settlementHeader ? { 'PAYMENT-RESPONSE': settlementHeader } : {};
    sendJson(res, 200, buildA2ATaskResponse(taskId, contextId, 'completed'), extraHeaders);
    return;
  }

  const { text: content, settlementHeader } = await resolveReportContent(
    config,
    req,
    eventId,
    resourceUrl,
  );

  const extraHeaders = settlementHeader ? { 'PAYMENT-RESPONSE': settlementHeader } : {};
  sendJson(
    res,
    200,
    buildA2AMessageResponse(content, body.message?.contextId),
    extraHeaders,
  );
}

export async function handleGetTask(
  _config: X402ServerConfig,
  res: ServerResponse,
  taskId: string,
): Promise<void> {
  const task = tasks.get(taskId);
  if (!task) {
    sendJson(res, 404, { error: 'Task not found', taskId });
    return;
  }

  sendJson(res, 200, {
    id: task.taskId,
    taskId: task.taskId,
    contextId: task.contextId,
    status: task.status,
    artifacts: task.result
      ? [{ parts: [{ kind: 'text', text: task.result }] }]
      : [],
  });
}

export async function handleListTasks(_config: X402ServerConfig, res: ServerResponse): Promise<void> {
  const list = [...tasks.values()].map((t) => ({
    id: t.taskId,
    taskId: t.taskId,
    contextId: t.contextId,
    status: t.status,
  }));
  sendJson(res, 200, { tasks: list });
}
