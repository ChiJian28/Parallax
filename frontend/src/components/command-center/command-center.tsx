'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MacroEventFeed } from '@/components/command-center/macro-event-feed';
import { CorrelationReportPanel } from '@/components/command-center/correlation-report-panel';
import {
  MACRO_EVENT_FEED,
  getMockFullReport,
  getMockTeaser,
} from '@/lib/command-center-mocks';
import { fetchReportTeaser, type ReportFull, type ReportTeaser } from '@/lib/api';
import { DEFAULT_EVENT_ID } from '@/lib/config';

function teaserOnlyReport(teaser: ReportTeaser): ReportFull {
  return {
    ...teaser,
    fullContent: '',
  };
}

export function CommandCenter() {
  const [selectedId, setSelectedId] = useState(DEFAULT_EVENT_ID);
  const [teaser, setTeaser] = useState<ReportTeaser | null>(null);
  const [fullReport, setFullReport] = useState<ReportFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportSource, setReportSource] = useState<'api' | 'fallback'>('fallback');

  const loadEvent = useCallback(async (eventId: string) => {
    setLoading(true);
    setReportSource('fallback');

    try {
      const apiTeaser = await fetchReportTeaser(eventId);
      if (apiTeaser?.teaser && !('error' in apiTeaser)) {
        setTeaser(apiTeaser);
        setFullReport(teaserOnlyReport(apiTeaser));
        setReportSource('api');
        return;
      }
    } catch {
      // Fall through to offline preview below.
    }

    const fallbackTeaser = getMockTeaser(eventId);
    const fallbackFull = getMockFullReport(eventId);
    if (fallbackTeaser && fallbackFull) {
      setTeaser(fallbackTeaser);
      setFullReport(fallbackFull);
    } else {
      setTeaser(null);
      setFullReport(null);
    }
  }, []);

  const handleReportUnlocked = useCallback((unlocked: ReportFull) => {
    setFullReport(unlocked);
    setReportSource('api');
  }, []);

  useEffect(() => {
    void loadEvent(selectedId);
  }, [selectedId, loadEvent]);

  const handleSelect = (id: string) => {
    if (id === selectedId) return;
    setSelectedId(id);
  };

  return (
    <div className="space-y-6">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-1"
      >
        <p className="font-mono text-xs uppercase tracking-widest text-parallax-accent">
          Command Center
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-parallax-fg sm:text-3xl">
          Macro-to-Onchain Correlation Terminal
        </h1>
        <p className="text-sm text-parallax-fg-muted">
          FRED macro surprise · Merchant Moe DLMM historical RPC · Aave V3 · cross-event Pearson r
        </p>
      </motion.header>

      <div className="grid gap-5 lg:grid-cols-[minmax(240px,280px)_1fr] lg:gap-6">
        <MacroEventFeed
          events={MACRO_EVENT_FEED}
          selectedId={selectedId}
          onSelect={handleSelect}
        />

        <motion.section
          key={selectedId}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: loading ? 0.6 : 1, x: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-[36rem]"
        >
          {loading ? (
            <div className="glass flex h-full min-h-[24rem] items-center justify-center rounded-xl">
              <p className="font-mono text-sm text-parallax-fg-muted">Loading report…</p>
            </div>
          ) : teaser && fullReport ? (
            <CorrelationReportPanel
              key={selectedId}
              teaser={teaser}
              fullReport={fullReport}
              priceMNT={teaser.priceMNT ?? 2}
              reportSource={reportSource}
              onReportUnlocked={handleReportUnlocked}
            />
          ) : (
            <div className="glass flex h-full min-h-[24rem] items-center justify-center rounded-xl px-6 text-center">
              <p className="font-mono text-sm text-parallax-fg-muted">
                No report for this event yet. Run backend{' '}
                <span className="text-parallax-accent">fetch-data --calendar</span> then{' '}
                <span className="text-parallax-accent">generate-report --live</span>.
              </p>
            </div>
          )}
        </motion.section>
      </div>
    </div>
  );
}
