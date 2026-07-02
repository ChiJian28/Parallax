'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { useAccount, useWalletClient } from 'wagmi';
import type { Erc8004Feedback } from '@/components/hud/types';
import { explorerTxUrl } from '@/lib/explorer';
import {
  shortenAddress,
  shortenTxHash,
  signalScoreToOnChainValue,
  submitOnChainFeedback,
} from '@/lib/feedback';
import { cn } from '@/lib/utils';

type ValidatorState = 'IDLE' | 'SIGNING' | 'SUCCESS';

const LOCKED_TAG = '#macro_correlation' as const;
const OPTIONAL_TAGS = ['#xstocks_accuracy', '#aave_rotation'] as const;
const CONTEXT_TAGS = [LOCKED_TAG, ...OPTIONAL_TAGS] as const;
type ContextTag = (typeof CONTEXT_TAGS)[number];

const SIGNAL_MAX = 5;

function SignalBar({
  index,
  filled,
  hovered,
  onSelect,
  onHover,
}: {
  index: number;
  filled: boolean;
  hovered: boolean;
  onSelect: (n: number) => void;
  onHover: (n: number | null) => void;
}) {
  const active = filled || hovered;

  return (
    <button
      type="button"
      aria-label={`Signal accuracy ${index + 1} of ${SIGNAL_MAX}`}
      onClick={() => onSelect(index + 1)}
      onMouseEnter={() => onHover(index + 1)}
      onMouseLeave={() => onHover(null)}
      className="group flex h-7 w-3.5 items-end justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-parallax-accent/40 focus-visible:ring-offset-1"
    >
      <span
        className={cn(
          'block w-full rounded-sm transition-all duration-150',
          active ? 'bg-[#D95B43]' : 'bg-gray-200 group-hover:bg-[#D95B43]/35',
        )}
        style={{ height: `${((index + 1) / SIGNAL_MAX) * 100}%` }}
      />
    </button>
  );
}

interface AlphaValidationNodeProps {
  contextKey: string;
  eventId: string;
  onValidated?: (item: Erc8004Feedback) => void;
}

