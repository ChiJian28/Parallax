'use client';

import Link from 'next/link';
import { AreaChart, BarChart, Card as TremorCard, Title, Text } from '@tremor/react';
import { AnimatedBorderCard, FadeIn } from '@/components/motion/animated-border';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MACRO_EVENTS } from '@/lib/config';
import { buildCorrelationSeries } from '@/lib/chart-data';
import type { ReputationSummary } from '@/lib/api';

function valueFormatter(n: number) {
  return `${n}%`;
}

export function DashboardBento({ reputation }: { reputation: ReputationSummary | null }) {
  const previewData = buildCorrelationSeries().map((d) => ({
    time: d.time,
    'InsightX Odds': d.insightXOdds,
    'SPCXx Volume': Math.round(d.volumeUsd * 1_200_000),
  }));

  return (
    <div className="grid gap-4 md:grid-cols-12">
      <FadeIn className="md:col-span-7">
        <AnimatedBorderCard pulse>
          <Card className="border-0 shadow-none">
            <CardHeader>
              <CardTitle>Macro Event Stream</CardTitle>
              <CardDescription>Live correlation triggers across Mantle xStocks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {MACRO_EVENTS.map((event) => (
                <Link
                  key={event.id}
                  href={event.id === 'spacex-ipo-q1' ? '/report/spacex-ipo-q1' : '#'}
                  className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50/50 px-4 py-3 transition hover:border-mantle-mint/40 hover:bg-white"
                >
                  <div>
                    <p className="font-medium text-zinc-900">{event.title}</p>
                    <p className="text-sm text-zinc-500">{event.subtitle}</p>
                  </div>
                  {event.live ? <Badge variant="mint">Live</Badge> : <Badge variant="outline">Soon</Badge>}
                </Link>
              ))}
            </CardContent>
          </Card>
        </AnimatedBorderCard>
      </FadeIn>

      <FadeIn delay={0.1} className="md:col-span-5">
        <Card>
          <CardHeader>
            <CardTitle>Agent Reputation</CardTitle>
            <CardDescription>ERC-8004 on Mantle Sepolia</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-6">
              <div>
                <p className="text-4xl font-bold text-zinc-900">
                  {reputation?.averageValue ? reputation.averageValue.toFixed(1) : '—'}
                </p>
                <p className="text-sm text-zinc-500">Avg accuracy score</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-zinc-700">{reputation?.count ?? 0}</p>
                <p className="text-sm text-zinc-500">On-chain ratings</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.15} className="md:col-span-12">
        <TremorCard className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <Title className="text-zinc-900">SPCXx Volume vs InsightX Probability</Title>
          <Text className="text-zinc-500">Pre / post macro event — Fluxion on Mantle</Text>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <BarChart
              className="h-56"
              data={previewData}
              index="time"
              categories={['SPCXx Volume']}
              colors={['emerald']}
              valueFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`}
              showAnimation
            />
            <AreaChart
              className="h-56"
              data={previewData}
              index="time"
              categories={['InsightX Odds']}
              colors={['teal']}
              valueFormatter={valueFormatter}
              showAnimation
            />
          </div>
        </TremorCard>
      </FadeIn>
    </div>
  );
}
