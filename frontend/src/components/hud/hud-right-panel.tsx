'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MacroVerdict } from '@/components/hud/erc8004-data';
import type { Erc8004Feedback, ReputationCurvePoint, TraceLogLine } from '@/components/hud/types';
import type { ReputationSummary } from '@/lib/api';
import { explorerTxUrl, PARALLAX_AGENT_EXPLORER_LINKS } from '@/lib/explorer';
import { terminalNowStamp } from '@/lib/terminal-timestamp';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

interface RightPanelProps {
  traceLogs: TraceLogLine[];
  isExecuting: boolean;
  reputation?: ReputationSummary | null;
  reputationLoading?: boolean;
  reputationCurve?: ReputationCurvePoint[];
  feedbackItems?: Erc8004Feedback[];
  agentDisplayId?: string;
}

type FeedItem = Erc8004Feedback & { feedId: string };

const VERDICT_COLORS: Record<MacroVerdict, string> = {
  UP: 'text-[#059669]',
  DOWN: 'text-[#D95B43]',
  HOLD: 'text-[#2563EB]',
};

const INK_BASE = 'text-[#4A3F35]';
const INK_PROMPT = 'text-[#D95B43]';
const INK_HIGHLIGHT = 'text-[#2563EB]';
const INK_SUCCESS = 'text-[#5F7161]';
const INK_MUTED = 'text-[#8C7B6A]';
const INK_WARN = 'text-[#B45309]';

const STAMP_MOTION = {
  initial: { opacity: 0, y: 3, filter: 'blur(1px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { duration: 0.14, ease: [0.22, 1, 0.36, 1] as const },
};

const INDICATOR_SPRING = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 22,
  mass: 0.85,
};

const HIGHLIGHT_REGEX =
  /(0x[a-fA-F0-9]+|\b(?:eth_call|getReserveData|getActiveId|Pearson r|r\(macro[^\)]*\)|block=\d+|pre_block=\d+|post_block=\d+|-?\d+\.?\d*%|-?\d+\.?\d×|-?\d+\.?\d pp)\b)/g;

const MAX_FEED_ITEMS = 10;

function toFeedItems(items: Erc8004Feedback[]): FeedItem[] {
  return items.slice(0, MAX_FEED_ITEMS).map((item, index) => ({
    ...item,
    feedId: `fb-${item.txHash}-${index}-${item.reviewer}`,
  }));
}

function verdictFromReputation(avg: number | undefined): MacroVerdict {
  if (avg == null || Number.isNaN(avg) || avg === 0) return 'HOLD';
  if (avg >= 80) return 'UP';
  if (avg < 60) return 'DOWN';
  return 'HOLD';
}

function formatReputationScore(avg: number | undefined): string {
  if (avg == null || Number.isNaN(avg) || avg === 0) return '—';
  return `${avg.toFixed(1)}%`;
}

function normalizeCurve(points: ReputationCurvePoint[], averageValue?: number): ReputationCurvePoint[] {
  if (points.length >= 2) return points;
  if (averageValue && averageValue > 0) {
    return [
      { label: 'Start', score: Math.max(averageValue - 8, 0) },
      { label: 'Now', score: averageValue },
    ];
  }
  return points;
}

