// Pure end-of-session summary for a card deck run. No React or store imports so
// lib/session-summary.check.ts can run with plain `npx tsx`.

export interface SessionSwipe {
  termId: string;
  direction: 'right' | 'left';
}

export interface SessionSummary {
  /** Unique words seen this session, in first-seen order. */
  seenIds: string[];
  /** Words never swiped left this session. */
  knownCount: number;
  /** Words swiped left at least once (a later right swipe on the re-fed card does not undo this). */
  reviewCount: number;
  /** Every swipe (including re-fed cards) earns XP in the store, so XP counts swipes, not words. */
  xpEarned: number;
}

export function summarizeSession(log: SessionSwipe[], xpPerSwipe: number): SessionSummary {
  const seenIds: string[] = [];
  const missed = new Set<string>();
  const seen = new Set<string>();
  for (const { termId, direction } of log) {
    if (!seen.has(termId)) {
      seen.add(termId);
      seenIds.push(termId);
    }
    if (direction === 'left') missed.add(termId);
  }
  return {
    seenIds,
    knownCount: seenIds.length - missed.size,
    reviewCount: missed.size,
    xpEarned: log.length * Math.max(0, xpPerSwipe),
  };
}
