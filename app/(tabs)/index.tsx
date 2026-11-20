import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, I18nManager } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight, BookOpen, Flame, Zap, Infinity, CheckCircle, RotateCcw } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/lib/useTheme';
import { colors, spacing, radius, typography } from '@/constants/theme';
import { getStats } from '@/lib/spaced-repetition';
import { QUOTES, getDailyQuote } from '@/constants/quotes';
import WeeklyChart, { ChartPeriod } from '@/components/WeeklyChart';
import { buildHomeShortcut } from '@/lib/home-shortcut';
import { getTermLanguage } from '@/types';
import type { Language } from '@/types';

type PushTarget = Parameters<ReturnType<typeof useRouter>['push']>[0];

export default function HomeScreen() {
  const { colors: t, isDark, accent } = useTheme();
  const router = useRouter();
  const { t: tr, i18n } = useTranslation();
  const { isLoaded, loadData, streak, dailyGoal, todayCount, progress, terms, selectedTags, language, energyLevel, hasActivePremium, displayName, getReviewNeededTerms, packs, packsLoaded, activePackId, getDailyReviewQueue, getPackProgress } = useAppStore();
  const isPremium = hasActivePremium();

  useEffect(() => {
    if (!isLoaded) loadData();
  }, [isLoaded]);

  const progressValues = Object.values(progress);
  const stats = getStats(progressValues);
  const seenCount = progressValues.filter(p => p.timesSeen > 0).length;
  const reviewTerms = useMemo(() => getReviewNeededTerms(), [progress, terms]);

  // Shortcut card: daily review (same flow as the packs screen) + resume last pack.
  const activePack = activePackId ? packs.find((p) => p.id === activePackId) ?? null : null;
  const shortcut = useMemo(
    () =>
      buildHomeShortcut({
        hasProgress: progressValues.some((p) => Boolean(p && (p.timesSeen ?? 1) > 0)),
        totalDue: getDailyReviewQueue().totalDue,
        activePackId,
        activePackExists: Boolean(activePack?.load),
        activePackSeen: activePack ? getPackProgress(activePack.id).seen : 0,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progress, terms, packsLoaded, activePackId, activePack]
  );
  const continuePackTitle =
    shortcut.kind === 'study' && shortcut.continuePackId && activePack
      ? i18n.exists(`categories.${activePack.id}`)
        ? tr(`categories.${activePack.id}`)
        : activePack.title[getTermLanguage(language)]
      : null;
  const isArabic = language === 'ar';
  const shortcutRow = isArabic && !I18nManager.isRTL ? styles.rowReverse : styles.row;
  const shortcutText = isArabic ? ({ writingDirection: 'rtl', textAlign: 'right' } as const) : undefined;
  const ShortcutArrow = isArabic ? ArrowLeft : ArrowRight;

  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return tr('home.greeting_morning');
    if (hour < 18) return tr('home.greeting_afternoon');
    return tr('home.greeting_evening');
  }

  const greetingText = displayName
    ? tr('home.greeting_name', { greeting: getGreeting(), name: displayName })
    : getGreeting();

  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('daily');
  const goalProgress = dailyGoal > 0 ? Math.min(todayCount / dailyGoal, 1) : 0;
  const goalComplete = todayCount >= dailyGoal;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View>
          <Text style={[typography.callout, { color: t.textTertiary, marginBottom: spacing.xs }]}>
            {greetingText}
          </Text>
          <Text style={[typography.largeTitle, { color: t.text }]}>
            {tr('home.continue')}
          </Text>
          <Text style={[typography.footnote, { color: t.textSecondary, marginTop: spacing.md, fontStyle: 'italic' }]}>
            {QUOTES[getDailyQuote()][language as keyof typeof QUOTES[0]]}
          </Text>
        </View>

        {/* Streak + Energy */}
        <View
          style={[styles.streakRow, { borderColor: t.border }]}
        >
          <View style={styles.streakItem}>
            <Flame size={16} color={streak > 0 ? '#F97316' : t.textTertiary} strokeWidth={2} />
            <Text style={[typography.subhead, { color: t.text, marginLeft: spacing.sm }]}>
              {tr('home.streak', { count: streak })}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: t.border }]} />
          <View style={styles.streakItem}>
            {isPremium
              ? <Infinity size={14} color={accent} strokeWidth={1.8} />
              : <Zap size={14} color={energyLevel > 0 ? colors.warning : colors.danger} strokeWidth={2} />}
            <Text style={[typography.subhead, { color: energyLevel > 0 || isPremium ? t.text : colors.danger, marginLeft: spacing.sm }]}>
              {isPremium ? tr('profile.unlimited') : `${energyLevel}/30`}
            </Text>
          </View>
        </View>

        {/* Daily Goal Progress */}
        <View
          style={[styles.dailyGoalCard, { backgroundColor: t.bgElevated, borderColor: t.border }]}
        >
          <View style={styles.dailyGoalHeader}>
            <Text style={[typography.caption, { color: t.textTertiary }]}>
              {tr('home.dailyGoalLabel')}
            </Text>
            {goalComplete && (
              <View style={styles.goalCompleteBadge}>
                <CheckCircle size={12} color={colors.success} strokeWidth={2} />
                <Text style={[typography.footnote, { color: colors.success, marginLeft: spacing.xs }]}>
                  {tr('home.dailyGoalComplete')}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.dailyGoalBarRow}>
            <View style={[styles.dailyGoalBar, { backgroundColor: t.bgSubtle }]}>
              <View
                style={[
                  styles.dailyGoalFill,
                  {
                    backgroundColor: goalComplete ? colors.success : accent,
                    width: `${goalProgress * 100}%`,
                  },
                ]}
              />
            </View>
            <Text style={[typography.subhead, { color: goalComplete ? colors.success : t.text, fontWeight: '600' }]}>
              {todayCount}/{dailyGoal}
            </Text>
          </View>
        </View>

        {/* Continue Studying CTA */}
        <View>
          <Pressable
            style={[styles.continueBtn, { backgroundColor: accent }]}
            onPress={() => router.push('/(tabs)/learn')}
          >
            <Text style={[typography.headline, { color: '#fff' }]}>
              {tr('home.continueStudying')}
            </Text>
            <ArrowRight size={16} color="#fff" strokeWidth={2} />
          </Pressable>
        </View>

        {/* Needs Review */}
        {reviewTerms.length > 0 && (
          <View>
            <Pressable
              style={[styles.reviewBtn, { backgroundColor: colors.warning + '15', borderColor: colors.warning + '40' }]}
              onPress={() => {
                useAppStore.getState().setReviewMode(true);
                router.push('/(tabs)/learn');
              }}
            >
              <RotateCcw size={16} color={colors.warning} strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={[typography.headline, { color: colors.warning }]}>
                  {tr('home.reviewCta')}
                </Text>
                <Text style={[typography.footnote, { color: t.textTertiary, marginTop: 2 }]}>
                  {tr('home.conceptsToReview', { count: reviewTerms.length })}
                </Text>
              </View>
              <ArrowRight size={16} color={colors.warning} strokeWidth={2} />
            </Pressable>
          </View>
        )}

        {/* Daily review + last pack shortcuts */}
        <View style={[styles.shortcutCard, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
          {shortcut.kind === 'browse' ? (
            <Pressable
              style={[styles.shortcutRow, shortcutRow]}
              onPress={() => router.push('/packs' as unknown as PushTarget)}
              accessibilityRole="button"
            >
              <BookOpen size={16} color={accent} strokeWidth={2} />
              <Text style={[typography.headline, styles.shortcutLabel, { color: accent }, shortcutText]}>
                {tr('dailyReview.browsePacks')}
              </Text>
              <ShortcutArrow size={16} color={accent} strokeWidth={2} />
            </Pressable>
          ) : (
            <>
              <Text style={[typography.caption, { color: t.textTertiary }, shortcutText]}>
                {tr('dailyReview.title')}
              </Text>
              <Text style={[typography.footnote, { color: t.textSecondary, marginTop: spacing.xs }, shortcutText]}>
                {tr('dailyReview.subtitle', { count: shortcut.dueCount })}
              </Text>
              {shortcut.showDailyReview && (
                <Pressable
                  style={[styles.shortcutRow, shortcutRow, { borderTopColor: t.border }, styles.shortcutDivider]}
                  onPress={() => router.push('/packs?daily=1' as unknown as PushTarget)}
                  accessibilityRole="button"
                >
                  <RotateCcw size={16} color={accent} strokeWidth={2} />
                  <Text style={[typography.headline, styles.shortcutLabel, { color: accent }, shortcutText]}>
                    {tr('dailyReview.title')}
                  </Text>
                  <ShortcutArrow size={16} color={accent} strokeWidth={2} />
                </Pressable>
              )}
              {shortcut.continuePackId && continuePackTitle && (
                <Pressable
                  style={[styles.shortcutRow, shortcutRow, { borderTopColor: t.border }, styles.shortcutDivider]}
                  onPress={() =>
                    router.push(
                      `/packs?packId=${encodeURIComponent(shortcut.continuePackId ?? '')}&autostart=1` as unknown as PushTarget
                    )
                  }
                  accessibilityRole="button"
                >
                  <BookOpen size={16} color={accent} strokeWidth={2} />
                  <Text
                    style={[typography.headline, styles.shortcutLabel, { color: accent }, shortcutText]}
                    numberOfLines={1}
                  >
                    {tr('dailyReview.continuePack', { pack: continuePackTitle })}
                  </Text>
                  <ShortcutArrow size={16} color={accent} strokeWidth={2} />
                </Pressable>
              )}
            </>
          )}
        </View>

        {/* Quick Stats */}
        <View>
          <Text style={[typography.caption, { color: t.textTertiary, marginBottom: spacing.lg, marginTop: spacing['2xl'] }]}>
            {tr('home.progress')}
          </Text>
          <View style={styles.statsRow}>
            <View style={[styles.statItem, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
              <Text style={[typography.title, { color: t.text }]}>{seenCount}</Text>
              <Text style={[typography.footnote, { color: t.textTertiary }]}>{tr('home.seen')}</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
              <Text style={[typography.title, { color: colors.success }]}>{stats.mastered}</Text>
              <Text style={[typography.footnote, { color: t.textTertiary }]}>{tr('home.mastered')}</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
              <Text style={[typography.title, { color: colors.warning }]}>{stats.learning}</Text>
              <Text style={[typography.footnote, { color: t.textTertiary }]}>{tr('home.learning')}</Text>
            </View>
          </View>
        </View>

        {/* Analytics Chart */}
        <View>
          <View style={styles.analyticsTabs}>
            {(['daily', 'weekly', 'monthly'] as ChartPeriod[]).map(p => (
              <Pressable
                key={p}
                style={[
                  styles.analyticsTab,
                  chartPeriod === p && { backgroundColor: accent + '20' },
                ]}
                onPress={() => setChartPeriod(p)}
              >
                <Text style={[typography.footnote, { color: chartPeriod === p ? accent : t.textTertiary, fontWeight: chartPeriod === p ? '600' : '400' }]}>
                  {tr(`home.chart_${p}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={[styles.chartCard, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
            <WeeklyChart period={chartPeriod} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing['6xl'], maxWidth: 800, alignSelf: 'center' as const, width: '100%' as any },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing['2xl'],
    marginBottom: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
  },
  streakItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  divider: { width: 1, height: 20 },
  dailyGoalCard: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    marginBottom: spacing['2xl'],
  },
  dailyGoalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  goalCompleteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dailyGoalBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  dailyGoalBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  dailyGoalFill: {
    height: '100%',
    borderRadius: 3,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing['2xl'],
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing['2xl'],
  },
  shortcutCard: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    marginBottom: spacing['2xl'],
  },
  row: { flexDirection: 'row' },
  rowReverse: { flexDirection: 'row-reverse' },
  shortcutRow: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  shortcutDivider: {
    borderTopWidth: 0.5,
    marginTop: spacing.md,
  },
  shortcutLabel: { flex: 1 },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.xs,
  },
  analyticsTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing['2xl'],
    marginBottom: spacing.lg,
  },
  analyticsTab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  chartCard: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 0.5,
  },
});
