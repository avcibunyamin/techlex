// Pure home-screen shortcut card state (no store, no React, no I/O).
// Verified by lib/home-shortcut.check.ts.

export interface HomeShortcutInput {
  /** True once the user has seen at least one card (any source). */
  hasProgress: boolean;
  /** Due cards across IT terms and loaded packs (ReviewQueueResult.totalDue). */
  totalDue: number;
  /** Last studied pack id (store.activePackId), or null. */
  activePackId: string | null;
  /** Cards seen in the active pack; the pack must exist and have progress to be resumable. */
  activePackSeen: number;
  activePackExists: boolean;
}

export type HomeShortcut =
  | { kind: 'browse' }
  | { kind: 'study'; dueCount: number; showDailyReview: boolean; continuePackId: string | null };

export function buildHomeShortcut(input: HomeShortcutInput): HomeShortcut {
  if (!input.hasProgress) return { kind: 'browse' };

  const dueCount = Math.max(0, Math.floor(input.totalDue || 0));
  const continuePackId =
    input.activePackId && input.activePackExists && input.activePackSeen > 0 ? input.activePackId : null;
  const showDailyReview = dueCount > 0;

  if (!showDailyReview && !continuePackId) return { kind: 'browse' };
  return { kind: 'study', dueCount, showDailyReview, continuePackId };
}
