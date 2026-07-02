import type { AcquisitionTraceLog, ReportFull, ReportTeaser } from '@/lib/api';

export interface MacroEventItem {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  status: 'live' | 'resolved' | 'upcoming';
  timestamp: string;
  hasReport?: boolean;
}

/** Aligned with backend macro-event-calendar.ts (Q1–Q2 2026) — all 7 events. */
export const MACRO_EVENT_FEED: MacroEventItem[] = [
  {
    id: 'fomc-jan-2026',
    title: 'FOMC Jan 2026',
    subtitle: 'DFF surprise · SPCXx + Aave window',
    category: 'Monetary Policy',
    status: 'resolved',
    timestamp: 'Jan 29 · 14:00 ET',
  },
  {
    id: 'cpi-feb-2026',
    title: 'CPI Feb 2026',
    subtitle: 'CPIAUCSL YoY proxy surprise',
    category: 'Inflation',
    status: 'resolved',
    timestamp: 'Feb 12 · 08:30 ET',
  },
  {
    id: 'cpi-mar-2026',
    title: 'CPI Mar 2026',
    subtitle: 'Hot print · cross-event Pearson',
    category: 'Inflation',
    status: 'resolved',
    timestamp: 'Mar 12 · 08:30 ET',
  },
  {
    id: 'fomc-mar-2026',
    title: 'FOMC Mar 2026',
    subtitle: 'Rate hold · DFF daily delta',
    category: 'Monetary Policy',
    status: 'resolved',
    timestamp: 'Mar 19 · 14:00 ET',
  },
  {
    id: 'cpi-jun-2026',
    title: 'CPI Jun 2026',
    subtitle: 'Post-listing · historical LB price',
    category: 'Inflation',
    status: 'live',
    timestamp: 'Jun 18 · 08:30 ET',
  },
  {
    id: 'crcl-ipo-q2',
    title: 'Circle IPO',
    subtitle: 'CRCL_x catalyst · hardcoded surprise',
    category: 'Equity Catalyst',
    status: 'upcoming',
    timestamp: 'Jun 15 · Q2',
  },
  {
    id: 'spacex-ipo-q1',
    title: 'SpaceX IPO',
    subtitle: 'SPCXx DLMM historical RPC · full report',
    category: 'Equity Catalyst',
    status: 'live',
    timestamp: 'Jun 15 · T-48h',
    hasReport: true,
  },
];

const FALLBACK_TEASERS: Record<string, ReportTeaser> = {
  'fomc-jan-2026': {
    eventId: 'fomc-jan-2026',
    eventName: 'FOMC January 2026',
    teaser:
      'FOMC held rates (DFF surprise = 0). SPCXx LB pool was not yet listed on Mantle — Aave stablecoin utilization provides the only onchain leg for this pre-listing window.',
    priceMNT: 2,
    x402Required: true,
  },
  'cpi-feb-2026': {
    eventId: 'cpi-feb-2026',
    eventName: 'CPI February 2026',
    teaser:
      'CPI YoY surprise −0.15 vs trailing 3-month mean. Aave USDC utilization jumped +33.5 pp in the historical window; xStocks price delta unavailable (pool listed Jun 12).',
    priceMNT: 2,
    x402Required: true,
  },
  'cpi-mar-2026': {
    eventId: 'cpi-mar-2026',
    eventName: 'CPI March 2026',
    teaser:
      'CPI surprise +0.79 (hot). Aave utilization −0.30 pp aggregate; xStocks historical LB read not available for this pre-listing date.',
    priceMNT: 2,
    x402Required: true,
  },
  'fomc-mar-2026': {
    eventId: 'fomc-mar-2026',
    eventName: 'FOMC March 2026',
    teaser:
      'FOMC hold (DFF Δ = 0). Marginal Aave utilization +0.67 pp; SPCXx Merchant Moe pool not deployed at event time.',
    priceMNT: 2,
    x402Required: true,
  },
  'cpi-jun-2026': {
    eventId: 'cpi-jun-2026',
    eventName: 'CPI June 2026',
    teaser:
      'Post-listing CPI window: SPCXx price −8.57% from historical getActiveId() at pre/post blocks. Cross-event Pearson r(macro, xStocks) = −1 with SpaceX IPO leg.',
    priceMNT: 2,
    x402Required: true,
  },
  'crcl-ipo-q2': {
    eventId: 'crcl-ipo-q2',
    eventName: 'Circle IPO Q2',
    teaser:
      'CRCL_x IPO surprise +0.05 (hardcoded). Aave utilization shift measured; SPCXx leg skipped (target token CRCL_x).',
    priceMNT: 2,
    x402Required: true,
  },
  'spacex-ipo-q1': {
    eventId: 'spacex-ipo-q1',
    eventName: 'SpaceX IPO — SPCXx',
    teaser:
      'IPO surprise +0.12. SPCXx/USDT0 price +8.29% via Merchant Moe DLMM active bin ID at historical blocks 96707144→96793544. Volume ratio proxied at 1.6× (|surprise|×5).',
    priceMNT: 2,
    x402Required: true,
  },
};

