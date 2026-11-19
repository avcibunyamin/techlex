// Pure daily review queue computation (no store, no React, no I/O).
// Verified by lib/review-queue.check.ts.

export const DEFAULT_REVIEW_LIMIT = 25;

export interface ReviewProgressLike {
  box: number;
  nextReview: number;
}

export interface ReviewQueueResult<T> {
  /** Due cards, sorted (lowest Leitner box first, then oldest due date) and capped at `limit`. */
  items: T[];
  /** Number of due cards before the limit is applied. */
  totalDue: number;
}

function normalizeBox(box: number): number {
  return box >= 1 && box <= 5 ? box : 1;
}

/**
 * Collects cards whose review date has passed from every source (packs, IT terms).
 * Cards without progress are new, not due, and are skipped. Duplicate ids are counted once.
 */
export function buildReviewQueue<T extends { id: string }>(
  sources: ReadonlyArray<ReadonlyArray<T>>,
  progress: Readonly<Record<string, ReviewProgressLike | undefined>>,
  now: number,
  limit: number = DEFAULT_REVIEW_LIMIT
): ReviewQueueResult<T> {
  if (!Number.isFinite(now)) {
    return { items: [], totalDue: 0 };
  }
  const seen = new Set<string>();
  const due: { item: T; box: number; nextReview: number }[] = [];

  for (const source of sources) {
    for (const item of source) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      const p = progress[item.id];
      if (!p || !Number.isFinite(p.nextReview)) continue;
      if (now < p.nextReview) continue;
      due.push({ item, box: normalizeBox(p.box), nextReview: p.nextReview });
    }
  }

  due.sort((a, b) => {
    if (a.box !== b.box) return a.box - b.box;
    if (a.nextReview !== b.nextReview) return a.nextReview - b.nextReview;
    return a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0;
  });

  const cap = Number.isNaN(limit) ? DEFAULT_REVIEW_LIMIT : Math.max(0, Math.floor(limit));
  return {
    items: due.slice(0, cap).map((d) => d.item),
    totalDue: due.length,
  };
}
