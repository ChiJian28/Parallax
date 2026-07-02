'use client';

import { Card as TremorCard, Title, Text, LineChart } from '@tremor/react';
import type { ReportFull } from '@/lib/api';
import { buildCorrelationSeries } from '@/lib/chart-data';

export function CorrelationChart({ report }: { report: ReportFull }) {
  const data = buildCorrelationSeries(report).map((d) => ({
    time: d.time,
    'InsightX Win Rate %': d.insightXOdds,
    'Fluxion Volume (M USD)': Number((d.volumeUsd * 1.2).toFixed(2)),
    event: d.event ? 'Macro Event' : '',
  }));

  return (
    <TremorCard className="border-0 bg-zinc-50/80 shadow-none ring-0">
      <Title className="text-zinc-900">Macro vs On-chain Correlation</Title>
      <Text className="text-zinc-500">
        Dual-axis view: InsightX collective intelligence vs $SPCXx Fluxion volume. Hover for
        agent-derived signals.
      </Text>
      <LineChart
        className="mt-4 h-72"
        data={data}
        index="time"
        categories={['InsightX Win Rate %', 'Fluxion Volume (M USD)']}
        colors={['teal', 'emerald']}
        valueFormatter={(v) => (v < 10 ? `${v}M` : `${v}%`)}
        showAnimation
        showLegend
        curveType="monotone"
      />
      {report.computedMetrics && (
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          {[
            ['Price Δ', `${report.computedMetrics.priceDelta}%`],
            ['Volume Spike', `${report.computedMetrics.volumeSpike}x`],
            ['InsightX Cal.', report.computedMetrics.insightXAccuracy?.toFixed(3) ?? 'n/a'],
            ['Surprise', String(report.computedMetrics.macroSurprise)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
              <p className="text-xs text-zinc-500">{label}</p>
              <p className="font-semibold text-zinc-900">{value}</p>
            </div>
          ))}
        </div>
      )}
    </TremorCard>
  );
}
