import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FinalReport } from './types.js';

const reports = new Map<string, FinalReport>();

/**
 * Step 6 — Report Builder storage (in-memory Map + JSON file persistence).
 */
export class ReportStore {
  constructor(private readonly outputDir = resolve(process.cwd(), 'reports')) {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      const files = readdirSync(this.outputDir).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        const raw = readFileSync(resolve(this.outputDir, file), 'utf8');
        const report = JSON.parse(raw) as FinalReport;
        reports.set(report.eventId, report);
      }
    } catch {
      // reports/ may not exist yet
    }
  }

  async save(report: FinalReport): Promise<FinalReport> {
    reports.set(report.eventId, report);

    mkdirSync(this.outputDir, { recursive: true });
    const filePath = resolve(this.outputDir, `${report.eventId}.json`);
    writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    return report;
  }

  get(eventId: string): FinalReport | undefined {
    return reports.get(eventId);
  }

  list(): FinalReport[] {
    return [...reports.values()];
  }
}

export const reportStore = new ReportStore();