function buildSparklinePath(
  points: ReputationCurvePoint[],
  width: number,
  height: number,
  padding = 4,
): string {
  if (points.length < 2) return '';

  const scores = points.map((p) => p.score);
  const min = Math.min(...scores) - 2;
  const max = Math.max(...scores) + 2;
  const range = max - min || 1;

  const coords = points.map((point, index) => {
    const x = padding + (index / (points.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (point.score - min) / range) * (height - padding * 2);
    return { x, y };
  });

  let path = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const cpx = (prev.x + curr.x) / 2;
    path += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return path;
}

function SolidVerdictIcon({ verdict, className }: { verdict: MacroVerdict; className?: string }) {
  const iconClass = cn('h-8 w-8 shrink-0', className);

  if (verdict === 'HOLD') {
    return (
      <svg viewBox="0 0 40 40" className={iconClass} aria-hidden>
        <rect x="6" y="17" width="28" height="6" rx="1.5" fill="currentColor" />
      </svg>
    );
  }

  const points = verdict === 'UP' ? '20,6 36,34 4,34' : '20,34 36,6 4,6';

  return (
    <svg viewBox="0 0 40 40" className={iconClass} aria-hidden>
      <polygon points={points} fill="currentColor" />
    </svg>
  );
}

function MacroSentimentIndicator({ verdict, score }: { verdict: MacroVerdict; score: string }) {
  const accent = VERDICT_COLORS[verdict];

  return (
    <div className="h-16 w-full overflow-hidden">
      <motion.div
        key={`${verdict}-${score}`}
        initial={{ scale: 0.88, opacity: 0.4, y: 4 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={INDICATOR_SPRING}
        className="grid h-full w-full grid-cols-[2.25rem_7.5rem_auto] items-center gap-x-4"
      >
        <SolidVerdictIcon verdict={verdict} className={accent} />
        <span
          className={cn(
            'block text-4xl font-extrabold uppercase leading-none tracking-tighter',
            accent,
          )}
        >
          {verdict}
        </span>
        <div className="flex min-w-[5.5rem] flex-col justify-center">
          <span className="whitespace-nowrap font-mono text-xl font-bold leading-none text-[#1C1917]">
            {score}
          </span>
          <span className="mt-0.5 whitespace-nowrap font-mono text-[9px] uppercase tracking-widest text-[#9CA3AF]">
            Avg Accuracy
          </span>
        </div>
      </motion.div>
    </div>
  );
}

function ReputationSparkline({ points }: { points: ReputationCurvePoint[] }) {
  const gradientId = useId();
  const width = 280;
  const height = 80;
  const linePath = useMemo(() => buildSparklinePath(points, width, height), [points]);
  const areaPath = linePath
    ? `${linePath} L ${width - 4} ${height} L 4 ${height} Z`
    : '';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <p className="mb-1 shrink-0 font-mono text-[8px] uppercase tracking-wider text-parallax-fg-muted">
        Reputation Curve · On-chain feedback history
      </p>
      {linePath ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="block h-full w-full"
            preserveAspectRatio="none"
            aria-hidden
          >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
            </linearGradient>
          </defs>
          {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
          <path
            d={linePath}
            fill="none"
            stroke="#2563EB"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx={width - 4}
            cy={
              4 +
              (1 -
                (points[points.length - 1].score -
                  (Math.min(...points.map((p) => p.score)) - 2)) /
                  (Math.max(...points.map((p) => p.score)) + 2 -
                    (Math.min(...points.map((p) => p.score)) - 2) || 1)) *
                (height - 8)
            }
            r="3.5"
            fill="#2563EB"
          />
        </svg>
        </div>
      ) : (
        <p className="font-mono text-[9px] text-parallax-fg-muted">No on-chain calibrations yet.</p>
      )}
    </div>
  );
}

function AgentExplorerLinks() {
  const links = [
    { label: 'Register tx', href: PARALLAX_AGENT_EXPLORER_LINKS.registrationTx },
    { label: 'Reputation registry', href: PARALLAX_AGENT_EXPLORER_LINKS.reputationRegistry },
  ];

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 rounded border border-parallax-border bg-[#FAF9F6] px-1.5 py-0.5 font-mono text-[7px] text-[#2563EB] transition-colors hover:border-parallax-accent/40 hover:text-parallax-accent"
          title={`View on MantleScan — ${link.label}`}
        >
          {link.label}
          <ExternalLink className="h-2 w-2 shrink-0" aria-hidden />
        </a>
      ))}
    </div>
  );
}

