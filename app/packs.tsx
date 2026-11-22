import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Linking,
  I18nManager,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle,
  Flame,
  Infinity,
  List,
  RotateCcw,
  Search,
  Target,
  X,
  Zap,
} from 'lucide-react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppStore, MAX_ENERGY, MIN_SCOPED_QUIZ_SIZE } from '@/lib/store';
import { packIdOfTerm } from '@/data/packs';
import {
  PACK_FILTERS,
  PackFilter,
  countPackFilters,
  filterPackTerms,
  isStruggling,
  wrongCount,
} from '@/lib/pack-filter';
import { useTheme } from '@/lib/useTheme';
import { colors, spacing, radius, typography } from '@/constants/theme';
import {
  Pack,
  PackGroup,
  LeitnerBox,
  Term,
  getTermLanguage,
} from '@/types';
import CardDeck from '@/components/CardDeck';
import { DailyReviewCard, DailyReviewSession } from '@/components/DailyReview';

type GroupFilter = 'all' | PackGroup;

const LEITNER_BOXES: LeitnerBox[] = [1, 2, 3, 4, 5];
const SEARCH_DEBOUNCE_MS = 200;

export default function PacksScreen() {
  const { colors: t, accent } = useTheme();
  const router = useRouter();
  const { t: tr, i18n } = useTranslation();
  const params = useLocalSearchParams<{ packId?: string; autostart?: string; daily?: string }>();

  const {
    isLoaded,
    loadData,
    packs,
    packsLoaded,
    activePackId,
    setActivePackId,
    ensurePacks,
    getPackProgress,
    getAllPacksProgress,
    getPackStudyTerms,
    getPackReviewNeededTerms,
    getDailyReviewQueue,
    getPackTerms,
    setQuizScope,
    countScopedQuizReady,
    progress,
    language,
    streak,
    energyLevel,
    hasActivePremium,
  } = useAppStore();

  const [selectedGroup, setSelectedGroup] = useState<GroupFilter>('all');
  const [studyingPackId, setStudyingPackId] = useState<string | null>(null);
  const [studyTerms, setStudyTerms] = useState<Term[]>([]);
  const [packReviewMode, setPackReviewMode] = useState(false);
  const [packPracticeMode, setPackPracticeMode] = useState(false);
  const [loadingPackId, setLoadingPackId] = useState<string | null>(null);
  const [loadErrorPackId, setLoadErrorPackId] = useState<string | null>(null);
  const [dailySession, setDailySession] = useState<{ terms: Term[]; total: number } | null>(null);
  // Word list ("Words") view of one pack: search + box/struggling filter.
  const [browsingPackId, setBrowsingPackId] = useState<string | null>(null);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [wordFilter, setWordFilter] = useState<PackFilter>('all');
  // True while the card deck shows a filtered word list instead of the pack's due cards.
  const [filteredSession, setFilteredSession] = useState(false);
  const didAutostartRef = useRef<string | null>(null);
  const didAutoBrowseRef = useRef<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const packListScrollRef = useRef<ScrollView | null>(null);
  const packListOffsetRef = useRef(0);
  const loadingPackRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!isLoaded) {
      void loadData();
    }
  }, [isLoaded, loadData]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isPremium = hasActivePremium();
  const termLang = getTermLanguage(language);
  const isArabic = language === 'ar';
  const shouldMirror = isArabic && !I18nManager.isRTL;
  const rowStyle = shouldMirror ? styles.rowReverse : styles.row;
  const textDirStyle = isArabic
    ? ({
        writingDirection: 'rtl' as const,
        textAlign: 'right' as const,
      })
    : undefined;
  const wordDirStyle = isArabic ? styles.ltrTextRight : styles.ltrText;

  const progressPackIds = useMemo(() => {
    const ids = new Set<string>();
    for (const termId of Object.keys(progress)) {
      const packId = packIdOfTerm(termId);
      if (packId) ids.add(packId);
    }
    return Array.from(ids);
  }, [progress]);

  const hasProgress = useMemo(
    () => Object.values(progress).some((p) => Boolean(p && (p.timesSeen ?? 1) > 0)),
    [progress]
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allProgress = useMemo(() => getAllPacksProgress(), [packs, progress, packsLoaded]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dailyDue = useMemo(() => getDailyReviewQueue().totalDue, [progress, packsLoaded]);
  const lastPack = useMemo(
    () => (hasProgress && activePackId ? packs.find((p) => p.id === activePackId) ?? null : null),
    [hasProgress, packs, activePackId]
  );
  const lastPackTitle = lastPack
    ? i18n.exists(`categories.${lastPack.id}`)
      ? tr(`categories.${lastPack.id}`)
      : lastPack.title[termLang]
    : null;

  const availableGroups = useMemo(() => {
    const present = new Set<PackGroup>(packs.map((p) => p.group));
    const ordered: PackGroup[] = ['english', 'exam', 'it'];
    return ordered.filter((g) => present.has(g));
  }, [packs]);

  const filteredPacks = useMemo(() => {
    if (selectedGroup === 'all') return packs;
    return packs.filter((p) => p.group === selectedGroup);
  }, [packs, selectedGroup]);

  const uniqueSources = useMemo(() => {
    const map = new Map<string, Pack['source']>();
    for (const pack of packs) {
      const key = `${pack.source.name}|${pack.source.url}|${pack.source.licenseUrl}`;
      if (!map.has(key)) {
        map.set(key, pack.source);
      }
    }
    return Array.from(map.values());
  }, [packs]);

  const handleOpenExternal = useCallback((url: string) => {
    Linking.openURL(url).catch(() => {});
  }, []);

  const handleStartPack = useCallback(
    async (pack: Pack, reviewOnly = false): Promise<boolean> => {
      if (!pack.load) return false;
      if (loadingPackRef.current) return false;

      loadingPackRef.current = true;
      setLoadingPackId(pack.id);
      setLoadErrorPackId(null);

      try {
        const ok = await ensurePacks([pack.id]);
        if (!mountedRef.current) return false;

        const prog = getPackProgress(pack.id);
        if (!ok || prog.loaded === 0) {
          if (!ok) {
            setLoadErrorPackId(pack.id);
          }
          return false;
        }

        if (reviewOnly) {
          const revTerms = getPackReviewNeededTerms(pack.id);
          if (revTerms.length === 0) return false;
          setDailySession(null);
          setActivePackId(pack.id);
          setFilteredSession(false);
          setBrowsingPackId(null);
          setPackReviewMode(true);
          setPackPracticeMode(false);
          setStudyTerms(revTerms);
          setStudyingPackId(pack.id);
          return true;
        }

        const dueTerms = getPackStudyTerms(pack.id, false);
        const isPractice = dueTerms.length === 0;
        const nextTerms = isPractice ? getPackStudyTerms(pack.id, true) : dueTerms;
        setDailySession(null);
        setActivePackId(pack.id);
        setFilteredSession(false);
        setBrowsingPackId(null);
        setPackReviewMode(false);
        setPackPracticeMode(isPractice);
        setStudyTerms(nextTerms);
        setStudyingPackId(pack.id);
        return true;
      } finally {
        loadingPackRef.current = false;
        if (mountedRef.current) {
          setLoadingPackId(null);
        }
      }
    },
    [ensurePacks, getPackProgress, setActivePackId, getPackReviewNeededTerms, getPackStudyTerms]
  );

  useEffect(() => {
    const targetPackId = Array.isArray(params.packId) ? params.packId[0] : params.packId;
    const auto = Array.isArray(params.autostart) ? params.autostart[0] : params.autostart;
    if (auto !== '1' || !targetPackId) {
      didAutostartRef.current = null;
      return;
    }
    if (!isLoaded) return;
    if (didAutostartRef.current === targetPackId) return;
    const target = packs.find((p) => p.id === targetPackId);
    if (target && target.load) {
      didAutostartRef.current = targetPackId;
      void handleStartPack(target, false).then((started) => {
        if (!started && didAutostartRef.current === targetPackId) {
          didAutostartRef.current = null;
        }
      });
    }
  }, [isLoaded, params.autostart, params.packId, packs, handleStartPack]);

  // Closes the deck; after a filtered session this returns to the word list (browsingPackId stays set).
  const handleBackToPacks = useCallback(() => {
    setPackReviewMode(false);
    setPackPracticeMode(false);
    setFilteredSession(false);
    setStudyingPackId(null);
  }, []);

  useEffect(() => {
    if (studyingPackId !== null || query === queryInput) return;
    const timer = setTimeout(() => {
      searchTimerRef.current = null;
      setQuery(queryInput);
    }, SEARCH_DEBOUNCE_MS);
    searchTimerRef.current = timer;
    return () => {
      clearTimeout(timer);
      if (searchTimerRef.current === timer) {
        searchTimerRef.current = null;
      }
    };
  }, [queryInput, query, studyingPackId]);

  const packTitleOf = useCallback(
    (pack: Pack) =>
      i18n.exists(`categories.${pack.id}`) ? tr(`categories.${pack.id}`) : pack.title[termLang],
    [i18n, tr, termLang]
  );

  const filterLabelOf = useCallback(
    (filter: PackFilter) => {
      if (filter === 'all') return tr('packs.filterAll');
      if (filter === 'new') return tr('packs.filterNew');
      if (filter === 'struggling') return tr('packs.filterStruggling');
      return tr('packs.filterBox', { box: filter });
    },
    [tr]
  );

  const handleBrowsePack = useCallback(
    async (pack: Pack): Promise<boolean> => {
      if (!pack.load) return false;
      if (loadingPackRef.current) return false;

      loadingPackRef.current = true;
      setLoadingPackId(pack.id);
      setLoadErrorPackId(null);

      try {
        const ok = await ensurePacks([pack.id]);
        if (!mountedRef.current) return false;
        if (!ok) {
          setLoadErrorPackId(pack.id);
          return false;
        }
        setQueryInput('');
        setQuery('');
        setWordFilter('all');
        setBrowsingPackId(pack.id);
        return true;
      } finally {
        loadingPackRef.current = false;
        if (mountedRef.current) {
          setLoadingPackId(null);
        }
      }
    },
    [ensurePacks]
  );

  // Open the pack's word list once when navigated with `packId` without `autostart=1` (e.g. Profile > Pack Progress).
  useEffect(() => {
    const targetPackId = Array.isArray(params.packId) ? params.packId[0] : params.packId;
    const auto = Array.isArray(params.autostart) ? params.autostart[0] : params.autostart;
    if (auto === '1' || !targetPackId) {
      didAutoBrowseRef.current = null;
      return;
    }
    if (!isLoaded) return;
    if (didAutoBrowseRef.current === targetPackId) return;
    const target = packs.find((p) => p.id === targetPackId);
    if (target && target.load) {
      didAutoBrowseRef.current = targetPackId;
      void handleBrowsePack(target).then((opened) => {
        if (!opened && didAutoBrowseRef.current === targetPackId) {
          didAutoBrowseRef.current = null;
        }
      });
    }
  }, [isLoaded, params.autostart, params.packId, packs, handleBrowsePack]);

  const handleCloseBrowse = useCallback(() => {
    setBrowsingPackId(null);
    setQueryInput('');
    setQuery('');
    setWordFilter('all');
  }, []);

  const browsingPack = useMemo(
    () => (browsingPackId ? packs.find((p) => p.id === browsingPackId) ?? null : null),
    [packs, browsingPackId]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const browseTerms = useMemo(
    () => (browsingPackId ? getPackTerms(browsingPackId) : []),
    [browsingPackId, packsLoaded]
  );

  const filteredWords = useMemo(
    () => filterPackTerms(browseTerms, progress, { query, filter: wordFilter }),
    [browseTerms, progress, query, wordFilter]
  );

  const filterCounts = useMemo(
    () => countPackFilters(browseTerms, progress, query),
    [browseTerms, progress, query]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filteredQuizReady = useMemo(
    () => countScopedQuizReady(filteredWords.map((w) => w.id)),
    [filteredWords, progress]
  );

  const resolveActiveFilteredWords = useCallback(() => {
    if (searchTimerRef.current !== null) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    if (query !== queryInput) {
      setQuery(queryInput);
      return filterPackTerms(browseTerms, progress, { query: queryInput, filter: wordFilter });
    }
    return filteredWords;
  }, [query, queryInput, browseTerms, progress, wordFilter, filteredWords]);

  // Card session on the filtered list; normal deck rules (energy for new cards, swipe sync) apply.
  const handleStudyFiltered = useCallback(() => {
    if (!browsingPackId) return;
    const words = resolveActiveFilteredWords();
    if (words.length === 0) return;
    setDailySession(null);
    setActivePackId(browsingPackId);
    setPackReviewMode(false);
    setPackPracticeMode(false);
    setFilteredSession(true);
    setStudyTerms(words);
    setStudyingPackId(browsingPackId);
  }, [browsingPackId, resolveActiveFilteredWords, setActivePackId]);

  const handleQuizFiltered = useCallback(() => {
    if (!browsingPack) return;
    const words = resolveActiveFilteredWords();
    const ids = words.map((w) => w.id);
    const readyCount = query !== queryInput ? countScopedQuizReady(ids) : filteredQuizReady;
    if (readyCount < MIN_SCOPED_QUIZ_SIZE) return;
    const trimmed = queryInput.trim();
    const label = [
      packTitleOf(browsingPack),
      filterLabelOf(wordFilter),
      ...(trimmed ? [`"${trimmed}"`] : []),
    ].join(' · ');
    setQuizScope({ ids, label });
    router.navigate('/(tabs)/quiz' as unknown as Parameters<typeof router.navigate>[0]);
  }, [
    browsingPack,
    resolveActiveFilteredWords,
    query,
    queryInput,
    countScopedQuizReady,
    filteredQuizReady,
    packTitleOf,
    filterLabelOf,
    wordFilter,
    setQuizScope,
    router,
  ]);

  const renderWordRow = useCallback(
    ({ item }: { item: Term }) => {
      const p = progress[item.id];
      const wrong = wrongCount(p);
      const isLearnedBox = Boolean(p && p.box >= 3);
      return (
        <Pressable
          onPress={() => router.push(`/term/${item.id}`)}
          accessibilityRole="button"
          accessibilityLabel={tr('packs.openWordDetail', { term: item.term })}
          style={({ pressed }) => [
            styles.wordRow,
            rowStyle,
            { backgroundColor: t.bgElevated, borderColor: t.border },
            pressed && { opacity: 0.75 },
          ]}
        >
          <View style={styles.wordTextCol}>
            <Text
              style={[typography.headline, { color: t.text }, wordDirStyle]}
              numberOfLines={1}
            >
              {item.term}
            </Text>
            <Text
              style={[typography.footnote, { color: t.textSecondary, marginTop: 2 }, wordDirStyle]}
              numberOfLines={2}
            >
              {item.translations[termLang].definition}
            </Text>
          </View>
          <View style={styles.wordMetaCol}>
            <View
              style={[
                styles.boxPill,
                {
                  backgroundColor: !p
                    ? t.bgSubtle
                    : isLearnedBox
                      ? colors.successMuted
                      : colors.accentSubtle,
                },
              ]}
            >
              <Text
                style={[
                  typography.caption,
                  { color: !p ? t.textTertiary : isLearnedBox ? colors.success : accent },
                ]}
              >
                {p ? tr('packs.boxShort', { box: p.box }) : tr('packs.filterNew')}
              </Text>
            </View>
            {wrong > 0 && (
              <Text
                style={[
                  typography.caption,
                  { color: isStruggling(p) ? colors.danger : t.textTertiary },
                ]}
              >
                {tr('packs.missedCount', { count: wrong })}
              </Text>
            )}
          </View>
        </Pressable>
      );
    },
    [progress, rowStyle, wordDirStyle, t, accent, termLang, tr, router]
  );

  const handleNavigateBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/explore' as unknown as Parameters<typeof router.replace>[0]);
    }
  }, [router]);

  // Snapshot the queue so the deck does not reset after every swipe.
  const startDailyReview = useCallback(() => {
    const queue = getDailyReviewQueue();
    setPackReviewMode(false);
    setPackPracticeMode(false);
    setFilteredSession(false);
    setStudyingPackId(null);
    setBrowsingPackId(null);
    setDailySession({ terms: queue.items, total: queue.totalDue });
  }, [getDailyReviewQueue]);

  const handleCloseDailyReview = useCallback(() => {
    setDailySession(null);
    setPackReviewMode(false);
    setPackPracticeMode(false);
    setFilteredSession(false);
    setStudyingPackId(null);
    setBrowsingPackId(null);
  }, []);

  // `?daily=1` (home shortcut) opens the daily review once per navigation,
  // after store hydration and any packs referenced in progress have loaded.
  const didAutoDailyRef = useRef(false);
  useEffect(() => {
    const daily = Array.isArray(params.daily) ? params.daily[0] : params.daily;
    if (daily !== '1') {
      didAutoDailyRef.current = false;
      return;
    }
    if (!isLoaded || didAutoDailyRef.current) return;

    const missingPackIds = progressPackIds.filter(
      (id) => getPackTerms(id).length === 0 && packs.some((p) => p.id === id && Boolean(p.load))
    );
    if (missingPackIds.length === 0) {
      didAutoDailyRef.current = true;
      startDailyReview();
      return;
    }

    let cancelled = false;
    void ensurePacks(missingPackIds).finally(() => {
      if (cancelled || !mountedRef.current || didAutoDailyRef.current) return;
      didAutoDailyRef.current = true;
      startDailyReview();
    });
    return () => {
      cancelled = true;
    };
  }, [
    isLoaded,
    packsLoaded,
    params.daily,
    progressPackIds,
    packs,
    getPackTerms,
    ensurePacks,
    startDailyReview,
  ]);

  const handleContinueLastPack = useCallback(() => {
    setDailySession(null);
    if (lastPack && lastPack.load) {
      void handleStartPack(lastPack, false);
      return;
    }
    setStudyingPackId(null);
    setBrowsingPackId(null);
    setSelectedGroup('all');
    packListScrollRef.current?.scrollTo({ y: packListOffsetRef.current, animated: true });
  }, [lastPack, handleStartPack]);

  const studyingPack = useMemo(
    () => (studyingPackId ? packs.find((p) => p.id === studyingPackId) ?? null : null),
    [packs, studyingPackId]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const studyingReviewTerms = useMemo(
    () => (studyingPackId ? getPackReviewNeededTerms(studyingPackId) : []),
    [studyingPackId, progress, packsLoaded]
  );

  if (dailySession) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <DailyReviewSession
          terms={dailySession.terms}
          totalDue={dailySession.total}
          hasProgress={hasProgress}
          language={language}
          streak={streak}
          lastPackTitle={lastPackTitle}
          onClose={handleCloseDailyReview}
          onRestart={startDailyReview}
          onContinuePack={handleContinueLastPack}
        />
      </SafeAreaView>
    );
  }

  if (studyingPack) {
    const packProg = allProgress[studyingPack.id] ?? getPackProgress(studyingPack.id);
    const canToggleReview = packReviewMode || studyingReviewTerms.length > 0;

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />

        <View style={[styles.deckHeader, rowStyle]}>
          <View style={styles.deckHeaderTitleWrap}>
            <Pressable onPress={handleBackToPacks} hitSlop={12}>
              <Text
                style={[typography.headline, { color: t.text }, textDirStyle]}
                numberOfLines={1}
              >
                {i18n.exists(`categories.${studyingPack.id}`)
                  ? tr(`categories.${studyingPack.id}`)
                  : studyingPack.title[termLang]}
              </Text>
              <Text
                style={[
                  typography.footnote,
                  { color: packPracticeMode ? accent : t.textSecondary, marginTop: spacing.xs },
                  textDirStyle,
                ]}
              >
                {packPracticeMode
                  ? `${tr('packs.learnedCount', { learned: packProg.learned, total: packProg.total })} · ${tr('packs.practiceMode')}`
                  : filteredSession
                    ? `${tr('packs.learnedCount', { learned: packProg.learned, total: packProg.total })} · ${filterLabelOf(wordFilter)}`
                    : tr('packs.learnedCount', {
                        learned: packProg.learned,
                        total: packProg.total,
                      })}
              </Text>
            </Pressable>
          </View>

          <View style={[styles.deckHeaderActions, rowStyle]}>
            {streak > 0 && (
              <View style={[styles.statChip, rowStyle, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
                <Flame size={14} color={colors.warning} strokeWidth={1.8} />
                <Text style={[typography.subhead, { color: colors.warning, fontWeight: '600' }]}>
                  {streak}
                </Text>
              </View>
            )}

            <View style={[styles.statChip, rowStyle, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
              {isPremium ? (
                <Infinity size={14} color={accent} strokeWidth={1.8} />
              ) : (
                <Zap
                  size={14}
                  color={energyLevel > 0 ? colors.warning : colors.danger}
                  strokeWidth={1.8}
                />
              )}
              {!isPremium && (
                <Text
                  style={[
                    typography.subhead,
                    {
                      color: energyLevel > 0 ? t.text : colors.danger,
                      fontWeight: '600',
                    },
                  ]}
                >
                  {`${energyLevel}/${MAX_ENERGY}`}
                </Text>
              )}
            </View>

            {!filteredSession && (
              <Pressable
                disabled={!canToggleReview}
                onPress={() => {
                  if (packReviewMode) {
                    handleStartPack(studyingPack, false);
                  } else {
                    handleStartPack(studyingPack, true);
                  }
                }}
                style={[
                  styles.iconCircleBtn,
                  {
                    backgroundColor: packReviewMode ? colors.accentMuted : colors.warningMuted,
                    borderColor: packReviewMode ? accent : colors.warning,
                    opacity: canToggleReview ? 1 : 0.4,
                  },
                ]}
              >
                {packReviewMode ? (
                  <BookOpen size={14} color={accent} strokeWidth={2} />
                ) : (
                  <RotateCcw size={14} color={colors.warning} strokeWidth={2} />
                )}
              </Pressable>
            )}

            <Pressable onPress={handleBackToPacks} hitSlop={12} style={styles.closeBtn}>
              <X size={22} color={t.textTertiary} strokeWidth={2} />
            </Pressable>
          </View>
        </View>

        <CardDeck
          terms={studyTerms}
          language={language}
          isReviewMode={packReviewMode}
          isPracticeMode={packPracticeMode}
          onRestart={() => {
            if (filteredSession) {
              // Re-run the same search/filter on current progress (e.g. fixed words leave "Struggling").
              const next = filterPackTerms(getPackTerms(studyingPack.id), progress, {
                query,
                filter: wordFilter,
              });
              if (next.length === 0) {
                handleBackToPacks();
              } else {
                setStudyTerms(next);
              }
              return;
            }
            if (packReviewMode && getPackReviewNeededTerms(studyingPack.id).length === 0) {
              handleStartPack(studyingPack, false);
            } else {
              handleStartPack(studyingPack, packReviewMode);
            }
          }}
        />
      </SafeAreaView>
    );
  }

  if (browsingPack) {
    const canStudy = filteredWords.length > 0;
    const canQuiz = filteredQuizReady >= MIN_SCOPED_QUIZ_SIZE;

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.topHeader}>
            <View style={[styles.titleBar, rowStyle]}>
              <Pressable
                onPress={handleCloseBrowse}
                hitSlop={12}
                accessibilityRole="button"
                style={[styles.backBtn, { backgroundColor: t.bgElevated, borderColor: t.border }]}
              >
                {isArabic ? (
                  <ArrowRight size={18} color={t.text} strokeWidth={2} />
                ) : (
                  <ArrowLeft size={18} color={t.text} strokeWidth={2} />
                )}
              </Pressable>
              <View style={styles.titleTextWrap}>
                <Text style={[typography.title, { color: t.text }, textDirStyle]} numberOfLines={1}>
                  {packTitleOf(browsingPack)}
                </Text>
                <Text style={[typography.footnote, { color: t.textSecondary }, textDirStyle]}>
                  {tr('packs.resultCount', { count: filteredWords.length })}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.searchBox,
                rowStyle,
                { backgroundColor: t.bgElevated, borderColor: t.border },
              ]}
            >
              <Search size={16} color={t.textTertiary} strokeWidth={2} />
              <TextInput
                value={queryInput}
                onChangeText={setQueryInput}
                placeholder={tr('packs.searchPlaceholder')}
                placeholderTextColor={t.textMuted}
                accessibilityLabel={tr('packs.searchPlaceholder')}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                style={[
                  typography.body,
                  styles.searchInput,
                  { color: t.text },
                  isArabic ? styles.searchInputRtl : null,
                ]}
              />
              {queryInput.length > 0 && (
                <Pressable
                  onPress={() => {
                    setQueryInput('');
                    setQuery('');
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={tr('packs.clearSearch')}
                >
                  <X size={16} color={t.textTertiary} strokeWidth={2} />
                </Pressable>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.tabRow, rowStyle]}
            >
              {PACK_FILTERS.map((filter) => {
                const active = wordFilter === filter;
                const count = filterCounts[String(filter)] ?? 0;
                const isStrugglingTab = filter === 'struggling';
                return (
                  <Pressable
                    key={String(filter)}
                    onPress={() => setWordFilter(filter)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.filterChip,
                      styles.tabChip,
                      rowStyle,
                      {
                        backgroundColor: active
                          ? isStrugglingTab
                            ? colors.danger
                            : accent
                          : t.bgElevated,
                        borderColor: active
                          ? isStrugglingTab
                            ? colors.danger
                            : accent
                          : isStrugglingTab && count > 0
                            ? colors.danger
                            : t.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.subhead,
                        { color: active ? colors.dark.text : t.textSecondary },
                      ]}
                    >
                      {filterLabelOf(filter)}
                    </Text>
                    <Text
                      style={[
                        typography.caption,
                        { color: active ? colors.dark.text : t.textTertiary },
                      ]}
                    >
                      {count}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {wordFilter === 'struggling' && (
              <Text style={[typography.footnote, { color: t.textTertiary }, textDirStyle]}>
                {tr('packs.strugglingHint')}
              </Text>
            )}
          </View>

          <FlatList
            data={filteredWords}
            keyExtractor={(item) => item.id}
            renderItem={renderWordRow}
            style={styles.flex}
            contentContainerStyle={styles.wordListContent}
            ItemSeparatorComponent={WordSeparator}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={11}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListEmptyComponent={
              <Text
                style={[
                  typography.callout,
                  { color: t.textTertiary, textAlign: 'center', marginTop: spacing['2xl'] },
                ]}
              >
                {tr('packs.noResults')}
              </Text>
            }
          />

          <View style={[styles.actionBar, { borderTopColor: t.border, backgroundColor: t.bg }]}>
            {canStudy && !canQuiz && (
              <Text style={[typography.caption, { color: t.textTertiary }, textDirStyle]}>
                {tr('packs.quizNeedsSeen', { min: MIN_SCOPED_QUIZ_SIZE })}
              </Text>
            )}
            <View style={[styles.actionBtnRow, rowStyle]}>
              <Pressable
                disabled={!canStudy}
                onPress={handleStudyFiltered}
                accessibilityRole="button"
                style={[
                  styles.actionBtn,
                  rowStyle,
                  {
                    backgroundColor: canStudy ? accent : t.bgSubtle,
                    borderColor: canStudy ? accent : t.border,
                  },
                ]}
              >
                <BookOpen size={15} color={canStudy ? colors.dark.text : t.textMuted} strokeWidth={2} />
                <Text
                  style={[
                    typography.subhead,
                    { color: canStudy ? colors.dark.text : t.textMuted, fontWeight: '600' },
                  ]}
                  numberOfLines={1}
                >
                  {tr('packs.studyFiltered', { count: filteredWords.length })}
                </Text>
              </Pressable>
              <Pressable
                disabled={!canQuiz}
                onPress={handleQuizFiltered}
                accessibilityRole="button"
                style={[
                  styles.actionBtn,
                  rowStyle,
                  {
                    backgroundColor: t.bgElevated,
                    borderColor: canQuiz ? accent : t.border,
                  },
                ]}
              >
                <Target size={15} color={canQuiz ? accent : t.textMuted} strokeWidth={2} />
                <Text
                  style={[
                    typography.subhead,
                    { color: canQuiz ? accent : t.textMuted, fontWeight: '600' },
                  ]}
                  numberOfLines={1}
                >
                  {tr('packs.quizFiltered', { count: filteredQuizReady })}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topHeader}>
        <View style={[styles.titleBar, rowStyle]}>
          <Pressable
            onPress={handleNavigateBack}
            hitSlop={12}
            style={[styles.backBtn, { backgroundColor: t.bgElevated, borderColor: t.border }]}
          >
            {isArabic ? (
              <ArrowRight size={18} color={t.text} strokeWidth={2} />
            ) : (
              <ArrowLeft size={18} color={t.text} strokeWidth={2} />
            )}
          </Pressable>
          <View style={styles.titleTextWrap}>
            <Text style={[typography.largeTitle, { color: t.text }, textDirStyle]}>
              {tr('packs.title')}
            </Text>
          </View>
        </View>

        <Text style={[typography.callout, { color: t.textSecondary }, textDirStyle]}>
          {tr('packs.subtitle')}
        </Text>

        <View style={[styles.filterRow, rowStyle]}>
          <Pressable
            onPress={() => setSelectedGroup('all')}
            style={[
              styles.filterChip,
              {
                backgroundColor: selectedGroup === 'all' ? accent : t.bgElevated,
                borderColor: selectedGroup === 'all' ? accent : t.border,
              },
            ]}
          >
            <Text
              style={[
                typography.subhead,
                { color: selectedGroup === 'all' ? colors.dark.text : t.textSecondary },
              ]}
            >
              {tr('packs.filterAll')}
            </Text>
          </Pressable>

          {availableGroups.map((group) => {
            const active = selectedGroup === group;
            return (
              <Pressable
                key={group}
                onPress={() => setSelectedGroup(group)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? accent : t.bgElevated,
                    borderColor: active ? accent : t.border,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.subhead,
                    { color: active ? colors.dark.text : t.textSecondary },
                  ]}
                >
                  {tr(`packs.group_${group}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loadErrorPackId && (
          <View
            style={[
              styles.errorBanner,
              rowStyle,
              { backgroundColor: t.bgElevated, borderColor: colors.danger },
            ]}
          >
            <Text
              style={[
                typography.footnote,
                { color: colors.danger, flex: 1 },
                textDirStyle,
              ]}
            >
              {tr('packs.loadError')}
            </Text>
            <Pressable onPress={() => setLoadErrorPackId(null)} hitSlop={8}>
              <X size={16} color={t.textTertiary} strokeWidth={2} />
            </Pressable>
          </View>
        )}
      </View>

      <ScrollView
        ref={packListScrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        <View
          onLayout={(e) => {
            const { y, height } = e.nativeEvent.layout;
            packListOffsetRef.current = y + height + spacing.lg;
          }}
        >
          <DailyReviewCard
            totalDue={dailyDue}
            hasProgress={hasProgress}
            language={language}
            lastPackTitle={lastPackTitle}
            onStart={startDailyReview}
            onContinuePack={handleContinueLastPack}
          />
        </View>

        {filteredPacks.map((pack) => {
          const prog = allProgress[pack.id] ?? getPackProgress(pack.id);
          const isReady = Boolean(pack.load);
          const isAnyLoading = loadingPackId !== null;
          const isThisLoading = loadingPackId === pack.id;
          const isActive = activePackId === pack.id;
          const learnedRatio = prog.total > 0 ? Math.min(prog.learned / prog.total, 1) : 0;
          const seenRatio = prog.total > 0 ? Math.min(prog.seen / prog.total, 1) : 0;

          let actionLabel = tr('packs.comingSoon');
          if (isReady) {
            if (prog.seen === 0) {
              actionLabel = tr('packs.start');
            } else if (prog.due + prog.new > 0) {
              actionLabel = tr('packs.continue');
            } else {
              actionLabel = tr('packs.practiceAll');
            }
          }

          return (
            <View
              key={pack.id}
              style={[
                styles.packCard,
                {
                  backgroundColor: t.bgElevated,
                  borderColor: isActive ? accent : t.border,
                },
              ]}
            >
              {/* Card top row: badges + x/1000 */}
              <View style={[styles.cardBadgeRow, rowStyle]}>
                <View style={[styles.badgeGroup, rowStyle]}>
                  <View style={[styles.groupBadge, { backgroundColor: colors.accentSubtle }]}>
                    <Text style={[typography.caption, { color: accent }]}>
                      {tr(`packs.group_${pack.group}`)}
                    </Text>
                  </View>
                  {isActive && (
                    <View style={[styles.groupBadge, rowStyle, { backgroundColor: colors.successMuted }]}>
                      <CheckCircle size={11} color={colors.success} strokeWidth={2} />
                      <Text style={[typography.caption, { color: colors.success }]}>
                        {tr('packs.active')}
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={[typography.mono, { color: prog.learned > 0 ? colors.success : t.textSecondary }]}>
                  {`${prog.learned}/${prog.total}`}
                </Text>
              </View>

              {/* Title */}
              <Text
                style={[
                  typography.title,
                  { color: t.text, marginTop: spacing.sm },
                  textDirStyle,
                ]}
              >
                {i18n.exists(`categories.${pack.id}`)
                  ? tr(`categories.${pack.id}`)
                  : pack.title[termLang]}
              </Text>

              {/* Progress summary text */}
              <View style={[styles.metricsRow, rowStyle]}>
                <Text style={[typography.subhead, { color: t.text }, textDirStyle]}>
                  {tr('packs.learnedCount', { learned: prog.learned, total: prog.total })}
                </Text>
                <Text style={[typography.footnote, { color: t.textTertiary }, textDirStyle]}>
                  {`${tr('packs.seenCount', { count: prog.seen })} · ${tr('packs.dueCount', { count: prog.due })}`}
                </Text>
              </View>

              {/* Progress bar ("x/1000") */}
              <View style={[styles.progressTrack, rowStyle, { backgroundColor: t.bgSubtle }]}>
                {seenRatio > 0 && (
                  <View
                    style={[
                      styles.progressSeenFill,
                      shouldMirror ? styles.fillRight : styles.fillLeft,
                      {
                        width: `${Math.max(seenRatio * 100, 1.5)}%` as `${number}%`,
                        backgroundColor: colors.accentMuted,
                      },
                    ]}
                  />
                )}
                {learnedRatio > 0 && (
                  <View
                    style={[
                      styles.progressLearnedFill,
                      {
                        width: `${Math.max(learnedRatio * 100, 1.5)}%` as `${number}%`,
                        backgroundColor: colors.success,
                      },
                    ]}
                  />
                )}
              </View>

              {prog.loaded > 0 && prog.loaded < prog.total && (
                <Text
                  style={[
                    typography.footnote,
                    { color: t.textTertiary, marginTop: spacing.xs },
                    textDirStyle,
                  ]}
                >
                  {tr('packs.sampleNote', { loaded: prog.loaded })}
                </Text>
              )}

              {/* 5-box Leitner distribution */}
              <View style={styles.boxesSection}>
                <Text style={[typography.caption, { color: t.textTertiary }, textDirStyle]}>
                  {tr('packs.boxesLabel')}
                </Text>
                <View style={[styles.boxesGrid, rowStyle]}>
                  {LEITNER_BOXES.map((box) => {
                    const count = prog.boxes[box];
                    const isLearnedBox = box >= 3;
                    return (
                      <View
                        key={box}
                        style={[
                          styles.boxCell,
                          {
                            backgroundColor:
                              count > 0
                                ? isLearnedBox
                                  ? colors.successMuted
                                  : colors.accentSubtle
                                : t.bgSubtle,
                            borderColor:
                              count > 0
                                ? isLearnedBox
                                  ? colors.success
                                  : accent
                                : t.borderSubtle,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            typography.caption,
                            {
                              color: isLearnedBox ? colors.success : t.textTertiary,
                            },
                          ]}
                        >
                          {tr('packs.boxShort', { box })}
                        </Text>
                        <Text
                          style={[
                            typography.headline,
                            {
                              color: count > 0 ? t.text : t.textMuted,
                              marginTop: 2,
                            },
                          ]}
                        >
                          {count}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Source + CC BY-SA 4.0 link & CTA button */}
              <View style={[styles.cardFooter, rowStyle, { borderTopColor: t.border }]}>
                <View style={styles.sourceTextCol}>
                  <Pressable
                    onPress={() => handleOpenExternal(pack.source.url)}
                    style={[styles.sourceNameRow, rowStyle]}
                    hitSlop={4}
                  >
                    <Text
                      style={[typography.footnote, { color: t.textSecondary, flexShrink: 1 }, textDirStyle]}
                      numberOfLines={1}
                    >
                      {pack.source.name}
                    </Text>
                    <ArrowUpRight size={12} color={t.textTertiary} strokeWidth={2} />
                  </Pressable>
                  <Pressable
                    onPress={() => handleOpenExternal(pack.source.licenseUrl)}
                    style={[styles.licenseRow, rowStyle]}
                    hitSlop={4}
                  >
                    <Text style={[typography.caption, { color: accent }]}>
                      {pack.source.license}
                    </Text>
                    <ArrowUpRight size={12} color={accent} strokeWidth={2} />
                  </Pressable>
                </View>

                {isReady && (
                  <Pressable
                    disabled={isAnyLoading}
                    onPress={() => {
                      void handleBrowsePack(pack);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={tr('packs.browseWords')}
                    style={[
                      styles.wordsBtn,
                      rowStyle,
                      {
                        borderColor: t.border,
                        opacity: isAnyLoading ? 0.6 : 1,
                      },
                    ]}
                  >
                    <List size={15} color={t.text} strokeWidth={2} />
                    <Text style={[typography.subhead, { color: t.text }]} numberOfLines={1}>
                      {tr('packs.browseWords')}
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  disabled={!isReady || isAnyLoading}
                  onPress={() => {
                    void handleStartPack(pack, false);
                  }}
                  style={[
                    styles.ctaBtn,
                    rowStyle,
                    {
                      backgroundColor: isReady ? accent : t.bgSubtle,
                      borderColor: isReady ? accent : t.border,
                      opacity: isReady && isAnyLoading && !isThisLoading ? 0.6 : 1,
                    },
                  ]}
                >
                  {isThisLoading ? (
                    <ActivityIndicator size="small" color={colors.dark.text} />
                  ) : (
                    <BookOpen
                      size={15}
                      color={isReady ? colors.dark.text : t.textMuted}
                      strokeWidth={2}
                    />
                  )}
                  <Text
                    style={[
                      typography.subhead,
                      {
                        color: isReady ? colors.dark.text : t.textMuted,
                        fontWeight: '600',
                      },
                    ]}
                  >
                    {actionLabel}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {/* CC BY-SA 4.0 Attribution Section */}
        <View
          style={[
            styles.attributionBox,
            { backgroundColor: t.bgElevated, borderColor: t.border },
          ]}
        >
          <Text style={[typography.caption, { color: t.textTertiary }, textDirStyle]}>
            {tr('packs.attributionTitle')}
          </Text>
          <Text
            style={[
              typography.footnote,
              { color: t.textSecondary, marginTop: spacing.sm },
              textDirStyle,
            ]}
          >
            {tr('packs.attributionNote', { license: 'CC BY-SA 4.0' })}
          </Text>

          <View style={styles.sourceList}>
            {uniqueSources.map((src) => (
              <View
                key={`${src.name}-${src.url}`}
                style={[styles.sourceRow, rowStyle, { borderColor: t.borderSubtle }]}
              >
                <View style={styles.sourceRowInfo}>
                  <Pressable onPress={() => handleOpenExternal(src.url)} hitSlop={4}>
                    <Text style={[typography.subhead, { color: t.text }, textDirStyle]}>
                      {src.name}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleOpenExternal(src.licenseUrl)}
                    style={[styles.licenseRow, rowStyle]}
                    hitSlop={4}
                  >
                    <Text style={[typography.footnote, { color: accent }, textDirStyle]}>
                      {`${tr('packs.licenseLabel')}: ${src.license}`}
                    </Text>
                    <ArrowUpRight size={12} color={accent} strokeWidth={1.8} />
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => handleOpenExternal(src.url)}
                  style={[styles.openSourceBadge, rowStyle]}
                  hitSlop={6}
                >
                  <Text style={[typography.footnote, { color: accent }]}>
                    {tr('packs.openSource')}
                  </Text>
                  <ArrowUpRight size={14} color={accent} strokeWidth={1.8} />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function WordSeparator() {
  return <View style={styles.wordSeparator} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  flex: {
    flex: 1,
  },
  searchBox: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
  },
  searchInputRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  tabRow: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  tabChip: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  wordListContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
  },
  wordSeparator: {
    height: spacing.sm,
  },
  wordRow: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  wordTextCol: {
    flex: 1,
    minWidth: 0,
  },
  wordMetaCol: {
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 0,
  },
  boxPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  ltrText: {
    writingDirection: 'ltr',
  },
  ltrTextRight: {
    writingDirection: 'ltr',
    textAlign: 'right',
  },
  actionBar: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 0.5,
    gap: spacing.sm,
  },
  actionBtnRow: {
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  wordsBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  topHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  titleBar: {
    alignItems: 'center',
    gap: spacing.md,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleTextWrap: {
    flex: 1,
  },
  filterRow: {
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  errorBanner: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  listContent: {
    padding: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing['5xl'],
    gap: spacing.lg,
  },
  packCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
  },
  cardBadgeRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badgeGroup: {
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  groupBadge: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  metricsRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.full,
    overflow: 'hidden',
    position: 'relative',
  },
  progressSeenFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: radius.full,
  },
  fillLeft: {
    left: 0,
  },
  fillRight: {
    right: 0,
  },
  progressLearnedFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  boxesSection: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  boxesGrid: {
    gap: spacing.sm,
  },
  boxCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  cardFooter: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 0.5,
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  sourceTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sourceNameRow: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  licenseRow: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  ctaBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  attributionBox: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    marginTop: spacing.sm,
  },
  sourceList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  sourceRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 0.5,
    gap: spacing.md,
  },
  sourceRowInfo: {
    flex: 1,
    gap: 2,
  },
  openSourceBadge: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  deckHeader: {
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.xl,
    paddingBottom: spacing.md,
    zIndex: 10,
    gap: spacing.md,
  },
  deckHeaderTitleWrap: {
    flex: 1,
  },
  deckHeaderActions: {
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  statChip: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 0.5,
  },
  iconCircleBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
