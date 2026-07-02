'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Clock, HelpCircle, Lock, PlusCircle, Search, Unlock, X } from 'lucide-react';
import type { HistoryEntry, IntentRoutingFeedback, StagedEvent } from '@/components/hud/types';
import type { MacroRegistryEvent } from '@/lib/api';
import {
  REGISTRY_FILTER_TABS,
  filterRegistryEvents,
  registryEventCode,
  registryEventEmoji,
  registryEventHasReport,
  registryEventSubtitle,
  registryEventTitle,
  type RegistryFilterType,
} from '@/lib/macro-registry-ui';
import { cn } from '@/lib/utils';

function historyEventLabel(event: StagedEvent): string {
  const compact = event.title
    .replace(/\s+2026$/i, '')
    .replace(/\s+/g, '-');
  return compact;
}

function formatHistoryEvents(entry: HistoryEntry): string {
  const events = entry.dossier.stagedEvents;
  if (events.length === 0) {
    return entry.batchId
      .split('+')
      .map((id) => `[${id}]`)
      .join(' + ');
  }
  return events.map((event) => `[${historyEventLabel(event)}]`).join(' + ');
}

function formatHistoryTimestamp(savedAt: number): string {
  const diffMs = Date.now() - savedAt;
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(savedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

interface LeftPanelProps {
  stagedEvents: StagedEvent[];
  registryEvents: MacroRegistryEvent[];
  history: HistoryEntry[];
  commandInput: string;
  isResolving: boolean;
  onCommandChange: (value: string) => void;
  onCommandSubmit: () => void;
  onRemoveStaged: (id: string) => void;
  onRestoreHistory: (entry: HistoryEntry) => void;
  onToggleRegistryEvent: (eventId: string) => void;
  routingFeedback: IntentRoutingFeedback | null;
}

export function HudLeftPanel({
  stagedEvents,
  registryEvents,
  history,
  commandInput,
  isResolving,
  onCommandChange,
  onCommandSubmit,
  onRemoveStaged,
  onRestoreHistory,
  onToggleRegistryEvent,
  routingFeedback,
}: LeftPanelProps) {
  const [, setRelativeTick] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<RegistryFilterType>('All');

  useEffect(() => {
    if (history.length === 0) return;
    const timer = setInterval(() => setRelativeTick((t) => t + 1), 30_000);
    return () => clearInterval(timer);
  }, [history.length]);

  const filteredEvents = useMemo(
    () => filterRegistryEvents(registryEvents, selectedCategory, commandInput),
    [registryEvents, selectedCategory, commandInput],
  );

  const stagedIds = useMemo(() => new Set(stagedEvents.map((e) => e.id)), [stagedEvents]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* Show History — unchanged */}
      <div className="group relative z-20 shrink-0">
        <motion.button
          type="button"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="flex w-full items-center gap-2 rounded-lg border border-parallax-border bg-white px-3 py-2 text-sm font-medium text-parallax-fg shadow-sm transition-colors hover:border-parallax-accent/40 hover:text-parallax-accent"
        >
          <Clock className="h-4 w-4 text-parallax-accent" />
          Show History
          <span className="ml-auto font-mono text-[10px] text-parallax-fg-muted">
            {history.length} saved
          </span>
        </motion.button>

        <div className="invisible absolute left-0 right-0 top-full z-50 pt-1 opacity-0 transition-opacity duration-200 group-hover:visible group-hover:opacity-100">
          <div className="pointer-events-none max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white/95 shadow-md backdrop-blur-md group-hover:pointer-events-auto">
            {history.length === 0 ? (
              <p className="px-3 py-2.5 text-xs text-gray-400">No correlation runs yet.</p>
            ) : (
              history.map((entry) => {
                const isUnlocked = entry.dossier.unlocked;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onRestoreHistory(entry)}
                    className="flex w-full cursor-pointer flex-row items-center justify-between px-3 py-2 text-left transition-colors hover:bg-gray-100"
                  >
                    {isUnlocked ? (
                      <Unlock
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ color: '#D95B43' }}
                        aria-hidden
                      />
                    ) : (
                      <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                    )}
                    <span className="ml-3 min-w-0 flex-1 truncate font-mono text-sm text-[#4B5563]">
                      {formatHistoryEvents(entry)}
                    </span>
                    <span className="ml-3 shrink-0 text-xs text-gray-400">
                      {formatHistoryTimestamp(entry.savedAt)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Event Staging Tray — ref compact style */}
      <div className="hud-panel shrink-0 border border-parallax-border bg-white p-3 shadow-sm">
        <div className="mb-2.5 flex items-center justify-between border-b border-parallax-border pb-2">
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-[10px] font-bold uppercase tracking-wider text-stone-700">
              Event Staging Tray
            </h3>
          </div>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 font-mono text-[9px] font-bold text-stone-600">
            {stagedEvents.length} loaded
          </span>
        </div>

        <div className="max-h-[140px] space-y-1.5 overflow-y-auto pr-1">
          {stagedEvents.length === 0 ? (
            <div className="py-3 text-center">
              <p className="text-[11px] italic text-parallax-fg-muted">Staging queue is empty.</p>
              <p className="mt-0.5 text-[9px] text-stone-400">Click "Stage +" on suggestion cards below.</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {stagedEvents.map((event) => {
                const reg = registryEvents.find((r) => r.event_id === event.id);
                const emoji = reg ? registryEventEmoji(reg) : '•';
                return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="group flex items-center justify-between gap-2 rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1.5 transition-all hover:border-parallax-accent/30 hover:bg-white"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="text-xs">{emoji}</span>
                    <div className="min-w-0 truncate">
                      <p className="truncate font-mono text-[11px] font-bold text-stone-800">{event.title}</p>
                      <p className="truncate font-mono text-[8px] font-semibold tracking-wider text-stone-400">
                        {event.id}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveStaged(event.id)}
                    className="rounded-full p-0.5 opacity-40 transition-opacity hover:bg-stone-100 hover:text-red-600 hover:opacity-100"
                    title="Remove from stage"
                    aria-label={`Remove ${event.title}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Discovery & Signal Deck */}
      <div className="hud-panel flex min-h-0 flex-1 flex-col border border-parallax-border bg-white p-3 shadow-sm">
        <div className="mb-3">
          <h3 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-stone-700">
            Discovery & Signal Deck
          </h3>
          <AnimatePresence>
            {routingFeedback && (
              <motion.p
                key={routingFeedback.message}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  'mb-2 rounded-lg border px-2.5 py-1.5 font-mono text-[10px] leading-snug',
                  routingFeedback.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-200 bg-amber-50 text-amber-900',
                )}
              >
                {routingFeedback.message}
              </motion.p>
            )}
          </AnimatePresence>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onCommandSubmit();
            }}
          >
            <div className="group relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-stone-400 transition-colors group-focus-within:text-parallax-accent" />
              </div>
              <input
                type="text"
                value={commandInput}
                onChange={(e) => onCommandChange(e.target.value)}
                placeholder="Describe macro event or ticker..."
                disabled={isResolving}
                className={cn(
                  'w-full rounded-lg border border-parallax-border bg-stone-50 py-2.5 pl-9 pr-14 text-xs text-parallax-fg',
                  'placeholder:text-stone-400 focus:border-parallax-accent focus:bg-white focus:outline-none focus:ring-1 focus:ring-parallax-accent/30',
                  'disabled:opacity-60',
                )}
              />
              <div className="absolute inset-y-0 right-1.5 flex items-center">
                <button
                  type="submit"
                  disabled={isResolving || !commandInput.trim()}
                  className="rounded-sm bg-stone-900 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-parallax-accent disabled:opacity-30 disabled:hover:bg-stone-900"
                >
                  {isResolving ? '…' : 'Stage'}
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="mb-2.5 border-b border-stone-100 pb-2">
          <p className="mb-1.5 font-mono text-[8px] font-bold uppercase tracking-widest text-stone-400">
            Filter Signal Registry
          </p>
          <div className="flex flex-wrap gap-1">
            {REGISTRY_FILTER_TABS.map((tab) => {
              const isActive = selectedCategory === tab.id;
              const count =
                tab.id === 'All'
                  ? registryEvents.length
                  : registryEvents.filter((e) => e.type === tab.id).length;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedCategory(tab.id)}
                  className={cn(
                    'cursor-pointer rounded px-2.5 py-1 font-mono text-[10px] font-bold tracking-tight transition-all',
                    isActive
                      ? 'bg-stone-900 text-white'
                      : 'border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100',
                  )}
                >
                  {tab.label}
                  <span className="ml-1 opacity-60">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-stone-400">
              Available Macro Parameters ({filteredEvents.length})
            </span>
            <span className="text-[9px] font-medium text-stone-400">Click to stage</span>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50 py-8 text-center">
              <HelpCircle className="mx-auto mb-1 h-5 w-5 text-stone-300" />
              <p className="text-[11px] font-bold text-stone-500">No events match this filter</p>
              <p className="mt-0.5 px-2 text-[9px] text-stone-400">
                Try another tab or use the search bar to resolve a custom prompt.
              </p>
            </div>
          ) : (
            filteredEvents.map((event) => {
              const isStaged = stagedIds.has(event.event_id);
              const title = registryEventTitle(event);
              const code = registryEventCode(event);
              const hasReport = registryEventHasReport(event.event_id);

              return (
                <button
                  key={event.event_id}
                  type="button"
                  onClick={() => onToggleRegistryEvent(event.event_id)}
                  className={cn(
                    'group flex w-full flex-col rounded-lg border p-2.5 text-left transition-all',
                    isStaged
                      ? 'border-parallax-accent/35 bg-[#fdf0eb]'
                      : 'border-stone-200 bg-white hover:border-parallax-accent/40 hover:shadow-sm',
                  )}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{registryEventEmoji(event)}</span>
                      <span className="font-mono text-[10px] font-bold tracking-wider text-stone-400">
                        [{code}]
                      </span>
                      {hasReport && (
                        <span className="rounded bg-[#059669]/10 px-1 py-0.5 font-mono text-[7px] font-bold text-[#059669]">
                          REPORT
                        </span>
                      )}
                    </div>
                    {isStaged ? (
                      <span className="flex items-center gap-0.5 rounded bg-parallax-accent/10 px-1.5 py-0.5 font-mono text-[8px] font-bold text-parallax-accent">
                        <CheckCircle2 className="h-2 w-2" />
                        Staged
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[8px] font-bold text-stone-800 transition-colors duration-200 group-hover:bg-parallax-accent group-hover:text-white">
                        <PlusCircle className="h-2.5 w-2.5" />
                        Stage
                      </span>
                    )}
                  </div>
                  <p
                    className={cn(
                      'font-mono text-[11px] font-bold leading-tight transition-colors',
                      isStaged
                        ? 'text-parallax-accent'
                        : 'text-stone-800 group-hover:text-parallax-accent',
                    )}
                  >
                    {title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-stone-500">
                    {registryEventSubtitle(event)}
                  </p>
                  <p className="mt-1 font-mono text-[8px] text-stone-400">{event.event_id}</p>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
