import type { IncomingMessage, ServerResponse } from 'node:http';

export function readJsonBody<T = unknown>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text.trim()) {
        resolve({} as T);
        return;
      }
      try {
        resolve(JSON.parse(text) as T);
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'PAYMENT-REQUIRED, PAYMENT-RESPONSE, payment-required, payment-response',
    ...extraHeaders,
  });
  res.end(payload);
}

export function normalizeHeaders(req: IncomingMessage): Record<string, string | string[] | undefined> {
  return req.headers as Record<string, string | string[] | undefined>;
}

export function extractMessageText(body: {
  message?: { parts?: Array<{ text?: string; kind?: string }>; content?: string };
  params?: { message?: { parts?: Array<{ text?: string }> } };
}): string {
  const message = body.message ?? body.params?.message;
  if (!message) return '';

  if (typeof message.content === 'string') return message.content;

  const parts = message.parts ?? [];
  const textPart = parts.find((p) => p.text);
  return textPart?.text ?? '';
}

export function extractEventIdFromText(text: string): string | null {
  const explicit = text.match(/event[_\s-]?id[:\s]+([a-z0-9-]+)/i);
  if (explicit?.[1]) return explicit[1].toLowerCase();

  if (/spacex|spcxx|spacex-ipo/i.test(text)) return 'spacex-ipo-q1';
  return null;
}
