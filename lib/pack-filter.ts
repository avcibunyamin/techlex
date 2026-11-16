// Pure helpers for browsing a pack: search, Leitner box filter, "struggling" words, rank order.
// No React or store imports so it can be checked with `npx tsx lib/pack-filter.check.ts`.

import type { LeitnerBox } from '@/types';

export interface PackFilterTerm {
  id: string;
  term: string;
  translations: {
    tr: { definition: string };
    en: { definition: string };
  };
  order: number;
  rank?: number;
}

export interface PackFilterProgress {
  box: number;
  timesSeen: number;
  timesCorrect: number;
}

export type PackProgressMap = Record<string, PackFilterProgress | undefined>;

// 'new' = no progress record yet; 1–5 = current Leitner box; 'struggling' = see isStruggling.
export type PackFilter = 'all' | 'new' | 'struggling' | LeitnerBox;

export const PACK_FILTERS: PackFilter[] = ['all', 'new', 1, 2, 3, 4, 5, 'struggling'];

export const STRUGGLING_MIN_WRONG = 2;

const TR_FOLD: Record<string, string> = {
  'İ': 'i',
  'I': 'i',
  'ı': 'i',
  'Ğ': 'g',
  'ğ': 'g',
  'Ş': 's',
  'ş': 's',
  'Ç': 'c',
  'ç': 'c',
  'Ö': 'o',
  'ö': 'o',
  'Ü': 'u',
  'ü': 'u',
};

// Case- and Turkish-letter-insensitive key: "İŞ", "iş", "is" and "IS" all fold to "is".
// Turkish letters are mapped explicitly because toLowerCase() turns "I" into "i" (not "ı")
// and "İ" into "i" + combining dot; remaining accents are stripped via NFD.
export function foldForSearch(text: string): string {
  let out = '';
  for (const ch of text) {
    out += TR_FOLD[ch] ?? ch;
  }
  if (typeof out.normalize === 'function') {
    out = out.normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  return out.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function tokenizeQuery(query: string): string[] {
  const folded = foldForSearch(query);
  return folded ? folded.split(' ') : [];
}

const haystackCache = new WeakMap<PackFilterTerm, string>();

function haystackOf(term: PackFilterTerm): string {
  let hay = haystackCache.get(term);
  if (hay === undefined) {
    hay = foldForSearch(
      `${term.term}\n${term.translations.tr.definition}\n${term.translations.en.definition}`
    );
    haystackCache.set(term, hay);
  }
  return hay;
}

// Every query token must appear in the term or in its TR/EN definition. Empty query matches all.
export function matchesQuery(term: PackFilterTerm, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const hay = haystackOf(term);
  return tokens.every((tok) => hay.includes(tok));
}

// Progress has no wrong-answer counter. Every left swipe (markUnknown) and every wrong quiz
// answer (downgradeQuizTerm -> markUnknown) adds 1 to timesSeen only, while right swipes and
// promoted quiz answers (markKnown) add 1 to both timesSeen and timesCorrect.
// So timesSeen - timesCorrect is the number of "wrong" answers. Clamped at 0 for odd data.
export function wrongCount(p: PackFilterProgress | undefined): number {
  if (!p) return 0;
  const seen = Number.isFinite(p.timesSeen) ? p.timesSeen : 0;
  const correct = Number.isFinite(p.timesCorrect) ? p.timesCorrect : 0;
  return Math.max(0, seen - correct);
}

// Struggling = missed at least twice and currently back in box 1.
export function isStruggling(p: PackFilterProgress | undefined): boolean {
  return Boolean(p && p.box === 1 && wrongCount(p) >= STRUGGLING_MIN_WRONG);
}

export function matchesFilter(p: PackFilterProgress | undefined, filter: PackFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'new') return !p;
  if (filter === 'struggling') return isStruggling(p);
  return Boolean(p && p.box === filter);
}

export function compareByRank(a: PackFilterTerm, b: PackFilterTerm): number {
  const ra = a.rank ?? a.order;
  const rb = b.rank ?? b.order;
  if (ra !== rb) return ra - rb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export interface PackFilterOptions {
  query?: string;
  filter?: PackFilter;
}

// Returns a new array sorted by rank (then order, then id); the input is not mutated.
export function filterPackTerms<T extends PackFilterTerm>(
  terms: readonly T[],
  progress: PackProgressMap,
  { query = '', filter = 'all' }: PackFilterOptions = {}
): T[] {
  const tokens = tokenizeQuery(query);
  return terms
    .filter((t) => matchesFilter(progress[t.id], filter) && matchesQuery(t, tokens))
    .sort(compareByRank);
}

// Count per filter tab for the current search, so tab badges match what the list shows.
export function countPackFilters(
  terms: readonly PackFilterTerm[],
  progress: PackProgressMap,
  query = ''
): Record<string, number> {
  const tokens = tokenizeQuery(query);
  const counts: Record<string, number> = {};
  for (const f of PACK_FILTERS) counts[String(f)] = 0;
  for (const t of terms) {
    if (!matchesQuery(t, tokens)) continue;
    const p = progress[t.id];
    for (const f of PACK_FILTERS) {
      if (matchesFilter(p, f)) counts[String(f)] += 1;
    }
  }
  return counts;
}
