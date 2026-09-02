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

export type SwipeDirection = 'left' | 'right' | 'up';
export type Difficulty = 1 | 2 | 3;
export type Language = 'tr' | 'en';
