import type { ComputedMetrics } from './correlation-calculator.js';
import type { LlmSynthesis, MacroEvent } from './types.js';
import type { ReportSynthesisContext } from './snapshot-adapter.js';

const PARALLAX_SYSTEM_PROMPT = `
You are Parallax, an elite onchain quantitative researcher and autonomous agent operating on the Mantle network.
Your mandate is to analyze the correlation between traditional macroeconomic trigger events and the subsequent reaction across Mantle's CeDeFi distribution layer.

INPUT DATA:
You will receive a single JSON payload containing deterministic data collected by the Mantle Agent Skills. This payload includes:
1. Macro Event: FRED CPI (or configured series) trigger, surprise magnitude, and pre/post UTC windows.
2. xStocks Reaction (Leg 2): SPCXx on Merchant Moe LB — volume_spike_ratio, price_change_pct, liquidity_change_pct.
3. Aave V3 (Leg 3, replaces InsightX): historical pre/post utilization_rate, borrow_apy, total_supplied_usd deltas per stablecoin.
4. event_delta: cross-layer signal including capital_flow_direction (risk_on | risk_off | neutral).

YOUR TASK:
Synthesize this data into a professional, institutional-grade research report suitable for a hackathon Track 1 submission.
Analyze how the macro surprise relates to onchain capital positioning across xStocks DEX liquidity and Aave V3 stablecoin utilization.

RULES (CRITICAL):
1. ZERO HALLUCINATION: Rely STRICTLY on numbers in the input JSON. Do not invent metrics, dates, or prices.
2. If data_caveats or event_delta.data_quality note RPC snapshot limits for xStocks volume, state that transparently.
3. Do NOT mention InsightX or prediction markets when insightx_skipped is true.
4. Emphasize Aave utilization_delta and capital_flow_direction as the Leg 3 correlation signal.
5. SPCXx trades on Merchant Moe (DLMM), NOT Fluxion.
5. TONE: Institutional, analytical, objective. Use precise financial terminology.
6. MANTLE NARRATIVE: Reinforce Mantle as the distribution layer for RWAs and capital efficiency.
7. FORMATTING: Markdown headers (##, ###), bold (**), bullet points where appropriate.

OUTPUT FORMAT:
Output a strictly valid JSON object with exactly two keys:
1. "teaser": 2-3 sentences for x402 paywall — state the event and primary onchain finding; withhold deepest analysis.
2. "full_analysis": Comprehensive English research article (at least 1200 words, target 2000+) with sections such as:
   Executive Summary, Macro Context, The SpaceX / SPCXx Narrative on Mantle, Merchant Moe Liquidity Analysis,
   Aave V3 Stablecoin Positioning, Data Limitations (if applicable), Conclusion & Forward Implications.
`;

function buildUserPrompt(
  event: MacroEvent,
  metrics: ComputedMetrics,
  context: ReportSynthesisContext,
): string {
  const payload = {
    event: {
      eventId: event.eventId,
      eventName: event.eventName,
      targetToken: event.targetToken,
    },
    computed_metrics: metrics,
    event_delta: context.event_delta,
    collected_data: {
      macro: context.macro,
      xstocks: context.xstocks,
      aave: context.aave,
      aave_windows: context.aave_windows,
    },
    cross_event_correlation: context.cross_event_correlation,
    insightx_skipped: context.insightx_skipped,
    data_caveats: context.data_caveats,
  };

  return `${PARALLAX_SYSTEM_PROMPT}

Use ONLY the following JSON as your factual source:

${JSON.stringify(payload, null, 2)}`;
}

function parseGeminiJson(text: string): LlmSynthesis {
  const parsed = JSON.parse(text) as Partial<LlmSynthesis>;
  if (!parsed.teaser || !parsed.full_analysis) {
    throw new Error('Gemini response missing teaser or full_analysis fields.');
  }
  return { teaser: parsed.teaser, full_analysis: parsed.full_analysis };
}

function isRetryableGeminiStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 503;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<{ ok: true; text: string } | { ok: false; status: number; body: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            teaser: { type: 'string' },
            full_analysis: { type: 'string' },
          },
          required: ['teaser', 'full_analysis'],
        },
        maxOutputTokens: 16384,
      },
    }),
  });

  if (!response.ok) {
    return { ok: false, status: response.status, body: await response.text() };
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return { ok: false, status: 500, body: 'Gemini returned empty content.' };
  }

  return { ok: true, text };
}

async function callGeminiWithRetry(
  apiKey: string,
  model: string,
  prompt: string,
  maxAttempts = 4,
): Promise<{ ok: true; text: string } | { ok: false; status: number; body: string }> {
  let last: { ok: false; status: number; body: string } = {
    ok: false,
    status: 500,
    body: 'No attempts made',
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await callGemini(apiKey, model, prompt);
    if (result.ok) return result;

    last = result;
    if (!isRetryableGeminiStatus(result.status) || attempt === maxAttempts) break;

    const delayMs = attempt * 8000;
    console.warn(
      `Gemini ${model} attempt ${attempt}/${maxAttempts} failed (${result.status}); retrying in ${delayMs / 1000}s…`,
    );
    await sleep(delayMs);
  }

  return last;
}

