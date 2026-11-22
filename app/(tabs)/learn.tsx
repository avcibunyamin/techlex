import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, Pressable, TouchableOpacity, I18nManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, RotateCcw, BookOpen, Zap, Infinity, Flame, ChevronRight } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/lib/useTheme';
import { colors, spacing, radius, typography } from '@/constants/theme';
import { getTermLanguage, Term } from '@/types';
import CardDeck from '@/components/CardDeck';
import { DailyReviewCard, DailyReviewSession } from '@/components/DailyReview';

type LearnPhase = 'choose' | 'deck' | 'daily';

export default function LearnScreen() {
  const { colors: t, accent } = useTheme();
  const router = useRouter();
  const { t: tr, i18n } = useTranslation();
  const { language, getTermsForReview, getReviewNeededTerms, selectedTags, todayCount, energyLevel, hasActivePremium, streak, reviewMode, setReviewMode, progress, packs, activePackId, getPackProgress, packsLoaded, getDailyReviewQueue } = useAppStore();

  const [phase, setPhase] = useState<LearnPhase>('choose');
  const [dailyTerms, setDailyTerms] = useState<Term[]>([]);
  const [dailyTotal, setDailyTotal] = useState(0);
  const [focusTick, setFocusTick] = useState(0);
  const reviewModeRef = useRef(reviewMode);
  reviewModeRef.current = reviewMode;

  const isArabic = language === 'ar';
  const shouldMirror = isArabic && !I18nManager.isRTL;
  const rowDir = shouldMirror ? ('row-reverse' as const) : ('row' as const);
  const textDirStyle = isArabic
    ? ({ writingDirection: 'rtl' as const, textAlign: (shouldMirror ? 'right' : 'left') as 'right' | 'left' })
    : undefined;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activePack = useMemo(
    () => packs.find((p) => p.id === activePackId && getPackProgress(p.id).loaded > 0) ?? packs[0] ?? null,
    [packs, activePackId, progress, packsLoaded]
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activePackProgress = useMemo(
    () => (activePack ? getPackProgress(activePack.id) : null),
    [activePack, progress, packsLoaded]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const normalTerms = useMemo(() => getTermsForReview(), [selectedTags, progress]);
  const reviewOnlyTerms = useMemo(() => getReviewNeededTerms(), [reviewMode, progress]);
  const terms = reviewMode ? reviewOnlyTerms : normalTerms;
  const isPremium = hasActivePremium();
  const reviewCount = reviewOnlyTerms.length;

  // Recomputed on focus too, because cards become due as time passes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dailyDue = useMemo(() => getDailyReviewQueue().totalDue, [progress, packsLoaded, focusTick]);
  const lastPack = useMemo(() => packs.find((p) => p.id === activePackId) ?? null, [packs, activePackId]);
  const lastPackTitle = lastPack
    ? i18n.exists(`categories.${lastPack.id}`)
      ? tr(`categories.${lastPack.id}`)
      : lastPack.title[getTermLanguage(language)]
    : null;

  useFocusEffect(
    useCallback(() => {
      setFocusTick((n) => n + 1);
      if (!reviewModeRef.current) {
        setPhase('choose');
      }
      return () => { setReviewMode(false); };
    }, [])
  );

  // Snapshot the queue so the deck does not reset after every swipe.
  const startDailyReview = () => {
    const queue = getDailyReviewQueue();
    setReviewMode(false);
    setDailyTerms(queue.items);
    setDailyTotal(queue.totalDue);
    setPhase('daily');
  };

  const handleContinuePack = () => {
    setPhase('choose');
    if (lastPack) {
      router.push(`/packs?packId=${encodeURIComponent(lastPack.id)}&autostart=1` as unknown as Parameters<typeof router.push>[0]);
    } else {
      router.push('/packs' as unknown as Parameters<typeof router.push>[0]);
    }
  };

  if (phase === 'daily') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top']}>
        <DailyReviewSession
          terms={dailyTerms}
          totalDue={dailyTotal}
          language={language}
          streak={streak}
          lastPackTitle={lastPackTitle}
          onClose={() => setPhase('choose')}
          onRestart={startDailyReview}
          onContinuePack={handleContinuePack}
        />
      </SafeAreaView>
    );
  }

  const handleChooseReview = () => {
    setReviewMode(true);
    setPhase('deck');
  };

  const handleChooseNew = () => {
    setReviewMode(false);
    setPhase('deck');
  };

  const handleBack = () => {
    setReviewMode(false);
    setPhase('choose');
  };

  if (phase === 'choose') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top']}>
        <View style={styles.chooseWrapper}>
          <View style={styles.chooseHeader}>
            <Text style={[typography.largeTitle, { color: t.text }]}>{tr('learn.title')}</Text>
            <Text style={[typography.callout, { color: t.textTertiary, marginTop: spacing.sm }]}>
              {tr('learn.chooseMode')}
            </Text>
          </View>

          <View style={styles.chooseCards}>
            {/* Review Card */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={[
                styles.chooseCard,
                {
                  backgroundColor: reviewCount > 0 ? colors.warning + '12' : t.bgElevated,
                  borderColor: reviewCount > 0 ? colors.warning + '50' : t.border,
                  opacity: reviewCount > 0 ? 1 : 0.5,
                },
              ]}
              onPress={handleChooseReview}
              disabled={reviewCount === 0}
            >
              <View style={[styles.chooseIconWrap, { backgroundColor: colors.warning + '20' }]}>
                <RotateCcw size={28} color={colors.warning} strokeWidth={2} />
              </View>
              <Text style={[typography.headline, { color: reviewCount > 0 ? colors.warning : t.textTertiary, marginTop: spacing.lg }]}>
                {tr('learn.reviewMode')}
              </Text>
              <Text style={[typography.footnote, { color: t.textTertiary, marginTop: spacing.xs, textAlign: 'center' }]}>
                {reviewCount > 0
                  ? tr('home.conceptsToReview', { count: reviewCount })
                  : tr('learn.noReview')}
              </Text>
            </TouchableOpacity>

            {/* New Terms Card */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={[
                styles.chooseCard,
                {
                  backgroundColor: accent + '12',
                  borderColor: accent + '50',
                },
              ]}
              onPress={handleChooseNew}
            >
              <View style={[styles.chooseIconWrap, { backgroundColor: accent + '20' }]}>
                <BookOpen size={28} color={accent} strokeWidth={2} />
              </View>
              <Text style={[typography.headline, { color: accent, marginTop: spacing.lg }]}>
                {tr('learn.newTerms')}
              </Text>
              <Text style={[typography.footnote, { color: t.textTertiary, marginTop: spacing.xs, textAlign: 'center' }]}>
                {tr('learn.newTermsSub', { count: normalTerms.length })}
              </Text>
            </TouchableOpacity>
          </View>

          <DailyReviewCard
            totalDue={dailyDue}
            language={language}
            lastPackTitle={lastPackTitle}
            onStart={startDailyReview}
            onContinuePack={handleContinuePack}
          />

          {activePack && activePackProgress && (
            <TouchableOpacity
              activeOpacity={0.75}
              style={[
                styles.packsCard,
                {
                  backgroundColor: t.bgElevated,
                  borderColor: t.border,
                  flexDirection: rowDir,
                },
              ]}
              onPress={() => router.push('/packs' as unknown as Parameters<typeof router.push>[0])}
            >
              <View style={{ flex: 1 }}>
                <Text style={[typography.caption, { color: accent }, textDirStyle]}>
                  {tr('packs.sectionLabel')}
                </Text>
                <Text
                  style={[typography.headline, { color: t.text, marginTop: spacing.xs }, textDirStyle]}
                  numberOfLines={1}
                >
                  {i18n.exists(`categories.${activePack.id}`)
                    ? tr(`categories.${activePack.id}`)
                    : activePack.title[getTermLanguage(language)]}
                </Text>
              </View>
              <View style={[styles.packsCardRight, { flexDirection: rowDir }]}>
                <Text
                  style={[
                    typography.mono,
                    { color: activePackProgress.learned > 0 ? colors.success : t.textSecondary },
                  ]}
                >
                  {`${activePackProgress.learned}/${activePackProgress.total}`}
                </Text>
                <ChevronRight
                  size={16}
                  color={t.textTertiary}
                  strokeWidth={1.8}
                  style={isArabic ? { transform: [{ rotate: '180deg' }] } : undefined}
                />
              </View>
            </TouchableOpacity>
          )}

          {/* Stats row */}
          <View style={[styles.chooseStats, { borderColor: t.border }]}>
            <View style={styles.chooseStat}>
              <Flame size={14} color={streak > 0 ? colors.warning : t.textTertiary} strokeWidth={2} />
              <Text style={[typography.subhead, { color: t.text }]}>
                {tr('home.streak', { count: streak })}
              </Text>
            </View>
            <View style={[styles.chooseDivider, { backgroundColor: t.border }]} />
            <View style={styles.chooseStat}>
              {isPremium
                ? <Infinity size={14} color={accent} strokeWidth={1.8} />
                : <Zap size={14} color={energyLevel > 0 ? colors.warning : colors.danger} strokeWidth={2} />}
              <Text style={[typography.subhead, { color: energyLevel > 0 || isPremium ? t.text : colors.danger }]}>
                {isPremium ? tr('profile.unlimited') : `${energyLevel}/30`}
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={handleBack} hitSlop={12}>
            <Text style={[typography.title, { color: t.text }]} numberOfLines={1}>{tr('learn.title')}</Text>
          </Pressable>
        </View>

        <View style={styles.headerRight}>
          {streak > 0 && (
            <View style={[styles.energyChip, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
              <Flame size={14} color={colors.warning} strokeWidth={1.8} />
              <Text style={[typography.subhead, { color: colors.warning, fontWeight: '600' }]}>
                {streak}
              </Text>
            </View>
          )}

          <View style={[styles.energyChip, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
            {isPremium
              ? <Infinity size={14} color={accent} strokeWidth={1.8} />
              : <Zap size={14} color={energyLevel > 0 ? colors.warning : colors.danger} strokeWidth={1.8} />}
            <Text style={[typography.subhead, {
              color: energyLevel > 0 || isPremium ? t.text : colors.danger,
              fontWeight: '600',
            }]}>
              {isPremium ? '' : `${energyLevel}/30`}
            </Text>
          </View>

          <Pressable
            onPress={() => {
              if (reviewMode) {
                setReviewMode(false);
              } else {
                handleChooseReview();
              }
            }}
            style={[styles.switchBtn, { backgroundColor: reviewMode ? accent + '15' : colors.warning + '15', borderColor: reviewMode ? accent + '40' : colors.warning + '40' }]}
          >
            {reviewMode ? (
              <BookOpen size={14} color={accent} strokeWidth={2} />
            ) : (
              <RotateCcw size={14} color={colors.warning} strokeWidth={2} />
            )}
          </Pressable>

          <Pressable onPress={handleBack} hitSlop={12} style={styles.closeBtn}>
            <X size={22} color={t.textTertiary} strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      <CardDeck terms={terms} language={language} isReviewMode={reviewMode} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, maxWidth: 800, alignSelf: 'center' as const, width: '100%' as any },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.xl,
    paddingBottom: spacing.md,
    zIndex: 10,
  },
  headerLeft: {
    flexShrink: 1,
    marginRight: spacing.md,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  energyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 0.5,
  },
  switchBtn: {
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
  chooseWrapper: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  chooseHeader: {
    alignItems: 'center',
    marginBottom: spacing['3xl'],
  },
  chooseCards: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  chooseCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1.5,
  },
  chooseIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packsCard: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  packsCardRight: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  chooseStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing['3xl'],
    paddingTop: spacing.xl,
    borderTopWidth: 0.5,
  },
  chooseStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  chooseDivider: {
    width: 1,
    height: 20,
  },
});