export function getMockTeaser(eventId: string): ReportTeaser | null {
  return FALLBACK_TEASERS[eventId] ?? null;
}

export function getMockFullReport(eventId: string): ReportFull | null {
  const teaser = FALLBACK_TEASERS[eventId];
  if (!teaser) return null;

  const metricsByEvent: Record<string, NonNullable<ReportFull['computedMetrics']>> = {
    'spacex-ipo-q1': {
      macroSurprise: 0.12,
      priceDelta: 8.29,
      volumeSpike: 1.6,
      aaveUtilizationDelta: -6.78,
      capitalFlowDirection: 'neutral',
      pearsonMacroXstocks: -1,
      pearsonMacroAave: -0.317,
    },
    'cpi-jun-2026': {
      macroSurprise: 1.0002,
      priceDelta: -8.57,
      volumeSpike: 6.0,
      aaveUtilizationDelta: 0.89,
      capitalFlowDirection: 'neutral',
      pearsonMacroXstocks: -1,
      pearsonMacroAave: -0.317,
    },
    'cpi-feb-2026': {
      macroSurprise: -0.1463,
      priceDelta: 0,
      volumeSpike: 1.73,
      aaveUtilizationDelta: 33.49,
      capitalFlowDirection: 'neutral',
      pearsonMacroAave: -0.317,
    },
  };

  const metrics = metricsByEvent[eventId] ?? {
    macroSurprise: 0,
    priceDelta: 0,
    volumeSpike: 1,
    aaveUtilizationDelta: null,
    capitalFlowDirection: 'neutral',
  };

  return {
    ...teaser,
    fullContent: `## ${teaser.eventName}\n\nPreview only — run \`npm run generate-report -- --live\` in backend to publish a Gemini report for this event.\n\n**Current pipeline:** FRED surprise (DFF/CPI) · Merchant Moe historical LB \`getActiveId()\` · Aave V3 historical RPC · cross-event Pearson r.`,
    computedMetrics: metrics,
    eventDelta: {
      data_quality: {
        xstocks_source: eventId === 'spacex-ipo-q1' || eventId === 'cpi-jun-2026' ? 'historical_rpc' : undefined,
        aave_source: 'historical_rpc',
      },
    },
  };
}

import { terminalNowStamp } from '@/lib/terminal-timestamp';

function mockTraceStamp(): string {
  return terminalNowStamp();
}

function surpriseLabelForEvent(eventId: string): { series: string; surprise: string; method: string } {
  if (eventId.includes('fomc')) {
    return { series: 'DFF', surprise: '0', method: 'fred_dff' };
  }
  if (eventId === 'cpi-feb-2026') {
    return { series: 'CPIAUCSL', surprise: '-0.1463', method: 'fred_cpi_yoy' };
  }
  if (eventId === 'cpi-mar-2026') {
    return { series: 'CPIAUCSL', surprise: '0.7931', method: 'fred_cpi_yoy' };
  }
  if (eventId === 'cpi-jun-2026') {
    return { series: 'CPIAUCSL', surprise: '1.0002', method: 'fred_cpi_yoy' };
  }
  if (eventId.includes('cpi')) {
    return { series: 'CPIAUCSL', surprise: '0', method: 'fred_cpi_yoy' };
  }
  if (eventId === 'crcl-ipo-q2') {
    return { series: 'hardcoded', surprise: '0.05', method: 'hardcoded' };
  }
  return { series: 'hardcoded', surprise: '0.12', method: 'hardcoded' };
}

