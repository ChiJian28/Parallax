import type { X402ServerConfig } from '../config.js';
import { sendJson } from '../http-utils.js';
import type { ServerResponse } from 'node:http';

export function handleAgentCard(config: X402ServerConfig, res: ServerResponse): void {
  const base = config.publicBaseUrl.replace(/\/+$/, '');

  sendJson(res, 200, {
    name: 'Parallax',
    description:
      'ERC-8004 macro-to-onchain correlation research agent. Delivers x402-gated correlation reports for Mantle xStocks and InsightX events.',
    url: `${base}/a2a`,
    version: '0.3.0',
    protocolVersion: '0.3.0',
    preferredTransport: 'HTTP+JSON',
    capabilities: {
      streaming: false,
      pushNotifications: false,
    },
    skills: [
      {
        id: 'macro-correlation-report',
        name: 'Macro Correlation Report',
        description: 'Fetch pre/post-event correlation analysis for xStocks and InsightX.',
        tags: ['finance', 'research', 'x402'],
      },
    ],
    supportedInterfaces: [
      {
        url: `${base}/a2a`,
        protocolBinding: 'HTTP+JSON',
        protocolVersion: '0.3.0',
      },
    ],
    additionalInterfaces: [
      {
        url: `${base}/a2a`,
        transport: 'HTTP+JSON',
        protocolVersion: '0.3.0',
      },
    ],
    x402: true,
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain', 'application/json'],
    metadata: {
      agentId: '5003:308',
      project: 'parallax',
      x402: {
        enabled: true,
        priceMNT: config.priceMNT,
        network: config.network,
      },
    },
  });
}
