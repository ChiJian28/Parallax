import type { X402ServerConfig } from '../config.js';
import { buildPaymentAccept } from './build-payment-required.js';

export interface PaymentVerificationResult {
  valid: boolean;
  payer?: string;
  transaction?: string;
  source: 'facilitator' | 'dev-bypass' | 'rejected';
  reason?: string;
}

function extractPaymentHeader(headers: Record<string, string | string[] | undefined>): string | null {
  const candidates = [
    'payment-signature',
    'x-payment',
    'authorization',
  ];

  for (const key of candidates) {
    const raw = headers[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!value) continue;

    if (key === 'authorization' && value.toLowerCase().startsWith('x402 ')) {
      return value.slice(5).trim();
    }
    return value;
  }

  return null;
}

async function verifyWithFacilitator(
  config: X402ServerConfig,
  paymentHeader: string,
  resourceUrl: string,
): Promise<PaymentVerificationResult> {
  if (!config.facilitatorApiKey) {
    return { valid: false, source: 'rejected', reason: 'FACILITATOR_API_KEY not configured' };
  }

  const paymentRequirements = buildPaymentAccept(config, resourceUrl);
  const body = {
    x402Version: 2,
    paymentHeader,
    paymentRequirements,
  };

  const response = await fetch(`${config.facilitatorUrl}/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.facilitatorApiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      valid: false,
      source: 'rejected',
      reason: `Facilitator verify HTTP ${response.status}: ${text}`,
    };
  }

  const result = (await response.json()) as {
    isValid?: boolean;
    valid?: boolean;
    payer?: string;
    transaction?: string;
  };

  const valid = result.isValid === true || result.valid === true;
  return {
    valid,
    payer: result.payer,
    transaction: result.transaction,
    source: 'facilitator',
    reason: valid ? undefined : 'Facilitator rejected payment',
  };
}

async function settleWithFacilitator(
  config: X402ServerConfig,
  paymentHeader: string,
  resourceUrl: string,
): Promise<{ transaction?: string; payer?: string } | null> {
  if (!config.facilitatorApiKey) return null;

  const paymentRequirements = buildPaymentAccept(config, resourceUrl);
  const response = await fetch(`${config.facilitatorUrl}/settle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.facilitatorApiKey}`,
    },
    body: JSON.stringify({
      x402Version: 2,
      paymentHeader,
      paymentRequirements,
    }),
  });

  if (!response.ok) return null;

  const result = (await response.json()) as { transaction?: string; payer?: string };
  return result;
}

/**
 * Verify x402 payment header (QuestFlow facilitator) or dev bypass for local testing.
 */
export async function verifyPayment(
  config: X402ServerConfig,
  headers: Record<string, string | string[] | undefined>,
  resourceUrl: string,
): Promise<PaymentVerificationResult> {
  const paymentHeader = extractPaymentHeader(headers);
  if (!paymentHeader) {
    return { valid: false, source: 'rejected', reason: 'No payment header present' };
  }

  if (config.devBypass) {
    return {
      valid: true,
      source: 'dev-bypass',
      payer: 'dev-bypass',
    };
  }

  const verified = await verifyWithFacilitator(config, paymentHeader, resourceUrl);
  if (!verified.valid) {
    return verified;
  }

  const settled = await settleWithFacilitator(config, paymentHeader, resourceUrl);
  return {
    valid: true,
    source: 'facilitator',
    payer: settled?.payer ?? verified.payer,
    transaction: settled?.transaction ?? verified.transaction,
  };
}

export function hasPaymentHeader(headers: Record<string, string | string[] | undefined>): boolean {
  return extractPaymentHeader(headers) !== null;
}
