import type { Erc8004Feedback } from '@/components/hud/types';

const MAX_FEED_ITEMS = 10;

/** Stable dedupe key — one card per on-chain feedback, not per tx hash */
export function feedItemKey(item: Erc8004Feedback): string {
  if (item.feedbackKey) return item.feedbackKey;
  if (item.feedbackIndex != null && item.reviewerFull) {
    return `${item.reviewerFull.toLowerCase()}:${item.feedbackIndex}`;
  }
  if (item.fullTxHash) return item.fullTxHash.toLowerCase();
  if (item.txHash && item.txHash !== 'pending') return txHashKey(item.txHash);
  return `${item.reviewer}:${item.rawValue ?? item.score}:${item.createdAt ?? item.comment}`;
}

/** Normalize tx hash to a comparable key (prefix + suffix). */
export function txHashKey(hash: string): string {
  const h = hash.toLowerCase();
  if (h.includes('...')) {
    const [pre, suf] = h.split('...');
    return `${pre}...${suf}`;
  }
  if (h.length >= 10) return `${h.slice(0, 6)}...${h.slice(-4)}`;
  return h;
}

export function txHashesMatch(a: string, b: string): boolean {
  const ka = txHashKey(a);
  const kb = txHashKey(b);
  return ka === kb;
}

/**
 * Merge fetched subgraph items with local pending cards.
 * Pending cards are NEVER dropped until their tx appears in fetched data.
 */
export function mergeFeedbackFeed(
  current: Erc8004Feedback[],
  fetched: Erc8004Feedback[],
): Erc8004Feedback[] {
  const pending = current.filter((item) => item.indexStatus === 'pending');
  const fetchedVerified = fetched.map((item) => ({
    ...item,
    indexStatus: 'verified' as const,
  }));

  const stillPending: Erc8004Feedback[] = [];
  const verifiedMatches: Erc8004Feedback[] = [];

  for (const p of pending) {
    const match = fetchedVerified.find(
      (f) =>
        (p.feedbackKey && f.feedbackKey && p.feedbackKey === f.feedbackKey) ||
        txHashesMatch(p.fullTxHash ?? p.txHash, f.fullTxHash ?? f.txHash),
    );
    if (match) {
      verifiedMatches.push({
        ...match,
        comment: p.comment || match.comment,
        indexStatus: 'verified',
      });
    } else {
      stillPending.push(p);
    }
  }

  const seen = new Set<string>();
  const merged: Erc8004Feedback[] = [];

  for (const item of [...stillPending, ...verifiedMatches]) {
    const key = feedItemKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  for (const item of fetchedVerified) {
    const key = feedItemKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged.slice(0, MAX_FEED_ITEMS);
}

export function hasPendingFeedback(items: Erc8004Feedback[]): boolean {
  return items.some((item) => item.indexStatus === 'pending');
}

/** Promote pending cards when their tx is confirmed on-chain (subgraph may lag). */
export function promotePendingByConfirmedTxs(
  items: Erc8004Feedback[],
  confirmedFullHashes: string[],
): Erc8004Feedback[] {
  if (confirmedFullHashes.length === 0) return items;

  return items.map((item) => {
    if (item.indexStatus !== 'pending') return item;
    const key = item.fullTxHash ?? item.txHash;
    const isConfirmed = confirmedFullHashes.some((h) => txHashesMatch(key, h));
    if (!isConfirmed) return item;
    return { ...item, indexStatus: 'verified' as const };
  });
}
