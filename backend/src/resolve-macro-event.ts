import 'dotenv/config';
import { isBatchMacroEventRequest, resolveMacroEvents } from './data/macro-event-resolver.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let request: { prompt?: string; event_ids?: string[]; prompts?: string[] };

  const idsFlagIndex = args.indexOf('--ids');
  if (idsFlagIndex >= 0) {
    const idsRaw = args[idsFlagIndex + 1];
    if (!idsRaw) {
      console.error('Usage: npm run resolve-event -- --ids fomc-mar-2026,spacex-ipo-q1');
      process.exit(1);
    }
    request = { event_ids: idsRaw.split(',').map((id) => id.trim()).filter(Boolean) };
  } else {
    const prompt = args.join(' ').trim();
    if (!prompt) {
      console.error('Usage:');
      console.error('  npm run resolve-event -- "FOMC March 2026"');
      console.error('  npm run resolve-event -- --ids fomc-mar-2026,spacex-ipo-q1,cpi-jun-2026');
      process.exit(1);
    }
    request = { prompt };
  }

  const mode = isBatchMacroEventRequest(request) ? 'batch' : 'single';
  console.log(`Resolving macro event(s) [${mode}]…\n`);

  const result = await resolveMacroEvents(request, {
    geminiApiKey: process.env.GEMINI_API_KEY,
    fredApiKey: process.env.FRED_API_KEY,
    geminiModel: process.env.GEMINI_MODEL,
  });

  console.log(JSON.stringify(result, null, 2));

  if (!result.success) {
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error('Macro event resolution failed:', error);
  process.exit(1);
});
