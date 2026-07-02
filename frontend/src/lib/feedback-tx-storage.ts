import type { Erc8004Feedback } from '@/components/hud/types';

const STORAGE_KEY = 'parallax-feedback-tx-registry';

export interface StoredFeedbackTx {
  fullTxHash: string;
  feedbackKey: string;
  reviewer: string;
  feedbackIndex?: number;
  value?: number;
  createdAt?: number;
  comment?: string;
  savedAt: number;
}

export interface FeedbackTxRegistry {
  version: 1;
  byKey: Record<string, StoredFeedbackTx>;
  byTxHash: Record<string, StoredFeedbackTx>;
}

/** Bootstrapped from on-chain log scan (agent 5003:308) */
export const FEEDBACK_TX_SEED: FeedbackTxRegistry = {
  version: 1,
  byKey: {
    '0x29fdb176c316982da6876425c7ec2b75041a8552:1': {
      fullTxHash: '0x949eb4e623eb95e65f4e79206f56189a8bd9952ee5089a96c54a5b3db135532e',
      feedbackKey: '0x29fdb176c316982da6876425c7ec2b75041a8552:1',
      reviewer: '0x29fdb176c316982da6876425c7ec2b75041a8552',
      feedbackIndex: 1,
      value: 80,
      createdAt: 1782561779,
      savedAt: 1782911145337,
    },
    '0x29fdb176c316982da6876425c7ec2b75041a8552:2': {
      fullTxHash: '0x2749e95d62774f37cd1e9323b56ceab772e2040d5a8caf1ea792559e36882e16',
      feedbackKey: '0x29fdb176c316982da6876425c7ec2b75041a8552:2',
      reviewer: '0x29fdb176c316982da6876425c7ec2b75041a8552',
      feedbackIndex: 2,
      value: 100,
      createdAt: 1782564465,
      savedAt: 1782911145338,
    },
    '0x29fdb176c316982da6876425c7ec2b75041a8552:3': {
      fullTxHash: '0x36e24d8affd2604a93721d286f110c2b045c2017017b454a1888ecc64d2c6f31',
      feedbackKey: '0x29fdb176c316982da6876425c7ec2b75041a8552:3',
      reviewer: '0x29fdb176c316982da6876425c7ec2b75041a8552',
      feedbackIndex: 3,
      value: 80,
      createdAt: 1782564541,
      savedAt: 1782911145338,
    },
    '0x29fdb176c316982da6876425c7ec2b75041a8552:4': {
      fullTxHash: '0x27365975f6c6da031fc97b0557b5b4e1b3552bb0dad286705f3eb84a4062db88',
      feedbackKey: '0x29fdb176c316982da6876425c7ec2b75041a8552:4',
      reviewer: '0x29fdb176c316982da6876425c7ec2b75041a8552',
      feedbackIndex: 4,
      value: 80,
      createdAt: 1782885035,
      savedAt: 1782911145338,
    },
    '0x29fdb176c316982da6876425c7ec2b75041a8552:5': {
      fullTxHash: '0x63c30495050764d4d9aaed0253f9970b7aef196a686a3e92c7ea7b0183dde0cf',
      feedbackKey: '0x29fdb176c316982da6876425c7ec2b75041a8552:5',
      reviewer: '0x29fdb176c316982da6876425c7ec2b75041a8552',
      feedbackIndex: 5,
      value: 100,
      createdAt: 1782911395,
      comment: 'All is really good!',
      savedAt: 1782912000000,
    },
  },
  byTxHash: {},
};

// Populate byTxHash from byKey
for (const rec of Object.values(FEEDBACK_TX_SEED.byKey)) {
  FEEDBACK_TX_SEED.byTxHash[rec.fullTxHash.toLowerCase()] = rec;
}

const CANONICAL_KEY_RE = /^0x[a-f0-9]{40}:\d+$/i;
const FALLBACK_COMMENT_RE = /^Validated via /;

function emptyRegistry(): FeedbackTxRegistry {
  return { version: 1, byKey: {}, byTxHash: {} };
}

function normalizeRegistry(raw: unknown): FeedbackTxRegistry {
  if (!raw || typeof raw !== 'object') return emptyRegistry();
  const data = raw as Partial<FeedbackTxRegistry>;
  const byKey = data.byKey && typeof data.byKey === 'object' ? { ...data.byKey } : {};
  const byTxHash =
    data.byTxHash && typeof data.byTxHash === 'object' ? { ...data.byTxHash } : {};
  for (const rec of Object.values(byKey)) {
    byTxHash[rec.fullTxHash.toLowerCase()] = rec;
  }
  return { version: 1, byKey, byTxHash };
}

export function feedbackTxKey(reviewer: string, feedbackIndex: number): string {
  return `${reviewer.toLowerCase()}:${feedbackIndex}`;
}

