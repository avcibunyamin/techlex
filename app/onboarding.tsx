import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Dimensions,
  ScrollView,
  TextInput,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import {
  ArrowRight,
  Layers,
  Brain,
  Repeat,
  User,
  Sun,
  Moon,
  Monitor,
  ChevronLeft,
  Check,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/lib/useTheme';
import { ThemeMode } from '@/lib/useTheme';
import { colors, spacing, radius, typography } from '@/constants/theme';
import { categories } from '@/data/categories';
import { getTermLanguage } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OnboardingScreen() {
  const { colors: t, accent, themeMode: currentTheme } = useTheme();
  const router = useRouter();
  const { t: tr } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedGoal, setSelectedGoal] = useState(10);
  const [displayName, setDisplayNameLocal] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>(currentTheme);

  const { setSelectedTags, setDailyGoal, setDisplayName, setThemeMode, completeOnboarding, language } =
    useAppStore();

  const tl = getTermLanguage(language);
  const totalPages = 6;

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
    if (displayName.trim()) {
      setDisplayName(displayName.trim());
    }
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

  const handleThemeSelect = (mode: ThemeMode) => {
    setSelectedTheme(mode);
    setThemeMode(mode);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentPage(page);
  };

  const isLastPage = currentPage === totalPages - 1;

  const DAILY_GOAL_OPTIONS = [
    { value: 5, label: tr('onboarding.goalCasual'), sublabel: tr('onboarding.conceptsPerDay', { count: 5 }) },
    { value: 10, label: tr('onboarding.goalRegular'), sublabel: tr('onboarding.conceptsPerDay', { count: 10 }) },
    { value: 20, label: tr('onboarding.goalSerious'), sublabel: tr('onboarding.conceptsPerDay', { count: 20 }) },
    { value: 30, label: tr('onboarding.goalIntense'), sublabel: tr('onboarding.conceptsPerDay', { count: 30 }) },
  ];

  const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'light', label: tr('onboarding.themeLight'), icon: <Sun size={20} color={selectedTheme === 'light' ? accent : t.textSecondary} strokeWidth={1.5} /> },
    { mode: 'dark', label: tr('onboarding.themeDark'), icon: <Moon size={20} color={selectedTheme === 'dark' ? accent : t.textSecondary} strokeWidth={1.5} /> },
    { mode: 'system', label: tr('onboarding.themeSystem'), icon: <Monitor size={20} color={selectedTheme === 'system' ? accent : t.textSecondary} strokeWidth={1.5} /> },
  ];

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
        <Pressable onPress={handleFinish} hitSlop={12}>
          <Text style={[typography.subhead, { color: t.textTertiary }]}>
            {tr('onboarding.skip')}
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
              {tr('onboarding.welcome')}
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.delay(600).duration(600)}
              style={[styles.pageDesc, { color: t.textSecondary }]}
            >
              {tr('onboarding.welcomeDesc')}
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
              {tr('onboarding.howItWorks')}
            </Text>
            <Text style={[styles.pageDesc, { color: t.textSecondary }]}>
              {tr('onboarding.howItWorksDesc')}
            </Text>

            <View style={styles.mechanicsList}>
              <View style={[styles.mechanicRow, { borderColor: t.border }]}>
                <View style={[styles.mechanicIcon, { backgroundColor: colors.successMuted }]}>
                  <ArrowRight size={16} color={colors.success} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.headline, { color: t.text }]}>{tr('onboarding.swipeRight')}</Text>
                  <Text style={[typography.callout, { color: t.textTertiary }]}>{tr('onboarding.swipeRightDesc')}</Text>
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
                  <Text style={[typography.headline, { color: t.text }]}>{tr('onboarding.swipeLeft')}</Text>
                  <Text style={[typography.callout, { color: t.textTertiary }]}>{tr('onboarding.swipeLeftDesc')}</Text>
                </View>
              </View>
              <View style={[styles.mechanicRow, { borderColor: t.border }]}>
                <View style={[styles.mechanicIcon, { backgroundColor: colors.accentMuted }]}>
                  <Repeat size={16} color={accent} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.headline, { color: t.text }]}>{tr('onboarding.tapFlip')}</Text>
                  <Text style={[typography.callout, { color: t.textTertiary }]}>{tr('onboarding.tapFlipDesc')}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Page 3: Name input */}
        <View style={[styles.page, { width: SCREEN_WIDTH }]}>
          <View style={styles.pageContent}>
            <View style={[styles.iconCircle, { backgroundColor: colors.accentSubtle }]}>
              <User size={32} color={accent} strokeWidth={1.5} />
            </View>
            <Text style={[styles.pageTitle, { color: t.text }]}>
              {tr('onboarding.nameTitle')}
            </Text>
            <Text style={[styles.pageDesc, { color: t.textSecondary }]}>
              {tr('onboarding.nameSubtitle')}
            </Text>
            <TextInput
              style={[
                styles.nameInput,
                {
                  color: t.text,
                  backgroundColor: t.bgElevated,
                  borderColor: displayName.length > 0 ? accent : t.border,
                },
              ]}
              placeholder={tr('onboarding.namePlaceholder')}
              placeholderTextColor={t.textMuted}
              value={displayName}
              onChangeText={setDisplayNameLocal}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={30}
            />
          </View>
        </View>

        {/* Page 4: Theme toggle */}
        <View style={[styles.page, { width: SCREEN_WIDTH }]}>
          <View style={styles.pageContent}>
            <View style={[styles.iconCircle, { backgroundColor: colors.accentSubtle }]}>
              <Sun size={32} color={accent} strokeWidth={1.5} />
            </View>
            <Text style={[styles.pageTitle, { color: t.text }]}>
              {tr('onboarding.themeTitle')}
            </Text>
            <Text style={[styles.pageDesc, { color: t.textSecondary }]}>
              {tr('onboarding.themeSubtitle')}
            </Text>

            <View style={styles.themeList}>
              {THEME_OPTIONS.map((opt) => {
                const active = selectedTheme === opt.mode;
                return (
                  <Pressable
                    key={opt.mode}
                    style={[
                      styles.themeRow,
                      {
                        backgroundColor: active ? colors.accentMuted : t.bgElevated,
                        borderColor: active ? accent : t.border,
                      },
                    ]}
                    onPress={() => handleThemeSelect(opt.mode)}
                  >
                    {opt.icon}
                    <Text style={[typography.headline, { color: t.text, flex: 1, marginLeft: spacing.lg }]}>
                      {opt.label}
                    </Text>
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

        {/* Page 5: Pick interests */}
        <View style={[styles.page, { width: SCREEN_WIDTH }]}>
          <View style={styles.pageContent}>
            <Text style={[styles.pageTitle, { color: t.text }]}>
              {tr('onboarding.interestsTitle')}
            </Text>
            <Text style={[styles.pageDesc, { color: t.textSecondary }]}>
              {tr('onboarding.interestsSubtitle')}
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
                      <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                      {selected && (
                        <View style={[styles.checkMark, { backgroundColor: accent }]}>
                          <Check size={12} color="#fff" strokeWidth={2.5} />
                        </View>
                      )}
                    </View>
                    <Text style={[typography.headline, { color: t.text, marginTop: spacing.md }]}>
                      {tr('categories.' + cat.id)}
                    </Text>
                    <Text style={[typography.footnote, { color: t.textTertiary, marginTop: spacing.xs }]}>
                      {tr('onboarding.subcategories', { count: cat.subcategories?.length ?? 0 })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* Page 6: Daily goal */}
        <View style={[styles.page, { width: SCREEN_WIDTH }]}>
          <View style={styles.pageContent}>
            <Text style={[styles.pageTitle, { color: t.text }]}>
              {tr('onboarding.paceTitle')}
            </Text>
            <Text style={[styles.pageDesc, { color: t.textSecondary }]}>
              {tr('onboarding.paceSubtitle')}
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
            {isLastPage ? tr('onboarding.startLearning') : tr('onboarding.continue')}
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
  nameInput: {
    marginTop: spacing['3xl'],
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.xl,
    fontSize: 16,
    fontWeight: '500',
  },
  themeList: {
    marginTop: spacing['3xl'],
    gap: spacing.md,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
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
  catDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
