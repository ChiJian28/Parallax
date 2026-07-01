import { mantleMcp } from '../mcp/mantle-client.js';
import { fetchMerchantMoeSpcxxSnapshot } from '../data/merchant-moe-spcxx.js';
import { runPreflight } from '../data/preflight.js';
import { SPCXX_POOL_VOLUME_48H_SQL } from '../data/queries/spcxx-volume.sql.js';
import { fetchInsightXMarkets } from '../data/insightx.js';
import { buildMockBaseline } from './mock-data.js';
import type { BaselineData, EventWindows, MacroEvent } from './types.js';

interface SqlResult {
  rows: Array<Record<string, unknown>>;
  warnings?: string[];
}

function pickInsightXOdds(markets: unknown[] | null | undefined): {
  odds: number | null;
  question: string | null;
} {
  if (!markets?.length) return { odds: null, question: null };

  const market = markets[0] as {
    question?: string;
    title?: string;
    outcomes?: Array<{ label?: string; probability?: number; price?: number }>;
  };

  const outcomes = market.outcomes ?? [];
  const yesOutcome =
    outcomes.find((o) => /yes|ipo|announce/i.test(o.label ?? '')) ?? outcomes[0];

  const raw = yesOutcome?.probability ?? yesOutcome?.price;
  const odds = typeof raw === 'number' ? raw : raw != null ? Number(raw) : null;

  return {
    odds: odds != null && !Number.isNaN(odds) ? odds : null,
    question: market.question ?? market.title ?? null,
  };
}

/**
 * Step 2 — Baseline Extractor
 * Merchant Moe RPC for SPCXx/USDT0 spot + volume; InsightX for pre-event odds.
 */
export async function extractBaseline(
  event: MacroEvent,
  windows: EventWindows,
  options: {
    useMockData: boolean;
    sqlEndpoint?: string;
    insightxEndpoint?: string;
    insightxSearch?: string;
    network?: 'mainnet' | 'sepolia';
  },
): Promise<BaselineData> {
  if (options.useMockData) {
    return buildMockBaseline(windows.preWindow);
  }

  const warnings: string[] = [];
  const network = options.network ?? 'mainnet';
  const preflight = await runPreflight(mantleMcp, network);
  const tokenAddress = preflight.addresses.spcxx.address;

  let preTwapUsd = 0;
  let preAvgDailyVolumeUsd = 0;

  const moe = await fetchMerchantMoeSpcxxSnapshot(mantleMcp, {
    network,
    spcxxAddress: tokenAddress,
  });

  if (moe) {
    preTwapUsd = moe.spot_price_usdt0;
    preAvgDailyVolumeUsd = moe.volume_24h_usd ?? 0;
    warnings.push(...moe.warnings);
  } else {
    warnings.push('Merchant Moe SPCXx/USDT0 pool not found for baseline.');
  }

  const sqlEndpoint = options.sqlEndpoint ?? process.env.MANTLE_SQL_INDEXER_ENDPOINT;
  if (sqlEndpoint && moe) {
    try {
      const sqlResult = (await mantleMcp.queryIndexerSql(sqlEndpoint, SPCXX_POOL_VOLUME_48H_SQL, {
        pool_address: moe.pool_address,
        window_start_utc: windows.preWindow.start_utc,
        window_end_utc: windows.preWindow.end_utc,
      })) as SqlResult;

      const row = sqlResult.rows[0];
      const volume = row?.volume_48h_usd;
      if (volume != null) {
        preAvgDailyVolumeUsd =
          typeof volume === 'number' ? volume / 2 : Number(volume) / 2;
      }

      const twap = row?.twap_usd;
      if (twap != null) {
        preTwapUsd = typeof twap === 'number' ? twap : Number(twap);
      }

      warnings.push(...(sqlResult.warnings ?? []));
    } catch (error) {
      warnings.push(
        `Pre-window SQL failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const insightx = await fetchInsightXMarkets(mantleMcp, {
    endpoint: options.insightxEndpoint,
    search: options.insightxSearch,
  });

  const { odds, question } = pickInsightXOdds(insightx.markets);
  if (insightx.status === 'blocked') {
    warnings.push(insightx.blocked_reason ?? 'InsightX subgraph blocked.');
  }

  return {
    tokenAddress,
    tokenSymbol: event.targetToken,
    preTwapUsd,
    preAvgDailyVolumeUsd,
    preInsightXOdds: odds ?? 0,
    insightXMarketQuestion: question,
    window: windows.preWindow,
    source: 'live',
    warnings,
  };
}