/** Simulated acquisition trace when POST /api/acquisition/run is unreachable. */
export function buildMockAcquisitionTrace(eventIds: string[]): AcquisitionTraceLog[] {
  const ids = eventIds.length > 0 ? eventIds : ['spacex-ipo-q1'];
  const logs: AcquisitionTraceLog[] = [
    {
      timestamp: mockTraceStamp(),
      level: 'warn',
      message: '[offline] backend unreachable — replaying simulated acquisition trace',
      node: 'thinker',
    },
    {
      timestamp: mockTraceStamp(),
      level: 'info',
      message: `> acquisition engine — ${ids.length} event(s) [mock]`,
      node: 'thinker',
    },
  ];

  for (const eventId of ids) {
    const feed = MACRO_EVENT_FEED.find((e) => e.id === eventId);
    const { series, surprise, method } = surpriseLabelForEvent(eventId);
    const type = feed?.category ?? 'Macro';
    const token = eventId.includes('crcl') ? 'CRCL_x' : 'SPCXx';

    logs.push(
      {
        timestamp: mockTraceStamp(),
        level: 'info',
        message: `resolve ${eventId} (${type}) — FRED series ${series} [mock]`,
        node: 'thinker',
      },
      {
        timestamp: mockTraceStamp(),
        level: 'ok',
        message: `${eventId}: surprise=${surprise} (${method}) [mock]`,
        node: 'thinker',
      },
    );

    if (token === 'SPCXx') {
      logs.push(
        {
          timestamp: mockTraceStamp(),
          level: 'rpc',
          message: 'eth_call getActiveId(pool=0xd14B0DcD319551AE4D7B12787c00EE1C1f9E1d2E, block=pre_window) [mock]',
          node: 'worker',
        },
        {
          timestamp: mockTraceStamp(),
          level: 'rpc',
          message: 'eth_call getActiveId(pool=0xd14B0DcD319551AE4D7B12787c00EE1C1f9E1d2E, block=post_window) [mock]',
          node: 'worker',
        },
        {
          timestamp: mockTraceStamp(),
          level: 'ok',
          message: `${eventId}: getActiveId pre_block=96707144→id=8388608 post_block=96793544 price_Δ=8.29% [mock]`,
          node: 'worker',
        },
      );
    } else {
      logs.push({
        timestamp: mockTraceStamp(),
        level: 'info',
        message: `${eventId}: xStocks read skipped (target=${token}) [mock]`,
        node: 'worker',
      });
    }

    logs.push(
      {
        timestamp: mockTraceStamp(),
        level: 'rpc',
        message: 'getReserveData(USDC|USDT0|USDe) @ AaveDataProvider pre/post [mock]',
        node: 'worker',
      },
      {
        timestamp: mockTraceStamp(),
        level: 'ok',
        message: `${eventId}: Aave blocks pre=96702944 post=96789344 avg_util 72.30%→64.10% [mock]`,
        node: 'worker',
      },
    );
  }

  logs.push(
    {
      timestamp: mockTraceStamp(),
      level: 'info',
      message: 'mantle_validateAddress — SPCXx / USDC registry preflight [mock]',
      node: 'worker',
    },
    {
      timestamp: mockTraceStamp(),
      level: 'ok',
      message: 'preflight ok — SPCXx=0x68fa48B1C2FE52b3D776E1953e0E782b5044Ce28 USDC=0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9 [mock]',
      node: 'worker',
    },
  );

  if (ids.length >= 2) {
    logs.push(
      {
        timestamp: mockTraceStamp(),
        level: 'info',
        message: `Pearson r matrix — ${ids.length} events [mock]`,
        node: 'verifier',
      },
      {
        timestamp: mockTraceStamp(),
        level: 'ok',
        message: 'r(macro,xStocks)=-0.317 r(xStocks,aave)=0.412 r(macro,aave)=-0.281 [mock]',
        node: 'verifier',
      },
    );
  } else {
    logs.push({
      timestamp: mockTraceStamp(),
      level: 'info',
      message: 'single-event run — cross-event Pearson skipped (need ≥2) [mock]',
      node: 'verifier',
    });
  }

  logs.push({
    timestamp: mockTraceStamp(),
    level: 'ok',
    message: 'acquisition trace complete [mock]',
    node: 'verifier',
  });

  return logs;
}