export function shortenTxHash(hash: string): string {
  if (hash.length < 14) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

export function isFallbackComment(comment: string): boolean {
  return FALLBACK_COMMENT_RE.test(comment.trim());
}

function mergeRegistries(base: FeedbackTxRegistry, overlay: FeedbackTxRegistry): FeedbackTxRegistry {
  const byKey = { ...base.byKey, ...overlay.byKey };
  const byTxHash = { ...base.byTxHash, ...overlay.byTxHash };
  for (const rec of Object.values(byKey)) {
    byTxHash[rec.fullTxHash.toLowerCase()] = rec;
  }
  return { version: 1, byKey, byTxHash };
}

function repairCanonicalKeys(registry: FeedbackTxRegistry): FeedbackTxRegistry {
  const byKey = { ...registry.byKey };
  for (const [key, seedRec] of Object.entries(FEEDBACK_TX_SEED.byKey)) {
    if (CANONICAL_KEY_RE.test(key)) {
      const existing = byKey[key];
      byKey[key] = {
        ...seedRec,
        comment: existing?.comment && !isFallbackComment(existing.comment)
          ? existing.comment
          : seedRec.comment ?? existing?.comment,
        savedAt: Math.max(existing?.savedAt ?? 0, seedRec.savedAt),
      };
    }
  }
  const byTxHash = { ...registry.byTxHash, ...FEEDBACK_TX_SEED.byTxHash };
  for (const rec of Object.values(byKey)) {
    byTxHash[rec.fullTxHash.toLowerCase()] = rec;
  }
  return { version: 1, byKey, byTxHash };
}

export function loadFeedbackTxRegistry(): FeedbackTxRegistry {
  if (typeof window === 'undefined') return repairCanonicalKeys(FEEDBACK_TX_SEED);

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = repairCanonicalKeys(mergeRegistries(FEEDBACK_TX_SEED, emptyRegistry()));
      saveFeedbackTxRegistry(seeded);
      return seeded;
    }
    return repairCanonicalKeys(normalizeRegistry(JSON.parse(raw)));
  } catch {
    return repairCanonicalKeys(FEEDBACK_TX_SEED);
  }
}

export function saveFeedbackTxRegistry(registry: FeedbackTxRegistry): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
  } catch {
    // private mode / quota
  }
}

/** Persist tx (+ optional comment) after wallet submit or API/RPC sync */
export function saveFeedbackTx(
  record: Omit<StoredFeedbackTx, 'savedAt'> & { savedAt?: number },
): void {
  const entry: StoredFeedbackTx = {
    ...record,
    reviewer: record.reviewer.toLowerCase(),
    savedAt: record.savedAt ?? Date.now(),
  };
  const registry = loadFeedbackTxRegistry();
  const prev = registry.byKey[entry.feedbackKey];
  if (prev) {
    entry.comment =
      entry.comment && !isFallbackComment(entry.comment)
        ? entry.comment
        : prev.comment && !isFallbackComment(prev.comment)
          ? prev.comment
          : entry.comment;
  }
  registry.byKey[entry.feedbackKey] = entry;
  registry.byTxHash[entry.fullTxHash.toLowerCase()] = entry;
  saveFeedbackTxRegistry(registry);
}

export function mergeSeedIntoFeedbackTxRegistry(seed: FeedbackTxRegistry): void {
  const current = loadFeedbackTxRegistry();
  saveFeedbackTxRegistry(repairCanonicalKeys(mergeRegistries(seed, current)));
}

function reviewerMatches(stored: string, display: string, full?: string): boolean {
  const s = stored.toLowerCase();
  const d = display.toLowerCase();
  if (full && s === full.toLowerCase()) return true;
  if (s === d) return true;
  if (d.includes('...')) {
    const [pre, suf] = d.split('...');
    return s.startsWith(pre) && s.endsWith(suf);
  }
  return false;
}

function resolveReviewerFull(item: Erc8004Feedback): string | undefined {
  if (item.reviewerFull) return item.reviewerFull.toLowerCase();
  const seedReviewer = Object.values(FEEDBACK_TX_SEED.byKey)[0]?.reviewer;
  if (seedReviewer && reviewerMatches(seedReviewer, item.reviewer)) return seedReviewer;
  return undefined;
}

function resolveFeedbackKey(item: Erc8004Feedback): string | undefined {
  if (item.feedbackKey) return item.feedbackKey;
  if (item.feedbackIndex != null) {
    const reviewer = resolveReviewerFull(item);
    if (reviewer) return feedbackTxKey(reviewer, item.feedbackIndex);
  }
  return undefined;
}

function findStoredTxByKey(
  registry: FeedbackTxRegistry,
  key: string | undefined,
  usedKeys: Set<string>,
): StoredFeedbackTx | undefined {
  if (!key || usedKeys.has(key)) return undefined;
  const hit = registry.byKey[key];
  if (!hit || usedKeys.has(hit.feedbackKey)) return undefined;
  return hit;
}

