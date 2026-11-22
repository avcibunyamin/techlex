export const MAX_BOOKMARKS = 500;

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
