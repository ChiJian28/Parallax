import type { X402Accept, ResourceInfo } from 'agent0-sdk';
import type { X402ServerConfig } from '../config.js';

export interface PaymentRequiredPayload {
  x402Version: number;
  accepts: X402Accept[];
  error?: string;
  resource?: ResourceInfo;
}

export function buildPaymentAccept(config: X402ServerConfig, resourceUrl: string): X402Accept {
  return {
    scheme: 'exact',
    network: config.network,
    price: config.priceAtomic,
    token: config.tokenAddress,
    destination: config.payTo,
    description: `Parallax macro correlation report (${config.priceMNT} MNT tier)`,
    resource: resourceUrl,
  };
}

export function buildPaymentRequiredPayload(
  config: X402ServerConfig,
  resourceUrl: string,
): PaymentRequiredPayload {
  return {
    x402Version: 2,
    accepts: [buildPaymentAccept(config, resourceUrl)],
    error: `Payment required: ${config.priceMNT} MNT tier — pay via x402 to unlock full analysis.`,
    resource: {
      url: resourceUrl,
      description: 'Parallax macro-to-onchain correlation report',
      mimeType: 'application/json',
    },
  };
}

export function encodePaymentRequiredHeader(payload: PaymentRequiredPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

export function buildPaymentResponseHeader(settlement: {
  success: boolean;
  transaction?: string;
  network?: string;
  payer?: string;
}): string {
  return Buffer.from(JSON.stringify(settlement), 'utf8').toString('base64');
}
