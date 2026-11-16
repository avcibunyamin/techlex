export interface Term {
  id: string;
  term: string;
  translations: {
    tr: { definition: string; example: string };
    en: { definition: string; example: string };
  };
  difficulty: 1 | 2 | 3;
  tags: string[];
  relatedTerms: string[];
  order: number;
  rank?: number;
  pos?: string;
}

export type PackGroup = 'english' | 'exam' | 'it';

export interface PackSource {
  name: string;
  url: string;
  license: string;
  licenseUrl: string;
}

export interface Pack {
  id: string;
  title: {
    tr: string;
    en: string;
  };
  group: PackGroup;
  size: number;
  source: PackSource;
  file: string;
  load?: () => Promise<unknown>;
}

export type PackTerm = Term;

export interface PackWord {
  id: string;
  word: string;
  rank: number;
}

export type LeitnerBox = 1 | 2 | 3 | 4 | 5;

export interface PackProgress {
  packId: string;
  learned: number;
  seen: number;
  total: number;
  loaded: number;
  due: number;
  new: number;
  boxes: Record<LeitnerBox, number>;
}

export interface UserProgress {
  termId: string;
  box: 1 | 2 | 3 | 4 | 5;
  lastSeen: number;
  nextReview: number;
  timesCorrect: number;
  timesSeen: number;
}

export interface Category {
  id: string;
  name: {
    tr: string;
    en: string;
  };
  icon: string;
  color: string;
  subcategories?: Category[];
  termCount?: number;
}

export type SwipeDirection = 'left' | 'right';
export type Difficulty = 1 | 2 | 3;
export type Language = 'tr' | 'en' | 'de' | 'fr' | 'es' | 'ar' | 'ja' | 'ko' | 'ru' | 'pt';
export type TermLanguage = 'tr' | 'en';

export function getTermLanguage(lang: Language): TermLanguage {
  return lang === 'tr' ? 'tr' : 'en';
}
