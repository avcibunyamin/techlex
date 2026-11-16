import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Term, UserProgress, Language, Pack, PackProgress, LeitnerBox } from '@/types';
import { createProgress, markKnown, markUnknown, isDueForReview } from './spaced-repetition';
import { pushPreferences, pullProgress, pushBatchSwipes } from './sync';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { ThemeMode } from './useTheme';
import { BADGES, BadgeCheckStats, XP_PER_SWIPE, XP_PER_QUIZ, getLeague, getLevel } from '@/constants/badges';
import { getLocalDateString, streakAfterLoad, streakAfterStudy } from './date-utils';
import { PACKS, findPackById, packIdOfTerm } from '@/data/packs';
import { buildReviewQueue, DEFAULT_REVIEW_LIMIT, ReviewQueueResult } from './review-queue';
import { buildClozeQuestion, ClozeQuestion } from './cloze-quiz';

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

function filterWrittenPackTerms(rawTerms: Term[]): Term[] {
  return rawTerms.filter(
    (t) =>
      Boolean(
        t.translations?.tr?.definition?.trim() &&
          t.translations?.en?.definition?.trim()
      )
  );
}

const PACK_TERMS_MAP: Record<string, Term[]> = {};

const TERM_BY_ID_MAP: Map<string, Term> = new Map(
  ALL_TERMS.map((t): [string, Term] => [t.id, t])
);

const _packLoadPromises = new Map<string, Promise<boolean>>();

function packIdsForProgress(progress: Record<string, UserProgress>): string[] {
  const ids = new Set<string>();
  for (const termId of Object.keys(progress)) {
    const packId = packIdOfTerm(termId);
    if (packId) ids.add(packId);
  }
  return Array.from(ids);
}

type SubscriptionTier = 'free' | 'individual' | 'duo' | 'family';

function findLoadedTerm(termId: string): Term | undefined {
  const itTerm = TERM_BY_ID_MAP.get(termId);
  if (itTerm) return itTerm;
  const packId = packIdOfTerm(termId);
  return packId ? PACK_TERMS_MAP[packId]?.find(t => t.id === termId) : undefined;
}

export type QuizMode = 'definition' | 'cloze';

export interface QuizQuestion {
  term: Term;
  displayedDefinition: string;
  isCorrect: boolean;
  sourceTerm?: Term;
  correctDefinition: string;
  /** Set only for cloze questions; otherwise the card is a true/false definition question. */
  cloze?: ClozeQuestion;
}

export interface SwipeQueueItem {
  id: string;
  termId: string;
  action: 'right' | 'left';
  timestamp: number;
  userId?: string;
}

export interface DailyStat {
  date: string;
  swipes: number;
  quizCorrect: number;
  newTerms: number;
}

interface AppState {
  terms: Term[];
  packs: Pack[];
  packsLoaded: number;
  activePackId: string | null;
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
  serverTimeOffset: number;
  dailyStats: DailyStat[];
  reviewMode: boolean;
  quizSeenIds: Set<string>;
  isSyncConflict: boolean;
  isCheckingSync: boolean;
  isResettingPassword: boolean;
  needsCloudHydration: boolean;
  pendingCloudData: { progress: Record<string, UserProgress>; profile: any } | null;

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
  loadFromCloud: (userId: string) => Promise<boolean>;
  getFilteredTerms: () => Term[];
  getTermsForReview: () => Term[];
  setActivePackId: (packId: string | null) => void;
  ensurePacks: (packIds: string[]) => Promise<boolean>;
  getTermById: (termId: string) => Term | undefined;
  getPackTerms: (packId: string) => Term[];
  getPackProgress: (packId: string) => PackProgress;
  getAllPacksProgress: () => Record<string, PackProgress>;
  getPackStudyTerms: (packId: string, includeAll?: boolean) => Term[];
  getPackReviewNeededTerms: (packId: string) => Term[];
  getDailyReviewQueue: (limit?: number) => ReviewQueueResult<Term>;
  getLevel: () => { level: number; currentXp: number; nextLevelXp: number };
  getLeague: () => { id: string; minXp: number; color: string };
  hasActivePremium: () => boolean;
  setCancelAtPeriodEnd: (cancel: boolean, periodEnd?: number) => void;
  checkAndAwardBadges: () => string[];
  undoSwipe: (termId: string, direction: 'right' | 'left', previousProgress: UserProgress | null, wasReview: boolean) => void;
  getReviewNeededTerms: () => Term[];
  getKnownTermCount: () => number;
  downgradeQuizTerm: (termId: string) => void;
  promoteQuizTerm: (termId: string) => void;
  generateQuiz: (mode?: QuizMode) => QuizQuestion[];
  submitQuizResults: (correctCount: number, totalCount: number) => void;
  recordDailyStat: (field: 'swipes' | 'quizCorrect' | 'newTerms', amount: number) => void;
  fetchServerTime: () => Promise<void>;
  getServerNow: () => number;
  setReviewMode: (on: boolean) => void;
  checkSyncConflict: (userId: string) => Promise<boolean>;
  resolveSyncConflict: (useCloud: boolean) => Promise<void>;
  dismissSyncConflict: () => void;
  hasLocalProgress: () => boolean;
  resetUserData: () => void;
}

