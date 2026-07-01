export interface GeminiJsonCallOptions {
  apiKey: string;
  model?: string;
  systemInstruction?: string;
  prompt: string;
  responseSchema?: Record<string, unknown>;
  useGoogleSearch?: boolean;
  maxOutputTokens?: number;
  maxAttempts?: number;
}

export type GeminiJsonResult<T> =
  | {
      ok: true;
      data: T;
      rawText: string;
    }
  | {
      ok: false;
      status: number;
      body: string;
    };

function isRetryableGeminiStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 503;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);

  return text.trim();
}

async function callGeminiOnce(
  apiKey: string,
  model: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; text: string } | { ok: false; status: number; body: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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

/**
 * Call Gemini with optional JSON schema and Google Search grounding.
 */
export async function callGeminiJson<T>(
  options: GeminiJsonCallOptions,
): Promise<GeminiJsonResult<T>> {
  const model = options.model ?? process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const maxAttempts = options.maxAttempts ?? 4;

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: options.maxOutputTokens ?? 4096,
  };

  if (options.responseSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = options.responseSchema;
  }

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
    generationConfig,
  };

  if (options.systemInstruction) {
    body.systemInstruction = { parts: [{ text: options.systemInstruction }] };
  }

  if (options.useGoogleSearch) {
    body.tools = [{ google_search: {} }];
  }

  let last: { ok: false; status: number; body: string } = {
    ok: false,
    status: 500,
    body: 'No attempts made',
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await callGeminiOnce(options.apiKey, model, body);
    if (!result.ok) {
      last = result;
      if (!isRetryableGeminiStatus(result.status) || attempt === maxAttempts) break;
      await sleep(attempt * 4000);
      continue;
    }

    try {
      const data = JSON.parse(extractJsonObject(result.text)) as T;
      return { ok: true, data, rawText: result.text };
    } catch (error) {
      last = {
        ok: false,
        status: 500,
        body: `Failed to parse Gemini JSON: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
      if (attempt === maxAttempts) break;
      await sleep(attempt * 2000);
    }
  }

  return last;
}
