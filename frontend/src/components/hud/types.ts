import type { CrossEventCorrelation, ReportFull } from '@/lib/api';

export type UnlockState = 'locked' | 'paying' | 'unlocked';
/** Middle panel: Stage → Execute → Paywall → Unlocked */
export type MiddlePanelPhase = 'STAGING' | 'ANALYZING' | 'PAYWALL_READY' | 'UNLOCKED';

export interface ResearchDossier {
  batchId: string;
  eventCount: number;
  priceMNT: number;
  unifiedTeaser: string;
  stagedEvents: StagedEvent[];
  synthesis: ReportFull;
  eventReports: Array<{ eventId: string; eventName: string; report: ReportFull }>;
  crossEventCorrelation?: CrossEventCorrelation;
  unlocked: boolean;
}

export interface IntentRoutingFeedback {
  type: 'success' | 'fail';
  message: string;
}

export interface StagedEvent {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  triggerLabel: string;
}

export interface HistoryEntry {
  id: string;
  batchId: string;
  eventCount: number;
  /** Wall-clock ms when this correlation run was first saved (never reset on unlock). */
  savedAt: number;
  dossier: ResearchDossier;
}

export interface ExecutionNode {
  id: string;
  label: string;
  role: 'thinker' | 'worker' | 'verifier';
  status: 'idle' | 'active' | 'done';
  detail: string;
}

export interface TraceLogLine {
  id: string;
  timestamp: string;
  level: 'rpc' | 'info' | 'ok' | 'warn';
  message: string;
}

export interface Erc8004Feedback {
  score: number;
  maxScore: number;
  tag: string;
  comment: string;
  reviewer: string;
  /** Full reviewer address for localStorage tx lookup */
  reviewerFull?: string;
  feedbackKey?: string;
  feedbackIndex?: number;
  rawValue?: number | null;
  createdAt?: number;
  txHash: string;
  /** Full tx hash for subgraph matching (optimistic pending cards) */
  fullTxHash?: string;
  indexStatus?: 'pending' | 'verified';
}

export interface ReputationCurvePoint {
  label: string;
  score: number;
}
