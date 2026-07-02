'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CheckCircle2, Lock, Sparkles } from 'lucide-react';
import type { ReportFull, ReportTeaser } from '@/lib/api';
import { fetchReportUnlocked } from '@/lib/api';
import { DEV_BYPASS } from '@/lib/config';
import { TypewriterTeaser } from '@/components/command-center/typewriter-teaser';
import { cn } from '@/lib/utils';

interface CorrelationReportPanelProps {
  teaser: ReportTeaser;
  fullReport: ReportFull;
  priceMNT: number;
  reportSource?: 'api' | 'fallback';
  onReportUnlocked?: (report: ReportFull) => void;
}

export function CorrelationReportPanel({
  teaser,
  fullReport,
  priceMNT,
  reportSource = 'fallback',
  onReportUnlocked,
}: CorrelationReportPanelProps) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const handleUnlock = async () => {
    setIsPaying(true);
    setUnlockError(null);

    try {
      if (DEV_BYPASS) {
        const unlocked = await fetchReportUnlocked(teaser.eventId);
        onReportUnlocked?.(unlocked);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1400));
      }
      setIsUnlocked(true);
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : 'Failed to unlock report');
    } finally {
      setIsPaying(false);
    }
  };

  const metrics = fullReport.computedMetrics;
  const cross = fullReport.crossEventCorrelation;
  const xstocksSource = fullReport.eventDelta?.data_quality?.xstocks_source;
  const aaveSource = fullReport.eventDelta?.data_quality?.aave_source;
  const previewContent = teaser.teaser;
  const reportContent =
    isUnlocked && fullReport.fullContent ? fullReport.fullContent : previewContent;

  const pearsonMacroXstocks =
    cross?.pearson_macro_xstocks ?? metrics?.pearsonMacroXstocks ?? null;
  const pearsonMacroAave = cross?.pearson_macro_aave ?? metrics?.pearsonMacroAave ?? null;
  const pearsonXstocksAave =
    cross?.pearson_xstocks_aave ?? metrics?.pearsonXstocksAave ?? null;

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="glass rounded-xl px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-parallax-accent">
            AI Synthesis
          </span>
          {!isUnlocked && (
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="font-mono text-[10px] text-parallax-fg-muted"
            >
              generating…
            </motion.span>
          )}
        </div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-parallax-fg sm:text-2xl">
          {teaser.eventName}
        </h2>
        {reportSource === 'fallback' && (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-amber-400/90">
            Offline preview · unlock requires published backend report
          </p>
        )}
        <div className="mt-3 min-h-[4.5rem]">
          <TypewriterTeaser text={teaser.teaser} />
        </div>
      </div>

      <div className="relative min-h-[32rem] flex-1 overflow-hidden rounded-xl">
        <motion.div
          animate={{
            filter: isUnlocked ? 'blur(0px)' : 'blur(14px)',
            scale: isUnlocked ? 1 : 0.985,
            opacity: isUnlocked ? 1 : 0.55,
          }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          className="glass h-full overflow-auto rounded-xl"
        >
          <div className="border-b border-parallax-border-glass px-6 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-parallax-fg-muted">
              Institutional Correlation Report
            </p>
          </div>

          <article className="prose prose-invert prose-sm max-w-none px-6 py-6 sm:prose-base prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-parallax-fg prose-p:text-parallax-fg-muted prose-strong:text-parallax-fg prose-th:border-parallax-border-glass prose-td:border-parallax-border-glass prose-th:text-parallax-fg prose-td:text-parallax-fg-muted">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{reportContent}</ReactMarkdown>
          </article>

          <AnimatePresence>
            {isUnlocked && metrics && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.5 }}
                className="border-t border-parallax-border-glass px-6 py-5"
              >
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-parallax-accent">
                  Computed Metrics (on-chain)
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: 'Macro Surprise', value: metrics.macroSurprise.toFixed(4) },
                    {
                      label: 'Price Δ (%)',
                      value: `${metrics.priceDelta > 0 ? '+' : ''}${metrics.priceDelta}`,
                    },
                    { label: 'Volume Spike (×)', value: `${metrics.volumeSpike}×` },
                    {
                      label: 'Aave Util Δ (pp)',
                      value: metrics.aaveUtilizationDelta?.toFixed(2) ?? 'n/a',
                    },
                    { label: 'Capital Flow', value: metrics.capitalFlowDirection ?? 'n/a' },
                    {
                      label: 'r(macro, xStocks)',
                      value: pearsonMacroXstocks?.toFixed(3) ?? 'n/a',
                    },
                    {
                      label: 'r(macro, Aave)',
                      value: pearsonMacroAave?.toFixed(3) ?? 'n/a',
                    },
                    {
                      label: 'r(xStocks, Aave)',
                      value: pearsonXstocksAave?.toFixed(3) ?? 'n/a',
                    },
                  ].map((item) => (
                    <div key={item.label} className="glass rounded-lg px-3 py-2.5">
                      <p className="font-mono text-[9px] uppercase tracking-wider text-parallax-fg-muted">
                        {item.label}
                      </p>
                      <p className="mt-1 font-mono text-lg font-semibold text-parallax-accent">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
                {(xstocksSource || aaveSource) && (
                  <p className="mt-3 font-mono text-[10px] text-parallax-fg-muted">
                    xStocks: {xstocksSource ?? 'n/a'} · Aave: {aaveSource ?? 'n/a'}
                    {xstocksSource === 'historical_rpc' && ' · DLMM getActiveId() @ block height'}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <AnimatePresence>
          {!isUnlocked && (
            <motion.div
              key="paywall"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.96, y: -12 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 flex items-center justify-center p-6"
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-parallax-bg/20 via-parallax-bg/60 to-parallax-bg/90" />

              <motion.div
                className={cn(
                  'glass relative z-10 w-full max-w-md rounded-2xl p-6 sm:p-8',
                  'shadow-[0_0_60px_rgba(0,255,204,0.08)]',
                )}
                initial={{ y: 16 }}
                animate={{ y: 0 }}
                exit={{ y: -24, opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-parallax-accent/30 bg-parallax-accent/10">
                  <Lock className="h-5 w-5 text-parallax-accent" />
                </div>

                <h3 className="text-center text-lg font-semibold text-parallax-fg sm:text-xl">
                  Unlock Full Institutional
                  <br />
                  Correlation Report
                </h3>
                <p className="mt-2 text-center text-sm text-parallax-fg-muted">
                  Pre-event baseline, post-event delta, and onchain correlation coefficients —
                  gated via x402 on Mantle Sepolia.
                </p>

                <motion.button
                  type="button"
                  onClick={handleUnlock}
                  disabled={isPaying}
                  whileHover={{ scale: isPaying ? 1 : 1.02 }}
                  whileTap={{ scale: isPaying ? 1 : 0.98 }}
                  className={cn(
                    'mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5',
                    'bg-parallax-accent text-sm font-semibold text-parallax-bg',
                    'shadow-[0_0_32px_rgba(0,255,204,0.35)] transition-shadow',
                    'hover:bg-parallax-accent-alt hover:shadow-[0_0_48px_rgba(0,255,204,0.45)]',
                    'disabled:cursor-wait disabled:opacity-80',
                  )}
                >
                  {isPaying ? (
                    <>
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="inline-block"
                      >
                        <Sparkles className="h-4 w-4" />
                      </motion.span>
                      Processing x402…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Pay {priceMNT} $MNT via x402
                    </>
                  )}
                </motion.button>

                <p className="mt-3 text-center font-mono text-[10px] text-parallax-fg-muted">
                  ERC-8004 agent · Mantle Sepolia · Chain ID 5003
                </p>
                {unlockError && (
                  <p className="mt-2 text-center text-xs text-red-400">{unlockError}</p>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isUnlocked && (
            <motion.div
              key="unlocked-badge"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="absolute right-4 top-4 z-20"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full border border-parallax-accent/40 bg-parallax-accent/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-parallax-accent">
                <CheckCircle2 className="h-3 w-3" />
                Unlocked
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
