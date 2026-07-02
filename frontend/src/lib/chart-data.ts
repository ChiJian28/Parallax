import type { ReportFull } from '@/lib/api';

export interface ChartPoint {
  time: string;
  insightXOdds: number;
  volumeUsd: number;
  event?: boolean;
}

/** Build chart series from report metrics (demo / mock windows). */
export function buildCorrelationSeries(report?: ReportFull | null): ChartPoint[] {
  const m = report?.computedMetrics;
  const baseOdds = m?.insightXAccuracy != null ? Math.round(m.insightXAccuracy * 100) : 35;
  const spike = m?.volumeSpike ?? 2;

  return [
    { time: 'T-48h', insightXOdds: baseOdds - 8, volumeUsd: 0.4 },
    { time: 'T-36h', insightXOdds: baseOdds - 5, volumeUsd: 0.5 },
    { time: 'T-24h', insightXOdds: baseOdds - 3, volumeUsd: 0.7 },
    { time: 'T-12h', insightXOdds: baseOdds - 1, volumeUsd: 0.9 },
    { time: 'T-6h', insightXOdds: baseOdds, volumeUsd: 1.0 },
    { time: 'Event', insightXOdds: baseOdds + 12, volumeUsd: spike * 0.6, event: true },
    { time: 'T+12h', insightXOdds: baseOdds + 18, volumeUsd: spike * 0.85 },
    { time: 'T+24h', insightXOdds: baseOdds + 22, volumeUsd: spike },
    { time: 'T+48h', insightXOdds: baseOdds + 15, volumeUsd: spike * 0.75 },
  ];
}