function FeedbackCard({ item }: { item: FeedItem }) {
  const isPerfect = item.score === item.maxScore;
  const isPending = item.indexStatus === 'pending';
  const isVerified = item.indexStatus === 'verified';
  const txUrl = explorerTxUrl(item.txHash, item.fullTxHash);

  return (
    <article
      className={cn(
        'rounded-lg border bg-[#FAF9F6] px-2.5 py-2',
        isPending ? 'border-amber-200/80' : 'border-parallax-border',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'shrink-0 font-mono text-xs font-bold',
            isPerfect ? 'text-[#D95B43]' : 'text-parallax-fg',
          )}
        >
          {item.score}/{item.maxScore}
        </span>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          {isPending && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-[8px] text-amber-700">
              Pending Indexing ⏳
            </span>
          )}
          {isVerified && (
            <span className="rounded-full border border-[#059669]/25 bg-[#059669]/10 px-1.5 py-0.5 font-mono text-[8px] text-[#059669]">
              Verified ✓
            </span>
          )}
          <span className="rounded-full bg-parallax-accent-blue/10 px-1.5 py-0.5 font-mono text-[8px] text-parallax-accent-blue">
            #{item.tag}
          </span>
        </div>
      </div>
      <p className="mt-1.5 text-[10px] leading-snug text-parallax-fg">{item.comment}</p>
      <div className="mt-1.5 space-y-0.5 font-mono text-[8px] text-parallax-fg-muted">
        <p>Reviewer: {item.reviewer}</p>
        <p className="flex flex-wrap items-center gap-1">
          <span>Tx:</span>
          {txUrl ? (
            <a
              href={txUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[#2563EB] transition-colors hover:text-parallax-accent hover:underline"
              title="View giveFeedback on MantleScan"
            >
              {item.txHash}
              <ExternalLink className="h-2.5 w-2.5 shrink-0" aria-hidden />
            </a>
          ) : (
            <span>{item.txHash}</span>
          )}
        </p>
      </div>
    </article>
  );
}

function renderInkBody(text: string, level: TraceLogLine['level']) {
  if (level === 'ok') {
    return <span className={INK_SUCCESS}>{highlightValues(text, INK_SUCCESS)}</span>;
  }
  if (level === 'warn') {
    return <span className={INK_WARN}>{highlightValues(text, INK_WARN)}</span>;
  }
  return <span className={INK_BASE}>{highlightValues(text, INK_HIGHLIGHT)}</span>;
}

function highlightValues(text: string, fallbackClass: string) {
  const parts = text.split(HIGHLIGHT_REGEX);
  return parts.map((part, index) => {
    if (!part) return null;
    const isHighlight = index % 2 === 1;
    if (!isHighlight) return <span key={`${part}-${index}`}>{part}</span>;
    return (
      <span
        key={`${part}-${index}`}
        className={fallbackClass === INK_SUCCESS ? INK_SUCCESS : INK_HIGHLIGHT}
      >
        {part}
      </span>
    );
  });
}

function InkLogMessage({ message, level }: { message: string; level: TraceLogLine['level'] }) {
  const prefixMatch = message.match(/^((?:[>$]\s*)|\[[^\]]+\]\s*)/);

  if (prefixMatch) {
    const prefix = prefixMatch[1];
    const rest = message.slice(prefix.length);
    return (
      <>
        <span className={cn('font-semibold', INK_PROMPT)}>{prefix}</span>
        {renderInkBody(rest, level)}
      </>
    );
  }

  return renderInkBody(message, level);
}

