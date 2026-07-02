import type { AcquisitionTraceLog } from '@/lib/api';
import { terminalNowStamp } from '@/lib/terminal-timestamp';

const CACHE_CHECK_STEPS: Array<Omit<AcquisitionTraceLog, 'timestamp'>> = [
  { level: 'info', message: '> correlation engine initialized', node: 'thinker' },
  { level: 'info', message: 'Checking Staging Cache...', node: 'thinker' },
];

export function buildCachePreambleSteps(): Array<Omit<AcquisitionTraceLog, 'timestamp'>> {
  return CACHE_CHECK_STEPS;
}

const WAITING_STEPS: Array<Omit<AcquisitionTraceLog, 'timestamp'>> = [
  { level: 'info', message: 'Aggregating DLMM State...', node: 'worker' },
  { level: 'rpc', message: 'eth_call getActiveId(pool=SPCXx, block=pre_window)', node: 'worker' },
  { level: 'rpc', message: 'getReserveData(USDT0|USDe) @ AaveDataProvider', node: 'worker' },
  { level: 'info', message: 'Awaiting quantitative engine response...', node: 'verifier' },
];

export function buildWaitingStepLogs(existingCount: number): AcquisitionTraceLog[] {
  const step = WAITING_STEPS[existingCount % WAITING_STEPS.length]!;
  return [{ ...step, timestamp: terminalNowStamp() }];
}

/**
 * Poll waiting steps until `ready` resolves (slow-path dwell while backend generates).
 */
export async function playWhileWaiting<T>(
  task: Promise<T>,
  options: {
    seedLogs: AcquisitionTraceLog[];
    intervalMs?: number;
    onLog: (logs: AcquisitionTraceLog[]) => void;
  },
): Promise<T> {
  const { seedLogs, intervalMs = 650, onLog } = options;
  const accumulated = [...seedLogs];
  onLog(accumulated);

  let waitingIndex = 0;
  const timer = setInterval(() => {
    accumulated.push(...buildWaitingStepLogs(waitingIndex));
    waitingIndex += 1;
    onLog([...accumulated]);
  }, intervalMs);

  try {
    return await task;
  } finally {
    clearInterval(timer);
  }
}

/**
 * Play terminal logs with a minimum dwell time so cache hits still feel "computed".
 */
export async function playCorrelationTrace(
  logs: AcquisitionTraceLog[],
  options: {
    minDurationMs: number;
    perLogDelayMs?: number;
    onLog: (logs: AcquisitionTraceLog[]) => void;
    onNodeProgress?: (node: NonNullable<AcquisitionTraceLog['node']>) => void;
  },
): Promise<void> {
  const { minDurationMs, perLogDelayMs = 0, onLog, onNodeProgress } = options;
  const startedAt = Date.now();
  const accumulated: AcquisitionTraceLog[] = [];

  const emit = (log: AcquisitionTraceLog) => {
    accumulated.push({ ...log, timestamp: terminalNowStamp() });
    onLog([...accumulated]);
    if (log.node) onNodeProgress?.(log.node);
  };

  for (let index = 0; index < logs.length; index++) {
    const log = logs[index]!;
    emit(log);
    if (index < logs.length - 1 && perLogDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, perLogDelayMs));
    }
  }

  const elapsed = Date.now() - startedAt;
  if (elapsed < minDurationMs) {
    await new Promise((resolve) => setTimeout(resolve, minDurationMs - elapsed));
  }
}

export function traceDelayForStatus(
  status: 'cache_hit' | 'cache_miss' | 'live_generated' | undefined,
  animationMs?: number,
): { minDurationMs: number; perLogDelayMs: number } {
  if (animationMs != null) {
    const isFast = status === 'cache_hit';
    return {
      minDurationMs: animationMs,
      perLogDelayMs: isFast ? 45 : 120,
    };
  }

  if (status === 'cache_hit') {
    return { minDurationMs: 1500, perLogDelayMs: 45 };
  }
  return { minDurationMs: 3000, perLogDelayMs: 120 };
}

/** Append new trace lines without replaying the base sequence. */
export async function appendTraceLogs(
  baseLogs: AcquisitionTraceLog[],
  newLogs: AcquisitionTraceLog[],
  options: {
    perLogDelayMs?: number;
    minTailMs?: number;
    skipMessageIncludes?: string[];
    onLog: (logs: AcquisitionTraceLog[]) => void;
  },
): Promise<void> {
  const {
    perLogDelayMs = 70,
    minTailMs = 800,
    skipMessageIncludes = ['Checking Staging Cache', 'scanning staging cache'],
    onLog,
  } = options;

  const merged = [...baseLogs];
  onLog(merged);
  const startedAt = Date.now();

  for (const log of newLogs) {
    if (skipMessageIncludes.some((pattern) => log.message.includes(pattern))) continue;
    merged.push({ ...log, timestamp: terminalNowStamp() });
    onLog([...merged]);
    await new Promise((resolve) => setTimeout(resolve, perLogDelayMs));
  }

  const elapsed = Date.now() - startedAt;
  if (elapsed < minTailMs) {
    await new Promise((resolve) => setTimeout(resolve, minTailMs - elapsed));
  }
}
