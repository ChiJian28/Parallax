'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { TerminalWalletButton } from '@/components/hud/terminal-wallet-button';
import { Moon, Sun } from 'lucide-react';
import { HudLeftPanel } from '@/components/hud/hud-left-panel';
import { HudMiddlePanel } from '@/components/hud/hud-middle-panel';
import { HudRightPanel } from '@/components/hud/hud-right-panel';
import { ParallaxLogo } from '@/components/layout/parallax-logo';
import type {
  Erc8004Feedback,
  HistoryEntry,
  IntentRoutingFeedback,
  MiddlePanelPhase,
  ResearchDossier,
  ReputationCurvePoint,
  StagedEvent,
  TraceLogLine,
  UnlockState,
} from '@/components/hud/types';
import { buildResearchDossier, mockCrossEventCorrelation, unlockDossier } from '@/lib/dossier';
import { buildCachePreambleSteps, appendTraceLogs, playCorrelationTrace, playWhileWaiting, traceDelayForStatus } from '@/lib/correlation-trace';
import { terminalNowStamp } from '@/lib/terminal-timestamp';
import { loadCorrelationHistory, saveCorrelationHistory, MAX_CORRELATION_HISTORY } from '@/lib/history-storage';
import {
  FEEDBACK_TX_SEED,
  mergeSeedIntoFeedbackTxRegistry,
  processFeedbackFeed,
  saveFeedbackTx,
} from '@/lib/feedback-tx-storage';
import { getMockFullReport, getMockTeaser, buildMockAcquisitionTrace, MACRO_EVENT_FEED } from '@/lib/command-center-mocks';
import { macroFeedToRegistryEvent } from '@/lib/macro-registry-ui';
import {
  fetchFeedbackFeed,
  fetchMacroEvents,
  fetchReportTeaser,
  fetchReportUnlocked,
  fetchReputation,
  probeCorrelationCache,
  resolveMacroPrompt,
  runAcquisitionTrace,
  runHudCorrelation,
  type AcquisitionTraceLog,
  type CorrelationRunResponse,
  type CrossEventCorrelation,
  type MacroRegistryEvent,
  type ReportFull,
  type ReputationSummary,
} from '@/lib/api';
import { DEV_BYPASS, PARALLAX_AGENT_ID } from '@/lib/config';
import { hasPendingFeedback, mergeFeedbackFeed, promotePendingByConfirmedTxs } from '@/lib/erc8004-feed-merge';
import { getTxReceiptStatus } from '@/lib/feedback';
import { cn } from '@/lib/utils';

const OUT_OF_SCOPE_MSG =
  '[Out of Scope] No historical Liquidity Book data indexed for this query. Try exploring Q1/Q2 macro events.';

function teaserOnlyReport(teaser: { eventId: string; eventName: string; teaser: string; priceMNT: number }): ReportFull {
  return { ...teaser, fullContent: '' };
}

async function fetchLockedEventReport(
  eventId: string,
  eventName: string,
): Promise<{ eventId: string; eventName: string; report: ReportFull } | null> {
  try {
    const apiTeaser = await fetchReportTeaser(eventId);
    if (apiTeaser?.teaser && !('error' in apiTeaser)) {
      return { eventId, eventName: apiTeaser.eventName, report: teaserOnlyReport(apiTeaser) };
    }
  } catch {
    // fallback below
  }

  const fallbackTeaser = getMockTeaser(eventId);
  const fallbackFull = getMockFullReport(eventId);
  if (fallbackTeaser && fallbackFull) {
    return {
      eventId,
      eventName: fallbackTeaser.eventName,
      report: { ...fallbackFull, fullContent: '' },
    };
  }

  return null;
}

async function fetchUnlockedEventReport(
  eventId: string,
  eventName: string,
): Promise<{ eventId: string; eventName: string; report: ReportFull }> {
  if (DEV_BYPASS) {
    try {
      const report = await fetchReportUnlocked(eventId);
      return { eventId, eventName: report.eventName, report };
    } catch {
      const mock = getMockFullReport(eventId);
      if (mock?.fullContent) {
        return { eventId, eventName: mock.eventName, report: mock };
      }
    }
  }

  const locked = await fetchLockedEventReport(eventId, eventName);
  if (locked) {
    return {
      ...locked,
      report: { ...locked.report, fullContent: locked.report.teaser },
    };
  }

  throw new Error(`No report content for ${eventId}`);
}

