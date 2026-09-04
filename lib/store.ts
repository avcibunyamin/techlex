import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Term, UserProgress, Language } from '@/types';
import { createProgress, markKnown, markUnknown } from './spaced-repetition';
import { pushProgress, pullProgress, pushBatchSwipes, BatchProgressItem } from './sync';
import { ThemeMode } from './useTheme';
import { BADGES, BadgeCheckStats, XP_PER_SWIPE, XP_PER_QUIZ, getLeague, getLevel } from '@/constants/badges';

import cybersecurityTerms from '@/data/terms/cybersecurity.json';
import softwareDevTerms from '@/data/terms/software-dev.json';
import aiMlTerms from '@/data/terms/ai-ml.json';
import networkingTerms from '@/data/terms/networking.json';
import designUxTerms from '@/data/terms/design-ux.json';

const ALL_TERMS: Term[] = [
  ...cybersecurityTerms,
  ...softwareDevTerms,
  ...aiMlTerms,
  ...networkingTerms,
  ...designUxTerms,
] as Term[];

type SubscriptionTier = 'free' | 'individual' | 'duo' | 'family';

export interface QuizQuestion {
  term: Term;
  displayedDefinition: string;
  isCorrect: boolean;
  sourceTerm?: Term;
}

export interface SwipeQueueItem {
  termId: string;
  action: 'right' | 'left';
  timestamp: number;
}

interface AppState {
  terms: Term[];
  progress: Record<string, UserProgress>;
  selectedTags: string[];
  language: Language;
  streak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  dailyGoal: number;
  todayCount: number;
  totalSwipes: number;
  xp: number;
  earnedBadges: string[];
  isLoaded: boolean;
  hasCompletedOnboarding: boolean;
  displayName: string;
  themeMode: ThemeMode;
  subscriptionTier: SubscriptionTier;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null;
  energyLevel: number;
  lastEnergyRefill: number;
  swipeQueue: SwipeQueueItem[];