export function AlphaValidationNode({ contextKey, eventId, onValidated }: AlphaValidationNodeProps) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [state, setState] = useState<ValidatorState>('IDLE');
  const [signalScore, setSignalScore] = useState(4);
  const [hoverScore, setHoverScore] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<Set<ContextTag>>(
    () => new Set([LOCKED_TAG, '#xstocks_accuracy']),
  );
  const [note, setNote] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [fullTxHash, setFullTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setState('IDLE');
    setSignalScore(4);
    setHoverScore(null);
    setSelectedTags(new Set([LOCKED_TAG, '#xstocks_accuracy']));
    setNote('');
    setTxHash(null);
    setFullTxHash(null);
    setError(null);
  }, [contextKey]);

  const displayScore = hoverScore ?? signalScore;
  const tagList = Array.from(selectedTags);
  const optionalTags = tagList.filter((t) => t !== LOCKED_TAG);
  const successTxUrl = txHash ? explorerTxUrl(txHash, fullTxHash ?? undefined) : null;

  function toggleTag(tag: ContextTag) {
    if (tag === LOCKED_TAG) return;
    setSelectedTags((prev) => {
      const next = new Set(prev);
      next.add(LOCKED_TAG);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (state !== 'IDLE') return;

    if (!isConnected || !walletClient) {
      setError('Connect wallet on Mantle Sepolia to sign ERC-8004 feedback.');
      return;
    }

    setState('SIGNING');
    setError(null);

    try {
      const hash = await submitOnChainFeedback(walletClient, {
        value: signalScoreToOnChainValue(signalScore),
        eventId,
        tag1: 'macro_correlation',
        tag2: optionalTags[0]?.replace(/^#/, '') ?? 'xstocks_accuracy',
        text: note.trim() || `Alpha validated for ${eventId}`,
      });

      const displayHash = shortenTxHash(hash);
      setTxHash(displayHash);
      setFullTxHash(hash);
      setState('SUCCESS');

      onValidated?.({
        score: signalScore,
        maxScore: SIGNAL_MAX,
        tag: 'macro_correlation',
        comment: note.trim() || `Alpha validated for ${eventId}`,
        reviewer: address ? shortenAddress(address) : 'you',
        reviewerFull: address ?? undefined,
        rawValue: signalScoreToOnChainValue(signalScore),
        createdAt: Math.floor(Date.now() / 1000),
        txHash: displayHash,
        fullTxHash: hash,
        indexStatus: 'verified',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('IDLE');
    }
  }

  return (
    <motion.div layout className="px-4 pb-6">
      <AnimatePresence mode="wait">
        {state === 'SUCCESS' ? (
          <motion.div
            key="success"
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{
              layout: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 0.3 },
            }}
            className="mt-10 overflow-hidden rounded-md border border-[#059669]/25 bg-[#059669]/5 px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#059669]" aria-hidden />
              <p className="font-mono text-xs font-medium text-[#059669]">
                ERC-8004 Calibration Registered on Mantle.
              </p>
              {txHash && (
                <p className="font-mono text-[10px] text-parallax-fg-muted">
                  Tx:{' '}
                  {successTxUrl ? (
                    <a
                      href={successTxUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-[#2563EB] transition-colors hover:text-parallax-accent hover:underline"
                    >
                      {txHash}
                      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                    </a>
                  ) : (
                    <span className="text-parallax-fg">{txHash}</span>
                  )}
                </p>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ layout: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } }}
            className="mt-10 rounded-md border border-gray-200 bg-[#F4F4F5] p-5"
          >
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">
              Validate Alpha Signal
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div
                className="flex items-end gap-1"
                onMouseLeave={() => setHoverScore(null)}
                role="group"
                aria-label="Signal accuracy calibration"
              >
                {Array.from({ length: SIGNAL_MAX }, (_, i) => (
                  <SignalBar
                    key={i}
                    index={i}
                    filled={i < signalScore}
                    hovered={hoverScore !== null && i < hoverScore}
                    onSelect={setSignalScore}
                    onHover={setHoverScore}
                  />
                ))}
              </div>
              <span className="font-mono text-sm text-parallax-fg">
                Signal Accuracy:{' '}
                <span className="font-semibold text-[#D95B43]">
                  {displayScore}/{SIGNAL_MAX}
                </span>
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {CONTEXT_TAGS.map((tag) => {
                const selected = selectedTags.has(tag);
                const isLocked = tag === LOCKED_TAG;
                return (
                  <button
                    key={tag}
                    type="button"
                    disabled={isLocked}
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors',
                      selected
                        ? 'border-[#2563EB] bg-[#2563EB] text-white'
                        : 'border-gray-300 bg-transparent text-gray-500 hover:border-gray-400 hover:text-gray-700',
                      isLocked && 'cursor-default ring-1 ring-[#2563EB]/30',
                    )}
                  >
                    {tag}
                    {isLocked ? ' · locked' : ''}
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={state === 'SIGNING'}
                placeholder="Add your on-chain consensus note... (e.g., LP depth metric was spot-on)"
                className={cn(
                  'w-full border-0 border-b border-gray-300 bg-transparent px-0 py-1.5',
                  'font-mono text-sm text-parallax-fg placeholder:text-gray-400',
                  'focus:border-[#D95B43] focus:outline-none focus:ring-0',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                )}
              />
            </div>

            {!isConnected && (
              <p className="mt-3 font-mono text-[10px] text-parallax-fg-muted">
                Connect wallet (header) on Mantle Sepolia — no QuestFlow key required for ERC-8004.
              </p>
            )}

            {error && <p className="mt-2 font-mono text-[10px] text-red-600">{error}</p>}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={state === 'SIGNING' || !isConnected}
                className={cn(
                  'rounded-md px-4 py-2 font-mono text-xs font-semibold text-white transition-colors',
                  'bg-[#D95B43] hover:bg-[#C24B36]',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                )}
              >
                {state === 'SIGNING' ? 'Awaiting Tx Signature...' : 'Sign & Validate (Mint 8004)'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
