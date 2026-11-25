export const MAX_BOOKMARKS = 500;
export const SAVED_WORDS_PREVIEW_LIMIT = 5;

/**
 * Sanitizes raw persisted bookmark data into a deduplicated list of non-empty
 * term IDs (newest first), capped at `max` entries.
 */
export function normalizeBookmarkIds(raw: unknown, max: number = MAX_BOOKMARKS): string[] {
  if (!Array.isArray(raw) || max <= 0) {
    return [];
  }
  const limit = Math.floor(max);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= limit) break;
  }

  return result;
}

/**
 * Toggles `id` in `ids` without mutating the input array:
 * - If `id` is already present, removes it.
 * - If `id` is not present, prepends it to the front (newest first) and drops
 *   the oldest entry if the resulting length exceeds `max`.
 */
export function toggleBookmarkIds(
  ids: readonly string[],
  id: string,
  max: number = MAX_BOOKMARKS
): string[] {
  if (max <= 0) {
    return [];
  }
  const limit = Math.floor(max);
  const cleanId = typeof id === 'string' ? id.trim() : '';
  const current = normalizeBookmarkIds(ids, Infinity);

  if (!cleanId) {
    return current.slice(0, limit);
  }

  if (current.includes(cleanId)) {
    return current.filter((item) => item !== cleanId).slice(0, limit);
  }

  return [cleanId, ...current].slice(0, limit);
}

export interface BookmarkPackLoadOptions {
  getTermById: (termId: string) => unknown | undefined;
  packIdOfTerm: (termId: string) => string | undefined;
  isPackLoaded?: (packId: string) => boolean;
  requestedPackIds?: ReadonlySet<string>;
}

/**
 * Returns deduplicated pack IDs that need to be loaded for bookmarked term IDs
 * not yet in memory, skipping packs already loaded or already requested once.
 */
export function getUnloadedBookmarkPackIds(
  bookmarkedIds: readonly string[],
  options: BookmarkPackLoadOptions
): string[] {
  const { getTermById, packIdOfTerm, isPackLoaded, requestedPackIds } = options;
  const seenPacks = new Set<string>();
  const result: string[] = [];

  for (const rawId of bookmarkedIds) {
    if (typeof rawId !== 'string') continue;
    const id = rawId.trim();
    if (!id) continue;
    if (getTermById(id) !== undefined) continue;

    const packId = packIdOfTerm(id);
    if (!packId || seenPacks.has(packId)) continue;
    if (isPackLoaded?.(packId)) continue;
    if (requestedPackIds?.has(packId)) continue;

    seenPacks.add(packId);
    result.push(packId);
  }

  return result;
}

export interface SavedWordsView<T> {
  allTerms: T[];
  visibleTerms: T[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * Resolves bookmarked IDs into loaded term objects, omitting unfound IDs and
 * slicing to `previewLimit` unless `showAll` is true.
 */
export function buildSavedWordsView<T>(
  bookmarkedIds: readonly string[],
  getTermById: (termId: string) => T | undefined,
  showAll: boolean = false,
  previewLimit: number = SAVED_WORDS_PREVIEW_LIMIT
): SavedWordsView<T> {
  const normalizedIds = normalizeBookmarkIds(bookmarkedIds, Infinity);
  const allTerms: T[] = [];

  for (const id of normalizedIds) {
    const term = getTermById(id);
    if (term !== undefined) {
      allTerms.push(term);
    }
  }

  const limit = Math.max(0, Math.floor(previewLimit));
  const hasMore = !showAll && allTerms.length > limit;
  const visibleTerms = showAll ? allTerms : allTerms.slice(0, limit);

  return {
    allTerms,
    visibleTerms,
    totalCount: allTerms.length,
    hasMore,
  };
}
