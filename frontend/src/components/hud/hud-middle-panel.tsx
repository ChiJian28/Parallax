'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, Loader2, Lock, Sparkles, X, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AlphaValidationNode } from '@/components/hud/alpha-validation-node';
import { TypewriterTeaser } from '@/components/command-center/typewriter-teaser';
import { buildDossierPaywallPreview } from '@/lib/dossier';
import type { MiddlePanelPhase, ResearchDossier, UnlockState, Erc8004Feedback } from '@/components/hud/types';
import type { ReportFull } from '@/lib/api';
import { cn } from '@/lib/utils';

type DossierTabId = 'synthesis' | string;

interface MiddlePanelProps {
  phase: MiddlePanelPhase;
  stagedCount: number;
  dossier: ResearchDossier | null;
  unlockState: UnlockState;
  activeEventLabel: string;
  onInitialize: () => void;
  onUnlock: () => void;
  onCancel?: () => void;
  onFeedbackValidated?: (item: Erc8004Feedback) => void;
}

const fadeTransition = { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const };
const fadeMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: fadeTransition,
};

const tabFade = {
  initial: { opacity: 0, x: 8 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -8 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
};

function MetricsGrid({ metrics }: { metrics: NonNullable<ReportFull['computedMetrics']> }) {
  const items = [
    { label: 'Macro Surprise', value: metrics.macroSurprise?.toFixed(4) ?? 'n/a' },
    {
      label: 'Price Δ %',
      value: `${(metrics.priceDelta ?? 0) > 0 ? '+' : ''}${metrics.priceDelta ?? 0}`,
    },
    { label: 'Volume ×', value: `${metrics.volumeSpike}×` },
    {
      label: 'r(macro,xStocks)',
      value: metrics.pearsonMacroXstocks?.toFixed(3) ?? 'n/a',
    },
    {
      label: 'r(xStocks,aave)',
      value: metrics.pearsonXstocksAave?.toFixed(3) ?? 'n/a',
    },
    {
      label: 'r(macro,aave)',
      value: metrics.pearsonMacroAave?.toFixed(3) ?? 'n/a',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((m) => (
        <div
          key={m.label}
          className="rounded-lg border border-parallax-border bg-[#FAF9F6] px-2 py-1.5"
        >
          <p className="font-mono text-[8px] uppercase text-parallax-fg-muted">{m.label}</p>
          <p className="font-mono text-sm font-semibold text-parallax-accent">{m.value}</p>
        </div>
      ))}
    </div>
  );
}

function ReportMarkdown({ content }: { content: string }) {
  return (
    <article className="prose prose-sm prose-slate max-w-none px-4 py-4 prose-headings:font-semibold prose-headings:text-parallax-fg prose-p:text-parallax-fg-muted prose-strong:text-parallax-fg prose-table:text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </article>
  );
}

export function HudMiddlePanel({
  phase,
  stagedCount,
  dossier,
  unlockState,
  activeEventLabel,
  onInitialize,
  onUnlock,
  onCancel,
  onFeedbackValidated,
}: MiddlePanelProps) {
  const [activeTab, setActiveTab] = useState<DossierTabId>('synthesis');
  const isPaying = unlockState === 'paying';
  const isUnlocked = phase === 'UNLOCKED' && dossier?.unlocked;
  const isMultiEvent = (dossier?.eventCount ?? 0) > 1;
  const soleEvent = dossier?.eventReports[0] ?? null;

  useEffect(() => {
    if (!dossier) return;
    setActiveTab(isMultiEvent ? 'synthesis' : dossier.eventReports[0]?.eventId ?? 'synthesis');
  }, [dossier, isMultiEvent]);

  const paywallPreview = dossier ? buildDossierPaywallPreview(dossier) : '';

  const activeReport: ReportFull | null = !dossier
    ? null
    : isMultiEvent
      ? activeTab === 'synthesis'
        ? dossier.synthesis
        : (dossier.eventReports.find((e) => e.eventId === activeTab)?.report ?? null)
      : (soleEvent?.report ?? null);

  const displayBody =
    isUnlocked && activeReport?.fullContent
      ? activeReport.fullContent
      : activeReport?.fullContent || activeReport?.teaser || paywallPreview;

  const tabs: Array<{ id: DossierTabId; label: string }> = isMultiEvent
    ? [
        { id: 'synthesis', label: '✦ Executive Synthesis' },
        ...dossier!.eventReports.map((e) => ({
          id: e.eventId,
          label: `Event: ${e.eventName}`,
        })),
      ]
    : [];

  const showAlphaValidator =
    isUnlocked && (isMultiEvent ? activeTab === 'synthesis' : true);

  const alphaValidatorKey = isMultiEvent
    ? `${dossier?.batchId ?? 'batch'}:synthesis`
    : `${soleEvent?.eventId ?? 'event'}:report`;

  const alphaValidatorEventId = isMultiEvent
    ? dossier?.eventReports[0]?.eventId ?? dossier?.stagedEvents[0]?.id ?? 'batch'
    : soleEvent?.eventId ?? 'event';

  const showCancel = onCancel != null && !(phase === 'STAGING' && stagedCount === 0);
  const showFloatingCancel =
    showCancel && (phase === 'STAGING' || phase === 'ANALYZING');
  const showHeaderCancel =
    showCancel && (phase === 'PAYWALL_READY' || phase === 'UNLOCKED');

  return (
    <div className="hud-panel relative h-full min-h-0 overflow-hidden">
      {showFloatingCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-3 top-3 z-20 rounded-md border border-parallax-border bg-white/90 p-1.5 text-parallax-fg-muted shadow-sm backdrop-blur-sm transition-colors hover:border-parallax-accent/40 hover:bg-white hover:text-parallax-accent"
          aria-label="Cancel and reset session"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <AnimatePresence mode="wait">
        {phase === 'STAGING' && (
          <motion.div
            key="staging"
            {...fadeMotion}
            className="flex h-full flex-col items-center justify-center px-6 text-center"
          >
            {stagedCount > 0 ? (
              <>
                <motion.button
                  type="button"
                  onClick={onInitialize}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  animate={{
                    boxShadow: [
                      '0 0 24px rgba(217,91,67,0.25)',
                      '0 0 40px rgba(217,91,67,0.45)',
                      '0 0 24px rgba(217,91,67,0.25)',
                    ],
                  }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-8 py-4',
                    'bg-parallax-accent text-base font-semibold text-white',
                    'ring-2 ring-parallax-accent/30',
                  )}
                >
                  <Zap className="h-5 w-5" />
                  Initialize Correlation Engine
                </motion.button>
                <p className="mt-4 max-w-sm text-sm text-parallax-fg-muted">
                  Ready to analyze{' '}
                  <span className="font-semibold text-parallax-fg">{stagedCount}</span> event
                  {stagedCount === 1 ? '' : 's'} across Mantle RWAs.
                </p>
              </>
            ) : (
              <div className="max-w-md space-y-3">
                <div className="mx-auto mb-4 flex h-12 w-12 animate-pulse items-center justify-center rounded-full bg-parallax-accent/10">
                  <Activity className="h-6 w-6 text-parallax-accent" />
                </div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-parallax-accent">
                  Value Delivery Hub
                </p>
                <h2 className="text-lg font-bold text-parallax-fg">Stage macro events to begin</h2>
                <p className="text-sm text-parallax-fg-muted">
                  Use the Discovery Deck on the left to stage signals, then Initialize when your
                  correlation queue is ready.
                </p>
              </div>
            )}
          </motion.div>
        )}

        {phase === 'ANALYZING' && (
          <motion.div
            key="analyzing"
            {...fadeMotion}
            className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center"
          >
            <Loader2 className="h-10 w-10 animate-spin text-parallax-accent-blue" />
            <div>
              <p className="text-base font-semibold text-parallax-fg">
                Querying Historical RPCs &amp; DLMM Bins…
              </p>
              <p className="mt-1 font-mono text-[10px] text-parallax-fg-muted">{activeEventLabel}</p>
            </div>
          </motion.div>
        )}

        {(phase === 'PAYWALL_READY' || phase === 'UNLOCKED') && dossier && (
          <motion.div key="dossier" {...fadeMotion} className="flex h-full min-h-0 flex-col">
            {/* Header + unified teaser */}
            <div className="shrink-0 border-b border-parallax-border px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {!isMultiEvent && (
                    <div className="mb-2 flex h-9 w-9 animate-pulse items-center justify-center rounded-full bg-parallax-accent/10">
                      <Activity className="h-4 w-4 text-parallax-accent" />
                    </div>
                  )}
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-parallax-accent">
                    {isMultiEvent ? 'Research Dossier' : 'Value Delivery Hub'}
                  </p>
                  <h1 className="mt-1 truncate text-lg font-bold tracking-tight text-parallax-fg">
                    {isMultiEvent
                      ? `${dossier.eventCount} Event Batch · Master-Detail`
                      : (soleEvent?.eventName ?? 'Correlation Report')}
                  </h1>
                  <p className="mt-0.5 font-mono text-[10px] text-parallax-fg-muted">
                    {isMultiEvent ? dossier.batchId : soleEvent?.eventId}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isUnlocked && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-full border border-parallax-accent/30 bg-parallax-accent/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-parallax-accent"
                    >
                      {isMultiEvent ? 'Dossier Unlocked' : 'Alpha Unlocked'}
                    </motion.span>
                  )}
                  {showHeaderCancel && (
                    <button
                      type="button"
                      onClick={onCancel}
                      className="rounded-md border border-parallax-border bg-white p-1.5 text-parallax-fg-muted shadow-sm transition-colors hover:border-parallax-accent/40 hover:text-parallax-accent"
                      aria-label="Cancel and reset session"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-3 min-h-[3.5rem] rounded-lg border border-parallax-border bg-[#FAF9F6] px-3 py-2">
                <TypewriterTeaser text={dossier.unifiedTeaser} speedMs={14} />
              </div>
            </div>

            {/* Tab navigation — multi-event unlocked only */}
            {isUnlocked && isMultiEvent && tabs.length > 0 && (
              <div className="shrink-0 border-b border-parallax-border bg-white/60 px-2 py-1.5">
                <div className="flex gap-1 overflow-x-auto scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'shrink-0 rounded-lg px-2.5 py-1.5 font-mono text-[10px] transition-colors',
                        activeTab === tab.id
                          ? 'bg-parallax-accent/10 text-parallax-accent ring-1 ring-parallax-accent/30'
                          : 'text-parallax-fg-muted hover:bg-[#FAF9F6] hover:text-parallax-fg',
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Content area */}
            <div className="relative min-h-0 flex-1">
              <motion.div
                animate={{
                  filter: isUnlocked ? 'blur(0px)' : 'blur(12px)',
                  opacity: isUnlocked ? 1 : 0.5,
                }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="h-full overflow-y-auto scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                <div className="border-b border-parallax-border px-4 py-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-parallax-fg-muted">
                    {isMultiEvent
                      ? activeTab === 'synthesis'
                        ? 'Institutional Correlation Synthesis'
                        : 'Event-Level Correlation Report'
                      : 'Institutional Correlation Report'}
                  </p>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div key={isUnlocked ? activeTab : 'paywall-preview'} {...tabFade}>
                    <ReportMarkdown content={displayBody} />

                    {isUnlocked && activeReport?.computedMetrics && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="border-t border-parallax-border px-4 py-3"
                      >
                        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-parallax-accent">
                          Computed Metrics
                        </p>
                        <MetricsGrid metrics={activeReport.computedMetrics} />
                      </motion.div>
                    )}

                    {showAlphaValidator && (
                      <AlphaValidationNode
                        contextKey={alphaValidatorKey}
                        eventId={alphaValidatorEventId}
                        onValidated={onFeedbackValidated}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </motion.div>

              <AnimatePresence>
                {phase === 'PAYWALL_READY' && (
                  <motion.div
                    key="paywall"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.4 }}
                    className="absolute inset-0 flex items-center justify-center p-4"
                  >
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-white/50 to-white/85" />
                    <motion.button
                      type="button"
                      onClick={onUnlock}
                      disabled={isPaying}
                      whileHover={{ scale: isPaying ? 1 : 1.05 }}
                      whileTap={{ scale: isPaying ? 1 : 0.97 }}
                      animate={
                        isPaying
                          ? undefined
                          : {
                              y: [0, -5, 0],
                              boxShadow: [
                                '0 0 20px rgba(217,91,67,0.3)',
                                '0 0 36px rgba(217,91,67,0.55)',
                                '0 0 20px rgba(217,91,67,0.3)',
                              ],
                            }
                      }
                      transition={
                        isPaying
                          ? undefined
                          : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
                      }
                      className={cn(
                        'relative z-10 flex max-w-md flex-col items-center gap-1 rounded-xl px-6 py-3.5',
                        'bg-parallax-accent text-sm font-semibold text-white shadow-lg',
                        'shadow-parallax-accent/25 ring-2 ring-parallax-accent/25 hover:bg-parallax-accent-alt',
                        'disabled:cursor-wait disabled:opacity-80 disabled:animate-none',
                      )}
                    >
                      {isPaying ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing x402…
                        </span>
                      ) : (
                        <>
                          <span className="flex items-center gap-2">
                            <Lock className="h-4 w-4" />
                            {isMultiEvent ? 'Unlock Full Research Dossier' : 'Unlock Full Alpha'}
                            <Sparkles className="h-4 w-4 opacity-80" />
                          </span>
                          <span className="font-mono text-[11px] font-medium opacity-90">
                            Pay {dossier.priceMNT} $MNT
                          </span>
                        </>
                      )}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