function formatTrigger(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return iso;
  }
}

function registryToStaged(event: MacroRegistryEvent): StagedEvent {
  const feed = MACRO_EVENT_FEED.find((e) => e.id === event.event_id);
  return {
    id: event.event_id,
    title: feed?.title ?? event.name.replace(/_/g, ' '),
    subtitle: feed?.subtitle ?? `${event.type} · ${event.tokens.join(', ')}`,
    type: event.type,
    triggerLabel: formatTrigger(event.trigger_time_utc),
  };
}

function feedToStaged(id: string): StagedEvent | null {
  const feed = MACRO_EVENT_FEED.find((e) => e.id === id);
  if (!feed) return null;
  return {
    id: feed.id,
    title: feed.title,
    subtitle: feed.subtitle,
    type: feed.category,
    triggerLabel: feed.timestamp,
  };
}

function successFeedback(eventId: string): IntentRoutingFeedback {
  return {
    type: 'success',
    message: `[Signal Locked] Mapped to on-chain event: ${eventId}`,
  };
}

async function collectConfirmedTxHashes(hashes: string[]): Promise<string[]> {
  const confirmed: string[] = [];
  await Promise.all(
    hashes.map(async (hash) => {
      if ((await getTxReceiptStatus(hash)) === 'success') confirmed.push(hash);
    }),
  );
  return confirmed;
}

async function promotePendingFromReceipts(items: Erc8004Feedback[]): Promise<Erc8004Feedback[]> {
  const pendingHashes = items
    .filter((item) => item.indexStatus === 'pending' && item.fullTxHash)
    .map((item) => item.fullTxHash!);
  const confirmed = await collectConfirmedTxHashes(pendingHashes);
  return promotePendingByConfirmedTxs(items, confirmed);
}

