import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
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
  RotateCcw,
  X,
  Zap,
} from 'lucide-react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppStore, MAX_ENERGY } from '@/lib/store';
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

type GroupFilter = 'all' | PackGroup;

const LEITNER_BOXES: LeitnerBox[] = [1, 2, 3, 4, 5];

export default function PacksScreen() {
  const { colors: t, accent } = useTheme();
  const router = useRouter();
  const { t: tr, i18n } = useTranslation();
  const params = useLocalSearchParams<{ packId?: string; autostart?: string }>();

  const {
    packs,
    packsLoaded,
    activePackId,
    setActivePackId,
    ensurePacks,
    getPackProgress,
    getAllPacksProgress,
    getPackStudyTerms,
    getPackReviewNeededTerms,
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
  const didAutostartRef = useRef(false);
  const loadingPackRef = useRef(false);
  const mountedRef = useRef(true);

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
        textAlign: (shouldMirror ? 'right' : 'left') as 'right' | 'left',
      })
    : undefined;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allProgress = useMemo(() => getAllPacksProgress(), [packs, progress, packsLoaded]);

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
    async (pack: Pack, reviewOnly = false) => {
      if (!pack.load) return;
      if (loadingPackRef.current) return;

      loadingPackRef.current = true;
      setLoadingPackId(pack.id);
      setLoadErrorPackId(null);

      try {
        const ok = await ensurePacks([pack.id]);
        if (!mountedRef.current) return;

        const prog = getPackProgress(pack.id);
        if (!ok || prog.loaded === 0) {
          if (!ok) {
            setLoadErrorPackId(pack.id);
          }
          return;
        }

        setActivePackId(pack.id);

        if (reviewOnly) {
          const revTerms = getPackReviewNeededTerms(pack.id);
          if (revTerms.length === 0) return;
          setPackReviewMode(true);
          setPackPracticeMode(false);
          setStudyTerms(revTerms);
          setStudyingPackId(pack.id);
          return;
        }

        const dueTerms = getPackStudyTerms(pack.id, false);
        const isPractice = dueTerms.length === 0;
        const nextTerms = isPractice ? getPackStudyTerms(pack.id, true) : dueTerms;
        setPackReviewMode(false);
        setPackPracticeMode(isPractice);
        setStudyTerms(nextTerms);
        setStudyingPackId(pack.id);
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
    if (didAutostartRef.current) return;
    const targetPackId = Array.isArray(params.packId) ? params.packId[0] : params.packId;
    const auto = Array.isArray(params.autostart) ? params.autostart[0] : params.autostart;
    if (auto === '1' && targetPackId) {
      const target = packs.find((p) => p.id === targetPackId);
      if (target) {
        didAutostartRef.current = true;
        void handleStartPack(target, false);
      }
    }
  }, [params.autostart, params.packId, packs, handleStartPack]);

  const handleBackToPacks = useCallback(() => {
    setPackReviewMode(false);
    setPackPracticeMode(false);
    setStudyingPackId(null);
  }, []);

  const handleNavigateBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/explore' as unknown as Parameters<typeof router.replace>[0]);
    }
  }, [router]);

  const studyingPack = useMemo(
    () => (studyingPackId ? packs.find((p) => p.id === studyingPackId) ?? null : null),
    [packs, studyingPackId]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const studyingReviewTerms = useMemo(
    () => (studyingPackId ? getPackReviewNeededTerms(studyingPackId) : []),
    [studyingPackId, progress, packsLoaded]
  );

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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
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
