import type { MantleMcpClient } from '../mcp/mantle-client.js';
import { INSIGHTX_DEFAULT_SEARCH, INSIGHTX_MARKETS_QUERY } from './queries/insightx-markets.graphql.js';
import type { InsightXMarketResult } from './types.js';

interface SubgraphResult {
  data: { markets?: unknown[] } | null;
  errors: unknown;
  endpoint: string;
  warnings: string[];
}

/** When true, InsightX is not fetched or written to Module 2 output (implementation kept). */
export function isInsightXOutputSkipped(): boolean {
  return process.env.SKIP_INSIGHTX_OUTPUT === 'true';
}

export function skippedInsightXResult(): InsightXMarketResult {
  return {
    status: 'blocked',
    source_endpoint: null,
    queried_at_utc: new Date().toISOString(),
    markets: null,
    raw_data: null,
    blocked_reason: 'Skipped (SKIP_INSIGHTX_OUTPUT=true)',
    skipped: true,
    warnings: ['InsightX collection skipped by configuration.'],
  };
}

/**
 * Fetch InsightX prediction market odds via mantle_querySubgraph.
 */
export async function fetchInsightXMarkets(
  mcp: MantleMcpClient,
  options: {
    endpoint?: string;
    search?: string;
    first?: number;
    force?: boolean;
  } = {},
): Promise<InsightXMarketResult> {
  if (!options.force && isInsightXOutputSkipped()) {
    return skippedInsightXResult();
  }

  const endpoint = options.endpoint ?? process.env.INSIGHTX_SUBGRAPH_ENDPOINT;
  const search = options.search ?? process.env.INSIGHTX_MARKET_SEARCH ?? INSIGHTX_DEFAULT_SEARCH;
  const first = options.first ?? 10;

  if (!endpoint) {
    return {
      status: 'blocked',
      source_endpoint: null,
      queried_at_utc: new Date().toISOString(),
      markets: null,
      raw_data: null,
      blocked_reason:
        'INSIGHTX_SUBGRAPH_ENDPOINT not configured. Provide the InsightX GraphQL subgraph URL.',
      warnings: ['No subgraph query executed.'],
    };
  }

  try {
    const result = (await mcp.querySubgraph(endpoint, INSIGHTX_MARKETS_QUERY, {
      search,
      first,
    })) as SubgraphResult;

    const markets = result.data?.markets ?? [];

    return {
      status: 'ok',
      source_endpoint: endpoint,
      queried_at_utc: new Date().toISOString(),
      markets: Array.isArray(markets) ? markets : [],
      raw_data: result.data,
      warnings: result.warnings ?? [],
    };
  } catch (error) {
    return {
      status: 'blocked',
      source_endpoint: endpoint,
      queried_at_utc: new Date().toISOString(),
      markets: null,
      raw_data: null,
      blocked_reason: error instanceof Error ? error.message : String(error),
      warnings: ['Subgraph query failed. Verify endpoint URL and schema.'],
    };
  }
}
