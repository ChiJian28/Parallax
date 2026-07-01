import type { IncomingMessage, ServerResponse } from 'node:http';
import { reportStore } from '../../agent/report-store.js';
import type { X402ServerConfig } from '../config.js';
import {
  buildPaymentRequiredPayload,
  buildPaymentResponseHeader,
  encodePaymentRequiredHeader,
} from '../x402/build-payment-required.js';
import { hasPaymentHeader, verifyPayment } from '../x402/verify-payment.js';
import { normalizeHeaders, sendJson } from '../http-utils.js';

function buildResourceUrl(config: X402ServerConfig, eventId: string): string {
  return `${config.publicBaseUrl}/api/report/${eventId}`;
}

function teaserPayload(report: ReturnType<typeof reportStore.get>) {
  return {
    eventId: report!.eventId,
    eventName: report!.eventName,
    teaser: report!.teaser,
    priceMNT: report!.priceMNT,
    x402Required: true,
    payment: {
      network: 'mantle-sepolia',
      chainId: 5003,
      note: 'Pay via x402 (USDC EIP-3009 on Mantle Sepolia) to unlock fullContent.',
    },
  };
}

function fullPayload(report: NonNullable<ReturnType<typeof reportStore.get>>) {
  return {
    eventId: report.eventId,
    eventName: report.eventName,
    timestamp: report.timestamp,
    teaser: report.teaser,
    fullContent: report.fullContent,
    priceMNT: report.priceMNT,
    computedMetrics: {
      ...report.computedMetrics,
      pearsonMacroAave: report.crossEventCorrelation?.pearson_macro_aave ?? null,
      pearsonMacroXstocks:
        report.crossEventCorrelation?.pearson_macro_xstocks ??
        report.computedMetrics.pearsonMacroXstocks,
      pearsonXstocksAave:
        report.crossEventCorrelation?.pearson_xstocks_aave ??
        report.computedMetrics.pearsonXstocksAave,
    },
    eventDelta: report.eventDelta,
    crossEventCorrelation: report.crossEventCorrelation,
    dataSources: report.dataSources,
  };
}

export async function handleGetReport(
  config: X402ServerConfig,
  req: IncomingMessage,
  res: ServerResponse,
  eventId: string,
): Promise<void> {
  const report = reportStore.get(eventId);
  if (!report) {
    sendJson(res, 404, { error: 'Report not found', eventId });
    return;
  }

  const headers = normalizeHeaders(req);
  const resourceUrl = buildResourceUrl(config, eventId);

  if (!hasPaymentHeader(headers)) {
    const paymentRequired = buildPaymentRequiredPayload(config, resourceUrl);
    sendJson(res, 402, teaserPayload(report), {
      'PAYMENT-REQUIRED': encodePaymentRequiredHeader(paymentRequired),
    });
    return;
  }

  const verification = await verifyPayment(config, headers, resourceUrl);
  if (!verification.valid) {
    const paymentRequired = buildPaymentRequiredPayload(config, resourceUrl);
    sendJson(
      res,
      402,
      {
        ...teaserPayload(report),
        paymentError: verification.reason ?? 'Payment verification failed',
      },
      {
        'PAYMENT-REQUIRED': encodePaymentRequiredHeader(paymentRequired),
      },
    );
    return;
  }

  const settlementHeader = buildPaymentResponseHeader({
    success: true,
    transaction: verification.transaction,
    network: config.network,
    payer: verification.payer,
  });

  sendJson(res, 200, {
    ...fullPayload(report),
    x402Settlement: {
      success: true,
      transaction: verification.transaction,
      network: config.network,
      payer: verification.payer,
    },
  }, {
    'PAYMENT-RESPONSE': settlementHeader,
  });
}

export async function handleListReports(_config: X402ServerConfig, res: ServerResponse): Promise<void> {
  const reports = reportStore.list().map((r) => ({
    eventId: r.eventId,
    eventName: r.eventName,
    priceMNT: r.priceMNT,
    timestamp: r.timestamp,
  }));
  sendJson(res, 200, { reports });
}
