import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Dimensions,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import {
  ArrowRight,
  Layers,
  Brain,
  Repeat,
  Shield,
  Code,
  ChevronLeft,
  Check,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/lib/useTheme';
import { colors, spacing, radius, typography } from '@/constants/theme';
import { categories } from '@/data/categories';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DAILY_GOAL_OPTIONS = [
  { value: 5, label: 'Casual', sublabel: '5 concepts / day' },
  { value: 10, label: 'Regular', sublabel: '10 concepts / day' },
  { value: 20, label: 'Serious', sublabel: '20 concepts / day' },
  { value: 30, label: 'Intense', sublabel: '30 concepts / day' },
];

export default function OnboardingScreen() {
  const { colors: t, accent } = useTheme();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedGoal, setSelectedGoal] = useState(10);

  const { setSelectedTags, setDailyGoal, setLanguage, completeOnboarding } =
    useAppStore();

  const totalPages = 4;

  const goNext = () => {
    if (currentPage < totalPages - 1) {
      scrollRef.current?.scrollTo({
        x: SCREEN_WIDTH * (currentPage + 1),
        animated: true,
      });
    }
  };

  const goBack = () => {
    if (currentPage > 0) {
      scrollRef.current?.scrollTo({
        x: SCREEN_WIDTH * (currentPage - 1),
        animated: true,
      });
    }
  };

  const handleFinish = () => {
    if (selectedCategories.length > 0) {
      setSelectedTags(selectedCategories);
    }
    setDailyGoal(selectedGoal);
    completeOnboarding();
    router.replace('/(tabs)');
  };

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentPage(page);
  };

  const isLastPage = currentPage === totalPages - 1;

  const categoryIcons: Record<string, React.ReactNode> = {
    cybersecurity: <Shield size={20} color="#E17055" strokeWidth={1.5} />,
    'software-dev': <Code size={20} color="#0984E3" strokeWidth={1.5} />,
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        {currentPage > 0 ? (
          <Pressable onPress={goBack} hitSlop={12}>
            <ChevronLeft size={20} color={t.textSecondary} strokeWidth={1.5} />
          </Pressable>
        ) : (
          <View style={{ width: 20 }} />
        )}
        <View style={styles.dots}>
          {Array.from({ length: totalPages }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.pageDot,
                {
                  backgroundColor: i === currentPage ? accent : t.bgSubtle,
                  width: i === currentPage ? 20 : 6,
                },
              ]}
            />
          ))}
        </View>
        <Pressable
          onPress={handleFinish}
          hitSlop={12}
        >
          <Text style={[typography.subhead, { color: t.textTertiary }]}>
            Skip
          </Text>
        </Pressable>
      </View>

      {/* Pages */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        bounces={false}
      >
        {/* Page 1: Welcome */}
        <View style={[styles.page, { width: SCREEN_WIDTH }]}>
          <View style={styles.pageContent}>
            <Animated.View
              entering={FadeInDown.delay(200).duration(600)}
              style={[styles.iconCircle, { backgroundColor: colors.accentSubtle }]}
            >
              <Layers size={32} color={accent} strokeWidth={1.5} />
            </Animated.View>
            <Animated.Text
              entering={FadeInDown.delay(400).duration(600)}
              style={[styles.pageTitle, { color: t.text }]}
            >
              Master technology{'\n'}concepts
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.delay(600).duration(600)}
              style={[styles.pageDesc, { color: t.textSecondary }]}
            >
              Build your technical vocabulary with bite-sized flashcards.
              From cybersecurity to software development, learn the terms
              that matter.
            </Animated.Text>
          </View>
        </View>

        {/* Page 2: How it works */}
        <View style={[styles.page, { width: SCREEN_WIDTH }]}>
          <View style={styles.pageContent}>
            <Animated.View
              entering={FadeIn.duration(400)}
              style={[styles.iconCircle, { backgroundColor: colors.accentSubtle }]}
            >
              <Brain size={32} color={accent} strokeWidth={1.5} />
            </Animated.View>
            <Text style={[styles.pageTitle, { color: t.text }]}>
              Swipe to learn
            </Text>
            <Text style={[styles.pageDesc, { color: t.textSecondary }]}>
              A simple, effective learning loop powered by spaced repetition.
            </Text>

            <View style={styles.mechanicsList}>
              <View style={[styles.mechanicRow, { borderColor: t.border }]}>
                <View style={[styles.mechanicIcon, { backgroundColor: colors.successMuted }]}>
                  <ArrowRight size={16} color={colors.success} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.headline, { color: t.text }]}>Swipe right</Text>
                  <Text style={[typography.callout, { color: t.textTertiary }]}>I know this concept</Text>
                </View>
              </View>
              <View style={[styles.mechanicRow, { borderColor: t.border }]}>
                <View style={[styles.mechanicIcon, { backgroundColor: colors.dangerMuted }]}>
                  <ArrowRight
                    size={16}
                    color={colors.danger}
                    strokeWidth={2}
                    style={{ transform: [{ rotate: '180deg' }] }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.headline, { color: t.text }]}>Swipe left</Text>
                  <Text style={[typography.callout, { color: t.textTertiary }]}>Still learning</Text>
                </View>
              </View>
              <View style={[styles.mechanicRow, { borderColor: t.border }]}>
                <View style={[styles.mechanicIcon, { backgroundColor: colors.accentMuted }]}>
                  <Repeat size={16} color={accent} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.headline, { color: t.text }]}>Tap card</Text>
                  <Text style={[typography.callout, { color: t.textTertiary }]}>Flip to see definition</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Page 3: Pick interests */}
        <View style={[styles.page, { width: SCREEN_WIDTH }]}>
          <View style={styles.pageContent}>
            <Text style={[styles.pageTitle, { color: t.text }]}>
              What interests you?
            </Text>
            <Text style={[styles.pageDesc, { color: t.textSecondary }]}>
              Choose one or more areas. You can always change this later.
            </Text>

            <View style={styles.categoryList}>
              {categories.map((cat) => {
                const selected = selectedCategories.includes(cat.id);
                return (
                  <Pressable
                    key={cat.id}
                    style={[
                      styles.categoryCard,
                      {
                        backgroundColor: selected ? colors.accentMuted : t.bgElevated,
                        borderColor: selected ? accent : t.border,
                      },
                    ]}
                    onPress={() => toggleCategory(cat.id)}
                  >
                    <View style={styles.categoryCardTop}>
                      {categoryIcons[cat.id]}
                      {selected && (
                        <View style={[styles.checkMark, { backgroundColor: accent }]}>
                          <Check size={12} color="#fff" strokeWidth={2.5} />
                        </View>
                      )}
                    </View>
                    <Text style={[typography.headline, { color: t.text, marginTop: spacing.md }]}>
                      {cat.name.en}
                    </Text>
                    <Text style={[typography.footnote, { color: t.textTertiary, marginTop: spacing.xs }]}>
                      {cat.subcategories?.length ?? 0} subcategories
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* Page 4: Daily goal */}
        <View style={[styles.page, { width: SCREEN_WIDTH }]}>
          <View style={styles.pageContent}>
            <Text style={[styles.pageTitle, { color: t.text }]}>
              Set your pace
            </Text>
            <Text style={[styles.pageDesc, { color: t.textSecondary }]}>
              How many concepts do you want to learn each day? Start small and build up.
            </Text>

            <View style={styles.goalList}>
              {DAILY_GOAL_OPTIONS.map((opt) => {
                const active = selectedGoal === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[
                      styles.goalRow,
                      {
                        backgroundColor: active ? colors.accentMuted : t.bgElevated,
                        borderColor: active ? accent : t.border,
                      },
                    ]}
                    onPress={() => setSelectedGoal(opt.value)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.headline, { color: t.text }]}>
                        {opt.label}
                      </Text>
                      <Text style={[typography.footnote, { color: t.textTertiary }]}>
                        {opt.sublabel}
                      </Text>
                    </View>
                    {active && (
                      <View style={[styles.checkMark, { backgroundColor: accent }]}>
                        <Check size={12} color="#fff" strokeWidth={2.5} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom button */}
      <View style={styles.bottomBar}>
        <Pressable
          style={[styles.continueBtn, { backgroundColor: accent }]}
          onPress={isLastPage ? handleFinish : goNext}
        >
          <Text style={[typography.headline, { color: '#fff' }]}>
            {isLastPage ? 'Start learning' : 'Continue'}
          </Text>
          {!isLastPage && (
            <ArrowRight size={18} color="#fff" strokeWidth={2} style={{ marginLeft: spacing.sm }} />
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageDot: {
    height: 6,
    borderRadius: 3,
  },
  page: {
    flex: 1,
  },
  pageContent: {
    flex: 1,
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing['4xl'],
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  pageDesc: {
    ...typography.body,
    lineHeight: 24,
    marginTop: spacing.lg,
  },
  mechanicsList: {
    marginTop: spacing['3xl'],
    gap: spacing.sm,
  },
  mechanicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 0.5,
    gap: spacing.lg,
  },
  mechanicIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryList: {
    marginTop: spacing['2xl'],
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  categoryCard: {
    flex: 1,
    minWidth: '44%',
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  categoryCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalList: {
    marginTop: spacing['2xl'],
    gap: spacing.md,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  bottomBar: {
    paddingHorizontal: spacing['2xl'],
    paddingBottom: spacing.xl,
  },
  continueBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 52,
    borderRadius: radius.md,
  },
});