/**
 * Step 5 — LLM Synthesizer (Gemini API with structured JSON output).
 */
export async function synthesizeReport(
  event: MacroEvent,
  metrics: ComputedMetrics,
  apiKey?: string,
  context?: ReportSynthesisContext,
): Promise<{ synthesis: LlmSynthesis; source: 'gemini' | 'mock' }> {
  const key = apiKey ?? process.env.GEMINI_API_KEY;

  if (!key) {
    return { synthesis: buildMockSynthesis(event, metrics, context), source: 'mock' };
  }

  const prompt = context
    ? buildUserPrompt(event, metrics, context)
    : buildLegacyUserPrompt(event, metrics);

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const result = await callGeminiWithRetry(key, model, prompt);

  if (!result.ok) {
    console.warn(`Gemini API error ${result.status}: ${result.body.slice(0, 200)}`);
    console.warn('Falling back to deterministic synthesis with snapshot data.');
    return {
      synthesis: buildMockSynthesis(event, metrics, context),
      source: 'mock',
    };
  }

  return { synthesis: parseGeminiJson(result.text), source: 'gemini' };
}

function buildLegacyUserPrompt(event: MacroEvent, metrics: ComputedMetrics): string {
  return `Event: ${event.eventName} (${event.eventId})
Target token: ${event.targetToken}

Computed metrics (use only these numbers):
${JSON.stringify(metrics, null, 2)}`;
}

/** Deterministic fallback when GEMINI_API_KEY is not configured. */
export function buildMockSynthesis(
  event: MacroEvent,
  metrics: ComputedMetrics,
  context?: ReportSynthesisContext,
): LlmSynthesis {
  if (context) {
    const xs = context.xstocks;
    const venue = xs.provider === 'merchant_moe' ? 'Merchant Moe' : xs.provider;
    const priceNote =
      context.xstocks.price_shift_pct != null
        ? `Price shifted ${context.xstocks.price_shift_pct.toFixed(2)}% across the measurement window.`
        : `Spot price: $${xs.spot_price_usdt0?.toFixed(2) ?? 'n/a'} USDT0.`;

    return {
      teaser:
        `FRED macro surprise ${metrics.macroSurprise.toFixed(2)} mapped to $${event.targetToken} on ${venue}: ` +
        `TVL $${xs.tvl_usd?.toLocaleString() ?? 'n/a'}, 24h volume $${xs.volume_24h_usd?.toLocaleString() ?? 'n/a'}. ` +
        `${priceNote}`,
      full_analysis:
        `## ${event.eventName}: Macro-to-Onchain Correlation\n\n` +
        `### Macro Context\n` +
        `FRED ${context.macro.fred_series_id ?? 'series'} observation (${context.macro.fred_observation_date ?? 'n/a'}): ` +
        `${context.macro.current_value ?? 'n/a'} vs prior ${context.macro.previous_value ?? 'n/a'} ` +
        `(surprise magnitude ${metrics.macroSurprise.toFixed(2)}).\n\n` +
        `### xStocks on ${venue}\n` +
        `**$${event.targetToken}** pool ${xs.pool_address ?? 'n/a'} (bin_step ${xs.bin_step ?? 'n/a'}): ` +
        `spot **$${xs.spot_price_usdt0?.toFixed(2) ?? 'n/a'}**, TVL **$${xs.tvl_usd?.toLocaleString() ?? 'n/a'}**, ` +
        `24h volume **$${xs.volume_24h_usd?.toLocaleString() ?? 'n/a'}**.\n\n` +
        `### Aave V3\n` +
        context.aave.markets
          .map(
            (m) =>
              `- **${m.asset}**: supply APY ${m.supply_apy ?? 'n/a'}%, TVL $${m.tvl_usd?.toLocaleString() ?? 'n/a'}`,
          )
          .join('\n') +
        `\n\n### Data Notes\n` +
        (context.data_caveats.length > 0 ? context.data_caveats.map((c) => `- ${c}`).join('\n') : '- None') +
        `\n\n*Configure GEMINI_API_KEY for full LLM synthesis.*`,
    };
  }

  const direction = metrics.priceDelta < 0 ? 'declined' : 'rose';
  const volumeNote =
    metrics.volumeSpike >= 2
      ? `Volume surged ${metrics.volumeSpike}x versus the pre-event baseline.`
      : `Volume moved modestly at ${metrics.volumeSpike}x the baseline.`;

  return {
    teaser: `$${event.targetToken} ${direction} ${Math.abs(metrics.priceDelta).toFixed(1)}% following "${event.eventName}". ${volumeNote}`,
    full_analysis: `## ${event.eventName}: Macro-to-Onchain Correlation\n\n` +
      `Parallax measured **$${event.targetToken}** against macro surprise magnitude **${metrics.macroSurprise}**.\n\n` +
      `### Price Reaction\nTokenized equity price **${direction} ${Math.abs(metrics.priceDelta).toFixed(2)}%** in the post-event window.\n\n` +
      `### Volume Dynamics\n${volumeNote}\n\n` +
      `*Configure GEMINI_API_KEY for full LLM synthesis.*`,
  };
}
