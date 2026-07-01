import { callGeminiJson } from '../lib/gemini-client.js';
import type { CrossEventCorrelation } from '../data/cross-event-correlation.js';

export interface EventSummary {
  id: string;
  surprise_delta: number;
  xstocks_price_change_pct: number;
  aave_utilization_delta: number;
  event_teaser: string;
}

export interface CrossCorrelationMetrics {
  pearson_macro_xstocks: number;
  pearson_xstocks_aave: number;
  capital_flow_regime: 'Risk-On' | 'Risk-Off' | 'Mixed';
}

export interface CombinedReportOutput {
  teaser: string;
  full_analysis: string;
}

export class CombinedSynthesisError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'CombinedSynthesisError';
  }
}

const COMBINED_SYSTEM_PROMPT = `You are the Chief Macro Strategist for Parallax, an institutional-grade quantitative agent on the Mantle Network. You analyze capital rotation between Real-World Assets (Tokenized xStocks on Merchant Moe) and CeDeFi lending markets (Aave V3).`;

const COMBINED_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    teaser: { type: 'string' },
    full_analysis: { type: 'string' },
  },
  required: ['teaser', 'full_analysis'],
} as const;

function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);

  return text.trim();
}

function validateInputs(events: EventSummary[], metrics: CrossCorrelationMetrics): void {
  if (events.length < 2) {
    throw new CombinedSynthesisError('Combined synthesis requires at least 2 events.');
  }

  for (const event of events) {
    if (!event.id?.trim()) {
      throw new CombinedSynthesisError('Each EventSummary must have a non-empty id.');
    }
    if (!event.event_teaser?.trim()) {
      throw new CombinedSynthesisError(`Event "${event.id}" is missing event_teaser.`);
    }
    if (!Number.isFinite(event.surprise_delta)) {
      throw new CombinedSynthesisError(`Event "${event.id}" has invalid surprise_delta.`);
    }
    if (!Number.isFinite(event.xstocks_price_change_pct)) {
      throw new CombinedSynthesisError(`Event "${event.id}" has invalid xstocks_price_change_pct.`);
    }
    if (!Number.isFinite(event.aave_utilization_delta)) {
      throw new CombinedSynthesisError(`Event "${event.id}" has invalid aave_utilization_delta.`);
    }
  }

  const validRegimes = new Set<CrossCorrelationMetrics['capital_flow_regime']>([
    'Risk-On',
    'Risk-Off',
    'Mixed',
  ]);
  if (!validRegimes.has(metrics.capital_flow_regime)) {
    throw new CombinedSynthesisError(
      `Invalid capital_flow_regime: ${String(metrics.capital_flow_regime)}`,
    );
  }

  for (const [key, value] of Object.entries({
    pearson_macro_xstocks: metrics.pearson_macro_xstocks,
    pearson_xstocks_aave: metrics.pearson_xstocks_aave,
  })) {
    if (!Number.isFinite(value)) {
      throw new CombinedSynthesisError(`Invalid ${key}: expected a finite number.`);
    }
  }
}

function buildCombinedUserPrompt(
  events: EventSummary[],
  metrics: CrossCorrelationMetrics,
): string {
  return `Below is a highly compressed cross-event quantitative dataset.

[CROSS-EVENT CORRELATION METRICS]

Pearson r (Macro Surprise to xStocks Price): ${metrics.pearson_macro_xstocks}

Pearson r (xStocks Price to Aave Utilization): ${metrics.pearson_xstocks_aave}

Dominant Capital Flow Regime: ${metrics.capital_flow_regime}

[INDIVIDUAL EVENT CONTEXTS (SUMMARY INGESTION)]

${JSON.stringify(events, null, 2)}

Your Task:

Synthesize an "Executive Research Dossier" evaluating the overarching macroeconomic trends.

Do NOT just list the events one by one. Analyze the slope and trend indicated by the Pearson r coefficients. What does a correlation of ${metrics.pearson_macro_xstocks} reveal about Mantle's RWA market?

Explain the macroeconomic transmission mechanism: based on the event contexts provided, why is capital rotating between Merchant Moe's Liquidity Book and Aave's lending pools?

Adopt a sophisticated, sovereign thematic tone (resembling Goldman Sachs Global Investment Research or Bridgewater Daily Observations). Focus on capital velocity, hedging behaviors, and risk pricing on Mantle L2.

You must output strictly in JSON format matching this schema:

{
"teaser": "A dramatic, high-impact 1-sentence alpha synthesis of the cross-event correlation.",
"full_analysis": "### ✦ EXECUTIVE SYNTHESIS\\n\\n[Your deep markdown analysis here. Use headings, bullet points, and highlight specific data points from the inputs.]"
}`;
}

function parseCombinedOutput(rawText: string): CombinedReportOutput {
  let parsed: Partial<CombinedReportOutput>;
  try {
    parsed = JSON.parse(extractJsonObject(rawText)) as Partial<CombinedReportOutput>;
  } catch (error) {
    throw new CombinedSynthesisError(
      'Failed to parse LLM response as JSON.',
      error,
    );
  }

  if (!parsed.teaser?.trim() || !parsed.full_analysis?.trim()) {
    throw new CombinedSynthesisError('LLM response missing teaser or full_analysis fields.');
  }

  return {
    teaser: parsed.teaser.trim(),
    full_analysis: parsed.full_analysis.trim(),
  };
}

function formatPearson(value: number): string {
  return value.toFixed(3);
}

