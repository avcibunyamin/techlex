import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, Pressable, ScrollView,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Target, X, Check, HelpCircle, RefreshCw, Zap, Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAppStore, QuizQuestion } from '@/lib/store';
import { useTheme } from '@/lib/useTheme';
import { colors, spacing, radius, typography } from '@/constants/theme';
import { XP_PER_QUIZ } from '@/constants/badges';
import PaywallModal from '@/components/PaywallModal';

const PRESS_SPRING = { damping: 15, stiffness: 300 };
const MIN_KNOWN_FOR_QUIZ = 10;

type QuizState = 'idle' | 'active' | 'results';

export default function QuizScreen() {
  const { colors: t, accent } = useTheme();
  const { t: tr } = useTranslation();
  const knownCount = useAppStore(s => s.getKnownTermCount());
  const isPremium = useAppStore(s => s.hasActivePremium());
  const { generateQuiz, submitQuizResults, downgradeQuizTerm, promoteQuizTerm } = useAppStore();

  const [quizState, setQuizState] = useState<QuizState>('idle');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [results, setResults] = useState<(boolean | null)[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);

  const advanceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const borderGlow = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const cardKey = useSharedValue(0);

  const falseBtnScale = useSharedValue(1);
  const trueBtnScale = useSharedValue(1);
  const startBtnScale = useSharedValue(1);
  const retryBtnScale = useSharedValue(1);
  const skipBtnScale = useSharedValue(1);
  const gotItBtnScale = useSharedValue(1);

  const falseBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: falseBtnScale.value }],
  }));
  const trueBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: trueBtnScale.value }],
  }));
  const startBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: startBtnScale.value }],
  }));
  const retryBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: retryBtnScale.value }],
  }));
  const skipBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: skipBtnScale.value }],
  }));
  const gotItBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: gotItBtnScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: borderGlow.value,
  }));

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const startQuiz = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    const qs = generateQuiz();
    if (qs.length === 0) return;
    setQuestions(qs);
    setCurrentQ(0);
    setScore(0);
    setAnswered(false);
    setLastCorrect(null);
    setShowCorrection(false);
    setResults(new Array(qs.length).fill(null));
    setQuizState('active');
    borderGlow.value = 0;
    shakeX.value = 0;
  }, [generateQuiz, borderGlow, shakeX]);

  const advanceToNext = useCallback((wasCorrect: boolean) => {
    if (currentQ + 1 >= questions.length) {
      const finalScore = wasCorrect ? score + 1 : score;
      submitQuizResults(finalScore, questions.length);
      setQuizState('results');
    } else {
      setCurrentQ(i => i + 1);
      setAnswered(false);
      setLastCorrect(null);
      setShowCorrection(false);
      borderGlow.value = 0;
      shakeX.value = 0;
      cardKey.value = cardKey.value + 1;
    }
  }, [currentQ, questions, score, submitQuizResults, borderGlow, shakeX, cardKey]);

  const handleAnswer = useCallback((userSaysTrue: boolean) => {
    if (answered || currentQ >= questions.length) return;

    const q = questions[currentQ];
    const isUserCorrect = userSaysTrue === q.isCorrect;

    setAnswered(true);
    setLastCorrect(isUserCorrect);
    setResults(prev => {
      const copy = [...prev];
      copy[currentQ] = isUserCorrect;
      return copy;
    });

    if (isUserCorrect) {
      setScore(s => s + 1);
      promoteQuizTerm(q.term.id);
      borderGlow.value = withSequence(
        withTiming(1, { duration: 200 }),
        withDelay(200, withTiming(0, { duration: 300 })),
      );
      advanceTimer.current = setTimeout(() => {
        advanceToNext(true);
      }, 600);
    } else {
      shakeX.value = withSequence(
        withTiming(-8, { duration: 50 }),
        withTiming(8, { duration: 50 }),
        withTiming(-5, { duration: 50 }),
        withTiming(5, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
      setShowCorrection(true);
      downgradeQuizTerm(q.term.id);
    }
  }, [answered, currentQ, questions, score, downgradeQuizTerm, promoteQuizTerm, advanceToNext, borderGlow, shakeX]);

  const handleGotIt = useCallback(() => {
    advanceToNext(false);
  }, [advanceToNext]);

  const handleSkip = useCallback(() => {
    if (answered || currentQ >= questions.length) return;
    const q = questions[currentQ];
    setAnswered(true);
    setLastCorrect(false);
    setResults(prev => {
      const copy = [...prev];
      copy[currentQ] = false;
      return copy;
    });
    downgradeQuizTerm(q.term.id);
    setShowCorrection(true);
    shakeX.value = withSequence(
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(-5, { duration: 50 }),
      withTiming(5, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  }, [answered, currentQ, questions, downgradeQuizTerm, shakeX]);

  const getResultMessage = () => {
    const total = questions.length;
    const finalScore = score;
    if (finalScore === total) return tr('quiz.perfect');
    if (finalScore >= 7) return tr('quiz.great');
    return tr('quiz.tryAgain');
  };

  // --- IDLE STATE ---
  if (quizState === 'idle') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top']}>
        <View style={styles.header}>
          <Text style={[typography.largeTitle, { color: t.text }]}>{tr('quiz.title')}</Text>
        </View>
        <View style={styles.centerContent}>
          {knownCount === 0 ? (
            <Animated.View entering={FadeIn.duration(300)} style={styles.emptyInner}>
              <Target size={32} color={t.textMuted} strokeWidth={1} />
              <Text style={[typography.headline, { color: t.text, marginTop: spacing.xl }]}>
                {tr('quiz.empty')}
              </Text>
              <Text style={[typography.callout, { color: t.textTertiary, textAlign: 'center', marginTop: spacing.sm }]}>
                {tr('quiz.emptySub')}
              </Text>
            </Animated.View>
          ) : knownCount < MIN_KNOWN_FOR_QUIZ ? (
            <Animated.View entering={FadeIn.duration(300)} style={styles.emptyInner}>
              <Target size={32} color={t.textMuted} strokeWidth={1} />
              <Text style={[typography.headline, { color: t.text, marginTop: spacing.xl }]}>
                {tr('quiz.notEnoughTitle')}
              </Text>
              <Text style={[typography.callout, { color: t.textTertiary, textAlign: 'center', marginTop: spacing.sm }]}>
                {tr('quiz.notEnoughSub', { current: knownCount })}
              </Text>
              <View style={[styles.progressBar, { backgroundColor: t.bgSubtle }]}>
                <View style={[styles.progressFill, { width: `${(knownCount / MIN_KNOWN_FOR_QUIZ) * 100}%`, backgroundColor: accent }]} />
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn.duration(300)} style={styles.emptyInner}>
              <Target size={32} color={accent} strokeWidth={1.5} />
              <Text style={[typography.headline, { color: t.text, marginTop: spacing.xl }]}>
                {tr('quiz.title')}
              </Text>
              <Text style={[typography.callout, { color: t.textTertiary, textAlign: 'center', marginTop: spacing.sm }]}>
                {knownCount} {tr('quiz.termsReady')}
              </Text>
              <Animated.View style={[styles.startBtnWrap, startBtnStyle]}>
                <Pressable
                  style={[styles.startBtn, { backgroundColor: accent }]}
                  onPressIn={() => { startBtnScale.value = withSpring(0.95, PRESS_SPRING); }}
                  onPressOut={() => { startBtnScale.value = withSpring(1, PRESS_SPRING); }}
                  onPress={startQuiz}
                >
                  <Text style={[typography.headline, { color: '#fff' }]}>{tr('quiz.start')}</Text>
                </Pressable>
              </Animated.View>
            </Animated.View>
          )}
        </View>
        <PaywallModal visible={showPaywall} onDismiss={() => setShowPaywall(false)} variant="premium" source="quizHint" />
      </SafeAreaView>
    );
  }

  // --- RESULTS STATE ---
  if (quizState === 'results') {
    const finalScore = score;
    const xpEarned = finalScore * XP_PER_QUIZ;

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top']}>
        <View style={styles.header}>
          <Text style={[typography.largeTitle, { color: t.text }]}>{tr('quiz.results')}</Text>
        </View>
        <Animated.View entering={FadeIn.duration(400)} style={styles.centerContent}>
          <View style={styles.resultsInner}>
            <View style={styles.progressDots}>
              {results.map((r, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressDot,
                    { backgroundColor: r === true ? colors.success : r === false ? colors.danger : t.bgSubtle },
                  ]}
                />
              ))}
            </View>

            <Text style={[styles.scoreText, { color: t.text }]}>
              {finalScore}/{questions.length}
            </Text>

            <View style={[styles.xpBadge, { backgroundColor: accent + '15' }]}>
              <Zap size={16} color={accent} strokeWidth={2} />
              <Text style={[typography.headline, { color: accent }]}>
                +{xpEarned} XP
              </Text>
            </View>

            <Text style={[typography.callout, { color: t.textTertiary, marginTop: spacing.xl }]}>
              {getResultMessage()}
            </Text>

            <Animated.View style={[styles.retryBtnWrap, retryBtnStyle]}>
              <Pressable
                style={[styles.startBtn, { backgroundColor: accent }]}
                onPressIn={() => { retryBtnScale.value = withSpring(0.95, PRESS_SPRING); }}
                onPressOut={() => { retryBtnScale.value = withSpring(1, PRESS_SPRING); }}
                onPress={() => {
                  setQuizState('idle');
                  setAnswered(false);
                  setLastCorrect(null);
                  setShowCorrection(false);
                }}
              >
                <RefreshCw size={16} color="#fff" strokeWidth={2} />
                <Text style={[typography.headline, { color: '#fff' }]}>{tr('quiz.retry')}</Text>
              </Pressable>
            </Animated.View>
          </View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // --- ACTIVE QUIZ STATE ---
  const q = questions[currentQ];
  if (!q) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[typography.largeTitle, { color: t.text }]}>{tr('quiz.title')}</Text>
        <Text style={[typography.subhead, { color: t.textTertiary }]}>
          {currentQ + 1}/{questions.length}
        </Text>
      </View>

      <View style={styles.progressDots}>
        {results.map((r, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              {
                backgroundColor:
                  r === true ? colors.success
                  : r === false ? colors.danger
                  : i === currentQ ? accent
                  : t.bgSubtle,
              },
            ]}
          />
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          key={`q-${currentQ}`}
          entering={FadeIn.duration(250)}
          exiting={FadeOut.duration(150)}
          style={shakeStyle}
        >
          <View style={[styles.quizCard, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
            <Animated.View
              style={[
                styles.glowOverlay,
                { borderColor: colors.success },
                glowStyle,
              ]}
              pointerEvents="none"
            />

            <Text style={[styles.quizTerm, { color: t.text }]}>
              {q.term.term}
            </Text>

            <View style={[styles.quizDivider, { backgroundColor: t.border }]} />

            <Text style={[styles.quizDefinition, { color: t.textSecondary }]}>
              {q.displayedDefinition}
            </Text>

          </View>
        </Animated.View>

        {showCorrection && (
          <Animated.View
            entering={FadeIn.duration(250)}
            style={[styles.correctionBox, { borderColor: colors.danger, backgroundColor: colors.dangerMuted }]}
          >
            <Text style={[typography.subhead, { color: colors.danger }]}>
              {tr('quiz.correctDefinitionLabel')}
            </Text>
            <Text style={[typography.body, { color: t.text, marginTop: spacing.xs }]}>
              {q.correctDefinition}
            </Text>
            {q.sourceTerm && (
              isPremium ? (
                <Text style={[typography.footnote, { color: t.textTertiary, marginTop: spacing.sm }]}>
                  {tr('quiz.definitionFrom', { term: q.sourceTerm.term })}
                </Text>
              ) : (
                <Pressable onPress={() => setShowPaywall(true)} style={[styles.unlockBox, { backgroundColor: accent + '15', borderColor: accent + '40', marginTop: spacing.md }]}>
                  <Lock size={14} color={accent} strokeWidth={2} />
                  <Text style={[typography.subhead, { color: accent, fontWeight: '600' }]}>
                    {tr('quiz.unlockSource')}
                  </Text>
                </Pressable>
              )
            )}
            <Animated.View style={[styles.gotItBtnWrap, gotItBtnStyle]}>
              <Pressable
                style={[styles.gotItBtn, { backgroundColor: colors.danger }]}
                onPressIn={() => { gotItBtnScale.value = withSpring(0.95, PRESS_SPRING); }}
                onPressOut={() => { gotItBtnScale.value = withSpring(1, PRESS_SPRING); }}
                onPress={handleGotIt}
              >
                <Text style={[typography.headline, { color: '#fff' }]}>{tr('quiz.gotIt')}</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Answer feedback */}
      {answered && lastCorrect !== null && !showCorrection && (
        <Animated.View entering={FadeIn.duration(150)} style={styles.feedbackRow}>
          <Text style={[typography.subhead, { color: lastCorrect ? colors.success : colors.danger }]}>
            {lastCorrect ? tr('quiz.correct') : tr('quiz.wrong')}
          </Text>
        </Animated.View>
      )}

      {/* Action buttons — hide when correction box is visible */}
      {!showCorrection && (
        <View style={styles.actions}>
          <Animated.View style={falseBtnStyle}>
            <Pressable
              style={[styles.answerBtn, { borderColor: colors.danger + '40' }]}
              onPressIn={() => { falseBtnScale.value = withSpring(0.92, PRESS_SPRING); }}
              onPressOut={() => { falseBtnScale.value = withSpring(1, PRESS_SPRING); }}
              onPress={() => handleAnswer(false)}
              disabled={answered}
            >
              <X size={24} color={colors.danger} strokeWidth={2} />
              <Text style={[styles.answerLabel, { color: colors.danger }]}>{tr('quiz.false')}</Text>
            </Pressable>
          </Animated.View>

          <Animated.View style={skipBtnStyle}>
            <Pressable
              style={[styles.skipBtn, { borderColor: colors.warning + '40' }]}
              onPressIn={() => { skipBtnScale.value = withSpring(0.92, PRESS_SPRING); }}
              onPressOut={() => { skipBtnScale.value = withSpring(1, PRESS_SPRING); }}
              onPress={handleSkip}
              disabled={answered}
            >
              <HelpCircle size={24} color={colors.warning} strokeWidth={2} />
              <Text style={[styles.answerLabel, { color: colors.warning }]}>{tr('quiz.skip')}</Text>
            </Pressable>
          </Animated.View>

          <Animated.View style={trueBtnStyle}>
            <Pressable
              style={[styles.answerBtn, { borderColor: colors.success + '40' }]}
              onPressIn={() => { trueBtnScale.value = withSpring(0.92, PRESS_SPRING); }}
              onPressOut={() => { trueBtnScale.value = withSpring(1, PRESS_SPRING); }}
              onPress={() => handleAnswer(true)}
              disabled={answered}
            >
              <Check size={24} color={colors.success} strokeWidth={2} />
              <Text style={[styles.answerLabel, { color: colors.success }]}>{tr('quiz.true')}</Text>
            </Pressable>
          </Animated.View>
        </View>
      )}

      <PaywallModal visible={showPaywall} onDismiss={() => setShowPaywall(false)} variant="premium" source="quizHint" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, maxWidth: 800, alignSelf: 'center' as const, width: '100%' as any },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.xl,
    paddingBottom: spacing.md,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyInner: {
    alignItems: 'center',
    paddingHorizontal: spacing['4xl'],
  },
  startBtnWrap: {
    marginTop: spacing['3xl'],
    width: '100%',
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
  },
  progressBar: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    marginTop: spacing.xl,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  quizCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing['2xl'],
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  glowOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.xl,
    borderWidth: 2.5,
  },
  quizTerm: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  quizDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: spacing.xl,
  },
  quizDefinition: {
    ...typography.body,
    lineHeight: 24,
    textAlign: 'center',
  },
  sourceHint: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 0.5,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  unlockBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  correctionBox: {
    marginTop: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  gotItBtnWrap: {
    marginTop: spacing.lg,
  },
  gotItBtn: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackRow: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing['3xl'],
    paddingVertical: spacing.xl,
    paddingBottom: spacing['2xl'],
  },
  answerBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
  },
  skipBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
  },
  answerLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  resultsInner: {
    alignItems: 'center',
    paddingHorizontal: spacing['4xl'],
  },
  scoreText: {
    fontSize: 64,
    fontWeight: '700',
    letterSpacing: -2,
    marginTop: spacing.xl,
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 20,
    marginTop: spacing.xl,
  },
  retryBtnWrap: {
    marginTop: spacing['3xl'],
    width: '100%',
  },
});
