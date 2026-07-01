import { mantleMcp } from '../mcp/mantle-client.js';
import { fetchMerchantMoeSpcxxSnapshot } from '../data/merchant-moe-spcxx.js';
import { runPreflight } from '../data/preflight.js';
import { SPCXX_POOL_VOLUME_48H_SQL } from '../data/queries/spcxx-volume.sql.js';
import { fetchInsightXMarkets } from '../data/insightx.js';
import { buildMockPostEvent } from './mock-data.js';
import type { BaselineData, EventWindows, PostEventData } from './types.js';

interface SqlResult {
  rows: Array<Record<string, unknown>>;
  warnings?: string[];
}

function pickResolution(markets: unknown[] | null | undefined): {
  resolved: boolean;
  label: string | null;
} {
  if (!markets?.length) return { resolved: false, label: null };

  const market = markets[0] as {
    resolved?: boolean;
    status?: string;
    outcomes?: Array<{ label?: string; probability?: number }>;
  };

  if (market.resolved === true || market.status === 'resolved') {
    const winner = market.outcomes?.find((o) => (o.probability ?? 0) >= 0.99);
    return { resolved: true, label: winner?.label ?? 'Resolved' };
  }

  return { resolved: false, label: null };
}

/**
 * Step 3 — Post-event Reaction Measurer
 * Merchant Moe RPC for post-event spot + volume; InsightX for resolution.
 */
export async function measurePostEventReaction(
  baseline: BaselineData,
  windows: EventWindows,
  options: {
    useMockData: boolean;
    sqlEndpoint?: string;
    insightxEndpoint?: string;
    insightxSearch?: string;
    network?: 'mainnet' | 'sepolia';
  },
): Promise<PostEventData> {
  if (options.useMockData) {
    return buildMockPostEvent(windows.postWindow, baseline.preAvgDailyVolumeUsd);
  }

  const warnings: string[] = [];
  const network = options.network ?? 'mainnet';
  const preflight = await runPreflight(mantleMcp, network);

  let postTwapUsd = 0;
  let postVolumeUsd = 0;

  const moe = await fetchMerchantMoeSpcxxSnapshot(mantleMcp, {
    network,
    spcxxAddress: preflight.addresses.spcxx.address,
  });

  if (moe) {
    postTwapUsd = moe.spot_price_usdt0;
    postVolumeUsd = moe.volume_24h_usd ?? 0;
    warnings.push(...moe.warnings);
  } else {
    warnings.push('Merchant Moe SPCXx/USDT0 pool not found for post-event read.');
  }

  const sqlEndpoint = options.sqlEndpoint ?? process.env.MANTLE_SQL_INDEXER_ENDPOINT;
  if (sqlEndpoint && moe) {
    try {
      const sqlResult = (await mantleMcp.queryIndexerSql(sqlEndpoint, SPCXX_POOL_VOLUME_48H_SQL, {
        pool_address: moe.pool_address,
        window_start_utc: windows.postWindow.start_utc,
        window_end_utc: windows.postWindow.end_utc,
      })) as SqlResult;

      const row = sqlResult.rows[0];
      const volume = row?.volume_48h_usd;
      if (volume != null) {
        postVolumeUsd = typeof volume === 'number' ? volume : Number(volume);
      }

      const twap = row?.twap_usd;
      if (twap != null) {
        postTwapUsd = typeof twap === 'number' ? twap : Number(twap);
      }

      warnings.push(...(sqlResult.warnings ?? []));
    } catch (error) {
      warnings.push(
        `Post-window SQL failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const insightx = await fetchInsightXMarkets(mantleMcp, {
    endpoint: options.insightxEndpoint,
    search: options.insightxSearch,
  });

  const { resolved, label } = pickResolution(insightx.markets);
  if (insightx.status === 'blocked') {
    warnings.push(insightx.blocked_reason ?? 'InsightX subgraph blocked.');
  }

  return {
    postTwapUsd,
    postVolumeUsd,
    preAvgVolumeUsd: baseline.preAvgDailyVolumeUsd,
    priceDeltaUsd: postTwapUsd - baseline.preTwapUsd,
    insightXResolution: resolved,
    insightXResolvedLabel: label,
    window: windows.postWindow,
    source: 'live',
    warnings,
  };
}