/** Deterministic fallback when GEMINI_API_KEY is unavailable or the API fails. */
export function buildMockCombinedSynthesis(
  events: EventSummary[],
  metrics: CrossCorrelationMetrics,
): CombinedReportOutput {
  const eventLines = events
    .map(
      (e) =>
        `- **${e.id}**: surprise ${e.surprise_delta.toFixed(2)}, xStocks Δ ${e.xstocks_price_change_pct.toFixed(2)}%, Aave util Δ ${e.aave_utilization_delta.toFixed(2)} pp`,
    )
    .join('\n');

  const macroSign =
    metrics.pearson_macro_xstocks > 0.3
      ? 'positive macro-to-RWA transmission'
      : metrics.pearson_macro_xstocks < -0.3
        ? 'inverse macro-to-RWA hedging'
        : 'weak macro-to-RWA coupling';

  return {
    teaser:
      `Across ${events.length} macro triggers, Parallax measures ${macroSign} ` +
      `(r=${formatPearson(metrics.pearson_macro_xstocks)}) with ${metrics.capital_flow_regime} capital rotation on Mantle.`,
    full_analysis:
      `### ✦ EXECUTIVE SYNTHESIS\n\n` +
      `Parallax aggregated **${events.length}** macro catalysts into a cross-event correlation dossier. ` +
      `Pearson **r(macro surprise, xStocks price) = ${formatPearson(metrics.pearson_macro_xstocks)}** ` +
      `and **r(xStocks price, Aave utilization) = ${formatPearson(metrics.pearson_xstocks_aave)}** ` +
      `frame the dominant **${metrics.capital_flow_regime}** regime on Mantle L2.\n\n` +
      `#### Event Summary Ingestion\n${eventLines}\n\n` +
        `#### Capital Rotation Thesis\n` +
        `Merchant Moe Liquidity Book bins and Aave V3 stablecoin pools are acting as paired venues for ` +
        `macro shock absorption: equity-beta expression via tokenized xStocks versus carry and hedge demand ` +
        `in CeDeFi lending markets.\n\n` +
        `*Configure GEMINI_API_KEY for live LLM executive synthesis.*`,
  };
}

/**
 * Derive capital flow regime label from cross-event series when not supplied explicitly.
 */
export function deriveCapitalFlowRegime(
  correlation: CrossEventCorrelation,
): CrossCorrelationMetrics['capital_flow_regime'] {
  let riskOn = 0;
  let riskOff = 0;

  for (const row of correlation.series) {
    const price = row.xstocks_price_change_pct;
    const util = row.aave_utilization_delta;
    if (price == null || util == null) continue;

    if (price > 0 && util <= 0) riskOn++;
    else if (price < 0 && util >= 0) riskOff++;
    else if (price > 0 && util > 0) riskOn++;
    else if (price < 0 && util < 0) riskOff++;
  }

  if (riskOn > 0 && riskOff === 0) return 'Risk-On';
  if (riskOff > 0 && riskOn === 0) return 'Risk-Off';
  return 'Mixed';
}

/**
 * Map acquisition cross-event correlation + per-event teasers into summary-ingestion inputs.
 */
export function buildCombinedSynthesisInputs(
  correlation: CrossEventCorrelation,
  teasersByEventId: Record<string, string>,
  regime?: CrossCorrelationMetrics['capital_flow_regime'],
): { events: EventSummary[]; metrics: CrossCorrelationMetrics } {
  const events: EventSummary[] = correlation.series.map((row) => ({
    id: row.event_id,
    surprise_delta: row.macro_surprise,
    xstocks_price_change_pct: row.xstocks_price_change_pct ?? 0,
    aave_utilization_delta: row.aave_utilization_delta ?? 0,
    event_teaser:
      teasersByEventId[row.event_id]?.trim() ||
      `Macro event ${row.event_id} processed by Parallax correlation engine.`,
  }));

  const metrics: CrossCorrelationMetrics = {
    pearson_macro_xstocks: correlation.pearson_macro_xstocks ?? 0,
    pearson_xstocks_aave: correlation.pearson_xstocks_aave ?? 0,
    capital_flow_regime: regime ?? deriveCapitalFlowRegime(correlation),
  };

  return { events, metrics };
}

/**
 * Map-Reduce combined synthesis: ingest event summaries + Pearson metrics, emit executive dossier.
 */
export async function generateCombinedSynthesis(
  events: EventSummary[],
  metrics: CrossCorrelationMetrics,
  apiKey?: string,
): Promise<CombinedReportOutput> {
  validateInputs(events, metrics);

  const key = apiKey ?? process.env.GEMINI_API_KEY;
  if (!key) {
    return buildMockCombinedSynthesis(events, metrics);
  }

  const result = await callGeminiJson<CombinedReportOutput>({
    apiKey: key,
    systemInstruction: COMBINED_SYSTEM_PROMPT,
    prompt: buildCombinedUserPrompt(events, metrics),
    responseSchema: COMBINED_RESPONSE_SCHEMA,
    maxOutputTokens: 8192,
  });

  if (!result.ok) {
    console.warn(
      `Gemini combined synthesis failed (${result.status}): ${result.body.slice(0, 200)}`,
    );
    return buildMockCombinedSynthesis(events, metrics);
  }

  try {
    return parseCombinedOutput(result.rawText);
  } catch (error) {
    if (error instanceof CombinedSynthesisError) {
      console.warn(`Gemini combined synthesis parse error: ${error.message}`);
      return buildMockCombinedSynthesis(events, metrics);
    }
    throw error;
  }
}
