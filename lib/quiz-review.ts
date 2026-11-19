// Pure helpers for extracting missed or skipped quiz questions and determining
// whether a scoped retry quiz can be started. No React Native or store imports.

export const DEFAULT_MIN_RETRY_SIZE = 4;

export interface QuizReviewQuestion {
  term: {
    id: string;
    term: string;
  };
  correctDefinition: string;
}

export interface MissedQuizItem {
  id: string;
  term: string;
  correctDefinition: string;
}

export interface QuizReviewSummary {
  missedItems: MissedQuizItem[];
  missedIds: string[];
  canRetryMissed: boolean;
}

/**
 * Extracts questions that were answered wrongly (`false`) or left unanswered/skipped
 * (`null` or `undefined`), deduplicating repeated terms by `term.id` in first-missed order.
 */
export function extractMissedQuizItems(
  questions: readonly QuizReviewQuestion[],
  results: readonly (boolean | null | undefined)[]
): MissedQuizItem[] {
  const seenIds = new Set<string>();
  const items: MissedQuizItem[] = [];

  for (let i = 0; i < questions.length; i += 1) {
    if (results[i] === true) continue;
    const q = questions[i];
    if (!q || !q.term) continue;
    const id = q.term.id.trim();
    const term = q.term.term.trim();
    if (!id || !term || seenIds.has(id)) continue;
    seenIds.add(id);
    items.push({
      id,
      term,
      correctDefinition: q.correctDefinition,
    });
  }

  return items;
}

/**
 * Builds the end-of-quiz review summary and checks whether the unique missed word count
 * meets the minimum scoped quiz size threshold (`minScopedSize`, defaults to 4).
 */
export function buildQuizReview(
  questions: readonly QuizReviewQuestion[],
  results: readonly (boolean | null | undefined)[],
  minScopedSize: number = DEFAULT_MIN_RETRY_SIZE
): QuizReviewSummary {
  const threshold =
    Number.isFinite(minScopedSize) && minScopedSize >= 1
      ? Math.floor(minScopedSize)
      : DEFAULT_MIN_RETRY_SIZE;
  const missedItems = extractMissedQuizItems(questions, results);
  const missedIds = missedItems.map((item) => item.id);
  return {
    missedItems,
    missedIds,
    canRetryMissed: missedIds.length >= threshold,
  };
}
