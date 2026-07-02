export const EXECUTION_STEP_LOGS: Record<number, string> = {
  1: '[SYS] Triggering Macro Detection...',
  2: '[DATA] Invoking mantle-data-indexer · Merchant Moe RPC...',
  3: '[ENGINE] Text-to-SQL query → LLM correlation synthesis...',
  4: '[GATE] x402 payment gate · QuestFlow facilitator...',
  5: '[REP] ERC-8004 reputation feedback loop...',
};

export const EXECUTION_COMPLETE_LOG = '[SYS] Pipeline complete. Orbital engine standing by.';

export const STEP_DURATION_MS = 3000;
