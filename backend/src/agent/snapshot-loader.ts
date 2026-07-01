import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AcquisitionSnapshot } from '../data/types.js';

export type LoadedAcquisitionSnapshot = Omit<AcquisitionSnapshot, 'insightx'> & {
  insightx?: AcquisitionSnapshot['insightx'];
};

const DEFAULT_SNAPSHOT_PATH = resolve(process.cwd(), 'data-snapshot.json');

export function loadAcquisitionSnapshot(
  snapshotPath = process.env.DATA_SNAPSHOT_PATH ?? DEFAULT_SNAPSHOT_PATH,
): LoadedAcquisitionSnapshot {
  const raw = readFileSync(snapshotPath, 'utf8');
  return JSON.parse(raw) as LoadedAcquisitionSnapshot;
}