export function ParallaxHUD() {
  const [darkMode, setDarkMode] = useState(false);
  const [registry, setRegistry] = useState<MacroRegistryEvent[]>([]);
  const [stagedEvents, setStagedEvents] = useState<StagedEvent[]>([]);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [commandInput, setCommandInput] = useState('');
  const [middlePhase, setMiddlePhase] = useState<MiddlePanelPhase>('STAGING');
  const [unlockState, setUnlockState] = useState<UnlockState>('locked');
  const [dossier, setDossier] = useState<ResearchDossier | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [traceLogs, setTraceLogs] = useState<TraceLogLine[]>([]);
  const [isRouting, setIsRouting] = useState(false);
  const [routingFeedback, setRoutingFeedback] = useState<IntentRoutingFeedback | null>(null);
  const [reputation, setReputation] = useState<ReputationSummary | null>(null);
  const [reputationCurve, setReputationCurve] = useState<ReputationCurvePoint[]>([]);
  const [feedbackFeed, setFeedbackFeed] = useState<Erc8004Feedback[]>([]);
  const [reputationLoading, setReputationLoading] = useState(true);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const correlationRunRef = useRef(0);

  const appendLog = useCallback((level: TraceLogLine['level'], message: string) => {
    setTraceLogs((prev) => [
      ...prev,
      { id: `${Date.now()}-${prev.length}`, timestamp: terminalNowStamp(), level, message },
    ]);
  }, []);

  const stopFeedbackPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const refreshErc8004Data = useCallback(
    async (options?: { preservePending?: boolean }) => {
      const preservePending = options?.preservePending ?? true;
      if (!preservePending) setReputationLoading(true);
      try {
        const [rep, feed] = await Promise.all([
          fetchReputation(PARALLAX_AGENT_ID),
          fetchFeedbackFeed(PARALLAX_AGENT_ID),
        ]);
        setReputation(rep);
        setReputationCurve(feed.curve);
        if (preservePending) {
          setFeedbackFeed((prev) => {
            const merged = mergeFeedbackFeed(
              prev,
              processFeedbackFeed(feed.items.map((i) => ({ ...i, indexStatus: 'verified' as const }))),
            );
            void promotePendingFromReceipts(merged).then(setFeedbackFeed);
            return merged;
          });
        } else {
          setFeedbackFeed(
            processFeedbackFeed(
              feed.items.map((item) => ({ ...item, indexStatus: 'verified' as const })),
            ),
          );
        }
      } catch (error) {
        appendLog(
          'warn',
          `ERC-8004 feed unavailable — ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        if (!preservePending) setReputationLoading(false);
      }
    },
    [appendLog],
  );

  const pollFeedbackIndexing = useCallback(() => {
    stopFeedbackPolling();
    pollTimerRef.current = setInterval(() => {
      void (async () => {
        try {
          const [rep, feed] = await Promise.all([
            fetchReputation(PARALLAX_AGENT_ID),
            fetchFeedbackFeed(PARALLAX_AGENT_ID),
          ]);
          setReputation(rep);
          setReputationCurve(feed.curve);
          setFeedbackFeed((prev) => {
            const merged = mergeFeedbackFeed(
              prev,
              processFeedbackFeed(feed.items.map((i) => ({ ...i, indexStatus: 'verified' as const }))),
            );
            void promotePendingFromReceipts(merged).then((promoted) => {
              setFeedbackFeed(promoted);
              if (!hasPendingFeedback(promoted)) stopFeedbackPolling();
            });
            return merged;
          });
        } catch {
          // Subgraph not ready — keep pending cards, retry next interval
        }
      })();
    }, 4000);
  }, [stopFeedbackPolling]);

  useEffect(() => {
    void refreshErc8004Data({ preservePending: false });
    return () => stopFeedbackPolling();
  }, [refreshErc8004Data, stopFeedbackPolling]);

  const handleFeedbackValidated = useCallback(
    (item: Erc8004Feedback) => {
      if (item.fullTxHash) {
        saveFeedbackTx({
          fullTxHash: item.fullTxHash,
          feedbackKey: item.feedbackKey ?? `tx:${item.fullTxHash.toLowerCase()}`,
          reviewer: item.reviewerFull ?? item.reviewer,
          feedbackIndex: item.feedbackIndex,
          value: item.rawValue ?? undefined,
          createdAt: item.createdAt,
          comment: item.comment,
        });
      }
      setFeedbackFeed((prev) =>
        processFeedbackFeed(mergeFeedbackFeed([item, ...prev], [])).slice(0, 10),
      );
      appendLog('ok', `ERC-8004 calibration verified on-chain — tx ${item.txHash}`);
      pollFeedbackIndexing();
    },
    [appendLog, pollFeedbackIndexing],
  );

  useEffect(() => {
    mergeSeedIntoFeedbackTxRegistry(FEEDBACK_TX_SEED);
    setHistory(loadCorrelationHistory());
    setHistoryReady(true);
  }, []);

  useEffect(() => {
    if (!historyReady) return;
    saveCorrelationHistory(history);
  }, [history, historyReady]);

  const showRoutingFeedback = useCallback((feedback: IntentRoutingFeedback) => {
    setRoutingFeedback(feedback);
  }, []);

  const upsertHistoryEntry = useCallback((nextDossier: ResearchDossier) => {
    const now = Date.now();
    setHistory((prev) => {
      const existing = prev.find((h) => h.batchId === nextDossier.batchId);
      const entry: HistoryEntry = {
        id: existing?.id ?? `${nextDossier.batchId}-${now}`,
        batchId: nextDossier.batchId,
        eventCount: nextDossier.eventCount,
        savedAt: existing?.savedAt ?? now,
        dossier: nextDossier,
      };
      return [entry, ...prev.filter((h) => h.batchId !== nextDossier.batchId)].slice(
        0,
        MAX_CORRELATION_HISTORY,
      );
    });
  }, []);

  const finishCorrelationRun = useCallback(
    async (
      staged: StagedEvent[],
      crossCorrelation?: CrossEventCorrelation,
      correlationResult?: CorrelationRunResponse,
    ) => {
      let valid: Array<{ eventId: string; eventName: string; report: ReportFull }>;

      if (correlationResult?.reports?.length) {
        valid = correlationResult.reports.map((entry) => ({
          eventId: entry.eventId,
          eventName: entry.eventName,
          report: {
            eventId: entry.eventId,
            eventName: entry.eventName,
            teaser: entry.teaser,
            priceMNT: entry.priceMNT,
            fullContent: '',
            crossEventCorrelation: crossCorrelation,
          },
        }));
      } else {
        const reports = await Promise.all(
          staged.map((event) => fetchLockedEventReport(event.id, event.title)),
        );
        valid = reports.filter(
          (entry): entry is NonNullable<typeof entry> => entry != null,
        );
      }

      if (valid.length === 0) {
        appendLog('warn', 'no reports available for staged batch — run backend generate-report');
        setMiddlePhase('STAGING');
        showRoutingFeedback({
          type: 'fail',
          message: '[No Report] Staged events have no published reports yet. Pre-generate via backend CLI.',
        });
        return;
      }

      const built = buildResearchDossier({
        stagedEvents: staged.filter((e) => valid.some((r) => r.eventId === e.id)),
        eventReports: valid,
        crossEventCorrelation: crossCorrelation ?? correlationResult?.cross_event_correlation,
        combinedSynthesis: correlationResult?.combined_synthesis,
        unlocked: false,
      });
      setDossier(built);
      setMiddlePhase('PAYWALL_READY');
      upsertHistoryEntry(built);
    },
    [appendLog, showRoutingFeedback, upsertHistoryEntry],
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (!routingFeedback) return;
    const timer = window.setTimeout(() => setRoutingFeedback(null), 3500);
    return () => window.clearTimeout(timer);
  }, [routingFeedback]);

  useEffect(() => {
    void fetchMacroEvents()
      .then((data) => setRegistry(data.events))
      .catch(() => {
        setRegistry(MACRO_EVENT_FEED.map(macroFeedToRegistryEvent));
      });
  }, []);

  const addStagedUnique = useCallback((events: StagedEvent[]) => {
    setStagedEvents((prev) => {
      const ids = new Set(prev.map((e) => e.id));
      const merged = [...prev];
      for (const event of events) {
        if (!ids.has(event.id)) {
          ids.add(event.id);
          merged.push(event);
        }
      }
      return merged;
    });
  }, []);

  const routeIntentFromPrompt = useCallback(
    async (prompt: string) => {
      setIsRouting(true);
      try {
        const result = await resolveMacroPrompt(prompt);

        if ('mode' in result && result.mode === 'batch' && result.success && result.events.length > 0) {
          const staged = result.events.map((e) => {
            const reg = registry.find((r) => r.event_id === e.event_id);
            return reg
              ? registryToStaged(reg)
              : (feedToStaged(e.event_id) ?? {
                  id: e.event_id,
                  title: e.event_name,
                  subtitle: e.event_type ?? 'Macro',
                  type: e.event_type ?? 'Macro',
                  triggerLabel: formatTrigger(e.trigger_time_utc),
                });
          });
          addStagedUnique(staged);
          const primaryId = result.event_ids[0] ?? staged[0].id;
          setActiveEventId(primaryId);
          setMiddlePhase('STAGING');
          setUnlockState('locked');
          // showRoutingFeedback(successFeedback(primaryId));
          return;
        }

        if ('success' in result && result.success && 'event' in result && result.event?.event_id) {
          const eventId = result.event.event_id;
          const reg = registry.find((r) => r.event_id === eventId);
          addStagedUnique([
            reg
              ? registryToStaged(reg)
              : (feedToStaged(eventId) ?? {
                  id: eventId,
                  title: result.event.event_name,
                  subtitle: 'Resolved via LLM',
                  type: 'Macro',
                  triggerLabel: '—',
                }),
          ]);
          setActiveEventId(eventId);
          setMiddlePhase('STAGING');
          setUnlockState('locked');
          // showRoutingFeedback(successFeedback(eventId));
          return;
        }

        showRoutingFeedback({ type: 'fail', message: OUT_OF_SCOPE_MSG });
      } catch {
        showRoutingFeedback({ type: 'fail', message: OUT_OF_SCOPE_MSG });
      } finally {
        setIsRouting(false);
      }
    },
    [addStagedUnique, registry, showRoutingFeedback],
  );

  const runCorrelationEngine = useCallback(async () => {
    if (stagedEvents.length === 0) return;

    const runId = correlationRunRef.current;
    const isActive = () => runId === correlationRunRef.current;

    const eventIds = stagedEvents.map((e) => e.id);
    const primaryId = activeEventId ?? eventIds[0];
    setActiveEventId(primaryId);
    setMiddlePhase('ANALYZING');
    setUnlockState('locked');
    setTraceLogs([]);

    const preambleSteps = buildCachePreambleSteps();
    let traceSeed: AcquisitionTraceLog[] = [];
    const mapLogsToState = (
      logs: Array<{ timestamp: string; level: TraceLogLine['level']; message: string }>,
    ) => {
      setTraceLogs(
        logs.map((log, index) => ({
          id: `${Date.now()}-${index}`,
          timestamp: log.timestamp,
          level: log.level,
          message: log.message,
        })),
      );
    };

    await playCorrelationTrace(
      preambleSteps.map((step) => ({ ...step, timestamp: '' })),
      { minDurationMs: 0, perLogDelayMs: 80, onLog: (logs) => { traceSeed = logs; mapLogsToState(logs); } },
    );

    if (!isActive()) return;

    try {
      const probe = await probeCorrelationCache(eventIds);

      if (!isActive()) return;

      if (probe.all_cached) {
        const correlation = await playWhileWaiting(runHudCorrelation(eventIds), {
          seedLogs: traceSeed,
          onLog: mapLogsToState,
        });
        if (!isActive()) return;

        const { minDurationMs, perLogDelayMs } = traceDelayForStatus(
          correlation.status,
          correlation.animation_ms,
        );

        await playCorrelationTrace(correlation.logs, {
          minDurationMs,
          perLogDelayMs,
          onLog: mapLogsToState,
        });

        if (!isActive()) return;

        if (!correlation.success) {
          setMiddlePhase('STAGING');
          showRoutingFeedback({
            type: 'fail',
            message: '[Correlation Failed] Could not load cached reports.',
          });
          return;
        }

        setActiveEventId(correlation.primary_event_id || primaryId);
        appendLog(
          'ok',
          `cache hit — dossier ready (${correlation.cache.events_cached.length} pre-baked reports)`,
        );
        if (!isActive()) return;
        await finishCorrelationRun(stagedEvents, correlation.cross_event_correlation, correlation);
        return;
      }

      // Slow path — phase 1: real RPC acquisition logs
      mapLogsToState([
        ...traceSeed,
        {
          timestamp: terminalNowStamp(),
          level: 'warn',
          message: `Cache MISS: ${probe.events_missing.join(', ') || 'batch'} — live RPC acquisition`,
        },
      ]);

      const acquisition = await playWhileWaiting(runAcquisitionTrace(eventIds), {
        seedLogs: traceSeed,
        onLog: mapLogsToState,
      });

      if (!isActive()) return;

      await playCorrelationTrace(acquisition.logs, {
        minDurationMs: 2500,
        perLogDelayMs: 90,
        onLog: mapLogsToState,
      });

      if (!isActive()) return;

      if (!acquisition.success) {
        setMiddlePhase('STAGING');
        showRoutingFeedback({
          type: 'fail',
          message: '[Acquisition Failed] Could not resolve staged events on backend.',
        });
        return;
      }

      // Slow path — phase 2: Gemini materialization (reuse acquisition session on backend)
      mapLogsToState([
        ...acquisition.logs,
        {
          timestamp: terminalNowStamp(),
          level: 'info',
          message: 'Gemini synthesis — materializing research dossier...',
        },
      ]);

      const correlation = await playWhileWaiting(
        runHudCorrelation(eventIds, { skipAcquisition: true }),
        {
          seedLogs: acquisition.logs,
          onLog: mapLogsToState,
        },
      );

      if (!isActive()) return;

      await appendTraceLogs(acquisition.logs, correlation.logs, {
        onLog: mapLogsToState,
      });

      if (!isActive()) return;

      if (!correlation.success) {
        setMiddlePhase('STAGING');
        showRoutingFeedback({
          type: 'fail',
          message: '[Correlation Failed] Live generation incomplete.',
        });
        return;
      }

      setActiveEventId(correlation.primary_event_id || acquisition.primary_event_id || primaryId);
      appendLog(
        'ok',
        correlation.status === 'live_generated'
          ? `live generated — ${correlation.cache.events_generated.length} new report(s)`
          : `materialized — ${correlation.reports.length} report(s) ready`,
      );
      if (!isActive()) return;
      await finishCorrelationRun(
        stagedEvents,
        correlation.cross_event_correlation ?? acquisition.cross_event_correlation,
        correlation,
      );
    } catch (error) {
      if (!isActive()) return;

      appendLog(
        'warn',
        error instanceof Error ? error.message : 'Correlation pipeline failed — attempting recovery',
      );

      try {
        const acquisition = await runAcquisitionTrace(eventIds);
        await playCorrelationTrace(acquisition.logs, {
          minDurationMs: 2000,
          perLogDelayMs: 90,
          onLog: mapLogsToState,
        });

        if (acquisition.success) {
          const correlation = await runHudCorrelation(eventIds, { skipAcquisition: true });
          if (!isActive()) return;
          if (correlation.success) {
            setActiveEventId(correlation.primary_event_id || primaryId);
            appendLog('ok', 'recovered — live backend reports loaded');
            if (!isActive()) return;
            await finishCorrelationRun(
              stagedEvents,
              correlation.cross_event_correlation ?? acquisition.cross_event_correlation,
              correlation,
            );
            return;
          }
        }
      } catch {
        // fall through to mock
      }

      const mockLogs = buildMockAcquisitionTrace(eventIds);
      await playCorrelationTrace(mockLogs, {
        minDurationMs: 2800,
        perLogDelayMs: 160,
        onLog: mapLogsToState,
      });

      setActiveEventId(primaryId);
      appendLog('warn', '[offline] backend unreachable — loading mock dossier');
      if (!isActive()) return;
      await finishCorrelationRun(stagedEvents, mockCrossEventCorrelation(eventIds));
    }
  }, [
    activeEventId,
    appendLog,
    finishCorrelationRun,
    showRoutingFeedback,
    stagedEvents,
  ]);

  const handleCommandSubmit = useCallback(() => {
    const prompt = commandInput.trim();
    if (!prompt) return;
    void routeIntentFromPrompt(prompt);
    setCommandInput('');
  }, [commandInput, routeIntentFromPrompt]);

  const handleResetSession = useCallback(() => {
    correlationRunRef.current += 1;
    setMiddlePhase('STAGING');
    setStagedEvents([]);
    setDossier(null);
    setUnlockState('locked');
    setActiveEventId(null);
    setTraceLogs([]);
  }, []);

  const handleRemoveStaged = useCallback(
    (id: string) => {
      setStagedEvents((prev) => {
        const next = prev.filter((e) => e.id !== id);
        if (next.length === 0 && middlePhase !== 'UNLOCKED') {
          setMiddlePhase('STAGING');
          setDossier(null);
          setActiveEventId(null);
        }
        return next;
      });
    },
    [middlePhase],
  );

  const handleToggleRegistryEvent = useCallback(
    (eventId: string) => {
      const isStaged = stagedEvents.some((e) => e.id === eventId);
      if (isStaged) {
        handleRemoveStaged(eventId);
        return;
      }

      const reg = registry.find((r) => r.event_id === eventId);
      if (reg) {
        addStagedUnique([registryToStaged(reg)]);
        setActiveEventId(eventId);
        setMiddlePhase('STAGING');
        setUnlockState('locked');
        // showRoutingFeedback(successFeedback(eventId));
      }
    },
    [addStagedUnique, handleRemoveStaged, registry, showRoutingFeedback, stagedEvents],
  );

  const handleUnlock = useCallback(async () => {
    if (!dossier) return;
    setUnlockState('paying');
    appendLog('info', `x402 payment flow — dossier batch (${dossier.eventCount} events, ${dossier.priceMNT} MNT)`);

    try {
      if (!DEV_BYPASS) {
        await new Promise((r) => setTimeout(r, 1400));
      }

      const fullReports = await Promise.all(
        dossier.eventReports.map((entry) =>
          fetchUnlockedEventReport(entry.eventId, entry.eventName),
        ),
      );

      const unlocked = unlockDossier(dossier, fullReports);
      setDossier(unlocked);
      setUnlockState('unlocked');
      setMiddlePhase('UNLOCKED');
      appendLog('ok', `x402 settled — research dossier unlocked (${unlocked.batchId})`);

      upsertHistoryEntry(unlocked);
    } catch (error) {
      appendLog('warn', error instanceof Error ? error.message : 'Unlock failed');
      setUnlockState('locked');
    }
  }, [appendLog, dossier, upsertHistoryEntry]);

  const handleRestoreHistory = useCallback(
    (entry: HistoryEntry) => {
      setDossier(entry.dossier);
      setActiveEventId(entry.dossier.stagedEvents[0]?.id ?? null);
      addStagedUnique(entry.dossier.stagedEvents);

      if (entry.dossier.unlocked) {
        setUnlockState('unlocked');
        setMiddlePhase('UNLOCKED');
      } else {
        setUnlockState('locked');
        setMiddlePhase('PAYWALL_READY');
      }

      appendLog('info', `restored dossier → ${entry.batchId}`);
    },
    [addStagedUnique, appendLog],
  );

  const activeEventLabel = useMemo(() => {
    if (!activeEventId) return 'No active event';
    const staged = stagedEvents.find((e) => e.id === activeEventId);
    if (staged) return `${staged.id} · ${staged.triggerLabel}`;
    return activeEventId;
  }, [activeEventId, stagedEvents]);

  return (
    <div className="flex h-screen max-h-screen flex-col overflow-hidden bg-parallax-bg text-parallax-fg">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-parallax-border bg-white/80 px-4 backdrop-blur-sm">
        <ParallaxLogo size={28} showTagline />
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'hidden font-mono text-[9px] uppercase tracking-wider sm:inline',
              middlePhase === 'ANALYZING' && 'text-parallax-accent-blue',
              middlePhase === 'PAYWALL_READY' && 'text-parallax-accent',
              middlePhase === 'STAGING' && 'text-parallax-fg-muted',
              middlePhase === 'UNLOCKED' && 'text-emerald-600',
            )}
          >
            {middlePhase}
          </span>
          <TerminalWalletButton />
        </div>
      </header>

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="grid min-h-0 flex-1 grid-cols-12 gap-2 p-2"
      >
        <section className="col-span-3 flex min-h-0 flex-col">
          <HudLeftPanel
            stagedEvents={stagedEvents}
            registryEvents={registry}
            history={history}
            commandInput={commandInput}
            isResolving={isRouting}
            routingFeedback={routingFeedback}
            onCommandChange={setCommandInput}
            onCommandSubmit={handleCommandSubmit}
            onRemoveStaged={handleRemoveStaged}
            onRestoreHistory={handleRestoreHistory}
            onToggleRegistryEvent={handleToggleRegistryEvent}
          />
        </section>

        <section className="col-span-6 flex min-h-0 flex-col">
          <HudMiddlePanel
            phase={middlePhase}
            stagedCount={stagedEvents.length}
            dossier={dossier}
            unlockState={unlockState}
            activeEventLabel={activeEventLabel}
            onInitialize={() => void runCorrelationEngine()}
            onUnlock={() => void handleUnlock()}
            onCancel={handleResetSession}
            onFeedbackValidated={handleFeedbackValidated}
          />
        </section>

        <section className="col-span-3 flex min-h-0 flex-col">
          <HudRightPanel
            traceLogs={traceLogs}
            isExecuting={middlePhase === 'ANALYZING'}
            reputation={reputation}
            reputationLoading={reputationLoading}
            reputationCurve={reputationCurve}
            feedbackItems={feedbackFeed}
            agentDisplayId={PARALLAX_AGENT_ID}
          />
        </section>
      </motion.main>
    </div>
  );
}