  loadData: () => Promise<void>;
  saveData: () => Promise<void>;
  scheduleSave: () => void;
  setSelectedTags: (tags: string[]) => void;
  toggleTag: (tag: string) => void;
  setLanguage: (lang: Language) => void;
  setDailyGoal: (goal: number) => void;
  completeOnboarding: () => void;
  setDisplayName: (name: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
  swipeRight: (termId: string) => void;
  swipeLeft: (termId: string) => void;
  consumeEnergy: () => boolean;
  refillEnergy: () => void;
  flushSwipeQueue: () => Promise<void>;
  syncToCloud: (userId: string) => Promise<void>;
  loadFromCloud: (userId: string) => Promise<void>;
  getFilteredTerms: () => Term[];
  getTermsForReview: () => Term[];
  getLevel: () => { level: number; currentXp: number; nextLevelXp: number };
  getLeague: () => { id: string; minXp: number; color: string };
  hasActivePremium: () => boolean;
  setCancelAtPeriodEnd: (cancel: boolean, periodEnd?: number) => void;
  checkAndAwardBadges: () => string[];
  undoSwipe: (termId: string, direction: 'right' | 'left', previousProgress: UserProgress | null, wasReview: boolean) => void;
  generateQuiz: () => QuizQuestion[];
  submitQuizResults: (correctCount: number, totalCount: number) => void;
}

const STORAGE_KEY = '@pratik_kelime_data';
const MAX_ENERGY = 30;
const ENERGY_REFILL_MS = 5 * 60 * 1000;
const BATCH_FLUSH_SIZE = 10;

let _saveTimer: ReturnType<typeof setTimeout> | undefined;
let _flushing = false;

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

export const useAppStore = create<AppState>((set, get) => ({
  terms: ALL_TERMS,
  progress: {},
  selectedTags: [],
  language: 'tr',
  streak: 0,
  longestStreak: 0,
  lastActiveDate: null,
  dailyGoal: 10,
  todayCount: 0,
  totalSwipes: 0,
  xp: 0,
  earnedBadges: [],
  isLoaded: false,
  hasCompletedOnboarding: false,
  displayName: '',
  themeMode: 'system',
  subscriptionTier: 'free',
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  energyLevel: MAX_ENERGY,
  lastEnergyRefill: Date.now(),
  swipeQueue: [],

  scheduleSave: () => {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      useAppStore.getState().saveData();
    }, 500);
  },

  loadData: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        const today = getTodayString();
        let streak = data.streak || 0;
        let todayCount = data.todayCount || 0;

        if (data.lastActiveDate) {
          const lastDate = new Date(data.lastActiveDate);
          const todayDate = new Date(today);
          const diffDays = Math.floor(
            (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (diffDays > 1) streak = 0;
          if (data.lastActiveDate !== today) todayCount = 0;
        }

        let energy = data.energyLevel ?? MAX_ENERGY;
        const lastRefill = data.lastEnergyRefill ?? Date.now();
        const tier = data.subscriptionTier ?? 'free';
        let newLastRefill = lastRefill;
        if (tier === 'free') {
          const elapsed = Date.now() - lastRefill;
          const refills = Math.floor(elapsed / ENERGY_REFILL_MS);
          if (refills > 0) {
            energy = Math.min(energy + refills, MAX_ENERGY);
            newLastRefill = Date.now();
          }
        } else {
          energy = 999;
        }

        // Strip starred from old progress entries
        const progress: Record<string, UserProgress> = {};
        if (data.progress) {
          for (const [k, v] of Object.entries(data.progress as Record<string, any>)) {
            const { starred, ...rest } = v;
            progress[k] = rest as UserProgress;
          }
        }

        set({
          progress,
          selectedTags: data.selectedTags || [],
          language: data.language || 'tr',
          streak,
          longestStreak: Math.max(data.longestStreak || 0, streak),
          lastActiveDate: data.lastActiveDate,
          dailyGoal: data.dailyGoal || 10,
          todayCount,
          totalSwipes: data.totalSwipes || 0,
          xp: data.xp || 0,
          earnedBadges: data.earnedBadges || [],
          isLoaded: true,
          hasCompletedOnboarding: data.hasCompletedOnboarding ?? false,
          displayName: data.displayName || '',
          themeMode: data.themeMode || 'system',
          subscriptionTier: tier,
          cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
          currentPeriodEnd: data.currentPeriodEnd || null,
          energyLevel: energy,
          lastEnergyRefill: newLastRefill,
          swipeQueue: data.swipeQueue || [],
        });
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },

  saveData: async () => {
    const s = get();
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          progress: s.progress,
          selectedTags: s.selectedTags,
          language: s.language,
          streak: s.streak,
          longestStreak: s.longestStreak,
          lastActiveDate: s.lastActiveDate,
          dailyGoal: s.dailyGoal,
          todayCount: s.todayCount,
          totalSwipes: s.totalSwipes,
          xp: s.xp,
          earnedBadges: s.earnedBadges,
          hasCompletedOnboarding: s.hasCompletedOnboarding,
          displayName: s.displayName,
          themeMode: s.themeMode,
          subscriptionTier: s.subscriptionTier,
          cancelAtPeriodEnd: s.cancelAtPeriodEnd,
          currentPeriodEnd: s.currentPeriodEnd,
          energyLevel: s.energyLevel,
          lastEnergyRefill: s.lastEnergyRefill,
          swipeQueue: s.swipeQueue,
        })
      );
    } catch {}
  },

  setSelectedTags: (tags) => {
    set({ selectedTags: tags });
    get().saveData();
  },

  toggleTag: (tag) => {
    const { selectedTags } = get();
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    set({ selectedTags: newTags });
    get().saveData();
  },

  setLanguage: (lang) => {
    set({ language: lang });
    import('@/lib/i18n').then(mod => mod.default.changeLanguage(lang));
    get().saveData();
  },

  setDailyGoal: (goal) => {
    set({ dailyGoal: goal });
    get().saveData();
  },

  completeOnboarding: () => {
    set({ hasCompletedOnboarding: true });
    get().saveData();
  },

  setDisplayName: (name) => {
    set({ displayName: name });
    get().saveData();
  },

  setThemeMode: (mode) => {
    set({ themeMode: mode });
    get().saveData();
  },

  swipeRight: (termId) => {
    const { progress, swipeQueue } = get();
    const existing = progress[termId] || createProgress(termId);
    const updated = markKnown(existing);
    const today = getTodayString();
    const state = get();
    let newStreak = state.streak;
    if (state.lastActiveDate !== today) newStreak = state.streak + 1;
    const newLongest = Math.max(state.longestStreak, newStreak);

    const newQueue = [...swipeQueue, { termId, action: 'right' as const, timestamp: Date.now() }];

    set({
      progress: { ...progress, [termId]: updated },
      todayCount: state.todayCount + 1,
      totalSwipes: state.totalSwipes + 1,
      xp: state.xp + XP_PER_SWIPE,
      streak: newStreak,
      longestStreak: newLongest,
      lastActiveDate: today,
      swipeQueue: newQueue,
    });
    get().scheduleSave();
    get().checkAndAwardBadges();

    if (newQueue.length >= BATCH_FLUSH_SIZE) {
      get().flushSwipeQueue();
    }
  },

  swipeLeft: (termId) => {
    const { progress, swipeQueue } = get();
    const existing = progress[termId] || createProgress(termId);
    const updated = markUnknown(existing);
    const today = getTodayString();
    const state = get();
    let newStreak = state.streak;
    if (state.lastActiveDate !== today) newStreak = state.streak + 1;
    const newLongest = Math.max(state.longestStreak, newStreak);

    const newQueue = [...swipeQueue, { termId, action: 'left' as const, timestamp: Date.now() }];

    set({
      progress: { ...progress, [termId]: updated },
      todayCount: state.todayCount + 1,
      totalSwipes: state.totalSwipes + 1,
      xp: state.xp + XP_PER_SWIPE,
      streak: newStreak,
      longestStreak: newLongest,
      lastActiveDate: today,
      swipeQueue: newQueue,
    });
    get().scheduleSave();
    get().checkAndAwardBadges();

    if (newQueue.length >= BATCH_FLUSH_SIZE) {
      get().flushSwipeQueue();
    }
  },

  consumeEnergy: () => {
    const s = get();
    if (get().hasActivePremium()) return true;
    if (s.energyLevel <= 0) return false;
    set({ energyLevel: s.energyLevel - 1 });
    get().scheduleSave();
    return true;
  },

  refillEnergy: () => {
    const s = get();
    if (get().hasActivePremium()) {
      set({ energyLevel: 999 });
      return;
    }
    const elapsed = Date.now() - s.lastEnergyRefill;
    const refills = Math.floor(elapsed / ENERGY_REFILL_MS);
    if (refills > 0 && s.energyLevel < MAX_ENERGY) {
      set({
        energyLevel: Math.min(s.energyLevel + refills, MAX_ENERGY),
        lastEnergyRefill: Date.now(),
      });
      get().saveData();
    }
  },

  flushSwipeQueue: async () => {
    if (_flushing) return;
    const state = get();
    if (state.swipeQueue.length === 0) return;

    _flushing = true;
    const queue = [...state.swipeQueue];
    set({ swipeQueue: [] });

    const termIds = [...new Set(queue.map(q => q.termId))];
    const progressToSync: BatchProgressItem[] = termIds
      .filter(id => state.progress[id])
      .map(id => ({
        term_id: id,
        box: state.progress[id].box,
        last_seen: new Date(state.progress[id].lastSeen).toISOString(),
        next_review: new Date(state.progress[id].nextReview).toISOString(),
        times_correct: state.progress[id].timesCorrect,
        times_seen: state.progress[id].timesSeen,
      }));

    const isPremium = get().hasActivePremium();

    const { error } = await pushBatchSwipes(
      progressToSync,
      queue.length,
      isPremium ? 0 : queue.length,
    );

    if (error) {
      set(s => ({ swipeQueue: [...queue, ...s.swipeQueue] }));
    }

    get().saveData();
    _flushing = false;
  },

  syncToCloud: async (userId) => {
    await get().flushSwipeQueue();
    const s = get();
    try {
      await pushProgress(userId, s.progress, {
        streak: s.streak,
        lastActiveDate: s.lastActiveDate,
        dailyGoal: s.dailyGoal,
        todayCount: s.todayCount,
        totalSwipes: s.totalSwipes,
        selectedTags: s.selectedTags,
        language: s.language,
        hasCompletedOnboarding: s.hasCompletedOnboarding,
      });
    } catch {}
  },

  loadFromCloud: async (userId) => {
    try {
      const { progress, profile } = await pullProgress(userId);
      if (profile) {
        const today = getTodayString();
        let streak = profile.streak;
        let todayCount = profile.todayCount;
        if (profile.lastActiveDate) {
          const lastDate = new Date(profile.lastActiveDate);
          const todayDate = new Date(today);
          const diffDays = Math.floor(
            (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (diffDays > 1) streak = 0;
          if (profile.lastActiveDate !== today) todayCount = 0;
        }
        const local = get();
        set({
          progress: Object.keys(progress).length > 0 ? progress : local.progress,
          selectedTags: profile.selectedTags.length > 0 ? profile.selectedTags : local.selectedTags,
          language: profile.language as Language,
          streak: Math.max(streak, local.streak),
          lastActiveDate: profile.lastActiveDate || local.lastActiveDate,
          dailyGoal: profile.dailyGoal,
          todayCount: Math.max(todayCount, local.todayCount),
          totalSwipes: Math.max(profile.totalSwipes || 0, local.totalSwipes),
          hasCompletedOnboarding: profile.hasCompletedOnboarding || local.hasCompletedOnboarding,
        });
        get().saveData();
      }
    } catch {}
  },

  getFilteredTerms: () => {
    const { terms, selectedTags } = get();
    if (selectedTags.length === 0) return terms;
    return terms.filter((term) =>
      selectedTags.some((tag) => term.tags.includes(tag))
    );
  },

  getTermsForReview: () => {
    const { progress } = get();
    const filteredTerms = get().getFilteredTerms();
    const now = Date.now();
    const due = filteredTerms.filter((term) => {
      const p = progress[term.id];
      if (!p) return true;
      return now >= p.nextReview;
    });
    due.sort((a, b) => {
      const pa = progress[a.id];
      const pb = progress[b.id];
      if (!pa) return -1;
      if (!pb) return 1;
      if (pa.box !== pb.box) return pa.box - pb.box;
      return pa.nextReview - pb.nextReview;
    });
    return due;
  },

  getLevel: () => {
    return getLevel(get().xp);
  },

  getLeague: () => {
    return getLeague(get().xp);
  },

  checkAndAwardBadges: () => {
    const s = get();
    const tagCounts: Record<string, number> = {};
    for (const [termId, prog] of Object.entries(s.progress)) {
      const term = s.terms.find(t => t.id === termId);
      if (term) {
        for (const tag of term.tags) {
          tagCounts[tag] = (tagCounts[tag] || 0) + prog.timesSeen;
        }
      }
    }

    const stats: BadgeCheckStats = {
      totalSwipes: s.totalSwipes,
      streak: s.streak,
      longestStreak: s.longestStreak,
      xp: s.xp,
      tagCounts,
      studyHour: new Date().getHours(),
    };

    const newBadges: string[] = [];
    for (const badge of BADGES) {
      if (!s.earnedBadges.includes(badge.id) && badge.condition(stats)) {
        newBadges.push(badge.id);
      }
    }

    if (newBadges.length > 0) {
      const xpBonus = newBadges.reduce((sum, id) => {
        const b = BADGES.find(b => b.id === id);
        return sum + (b?.xpReward ?? 0);
      }, 0);
      set({
        earnedBadges: [...s.earnedBadges, ...newBadges],
        xp: s.xp + xpBonus,
      });
      get().scheduleSave();
    }

    return newBadges;
  },

  hasActivePremium: () => {
    const s = get();
    if (s.subscriptionTier === 'free') return false;
    if (!s.cancelAtPeriodEnd) return true;
    if (s.currentPeriodEnd && s.currentPeriodEnd > Date.now()) return true;
    return false;
  },

  setCancelAtPeriodEnd: (cancel, periodEnd) => {
    set({
      cancelAtPeriodEnd: cancel,
      ...(periodEnd !== undefined ? { currentPeriodEnd: periodEnd } : {}),
    });
    get().saveData();
  },

  undoSwipe: (termId, direction, previousProgress, wasReview) => {
    const s = get();
    const newProgress = { ...s.progress };
    if (previousProgress) {
      newProgress[termId] = previousProgress;
    } else {
      delete newProgress[termId];
    }

    let newEnergy = s.energyLevel;
    if (!wasReview && !get().hasActivePremium()) {
      newEnergy = Math.min(s.energyLevel + 1, MAX_ENERGY);
    }

    set({
      progress: newProgress,
      todayCount: Math.max(0, s.todayCount - 1),
      totalSwipes: Math.max(0, s.totalSwipes - 1),
      xp: Math.max(0, s.xp - XP_PER_SWIPE),
      energyLevel: newEnergy,
      swipeQueue: s.swipeQueue.length > 0 && s.swipeQueue[s.swipeQueue.length - 1].termId === termId
        ? s.swipeQueue.slice(0, -1)
        : s.swipeQueue,
    });
    get().scheduleSave();
  },

  generateQuiz: () => {
    const { progress, terms, language } = get();
    const tl = language === 'tr' ? 'tr' : 'en';
    const seenIds = Object.keys(progress);
    const QUIZ_SIZE = 10;

    let selectedTerms: Term[];
    if (seenIds.length >= QUIZ_SIZE) {
      const shuffled = [...seenIds].sort(() => Math.random() - 0.5);
      selectedTerms = shuffled.slice(0, QUIZ_SIZE)
        .map(id => terms.find(t => t.id === id))
        .filter(Boolean) as Term[];
    } else {
      const seen = seenIds
        .map(id => terms.find(t => t.id === id))
        .filter(Boolean) as Term[];
      const unseen = terms
        .filter(t => !progress[t.id])
        .sort(() => Math.random() - 0.5)
        .slice(0, QUIZ_SIZE - seen.length);
      selectedTerms = [...seen, ...unseen];
    }

    const questions: QuizQuestion[] = selectedTerms.map(term => {
      const showCorrect = Math.random() < 0.5;

      if (showCorrect) {
        return {
          term,
          displayedDefinition: term.translations[tl].definition,
          isCorrect: true,
        };
      }

      const primaryTag = term.tags[0];
      let candidates = terms.filter(t =>
        t.id !== term.id && t.tags.some(tag => term.tags.includes(tag))
      );
      if (candidates.length === 0) {
        candidates = terms.filter(t => t.id !== term.id);
      }
      const donor = candidates[Math.floor(Math.random() * candidates.length)];

      return {
        term,
        displayedDefinition: donor.translations[tl].definition,
        isCorrect: false,
        sourceTerm: donor,
      };
    });

    return questions.sort(() => Math.random() - 0.5);
  },

  submitQuizResults: (correctCount, totalCount) => {
    const today = getTodayString();
    const s = get();
    let newStreak = s.streak;
    if (s.lastActiveDate !== today) newStreak = s.streak + 1;
    const newLongest = Math.max(s.longestStreak, newStreak);

    set({
      xp: s.xp + correctCount * XP_PER_QUIZ,
      todayCount: s.todayCount + correctCount,
      totalSwipes: s.totalSwipes + totalCount,
      streak: newStreak,
      longestStreak: newLongest,
      lastActiveDate: today,
    });
    get().scheduleSave();
    get().checkAndAwardBadges();
  },
}));
