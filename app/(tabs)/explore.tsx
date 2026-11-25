import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, TextInput, FlatList, I18nManager, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X, ChevronRight, ArrowUpRight, Shuffle, Check, BookOpen, Bookmark, Target } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppStore, MIN_SCOPED_QUIZ_SIZE } from '@/lib/store';
import { useTheme } from '@/lib/useTheme';
import { colors, spacing, radius, typography } from '@/constants/theme';
import { categories, Category, getAllTags, findCategoryById, getDescendantIds, findParentCategory } from '@/data/categories';
import { packIdOfTerm } from '@/data/packs';
import { Term, Language, getTermLanguage } from '@/types';
import { toLocaleUpper } from '@/lib/text-utils';
import { tokenizeQuery } from '@/lib/pack-filter';
import {
  SAVED_WORDS_PREVIEW_LIMIT,
  buildSavedWordsView,
  getUnloadedBookmarkPackIds,
} from '@/lib/bookmarks';
import {
  GLOBAL_SEARCH_DEBOUNCE_MS,
  GLOBAL_SEARCH_LIMIT,
  GLOBAL_SEARCH_PACK_BATCH_SIZE,
  getUnloadedPackIds,
  loadSearchPacksInBatches,
  searchGlobalTerms,
  shouldLoadPacksForQuery,
  type GlobalSearchItem,
  type GlobalSearchSource,
} from '@/lib/global-search';