const STORAGE_KEY = '@pratik_kelime_data';
export const MAX_ENERGY = 30;
const ENERGY_REFILL_MS = 5 * 60 * 1000;
const BATCH_FLUSH_SIZE = 10;

let _saveTimer: ReturnType<typeof setTimeout> | undefined;
let _flushPromise: Promise<void> | null = null;

function getTodayString(): string {
  return getLocalDateString();
}

function createSwipeEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export const useAppStore = create<AppState>((set, get) => ({
  terms: ALL_TERMS,
  packs: PACKS,
  packsLoaded: 0,
  activePackId: 'ngsl-1',
  progress: {},
  selectedTags: [],
  language: 'tr',
  streak: 0,
  longestStreak: 0,
  lastActiveDate: null,
  dailyGoal: 30,
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
  serverTimeOffset: 0,
  dailyStats: [],
  reviewMode: false,
  quizSeenIds: new Set<string>(),
  isSyncConflict: false,
  isCheckingSync: false,
  isResettingPassword: false,
  needsCloudHydration: false,
  pendingCloudData: null,

  setReviewMode: (on: boolean) => set({ reviewMode: on }),

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
          streak = streakAfterLoad(streak, data.lastActiveDate, today);
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

        const newLongest = Math.max(data.longestStreak || 0, streak);
        set({
          progress,
          activePackId:
            data.activePackId && findPackById(data.activePackId)
              ? data.activePackId
              : 'ngsl-1',
          selectedTags: data.selectedTags || [],
          language: data.language || 'tr',
          streak,
          longestStreak: newLongest,
          lastActiveDate: data.lastActiveDate ?? null,
          dailyGoal: (data.dailyGoal && data.dailyGoal !== 10) ? data.dailyGoal : 30,
          todayCount,
          totalSwipes: data.totalSwipes || 0,
          xp: data.xp || 0,
          earnedBadges: data.earnedBadges || [],
          isLoaded: true,
          hasCompletedOnboarding: data.hasCompletedOnboarding ?? false,
          displayName: data.displayName || '',
          needsCloudHydration: data.needsCloudHydration ?? false,
          themeMode: data.themeMode || 'system',
          subscriptionTier: tier,
          cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
          currentPeriodEnd: data.currentPeriodEnd || null,
          energyLevel: energy,
          lastEnergyRefill: newLastRefill,
          swipeQueue: (data.swipeQueue || []).map((item: SwipeQueueItem) => ({
            ...item,
            id: item.id || createSwipeEventId(),
          })),
          dailyStats: data.dailyStats || [],
        });
        if (data.lastActiveDate !== today) {
          get().saveData();
        }
        const packIds = packIdsForProgress(progress);
        if (packIds.length > 0) {
          await get().ensurePacks(packIds);
        }
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
          activePackId: s.activePackId,
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
          needsCloudHydration: s.needsCloudHydration,
          themeMode: s.themeMode,
          subscriptionTier: s.subscriptionTier,
          cancelAtPeriodEnd: s.cancelAtPeriodEnd,
          currentPeriodEnd: s.currentPeriodEnd,
          energyLevel: s.energyLevel,
          lastEnergyRefill: s.lastEnergyRefill,
          swipeQueue: s.swipeQueue,
          dailyStats: s.dailyStats,
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
    const isNew = !progress[termId];
    const existing = progress[termId] || createProgress(termId);
    const updated = markKnown(existing);
    const today = getTodayString();
    const state = get();
    const newStreak = streakAfterStudy(state.streak, state.lastActiveDate, today);
    const newLongest = Math.max(state.longestStreak, newStreak);

    const newQueue = [...swipeQueue, { id: createSwipeEventId(), termId, action: 'right' as const, timestamp: Date.now() }];

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
    get().recordDailyStat('swipes', 1);
    if (isNew) get().recordDailyStat('newTerms', 1);

    if (newQueue.length >= BATCH_FLUSH_SIZE) {
      get().flushSwipeQueue();
    }
  },

  swipeLeft: (termId) => {
    const { progress, swipeQueue } = get();
    const isNew = !progress[termId];
    const existing = progress[termId] || createProgress(termId);
    const updated = markUnknown(existing);
    const today = getTodayString();
    const state = get();
    const newStreak = streakAfterStudy(state.streak, state.lastActiveDate, today);
    const newLongest = Math.max(state.longestStreak, newStreak);

    const newQueue = [...swipeQueue, { id: createSwipeEventId(), termId, action: 'left' as const, timestamp: Date.now() }];

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
    get().recordDailyStat('swipes', 1);
    if (isNew) get().recordDailyStat('newTerms', 1);

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
    const now = get().getServerNow();
    const elapsed = now - s.lastEnergyRefill;
    if (elapsed < 0) return;
    const refills = Math.floor(elapsed / ENERGY_REFILL_MS);
    if (refills > 0 && s.energyLevel < MAX_ENERGY) {
      set({
        energyLevel: Math.min(s.energyLevel + refills, MAX_ENERGY),
        lastEnergyRefill: now,
      });
      get().saveData();
    }
  },

  flushSwipeQueue: async () => {
    if (_flushPromise) return _flushPromise;
    if (get().swipeQueue.length === 0) return;

    _flushPromise = (async () => {
      const queue = [...get().swipeQueue];
      set({ swipeQueue: get().swipeQueue.slice(queue.length) });

      try {
        const result = await pushBatchSwipes(queue);
        const unsent = queue.slice(result.sentCount);
        if (unsent.length > 0) {
          set(s => ({ swipeQueue: [...unsent, ...s.swipeQueue] }));
        }
        if (result.energy !== undefined && result.error !== 'user_changed') {
          set({ energyLevel: result.energy });
        }
      } catch {
        set(s => ({ swipeQueue: [...queue, ...s.swipeQueue] }));
      } finally {
        await get().saveData();
      }
    })();

    try {
      await _flushPromise;
    } finally {
      _flushPromise = null;
    }
  },

  syncToCloud: async (userId) => {
    const s = get();
    try {
      await pushPreferences({
        dailyGoal: s.dailyGoal,
        selectedTags: s.selectedTags,
        language: s.language,
        hasCompletedOnboarding: s.hasCompletedOnboarding,
      });
    } catch {}
    await get().flushSwipeQueue();
  },

  loadFromCloud: async (userId) => {
    try {
      const { progress, profile } = await pullProgress(userId);
      if (profile) {
        const today = getTodayString();
        let streak = profile.streak;
        let todayCount = profile.todayCount;
        if (profile.lastActiveDate) {
          streak = streakAfterLoad(streak, profile.lastActiveDate, today);
          if (profile.lastActiveDate !== today) todayCount = 0;
        }
        const local = get();
        const nextProgress = Object.keys(progress).length > 0 ? progress : local.progress;
        set({
          progress: nextProgress,
          selectedTags: profile.selectedTags.length > 0 ? profile.selectedTags : local.selectedTags,
          language: profile.language as Language,
          streak,
          longestStreak: profile.longestStreak,
          lastActiveDate: profile.lastActiveDate,
          dailyGoal: (profile.dailyGoal && profile.dailyGoal !== 10) ? profile.dailyGoal : 30,
          todayCount,
          totalSwipes: profile.totalSwipes,
          xp: profile.xp,
          subscriptionTier: profile.subscriptionTier,
          cancelAtPeriodEnd: profile.cancelAtPeriodEnd,
          currentPeriodEnd: profile.currentPeriodEnd,
          energyLevel: profile.energyLevel,
          lastEnergyRefill: profile.lastEnergyRefill,
          hasCompletedOnboarding: profile.hasCompletedOnboarding || local.hasCompletedOnboarding,
        });
        await get().saveData();
        const packIds = packIdsForProgress(nextProgress);
        if (packIds.length > 0) {
          await get().ensurePacks(packIds);
        }
      }
      return true;
    } catch {
      return false;
    }
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

  setActivePackId: (packId) => {
    set({ activePackId: packId });
    get().scheduleSave();
  },

  ensurePacks: async (packIds) => {
    const uniqueIds = Array.from(new Set(packIds));
    if (uniqueIds.length === 0) return true;

    const results = await Promise.all(
      uniqueIds.map((packId) => {
        if (Object.prototype.hasOwnProperty.call(PACK_TERMS_MAP, packId)) {
          return Promise.resolve(true);
        }
        const existing = _packLoadPromises.get(packId);
        if (existing) {
          return existing;
        }
        const pack = findPackById(packId);
        if (!pack || !pack.load) {
          return Promise.resolve(true);
        }
        const loader = pack.load;
        const promise = Promise.resolve()
          .then(() => loader())
          .then((mod) => {
            const raw =
              mod && typeof mod === 'object' && 'default' in mod
                ? (mod as { default: unknown }).default
                : mod;
            if (!Array.isArray(raw)) {
              throw new Error(`Invalid pack data for ${packId}`);
            }
            const filtered = filterWrittenPackTerms(raw as Term[]);
            PACK_TERMS_MAP[packId] = filtered;
            for (const term of filtered) {
              TERM_BY_ID_MAP.set(term.id, term);
            }
            set((s) => ({ packsLoaded: s.packsLoaded + 1 }));
            return true;
          })
          .catch((err) => {
            _packLoadPromises.delete(packId);
            console.warn(`Failed to load pack ${packId}:`, err);
            return false;
          });
        _packLoadPromises.set(packId, promise);
        return promise;
      })
    );

    return results.every(Boolean);
  },

  getTermById: (termId) => {
    return TERM_BY_ID_MAP.get(termId);
  },

  getPackTerms: (packId) => {
    return PACK_TERMS_MAP[packId] ?? [];
  },

  getPackProgress: (packId) => {
    const { progress } = get();
    const pack = findPackById(packId);
    const packTerms = PACK_TERMS_MAP[packId];
    const boxes: Record<LeitnerBox, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    if (!packTerms) {
      return {
        packId,
        learned: 0,
        seen: 0,
        total: pack ? pack.size : 0,
        loaded: 0,
        due: 0,
        new: 0,
        boxes,
      };
    }

    let seen = 0;
    let learned = 0;
    let due = 0;
    let newCount = 0;

    for (const term of packTerms) {
      const p = progress[term.id];
      if (p) {
        seen += 1;
        const box = (p.box >= 1 && p.box <= 5 ? p.box : 1) as LeitnerBox;
        boxes[box] += 1;
        if (box >= 3) {
          learned += 1;
        }
        if (isDueForReview(p)) {
          due += 1;
        }
      } else {
        newCount += 1;
      }
    }

    return {
      packId,
      learned,
      seen,
      total: pack ? pack.size : packTerms.length,
      loaded: packTerms.length,
      due,
      new: newCount,
      boxes,
    };
  },

  getAllPacksProgress: () => {
    const result: Record<string, PackProgress> = {};
    for (const pack of get().packs) {
      result[pack.id] = get().getPackProgress(pack.id);
    }
    return result;
  },

  getPackStudyTerms: (packId, includeAll = false) => {
    const { progress } = get();
    const packTerms = PACK_TERMS_MAP[packId] ?? [];
    const pool = includeAll
      ? [...packTerms]
      : packTerms.filter((term) => {
          const p = progress[term.id];
          if (!p) return true;
          return isDueForReview(p);
        });

    pool.sort((a, b) => {
      const pa = progress[a.id];
      const pb = progress[b.id];
      if (pa && pb) {
        if (pa.box !== pb.box) return pa.box - pb.box;
        return pa.nextReview - pb.nextReview;
      }
      if (pa && !pb) return -1;
      if (!pa && pb) return 1;
      return (a.rank ?? a.order) - (b.rank ?? b.order);
    });

    return pool;
  },

  getPackReviewNeededTerms: (packId) => {
    const { progress } = get();
    const packTerms = PACK_TERMS_MAP[packId] ?? [];
    return packTerms.filter((t) => {
      const p = progress[t.id];
      return Boolean(p && p.box === 1 && p.timesSeen > 0);
    });
  },

  // Due cards across IT terms and every loaded pack. Uses the device clock like
  // isDueForReview so the count matches the per-pack "due" numbers.
  getDailyReviewQueue: (limit = DEFAULT_REVIEW_LIMIT) => {
    const { progress, terms } = get();
    return buildReviewQueue([terms, ...Object.values(PACK_TERMS_MAP)], progress, Date.now(), limit);
  },

  getReviewNeededTerms: () => {
    const { progress, terms } = get();
    return terms.filter(t => {
      const p = progress[t.id];
      return p && p.box === 1 && p.timesSeen > 0;
    });
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
      const term = TERM_BY_ID_MAP.get(termId);
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

  getKnownTermCount: () => {
    const { progress } = get();
    return Object.values(progress).filter(p => p.box >= 2).length;
  },

  downgradeQuizTerm: (termId: string) => {
    const { progress } = get();
    const existing = progress[termId];
    if (!existing) return;
    const updated = markUnknown(existing);
    set({ progress: { ...progress, [termId]: updated } });
    get().scheduleSave();
  },

  promoteQuizTerm: (termId: string) => {
    const { progress } = get();
    const existing = progress[termId];
    if (!existing || !isDueForReview(existing)) return;
    const updated = markKnown(existing);
    set({ progress: { ...progress, [termId]: updated } });
    get().scheduleSave();
  },

  generateQuiz: (mode = 'definition') => {
    const { progress, terms, language, quizSeenIds } = get();
    const tl = language === 'tr' ? 'tr' : 'en';
    const QUIZ_SIZE = 10;

    // IT terms plus terms of packs already loaded into memory.
    const knownIds = Object.keys(progress).filter(
      id => progress[id].box >= 2 && findLoadedTerm(id) !== undefined
    );
    if (knownIds.length < QUIZ_SIZE) return [];

    const unseenFirst = knownIds.filter(id => !quizSeenIds.has(id));
    const pool = unseenFirst.length >= QUIZ_SIZE ? unseenFirst : knownIds;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const selectedTerms = shuffled.slice(0, QUIZ_SIZE)
      .map(id => findLoadedTerm(id))
      .filter((t): t is Term => Boolean(t));

    set({ quizSeenIds: new Set([...quizSeenIds, ...selectedTerms.map(t => t.id)]) });

    const allTermsPool = [...terms, ...Object.values(PACK_TERMS_MAP).flat()];
    const baseSeed = Math.floor(Math.random() * 0x7fffffff);
    const questions: QuizQuestion[] = selectedTerms.map((term, index) => {
      const correctDef = term.translations[tl].definition;

      if (mode === 'cloze') {
        // Distractors come from the term's own pack; IT terms share the IT term list as their pack.
        const packId = packIdOfTerm(term.id);
        const packTerms = (packId && PACK_TERMS_MAP[packId]) || terms;
        const cloze = buildClozeQuestion(term, packTerms, baseSeed + index);
        // No match in the example (or too few distractors): fall back to the definition question below.
        if (cloze) {
          return { term, displayedDefinition: correctDef, isCorrect: true, correctDefinition: correctDef, cloze };
        }
      }

      const showCorrect = Math.random() < 0.5;

      if (showCorrect) {
        return {
          term,
          displayedDefinition: correctDef,
          isCorrect: true,
          correctDefinition: correctDef,
        };
      }

      let candidates = allTermsPool.filter(t =>
        t.id !== term.id && t.tags.some(tag => term.tags.includes(tag))
      );
      if (candidates.length === 0) {
        candidates = allTermsPool.filter(t => t.id !== term.id);
      }
      const donor = candidates[Math.floor(Math.random() * candidates.length)];

      return {
        term,
        displayedDefinition: donor.translations[tl].definition,
        isCorrect: false,
        sourceTerm: donor,
        correctDefinition: correctDef,
      };
    });

    return questions.sort(() => Math.random() - 0.5);
  },

  submitQuizResults: (correctCount, totalCount) => {
    const today = getTodayString();
    const s = get();
    const newStreak = streakAfterStudy(s.streak, s.lastActiveDate, today);
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
    if (correctCount > 0) get().recordDailyStat('quizCorrect', correctCount);
  },

  recordDailyStat: (field, amount) => {
    const today = getTodayString();
    const stats = [...get().dailyStats];
    let entry = stats.find(s => s.date === today);
    if (!entry) {
      entry = { date: today, swipes: 0, quizCorrect: 0, newTerms: 0 };
      stats.push(entry);
    }
    entry[field] += amount;
    const cutoff = stats.length > 90 ? stats.slice(-90) : stats;
    set({ dailyStats: cutoff });
    get().scheduleSave();
  },

  fetchServerTime: async () => {
    if (!isSupabaseConfigured) return;
    try {
      const before = Date.now();
      const { data } = await getSupabase().rpc('get_server_time');
      const after = Date.now();
      if (data) {
        const serverMs = new Date(data).getTime();
        const localMs = (before + after) / 2;
        set({ serverTimeOffset: serverMs - localMs });
      }
    } catch {}
  },

  getServerNow: () => {
    return Date.now() + get().serverTimeOffset;
  },

  hasLocalProgress: () => {
    const { progress, totalSwipes, streak } = get();
    return Object.keys(progress).length > 0 || totalSwipes > 0 || streak > 0;
  },

  resetUserData: () => {
    set({
      progress: {},
      activePackId: 'ngsl-1',
      selectedTags: [],
      displayName: '',
      totalSwipes: 0,
      streak: 0,
      xp: 0,
      energyLevel: 30,
      lastEnergyRefill: 0,
      swipeQueue: [],
      dailyStats: [],
      reviewMode: false,
      quizSeenIds: new Set<string>(),
      isSyncConflict: false,
      isCheckingSync: false,
      isResettingPassword: false,
      needsCloudHydration: true,
      pendingCloudData: null,
      todayCount: 0,
      longestStreak: 0,
      lastActiveDate: null,
      earnedBadges: [],
      subscriptionTier: 'free' as SubscriptionTier,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      hasCompletedOnboarding: false,
    });
    get().scheduleSave();
  },

  checkSyncConflict: async (userId: string) => {
    if (!isSupabaseConfigured) { set({ isCheckingSync: false }); return false; }

    set({ isCheckingSync: true });

    const localHasData = get().hasLocalProgress();
    if (!localHasData) { set({ isCheckingSync: false }); return false; }

    try {
      const cloudData = await pullProgress(userId);
      if (!cloudData.profile) { set({ isCheckingSync: false }); return false; }

      const cloudHasProgress = Object.keys(cloudData.progress).length > 0
        || (cloudData.profile.totalSwipes ?? 0) > 0
        || (cloudData.profile.streak ?? 0) > 0;

      if (!cloudHasProgress) { set({ isCheckingSync: false }); return false; }

      const localTotal = get().totalSwipes;
      const cloudTotal = cloudData.profile.totalSwipes ?? 0;
      if (localTotal === cloudTotal && Object.keys(get().progress).length === Object.keys(cloudData.progress).length) {
        set({ isCheckingSync: false });
        return false;
      }

      set({ isSyncConflict: true, isCheckingSync: false, pendingCloudData: cloudData });
      return true;
    } catch {
      set({ isCheckingSync: false });
      return false;
    }
  },

  resolveSyncConflict: async (useCloud: boolean) => {
    const { pendingCloudData } = get();
    if (useCloud && pendingCloudData?.profile) {
      const profile = pendingCloudData.profile;
      const today = getTodayString();
      let streak = profile.streak;
      let todayCount = profile.todayCount;
      if (profile.lastActiveDate) {
        streak = streakAfterLoad(streak, profile.lastActiveDate, today);
        if (profile.lastActiveDate !== today) todayCount = 0;
      }

      set({
        progress: pendingCloudData.progress,
        selectedTags: profile.selectedTags?.length > 0 ? profile.selectedTags : get().selectedTags,
        language: profile.language as Language,
        streak,
        longestStreak: profile.longestStreak ?? 0,
        lastActiveDate: profile.lastActiveDate ?? null,
        dailyGoal: (profile.dailyGoal && profile.dailyGoal !== 10) ? profile.dailyGoal : 30,
        todayCount,
        totalSwipes: profile.totalSwipes ?? 0,
        xp: profile.xp ?? 0,
        subscriptionTier: profile.subscriptionTier ?? 'free',
        cancelAtPeriodEnd: profile.cancelAtPeriodEnd ?? false,
        currentPeriodEnd: profile.currentPeriodEnd ?? null,
        energyLevel: profile.energyLevel ?? MAX_ENERGY,
        lastEnergyRefill: profile.lastEnergyRefill ?? Date.now(),
        hasCompletedOnboarding: profile.hasCompletedOnboarding || get().hasCompletedOnboarding,
        isSyncConflict: false,
        isCheckingSync: false,
        pendingCloudData: null,
      });
      await get().saveData();
      const packIds = packIdsForProgress(pendingCloudData.progress);
      if (packIds.length > 0) {
        await get().ensurePacks(packIds);
      }
    } else {
      set({ isSyncConflict: false, isCheckingSync: false, pendingCloudData: null });
    }
  },

  dismissSyncConflict: () => {
    set({ isSyncConflict: false, isCheckingSync: false, pendingCloudData: null });
  },
}));
