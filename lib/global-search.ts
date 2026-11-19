// Pure global search across IT terms and loaded word packs.
// Case-, Turkish-letter- (İ/I/ı/i, ğ, ş, ç, ö, ü), and accent-insensitive via pack-filter.
// No React or store imports so it can be checked with `npx tsx lib/global-search.check.ts`.

import type { LeitnerBox } from '@/types';
import {
  foldForSearch,
  tokenizeQuery,
  matchesQuery,
  compareByRank,
  type PackFilterTerm,
} from './pack-filter';

export const GLOBAL_SEARCH_LIMIT = 30;
export const GLOBAL_SEARCH_DEBOUNCE_MS = 200;

export interface GlobalSearchTerm extends PackFilterTerm {
  tags?: readonly string[];
}

export interface GlobalSearchProgress {
  box: number;
  timesSeen?: number;
  timesCorrect?: number;
}

export type GlobalSearchProgressMap = Record<string, GlobalSearchProgress | undefined>;

export interface GlobalSearchSource<T extends GlobalSearchTerm = GlobalSearchTerm> {
  /** Pack ID when terms come from a word pack, or null/undefined for IT terms. */
  packId?: string | null;
  /** Optional pre-resolved source label. */
  label?: string;
  terms: readonly T[];
}

export interface GlobalSearchItem<T extends GlobalSearchTerm = GlobalSearchTerm> {
  term: T;
  /** Pack ID if the term comes from a pack, otherwise null for IT terms. */
  packId: string | null;
  /** Category tag id (for IT terms) or pack id (for pack terms). */
  sourceKey: string;
  /** Optional label from source, falling back to sourceKey. */
  sourceLabel: string;
  /** Normalized Leitner box (1..5) if seen, or null if new. */
  box: LeitnerBox | null;
}

export interface GlobalSearchResult<T extends GlobalSearchTerm = GlobalSearchTerm> {
  items: GlobalSearchItem<T>[];
  totalMatches: number;
  hasMore: boolean;
  hiddenCount: number;
}

export function normalizeSearchBox(p: GlobalSearchProgress | undefined): LeitnerBox | null {
  if (!p) return null;
  const raw = typeof p.box === 'number' && Number.isFinite(p.box) ? Math.floor(p.box) : 1;
  if (raw < 1 || raw > 5) return 1;
  return raw as LeitnerBox;
}

// Match quality tiers (lower is better):
// 0 = exact folded term match
// 1 = folded term starts with folded query
// 2 = folded term contains all query tokens
// 3 = definition match (via matchesQuery)
export function scoreTermMatch(
  term: PackFilterTerm,
  foldedQuery: string,
  tokens: readonly string[]
): number {
  const foldedTerm = foldForSearch(term.term);
  if (foldedQuery.length > 0 && foldedTerm === foldedQuery) return 0;
  if (foldedQuery.length > 0 && foldedTerm.startsWith(foldedQuery)) return 1;
  if (tokens.length > 0 && tokens.every((tok) => foldedTerm.includes(tok))) return 2;
  return 3;
}

export function searchGlobalTerms<T extends GlobalSearchTerm>(
  sources: readonly GlobalSearchSource<T>[],
  progress: GlobalSearchProgressMap,
  query: string,
  limit: number = GLOBAL_SEARCH_LIMIT
): GlobalSearchResult<T> {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) {
    return {
      items: [],
      totalMatches: 0,
      hasMore: false,
      hiddenCount: 0,
    };
  }

  const foldedQuery = tokens.join(' ');
  const safeLimit = Number.isFinite(limit)
    ? Math.max(0, Math.floor(limit))
    : GLOBAL_SEARCH_LIMIT;

  const seenIds = new Set<string>();
  const scored: { item: GlobalSearchItem<T>; tier: number }[] = [];

  for (const source of sources) {
    const packId = source.packId ?? null;
    for (const term of source.terms) {
      if (!term || typeof term.id !== 'string' || seenIds.has(term.id)) continue;
      if (!matchesQuery(term, tokens)) continue;
      seenIds.add(term.id);

      const primaryTag = term.tags && term.tags.length > 0 ? term.tags[0] : '';
      const sourceKey = packId ?? primaryTag;
      const sourceLabel = source.label ?? sourceKey;
      const box = normalizeSearchBox(progress[term.id]);
      const tier = scoreTermMatch(term, foldedQuery, tokens);

      scored.push({
        item: {
          term,
          packId,
          sourceKey,
          sourceLabel,
          box,
        },
        tier,
      });
    }
  }

  scored.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return compareByRank(a.item.term, b.item.term);
  });

  const totalMatches = scored.length;
  const items = scored.slice(0, safeLimit).map((entry) => entry.item);
  const hiddenCount = Math.max(0, totalMatches - items.length);

  return {
    items,
    totalMatches,
    hasMore: hiddenCount > 0,
    hiddenCount,
  };
}