function CategoryCheckbox({
  category,
  depth,
  selectedIds,
  onToggle,
  t,
  accent,
  tr,
}: {
  category: Category;
  depth: number;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  t: ReturnType<typeof useTheme>['colors'];
  accent: string;
  tr: (key: string, opts?: any) => string;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasSubs = category.subcategories && category.subcategories.length > 0;
  const isSelected = selectedIds.has(category.id);

  return (
    <View style={{ marginLeft: depth > 0 ? spacing.xl : 0 }}>
      <Pressable
        style={[styles.nodeRow, { borderColor: t.border }]}
        onPress={() => onToggle(category.id)}
      >
        {depth > 0 && (
          <View style={[styles.treeLine, { backgroundColor: t.border }]} />
        )}

        <View style={[
          styles.checkbox,
          {
            borderColor: isSelected ? accent : t.textTertiary,
            backgroundColor: isSelected ? accent : 'transparent',
          },
        ]}>
          {isSelected && <Check size={10} color="#fff" strokeWidth={3} />}
        </View>

        <View style={[styles.nodeDot, { backgroundColor: category.color }]} />
        <Text style={[
          depth === 0 ? typography.headline : typography.subhead,
          { color: t.text, flex: 1 }
        ]}>
          {tr('categories.' + category.id)}
        </Text>
        {hasSubs && (
          <Pressable onPress={() => setExpanded(!expanded)} hitSlop={12}>
            <ChevronRight
              size={14}
              color={t.textTertiary}
              strokeWidth={1.5}
              style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
            />
          </Pressable>
        )}
      </Pressable>
      {expanded && hasSubs && category.subcategories!.map((sub: Category) => (
        <CategoryCheckbox
          key={sub.id}
          category={sub}
          depth={depth + 1}
          selectedIds={selectedIds}
          onToggle={onToggle}
          t={t}
          accent={accent}
          tr={tr}
        />
      ))}
    </View>
  );
}

export default function ExploreScreen() {
  const { colors: t, accent } = useTheme();
  const router = useRouter();
  const { t: tr, i18n } = useTranslation();
  const {
    terms,
    language,
    selectedTags,
    setSelectedTags,
    packs,
    packsLoaded,
    activePackId,
    ensurePacks,
    getTermById,
    getPackTerms,
    getPackProgress,
    progress,
    bookmarkedIds,
    countScopedQuizReady,
    setQuizScope,
  } = useAppStore();
  const [queryInput, setQueryInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isLoadingPacks, setIsLoadingPacks] = useState(false);
  const [showAllSaved, setShowAllSaved] = useState(false);
  const exhaustedPackIdsRef = useRef<Set<string>>(new Set());
  const requestedBookmarkPacksRef = useRef<Set<string>>(new Set());
  const loadRunIdRef = useRef(0);

  useEffect(() => {
    if (bookmarkedIds.length <= SAVED_WORDS_PREVIEW_LIMIT && showAllSaved) {
      setShowAllSaved(false);
    }
  }, [bookmarkedIds.length, showAllSaved]);

  useEffect(() => {
    if (bookmarkedIds.length === 0) return;
    const packIdsToLoad = getUnloadedBookmarkPackIds(bookmarkedIds, {
      getTermById,
      packIdOfTerm,
      isPackLoaded: (packId) => getPackTerms(packId).length > 0,
      requestedPackIds: requestedBookmarkPacksRef.current,
    });
    if (packIdsToLoad.length === 0) return;
    for (const packId of packIdsToLoad) {
      requestedBookmarkPacksRef.current.add(packId);
    }
    void ensurePacks(packIdsToLoad);
  }, [bookmarkedIds, packsLoaded, getTermById, getPackTerms, ensurePacks]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const savedWordsView = useMemo(
    () => buildSavedWordsView(bookmarkedIds, getTermById, showAllSaved, SAVED_WORDS_PREVIEW_LIMIT),
    [bookmarkedIds, getTermById, showAllSaved, terms, packsLoaded]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const savedQuizReadyCount = useMemo(
    () => countScopedQuizReady(bookmarkedIds),
    [countScopedQuizReady, bookmarkedIds, progress, terms, packsLoaded]
  );
  const canQuizSaved = savedQuizReadyCount >= MIN_SCOPED_QUIZ_SIZE;

  const handleQuizSaved = useCallback(() => {
    if (countScopedQuizReady(bookmarkedIds) < MIN_SCOPED_QUIZ_SIZE) return;
    setQuizScope({ ids: bookmarkedIds, label: tr('explore.savedTitle') });
    router.navigate('/(tabs)/quiz' as unknown as Parameters<typeof router.navigate>[0]);
  }, [bookmarkedIds, countScopedQuizReady, setQuizScope, tr, router]);

  useEffect(() => {
    if (queryInput.trim().length === 0) {
      setDebouncedQuery('');
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedQuery(queryInput);
    }, GLOBAL_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [queryInput]);

  const isArabic = language === 'ar';
  const shouldMirror = isArabic && !I18nManager.isRTL;
  const rowDir = shouldMirror ? ('row-reverse' as const) : ('row' as const);
  const textDirStyle = isArabic
    ? ({ writingDirection: 'rtl' as const, textAlign: 'right' as const })
    : undefined;
  const wordDirStyle = isArabic
    ? ({ writingDirection: 'ltr' as const, textAlign: 'right' as const })
    : undefined;

  const featuredPack = useMemo(
    () => packs.find(p => p.id === activePackId && getPackProgress(p.id).loaded > 0) ?? packs[0] ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [packs, activePackId, progress, packsLoaded]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const featuredProgress = useMemo(
    () => (featuredPack ? getPackProgress(featuredPack.id) : null),
    [featuredPack, progress, packsLoaded]
  );

  const selectedSet = useMemo(() => new Set(selectedTags), [selectedTags]);

  const handleSmartToggle = useCallback((id: string) => {
    const category = findCategoryById(id);
    if (!category) return;

    const current = new Set(selectedTags);
    const isSelected = current.has(id);
    const descendants = getDescendantIds(category);

    if (isSelected) {
      current.delete(id);
      descendants.forEach(d => current.delete(d));
    } else {
      current.add(id);
      descendants.forEach(d => current.add(d));
    }

    let parent = findParentCategory(id);
    while (parent) {
      const siblings = parent.subcategories ?? [];
      const allSiblingsSelected = siblings.every(s => current.has(s.id));
      if (allSiblingsSelected) {
        current.add(parent.id);
      } else {
        current.delete(parent.id);
      }
      parent = findParentCategory(parent.id);
    }

    setSelectedTags(Array.from(current));
  }, [selectedTags, setSelectedTags]);

  const searchSources = useMemo<GlobalSearchSource<Term>[]>(() => {
    const sources: GlobalSearchSource<Term>[] = [{ packId: null, terms }];
    for (const pack of packs) {
      const packTerms = getPackTerms(pack.id);
      if (packTerms.length > 0) {
        sources.push({ packId: pack.id, terms: packTerms });
      }
    }
    return sources;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terms, packs, packsLoaded, getPackTerms]);

  const effectiveQuery = queryInput.trim().length === 0 ? '' : debouncedQuery;
  const showSearch = useMemo(() => tokenizeQuery(effectiveQuery).length > 0, [effectiveQuery]);
  const shouldLoadPacks = useMemo(
    () => shouldLoadPacksForQuery(queryInput) && shouldLoadPacksForQuery(effectiveQuery),
    [queryInput, effectiveQuery]
  );

  useEffect(() => {
    if (!shouldLoadPacks) {
      setIsLoadingPacks(false);
      return;
    }

    const packIds = packs.map((p) => p.id);
    const isPackLoaded = (packId: string) => getPackTerms(packId).length > 0;
    const unloadedIds = getUnloadedPackIds(packIds, isPackLoaded, exhaustedPackIdsRef.current);
    if (unloadedIds.length === 0) {
      setIsLoadingPacks(false);
      return;
    }

    let cancelled = false;
    const runId = ++loadRunIdRef.current;
    setIsLoadingPacks(true);

    void loadSearchPacksInBatches({
      packIds,
      isPackLoaded,
      ensurePacks,
      batchSize: GLOBAL_SEARCH_PACK_BATCH_SIZE,
      exhaustedPackIds: exhaustedPackIdsRef.current,
      shouldCancel: () => cancelled || loadRunIdRef.current !== runId,
    }).finally(() => {
      if (!cancelled && loadRunIdRef.current === runId) {
        setIsLoadingPacks(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [shouldLoadPacks, packs, ensurePacks, getPackTerms]);

  const searchResult = useMemo(
    () => searchGlobalTerms(searchSources, progress, effectiveQuery, GLOBAL_SEARCH_LIMIT),
    [searchSources, progress, effectiveQuery]
  );

  const resolveSourceLabel = useCallback(
    (item: GlobalSearchItem<Term>): string => {
      if (item.packId) {
        if (i18n.exists(`categories.${item.packId}`)) {
          return tr(`categories.${item.packId}`);
        }
        const pack = packs.find((p) => p.id === item.packId);
        return pack ? pack.title[getTermLanguage(language)] : item.packId;
      }
      const tag = item.sourceKey;
      if (tag && i18n.exists(`categories.${tag}`)) {
        return tr(`categories.${tag}`);
      }
      return toLocaleUpper(tag.replace(/-/g, ' '), language);
    },
    [i18n, tr, packs, language]
  );

  const handleClearSearch = useCallback(() => {
    setQueryInput('');
    setDebouncedQuery('');
  }, []);

  const handleShuffle = () => {
    if (selectedTags.length === 0) {
      setSelectedTags(getAllTags());
    }
    router.push('/(tabs)/learn');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[typography.largeTitle, { color: t.text }, textDirStyle]}>{tr('explore.title')}</Text>
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: t.bgElevated, borderColor: t.border, flexDirection: rowDir },
          ]}
        >
          <Search size={16} color={t.textTertiary} strokeWidth={1.8} />
          <TextInput
            style={[
              typography.body,
              styles.searchInput,
              shouldMirror ? { marginRight: spacing.md, marginLeft: 0 } : null,
              { color: t.text },
              textDirStyle,
            ]}
            placeholder={tr('explore.search')}
            placeholderTextColor={t.textMuted}
            value={queryInput}
            onChangeText={setQueryInput}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {queryInput.length > 0 && (
            <Pressable
              onPress={handleClearSearch}
              accessibilityRole="button"
              accessibilityLabel={tr('packs.clearSearch')}
              hitSlop={8}
            >
              <X size={16} color={t.textTertiary} strokeWidth={1.8} />
            </Pressable>
          )}
        </View>
      </View>

      {showSearch ? (
        <FlatList
          data={searchResult.items}
          keyExtractor={item => item.term.id}
          contentContainerStyle={styles.resultsList}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            isLoadingPacks ? (
              <View
                style={[
                  styles.loadingPacksRow,
                  { backgroundColor: t.bgSubtle, borderColor: t.border, flexDirection: rowDir },
                ]}
                accessibilityLiveRegion="polite"
              >
                <ActivityIndicator size="small" color={accent} />
                <Text
                  style={[typography.footnote, { color: t.textSecondary, flex: 1 }, textDirStyle]}
                  numberOfLines={1}
                >
                  {tr('explore.loadingPacks')}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const isMastered = item.box !== null && item.box >= 3;
            const isLearning = item.box !== null && item.box < 3;
            const boxBg = isMastered
              ? colors.successMuted
              : isLearning
                ? colors.accentMuted
                : t.bgSubtle;
            const boxColor = isMastered
              ? colors.success
              : isLearning
                ? accent
                : t.textTertiary;
            const boxLabel =
              item.box !== null ? tr('packs.filterBox', { box: item.box }) : tr('packs.filterNew');

            return (
              <Pressable
                style={[styles.resultItem, { borderColor: t.border, flexDirection: rowDir }]}
                onPress={() => router.push(`/term/${item.term.id}`)}
                accessibilityRole="button"
                accessibilityLabel={tr('packs.openWordDetail', { term: item.term.term })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[typography.headline, { color: t.text }, wordDirStyle]}>
                    {item.term.term}
                  </Text>
                  <View style={[styles.resultMetaRow, { flexDirection: rowDir }]}>
                    <View style={[styles.sourceBadge, { backgroundColor: t.bgSubtle, borderColor: t.border }]}>
                      <Text
                        style={[typography.footnote, { color: t.textSecondary }, textDirStyle]}
                        numberOfLines={1}
                      >
                        {resolveSourceLabel(item)}
                      </Text>
                    </View>
                    <View style={[styles.boxBadge, { backgroundColor: boxBg }]}>
                      <Text style={[typography.footnote, { color: boxColor, fontWeight: '600' }, textDirStyle]}>
                        {boxLabel}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[typography.callout, { color: t.textSecondary, marginTop: spacing.sm }, wordDirStyle]}
                    numberOfLines={2}
                  >
                    {item.term.translations[getTermLanguage(language)].definition}
                  </Text>
                </View>
                <ArrowUpRight size={16} color={t.textTertiary} strokeWidth={1.5} />
              </Pressable>
            );
          }}
          ListFooterComponent={
            searchResult.hasMore ? (
              <View style={[styles.moreResultsFooter, { borderColor: t.border }]}>
                <Text style={[typography.footnote, { color: t.textTertiary, textAlign: 'center' }, textDirStyle]}>
                  {tr('explore.moreResults', {
                    limit: GLOBAL_SEARCH_LIMIT,
                    count: searchResult.hiddenCount,
                  })}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptySearch}>
              <Text style={[typography.body, { color: t.textTertiary }, textDirStyle]}>
                {tr('home.noResults', { query: effectiveQuery.trim() })}
              </Text>
            </View>
          }
        />
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.mapContent}
          >
            {featuredPack && featuredProgress && (
              <View style={styles.packsSection}>
                <View style={[styles.sectionHeader, { flexDirection: rowDir }]}>
                  <Text style={[typography.caption, { color: t.textTertiary }, textDirStyle]}>
                    {tr('packs.sectionLabel')}
                  </Text>
                  <Pressable
                    onPress={() => router.push('/packs' as unknown as Parameters<typeof router.push>[0])}
                  >
                    <Text style={[typography.caption, { color: accent }]}>
                      {tr('packs.seeAll')}
                    </Text>
                  </Pressable>
                </View>

                <Pressable
                  style={[styles.packBanner, { backgroundColor: t.bgElevated, borderColor: t.border }]}
                  onPress={() => router.push('/packs' as unknown as Parameters<typeof router.push>[0])}
                >
                  <View style={[styles.packBannerTop, { flexDirection: rowDir }]}>
                    <Text
                      style={[typography.headline, { color: t.text, flex: 1 }, textDirStyle]}
                      numberOfLines={1}
                    >
                      {i18n.exists(`categories.${featuredPack.id}`)
                        ? tr(`categories.${featuredPack.id}`)
                        : featuredPack.title[getTermLanguage(language)]}
                    </Text>
                    <Text
                      style={[
                        typography.mono,
                        { color: featuredProgress.learned > 0 ? colors.success : t.textSecondary },
                      ]}
                    >
                      {`${featuredProgress.learned}/${featuredProgress.total}`}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.packProgressTrack,
                      { backgroundColor: t.bgSubtle, flexDirection: rowDir },
                    ]}
                  >
                    {featuredProgress.seen > 0 && (
                      <View
                        style={[
                          styles.packProgressSeen,
                          shouldMirror ? { right: 0 } : { left: 0 },
                          {
                            width: `${Math.min(Math.max((featuredProgress.seen / featuredProgress.total) * 100, 1.5), 100)}%` as `${number}%`,
                            backgroundColor: colors.accentMuted,
                          },
                        ]}
                      />
                    )}
                    {featuredProgress.learned > 0 && (
                      <View
                        style={[
                          styles.packProgressLearned,
                          {
                            width: `${Math.min(Math.max((featuredProgress.learned / featuredProgress.total) * 100, 1.5), 100)}%` as `${number}%`,
                            backgroundColor: colors.success,
                          },
                        ]}
                      />
                    )}
                  </View>

                  <View style={[styles.packBannerBottom, { flexDirection: rowDir }]}>
                    <Text
                      style={[typography.footnote, { color: t.textTertiary, flex: 1 }, textDirStyle]}
                      numberOfLines={1}
                    >
                      {`${featuredPack.source.name} · ${featuredPack.source.license}`}
                    </Text>
                    <Pressable
                      style={[styles.packContinueBtn, { backgroundColor: accent, flexDirection: rowDir }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push(
                          `/packs?packId=${featuredPack.id}&autostart=1` as unknown as Parameters<typeof router.push>[0]
                        );
                      }}
                    >
                      <BookOpen size={13} color={colors.dark.text} strokeWidth={2} />
                      <Text style={[typography.subhead, { color: colors.dark.text, fontWeight: '600' }]}>
                        {featuredProgress.seen > 0 ? tr('packs.continue') : tr('packs.start')}
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
              </View>
            )}

            {bookmarkedIds.length === 0 ? (
              <View
                style={[
                  styles.savedEmptyRow,
                  { backgroundColor: t.bgElevated, borderColor: t.border, flexDirection: rowDir },
                ]}
              >
                <Bookmark size={14} color={t.textTertiary} strokeWidth={1.8} />
                <Text
                  style={[typography.footnote, { color: t.textTertiary, flex: 1 }, textDirStyle]}
                  numberOfLines={1}
                >
                  {tr('explore.savedEmpty')}
                </Text>
              </View>
            ) : (
              <View style={styles.savedSection}>
                <View style={[styles.sectionHeader, { flexDirection: rowDir }]}>
                  <View style={[styles.savedTitleRow, { flexDirection: rowDir }]}>
                    <Text style={[typography.caption, { color: t.textTertiary }, textDirStyle]}>
                      {tr('explore.savedTitle')}
                    </Text>
                    <View style={[styles.savedCountBadge, { backgroundColor: t.bgSubtle, borderColor: t.border }]}>
                      <Text style={[typography.caption, { color: t.textSecondary }]}>
                        {savedWordsView.totalCount}
                      </Text>
                    </View>
                  </View>
                  {savedWordsView.hasMore && (
                    <Pressable
                      onPress={() => setShowAllSaved(true)}
                      accessibilityRole="button"
                      accessibilityLabel={tr('explore.savedShowAll')}
                      hitSlop={8}
                    >
                      <Text style={[typography.caption, { color: accent }, textDirStyle]}>
                        {tr('explore.savedShowAll')}
                      </Text>
                    </Pressable>
                  )}
                </View>

                {savedWordsView.visibleTerms.length > 0 && (
                  <View style={[styles.savedCard, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
                    {savedWordsView.visibleTerms.map((item, idx) => (
                      <Pressable
                        key={item.id}
                        style={[
                          styles.savedWordRow,
                          idx > 0 && { borderTopWidth: 0.5, borderTopColor: t.border },
                          { flexDirection: rowDir },
                        ]}
                        onPress={() => router.push(`/term/${item.id}`)}
                        accessibilityRole="button"
                        accessibilityLabel={tr('packs.openWordDetail', { term: item.term })}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[typography.headline, { color: t.text }, wordDirStyle]}
                            numberOfLines={1}
                          >
                            {item.term}
                          </Text>
                          <Text
                            style={[
                              typography.footnote,
                              { color: t.textSecondary, marginTop: 2 },
                              wordDirStyle,
                            ]}
                            numberOfLines={1}
                          >
                            {item.translations[getTermLanguage(language)].definition}
                          </Text>
                        </View>
                        <ArrowUpRight size={15} color={t.textTertiary} strokeWidth={1.5} />
                      </Pressable>
                    ))}
                  </View>
                )}

                <View style={styles.savedQuizWrap}>
                  <Pressable
                    disabled={!canQuizSaved}
                    onPress={handleQuizSaved}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canQuizSaved }}
                    style={[
                      styles.savedQuizBtn,
                      {
                        backgroundColor: canQuizSaved ? accent : t.bgSubtle,
                        borderColor: canQuizSaved ? accent : t.border,
                        flexDirection: rowDir,
                      },
                    ]}
                  >
                    <Target size={15} color={canQuizSaved ? colors.dark.text : t.textMuted} strokeWidth={2} />
                    <Text
                      style={[
                        typography.subhead,
                        { color: canQuizSaved ? colors.dark.text : t.textMuted, fontWeight: '600' },
                        textDirStyle,
                      ]}
                    >
                      {tr('explore.savedQuiz')}
                    </Text>
                  </Pressable>
                  {!canQuizSaved && (
                    <Text style={[typography.footnote, { color: t.textTertiary }, textDirStyle]}>
                      {tr('explore.savedNeedMore', { count: MIN_SCOPED_QUIZ_SIZE })}
                    </Text>
                  )}
                </View>
              </View>
            )}

            <View style={[styles.sectionHeader, { flexDirection: rowDir }]}>
              <Text style={[typography.caption, { color: t.textTertiary }]}>
                {tr('explore.knowledgeMap')}
              </Text>
              <Pressable onPress={() => {
                const allIds = getAllTags();
                const allSelected = allIds.every(id => selectedTags.includes(id));
                setSelectedTags(allSelected ? [] : allIds);
              }}>
                <Text style={[typography.caption, { color: accent }]}>
                  {getAllTags().every(id => selectedTags.includes(id))
                    ? tr('common.deselectAll')
                    : tr('common.selectAll')}
                </Text>
              </Pressable>
            </View>

            {categories.map(cat => (
              <CategoryCheckbox
                key={cat.id}
                category={cat}
                depth={0}
                selectedIds={selectedSet}
                onToggle={handleSmartToggle}
                t={t}
                accent={accent}
                tr={tr}
              />
            ))}
          </ScrollView>

          {/* Shuffle FAB */}
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={styles.fabContainer}
          >
            <Pressable
              style={[styles.fab, { backgroundColor: accent }]}
              onPress={handleShuffle}
            >
              <Shuffle size={18} color="#fff" strokeWidth={2} />
              <Text style={[typography.headline, { color: '#fff' }]}>
                {selectedTags.length > 0
                  ? `${tr('explore.shuffle')} (${selectedTags.length})`
                  : tr('explore.shuffleAll')}
              </Text>
            </Pressable>
          </Animated.View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, maxWidth: 800, alignSelf: 'center' as const, width: '100%' as any },
  header: { padding: spacing.xl, gap: spacing.lg },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 0.5,
    paddingHorizontal: spacing.lg,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.md,
    padding: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  packsSection: {
    marginBottom: spacing['2xl'],
  },
  savedEmptyRow: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 0.5,
    marginBottom: spacing['2xl'],
  },
  savedSection: {
    marginBottom: spacing['2xl'],
  },
  savedTitleRow: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  savedCountBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.full,
    borderWidth: 0.5,
  },
  savedCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  savedWordRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  savedQuizWrap: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  savedQuizBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  packBanner: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  packBannerTop: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  packProgressTrack: {
    height: 6,
    borderRadius: radius.full,
    overflow: 'hidden',
    position: 'relative',
  },
  packProgressSeen: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: radius.full,
  },
  packProgressLearned: {
    height: '100%',
    borderRadius: radius.full,
  },
  packBannerBottom: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  packContinueBtn: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  mapContent: { padding: spacing.xl, paddingTop: 0, paddingBottom: 120 },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  treeLine: {
    position: 'absolute',
    left: -spacing.md,
    top: 0,
    bottom: '50%',
    width: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nodeDot: { width: 8, height: 8, borderRadius: 4 },
  resultsList: { padding: spacing.xl, paddingTop: 0 },
  loadingPacksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 0.5,
    marginBottom: spacing.sm,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.lg,
    borderBottomWidth: 0.5,
    gap: spacing.md,
  },
  resultMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  sourceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 0.5,
    maxWidth: '75%' as any,
  },
  boxBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  moreResultsFooter: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 0.5,
  },
  emptySearch: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
  },
  fabContainer: {
    position: 'absolute',
    bottom: spacing['3xl'],
    left: spacing.xl,
    right: spacing.xl,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
});
