export interface BadgeDefinition {
  id: string;
  icon: string;
  category: 'streak' | 'volume' | 'sector' | 'special';
  xpReward: number;
  condition: (stats: BadgeCheckStats) => boolean;
}

export interface BadgeCheckStats {
  totalSwipes: number;
  streak: number;
  longestStreak: number;
  xp: number;
  tagCounts: Record<string, number>;
  studyHour?: number;
}

export const BADGES: BadgeDefinition[] = [
  // Streak badges
  {
    id: 'streak-3',
    icon: 'Flame',
    category: 'streak',
    xpReward: 50,
    condition: (s) => s.streak >= 3,
  },
  {
    id: 'streak-7',
    icon: 'Flame',
    category: 'streak',
    xpReward: 150,
    condition: (s) => s.streak >= 7,
  },
  {
    id: 'streak-30',
    icon: 'Flame',
    category: 'streak',
    xpReward: 500,
    condition: (s) => s.streak >= 30,
  },
  {
    id: 'streak-100',
    icon: 'Flame',
    category: 'streak',
    xpReward: 2000,
    condition: (s) => s.longestStreak >= 100,
  },

  // Volume badges
  {
    id: 'swipes-100',
    icon: 'Layers',
    category: 'volume',
    xpReward: 100,
    condition: (s) => s.totalSwipes >= 100,
  },
  {
    id: 'swipes-500',
    icon: 'Layers',
    category: 'volume',
    xpReward: 300,
    condition: (s) => s.totalSwipes >= 500,
  },
  {
    id: 'swipes-1000',
    icon: 'Award',
    category: 'volume',
    xpReward: 750,
    condition: (s) => s.totalSwipes >= 1000,
  },
  {
    id: 'swipes-5000',
    icon: 'Trophy',
    category: 'volume',
    xpReward: 2500,
    condition: (s) => s.totalSwipes >= 5000,
  },

  // Sector badges
  {
    id: 'blue-team-rookie',
    icon: 'Shield',
    category: 'sector',
    xpReward: 200,
    condition: (s) => (s.tagCounts['blue-team'] ?? 0) >= 50,
  },
  {
    id: 'red-team-rookie',
    icon: 'Crosshair',
    category: 'sector',
    xpReward: 200,
    condition: (s) => (s.tagCounts['red-team'] ?? 0) >= 50,
  },
  {
    id: 'dom-bender',
    icon: 'Code',
    category: 'sector',
    xpReward: 200,
    condition: (s) => (s.tagCounts['frontend'] ?? 0) >= 50,
  },
  {
    id: 'ai-architect',
    icon: 'Brain',
    category: 'sector',
    xpReward: 200,
    condition: (s) => (s.tagCounts['ai-ml'] ?? 0) >= 50,
  },
  {
    id: 'network-guru',
    icon: 'Network',
    category: 'sector',
    xpReward: 200,
    condition: (s) => (s.tagCounts['networking'] ?? 0) >= 50,
  },

  // Special badges
  {
    id: 'night-owl',
    icon: 'Moon',
    category: 'special',
    xpReward: 100,
    condition: (s) => s.studyHour !== undefined && (s.studyHour >= 23 || s.studyHour < 5),
  },
  {
    id: 'early-bird',
    icon: 'Sun',
    category: 'special',
    xpReward: 100,
    condition: (s) => s.studyHour !== undefined && s.studyHour >= 5 && s.studyHour < 8,
  },
];

export const XP_PER_SWIPE = 10;
export const XP_PER_QUIZ = 15;

export const LEAGUES = [
  { id: 'bronze', minXp: 0, color: '#CD7F32' },
  { id: 'silver', minXp: 5000, color: '#C0C0C0' },
  { id: 'gold', minXp: 20000, color: '#FFD700' },
  { id: 'diamond', minXp: 50000, color: '#B9F2FF' },
] as const;

export type LeagueId = (typeof LEAGUES)[number]['id'];

export function getLeague(xp: number): typeof LEAGUES[number] {
  for (let i = LEAGUES.length - 1; i >= 0; i--) {
    if (xp >= LEAGUES[i].minXp) return LEAGUES[i];
  }
  return LEAGUES[0];
}

export function getLevel(xp: number): { level: number; currentXp: number; nextLevelXp: number } {
  const level = Math.floor(xp / 1000) + 1;
  const currentXp = xp % 1000;
  const nextLevelXp = 1000;
  return { level, currentXp, nextLevelXp };
}