/** When API lacks feedbackKey, assign unused seed rows with matching on-chain value */
function findSeedTxByValue(
  registry: FeedbackTxRegistry,
  item: Erc8004Feedback,
  usedKeys: Set<string>,
): StoredFeedbackTx | undefined {
  const reviewer = resolveReviewerFull(item);
  if (reviewer == null || item.rawValue == null) return undefined;

  const pool = Object.values(registry.byKey)
    .filter(
      (rec) =>
        CANONICAL_KEY_RE.test(rec.feedbackKey) &&
        !usedKeys.has(rec.feedbackKey) &&
        rec.reviewer === reviewer &&
        rec.value === item.rawValue,
    )
    .sort((a, b) => (a.feedbackIndex ?? 0) - (b.feedbackIndex ?? 0));

  return pool[0];
}

function findPendingWalletTx(
  registry: FeedbackTxRegistry,
  item: Erc8004Feedback,
  usedKeys: Set<string>,
): StoredFeedbackTx | undefined {
  const reviewer = resolveReviewerFull(item);
  if (!reviewer) return undefined;

  return Object.values(registry.byKey).find(
    (rec) =>
      rec.feedbackKey.startsWith('tx:') &&
      !usedKeys.has(rec.feedbackKey) &&
      reviewerMatches(rec.reviewer, item.reviewer, reviewer) &&
      (item.rawValue == null || rec.value === item.rawValue),
  );
}

function applyStoredRecord<T extends Erc8004Feedback>(
  item: T,
  stored: StoredFeedbackTx,
  usedKeys: Set<string>,
): T {
  usedKeys.add(stored.feedbackKey);
  const feedbackKey = resolveFeedbackKey(item) ?? stored.feedbackKey;
  const comment =
    item.comment && !isFallbackComment(item.comment)
      ? item.comment
      : stored.comment && !isFallbackComment(stored.comment)
        ? stored.comment
        : item.comment;

  return {
    ...item,
    feedbackKey,
    feedbackIndex: item.feedbackIndex ?? stored.feedbackIndex,
    reviewerFull: item.reviewerFull ?? stored.reviewer,
    fullTxHash: stored.fullTxHash,
    txHash: shortenTxHash(stored.fullTxHash),
    comment,
  };
}

export function enrichFeedbackWithStoredTx<T extends Erc8004Feedback>(items: T[]): T[] {
  const registry = loadFeedbackTxRegistry();
  const usedKeys = new Set<string>();

  return items.map((item) => {
    const hasTx =
      Boolean(item.fullTxHash) || (Boolean(item.txHash) && item.txHash !== 'pending');
    if (hasTx) return item;

    const key = resolveFeedbackKey(item);
    const stored =
      findStoredTxByKey(registry, key, usedKeys) ??
      (item.fullTxHash
        ? registry.byTxHash[item.fullTxHash.toLowerCase()]
        : undefined) ??
      findSeedTxByValue(registry, item, usedKeys) ??
      findPendingWalletTx(registry, item, usedKeys);

    if (!stored || usedKeys.has(stored.feedbackKey)) return item;
    return applyStoredRecord(item, stored, usedKeys);
  });
}

export function enrichFeedbackComments<T extends Erc8004Feedback>(items: T[]): T[] {
  const registry = loadFeedbackTxRegistry();
  return items.map((item) => {
    if (!isFallbackComment(item.comment)) return item;
    const key = resolveFeedbackKey(item);
    const stored = key ? registry.byKey[key] : undefined;
    if (stored?.comment && !isFallbackComment(stored.comment)) {
      return { ...item, comment: stored.comment };
    }
    return item;
  });
}

/** Persist RPC/API feed into localStorage (tx + IPFS comment) for future loads */
export function syncFeedbackFeedToStorage(items: Erc8004Feedback[]): void {
  for (const item of items) {
    const key = resolveFeedbackKey(item);
    const fullTxHash = item.fullTxHash;
    const reviewer = resolveReviewerFull(item);
    if (!fullTxHash || !reviewer) continue;

    const feedbackKey =
      key ??
      (item.feedbackIndex != null
        ? feedbackTxKey(reviewer, item.feedbackIndex)
        : `tx:${fullTxHash.toLowerCase()}`);

    saveFeedbackTx({
      fullTxHash,
      feedbackKey,
      reviewer,
      feedbackIndex: item.feedbackIndex,
      value: item.rawValue ?? undefined,
      createdAt: item.createdAt,
      comment: !isFallbackComment(item.comment) ? item.comment : undefined,
    });
  }
}

/** Full pipeline: enrich from storage → sync API/RPC results back to storage */
export function processFeedbackFeed<T extends Erc8004Feedback>(items: T[]): T[] {
  const withTx = enrichFeedbackWithStoredTx(items);
  const withComments = enrichFeedbackComments(withTx);
  syncFeedbackFeedToStorage(withComments);
  return withComments;
}
