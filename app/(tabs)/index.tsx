import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, Flame, Zap, Infinity, CheckCircle } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/lib/useTheme';
import { colors, spacing, radius, typography } from '@/constants/theme';
import { getStats } from '@/lib/spaced-repetition';
import { categories } from '@/data/categories';
import { getTermLanguage } from '@/types';

export default function HomeScreen() {
  const { colors: t, isDark, accent } = useTheme();
  const router = useRouter();
  const { t: tr } = useTranslation();
  const { isLoaded, loadData, streak, dailyGoal, todayCount, progress, terms, selectedTags, language, energyLevel, hasActivePremium, displayName } = useAppStore();
  const isPremium = hasActivePremium();

  useEffect(() => {
    if (!isLoaded) loadData();
  }, [isLoaded]);

  const progressValues = Object.values(progress);
  const stats = getStats(progressValues);
  const seenCount = progressValues.filter(p => p.timesSeen > 0).length;

  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return tr('home.greeting_morning');
    if (hour < 18) return tr('home.greeting_afternoon');
    return tr('home.greeting_evening');
  }

  const greetingText = displayName
    ? tr('home.greeting_name', { greeting: getGreeting(), name: displayName })
    : getGreeting();

  const goalProgress = dailyGoal > 0 ? Math.min(todayCount / dailyGoal, 1) : 0;
  const goalComplete = todayCount >= dailyGoal;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400).delay(0)}>
          <Text style={[typography.callout, { color: t.textTertiary, marginBottom: spacing.xs }]}>
            {greetingText}
          </Text>
          <Text style={[typography.largeTitle, { color: t.text }]}>
            {tr('home.continue')}
          </Text>
        </Animated.View>

        {/* Streak + Energy */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(80)}
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
        </Animated.View>

        {/* Daily Goal Progress */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(120)}
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
        </Animated.View>

        {/* Continue Learning */}
        {seenCount > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(160)}>
            <Pressable
              style={[styles.continueCard, { backgroundColor: t.bgElevated, borderColor: t.border }]}
              onPress={() => router.push('/(tabs)/learn')}
            >
              <View>
                <Text style={[typography.caption, { color: accent }]}>
                  {tr('home.continueLearning')}
                </Text>
                <Text style={[typography.headline, { color: t.text, marginTop: spacing.sm }]}>
                  {stats.dueForReview > 0
                    ? tr('home.conceptsToReview', { count: stats.dueForReview })
                    : tr('home.conceptsMastered', { count: stats.mastered })}
                </Text>
                <View style={styles.progressBarContainer}>
                  <View
                    style={[styles.progressBar, { backgroundColor: t.bgSubtle }]}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: accent,
                          width: `${terms.length > 0 ? (stats.mastered / terms.length) * 100 : 0}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[typography.footnote, { color: t.textTertiary }]}>
                    {terms.length > 0 ? Math.round((stats.mastered / terms.length) * 100) : 0}%
                  </Text>
                </View>
              </View>
              <ArrowRight size={18} color={t.textTertiary} strokeWidth={1.5} />
            </Pressable>
          </Animated.View>
        )}

        {/* Explore */}
        <Animated.View entering={FadeInDown.duration(400).delay(240)}>
          <Text style={[typography.caption, { color: t.textTertiary, marginBottom: spacing.lg }]}>
            {tr('home.explore')}
          </Text>
          <View style={styles.exploreGrid}>
            {categories.map((cat) => (
              <Pressable
                key={cat.id}
                style={[styles.exploreItem, { backgroundColor: t.bgElevated, borderColor: t.border }]}
                onPress={() => {
                  useAppStore.getState().setSelectedTags([cat.id]);
                  router.push('/(tabs)/learn');
                }}
              >
                <View style={[styles.exploreDot, { backgroundColor: cat.color }]} />
                <Text style={[typography.subhead, { color: t.text }]}>
                  {tr('categories.' + cat.id)}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Quick Stats */}
        <Animated.View entering={FadeInDown.duration(400).delay(320)}>
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
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing['6xl'] },
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
  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    borderWidth: 0.5,
    padding: spacing.xl,
    marginBottom: spacing['2xl'],
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  progressBar: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  exploreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  exploreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    borderWidth: 0.5,
    gap: spacing.sm,
  },
  exploreDot: { width: 8, height: 8, borderRadius: 4 },
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
});