function StreamingTraceTerminal({
  logs,
  isExecuting,
}: {
  logs: TraceLogLine[];
  isExecuting: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [cursorStamp, setCursorStamp] = useState(() => terminalNowStamp());

  useEffect(() => {
    if (!isExecuting) return;
    setCursorStamp(terminalNowStamp());
    const timer = setInterval(() => setCursorStamp(terminalNowStamp()), 1000);
    return () => clearInterval(timer);
  }, [isExecuting]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isExecuting, cursorStamp]);

  return (
    <div className="terminal-sepia flex min-h-0 flex-1 flex-col overflow-hidden rounded-md">
      <div
        ref={scrollRef}
        className="terminal-sepia-scroll min-h-0 flex-1 overflow-y-auto px-3 py-2.5 font-mono text-xs leading-relaxed"
      >
        {logs.length === 0 ? (
          <p className={INK_MUTED}>
            <span className={cn('font-semibold', INK_PROMPT)}>$ </span>
            {isExecuting ? 'streaming RPC trace onto ledger…' : 'awaiting correlation engine…'}
          </p>
        ) : (
          logs.map((line) => (
            <motion.div
              key={line.id}
              {...STAMP_MOTION}
              className="mb-1 flex items-start gap-2"
            >
              <span className={cn('shrink-0 pt-px tabular-nums', INK_MUTED)}>{line.timestamp}</span>
              <span className="min-w-0 flex-1 break-all">
                <InkLogMessage message={line.message} level={line.level} />
              </span>
            </motion.div>
          ))
        )}
        {isExecuting && logs.length > 0 ? (
          <motion.div {...STAMP_MOTION} className="mt-1 flex gap-2 whitespace-nowrap">
            <span className={cn('shrink-0 tabular-nums', INK_MUTED)}>{cursorStamp}</span>
            <span className={cn('animate-pulse font-semibold', INK_PROMPT)}>▌</span>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}

export function HudRightPanel({
  traceLogs,
  isExecuting,
  reputation = null,
  reputationLoading = false,
  reputationCurve = [],
  feedbackItems = [],
  agentDisplayId = 'Parallax · ERC-8004',
}: RightPanelProps) {
  const feedItems = useMemo(() => toFeedItems(feedbackItems), [feedbackItems]);
  const verdict = verdictFromReputation(reputation?.averageValue);
  const scoreLabel = formatReputationScore(reputation?.averageValue);
  const curvePoints = normalizeCurve(reputationCurve, reputation?.averageValue);
  const onChainCount = reputation?.count ?? 0;
  const visibleCount = feedItems.length;
  const ratingCount = visibleCount > 0 ? visibleCount : onChainCount;
  const showOnChainOnlyPlaceholder =
    !reputationLoading && visibleCount === 0 && onChainCount > 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      <div className="flex min-h-0 flex-[6] flex-col gap-1.5 overflow-hidden">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-parallax-border bg-white px-3 py-2.5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-mono text-[9px] text-parallax-fg-muted">
              Agent:{' '}
              <a
                href={PARALLAX_AGENT_EXPLORER_LINKS.agentNft}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-[#2563EB] transition-colors hover:text-parallax-accent hover:underline"
                title="View agent NFT on MantleScan"
              >
                {agentDisplayId}
                <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-80" aria-hidden />
              </a>
            </p>
            <a
              href={PARALLAX_AGENT_EXPLORER_LINKS.identityRegistry}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-1 rounded-full border border-[#059669]/20 bg-[#059669]/5 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-[#059669] transition-colors hover:border-[#059669]/40 hover:bg-[#059669]/10"
              title="ERC-8004 Identity Registry on MantleScan"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#059669]" />
              ERC-8004
              <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-70" aria-hidden />
            </a>
          </div>

          <AgentExplorerLinks />

          <div className="mt-2 shrink-0">
            <p className="mb-1 font-mono text-[8px] uppercase tracking-wider text-parallax-fg-muted">
              Agent Reputation · On-chain
            </p>
            <MacroSentimentIndicator
              verdict={reputationLoading ? 'HOLD' : verdict}
              score={reputationLoading ? '…' : scoreLabel}
            />
          </div>

          <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden">
            <ReputationSparkline points={curvePoints} />
          </div>
        </section>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-parallax-border bg-white shadow-sm">
          <div className="flex shrink-0 items-center justify-between border-b border-parallax-border px-3 py-1.5">
            <p className="font-mono text-[9px] uppercase tracking-wider text-parallax-fg-muted">
              ERC-8004 Verified Ratings
            </p>
            <span className="font-mono text-[9px] tabular-nums text-parallax-fg-muted">
              {ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'}
            </span>
          </div>
          <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto p-2">
            {feedItems.length === 0 ? (
              showOnChainOnlyPlaceholder ? (
                <article className="rounded-lg border border-[#059669]/25 bg-[#059669]/5 px-2.5 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[#059669]/25 bg-[#059669]/10 px-1.5 py-0.5 font-mono text-[8px] text-[#059669]">
                      Verified ✓ On-chain
                    </span>
                    <span className="font-mono text-[8px] text-parallax-fg-muted">
                      {onChainCount} {onChainCount === 1 ? 'calibration' : 'calibrations'} · avg{' '}
                      {reputation?.averageValue?.toFixed(1) ?? '—'}%
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] leading-snug text-parallax-fg">
                    Feedback is confirmed on Mantle Sepolia. Subgraph feed cards sync shortly —
                    refresh if the list is empty after ~1 min.
                  </p>
                </article>
              ) : (
                <p className="px-1 py-3 text-center font-mono text-[9px] text-parallax-fg-muted">
                  {reputationLoading
                    ? 'Loading on-chain feedback…'
                    : 'No verified ratings yet. Validate alpha after unlock.'}
                </p>
              )
            ) : (
              <AnimatePresence initial={false} mode="popLayout">
                {feedItems.map((item) => (
                  <motion.div
                    key={item.feedId}
                    layout
                    initial={{ opacity: 0, y: -18, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{
                      layout: { type: 'spring', stiffness: 380, damping: 30 },
                      opacity: { duration: 0.22 },
                      y: { type: 'spring', stiffness: 420, damping: 28 },
                    }}
                    className="mb-1.5"
                  >
                    <FeedbackCard item={item} />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </section>
      </div>

      <section className="flex min-h-0 flex-[4] flex-col overflow-hidden rounded-lg border border-[#E6D8C3] bg-white p-2 shadow-sm">
        <div className="mb-1.5 flex shrink-0 items-center justify-between px-1">
          <p className="font-mono text-[9px] uppercase tracking-wider text-[#8C7B6A]">
            Streaming Logging Terminal
          </p>
          {isExecuting ? (
            <span className="flex items-center gap-1.5 font-mono text-[8px] text-[#D95B43]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#D95B43]" />
              LIVE
            </span>
          ) : (
            <span className="font-mono text-[8px] text-[#8C7B6A]">RPC · FRED · Gemini</span>
          )}
        </div>

        <StreamingTraceTerminal logs={traceLogs} isExecuting={isExecuting} />
      </section>
    </div>
  );
}
