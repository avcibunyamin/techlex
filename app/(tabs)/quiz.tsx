import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, Pressable, ScrollView, I18nManager, Platform,
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
import { Target, X, Check, HelpCircle, RefreshCw, Zap, Lock, Volume2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from 'expo-router';
import { useAppStore, QuizQuestion, QuizMode, MIN_SCOPED_QUIZ_SIZE } from '@/lib/store';
import { useTheme } from '@/lib/useTheme';
import { colors, spacing, radius, typography } from '@/constants/theme';
import { haptic } from '@/lib/haptics';
import { mapQuizKey } from '@/lib/shortcuts';
import { useWebKeyboard } from '@/lib/useWebKeyboard';
import { XP_PER_QUIZ } from '@/constants/badges';
import PaywallModal from '@/components/PaywallModal';
import SpeakButton, { SpeechRateToggle, useSpeechAvailability } from '@/components/SpeakButton';
import { speak, stop as stopSpeech } from '@/lib/speech';
import { quizModeAvailability, listenQuestionKind } from '@/lib/speech-logic';

const PRESS_SPRING = { damping: 15, stiffness: 300 };
const QUIZ_MODES: readonly QuizMode[] = ['definition', 'cloze', 'listen'];
const MODE_LABEL_KEYS: Record<QuizMode, string> = {
  definition: 'quiz.modeDefinition',
  cloze: 'quiz.modeCloze',
  listen: 'quiz.modeListen',
};
const MIN_KNOWN_FOR_QUIZ = 10;

type QuizState = 'idle' | 'active' | 'results';

export default function QuizScreen() {
  const { colors: t, accent } = useTheme();
  const { t: tr } = useTranslation();
  const knownCount = useAppStore(s => s.getKnownTermCount());
  const isPremium = useAppStore(s => s.hasActivePremium());
  const language = useAppStore(s => s.language);
  const quizScope = useAppStore(s => s.quizScope);
  // Selector re-runs on progress changes, so the ready count stays current after a quiz.
  const scopedReady = useAppStore(s => (s.quizScope ? s.countScopedQuizReady(s.quizScope.ids) : 0));
  const { generateQuiz, submitQuizResults, downgradeQuizTerm, promoteQuizTerm, setQuizScope } = useAppStore();
  const rowDir = language === 'ar' && !I18nManager.isRTL ? 'row-reverse' : 'row';

  const [quizState, setQuizState] = useState<QuizState>('idle');
  const [mode, setMode] = useState<QuizMode>('definition');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [results, setResults] = useState<(boolean | null)[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);
  const [showSkipFeedback, setShowSkipFeedback] = useState(false);
  // Set when speech fails during this quiz; remaining listen questions are shown written.
  const [speechFailed, setSpeechFailed] = useState(false);
  const speechAvailable = useSpeechAvailability();
  const listenAvailability = quizModeAvailability('listen', speechAvailable);
  const isArabic = language === 'ar';

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
    const qs = generateQuiz(mode, quizScope?.ids);
    if (qs.length === 0) return;
    setQuestions(qs);
    setCurrentQ(0);
    setScore(0);
    setAnswered(false);
    setLastCorrect(null);
    setSelectedOption(null);
    setShowCorrection(false);
    setShowSkipFeedback(false);
    setSpeechFailed(false);
    setResults(new Array(qs.length).fill(null));
    setQuizState('active');
    borderGlow.value = 0;
    shakeX.value = 0;
  }, [generateQuiz, mode, quizScope, borderGlow, shakeX]);

  const advanceToNext = useCallback((wasCorrect: boolean) => {
    if (currentQ + 1 >= questions.length) {
      const finalScore = wasCorrect ? score + 1 : score;
      submitQuizResults(finalScore, questions.length);
      setQuizState('results');
    } else {
      setCurrentQ(i => i + 1);
      setAnswered(false);
      setLastCorrect(null);
      setSelectedOption(null);
      setShowCorrection(false);
      setShowSkipFeedback(false);
      borderGlow.value = 0;
      shakeX.value = 0;
      cardKey.value = cardKey.value + 1;
    }
  }, [currentQ, questions, score, submitQuizResults, borderGlow, shakeX, cardKey]);

  // Shared by the true/false and cloze questions: same Leitner promote/downgrade and XP flow.
  const resolveAnswer = useCallback((isUserCorrect: boolean) => {
    if (answered || currentQ >= questions.length) return;

    const q = questions[currentQ];

    setAnswered(true);
    setLastCorrect(isUserCorrect);
    setResults(prev => {
      const copy = [...prev];
      copy[currentQ] = isUserCorrect;
      return copy;
    });

    if (isUserCorrect) {
      haptic.success();
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
      haptic.warning();
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
  }, [answered, currentQ, questions, downgradeQuizTerm, promoteQuizTerm, advanceToNext, borderGlow, shakeX]);

  const handleAnswer = useCallback((userSaysTrue: boolean) => {
    const q = questions[currentQ];
    if (!q) return;
    resolveAnswer(userSaysTrue === q.isCorrect);
  }, [questions, currentQ, resolveAnswer]);

  // Cloze and listen questions share the 4-option UI.
  const handleChoiceAnswer = useCallback((index: number) => {
    const q = questions[currentQ];
    const choice = q?.cloze ?? q?.listen;
    if (answered || !choice) return;
    setSelectedOption(index);
    resolveAnswer(index === choice.correctIndex);
  }, [answered, questions, currentQ, resolveAnswer]);

  const activeQuestion = quizState === 'active' ? questions[currentQ] : undefined;
  const listenKind = activeQuestion?.listen ? listenQuestionKind(speechAvailable, speechFailed) : null;

  const playListenTerm = useCallback(() => {
    const q = questions[currentQ];
    if (!q?.listen) return;
    speak(q.term.term, {
      rate: useAppStore.getState().speechRate,
      onError: () => setSpeechFailed(true),
    });
  }, [questions, currentQ]);

  // New question: stop the previous audio; a spoken listen question plays its term once.
  useEffect(() => {
    stopSpeech();
    if (listenKind === 'audio') playListenTerm();
  }, [quizState, currentQ, questions, listenKind, playListenTerm]);

  useFocusEffect(
    useCallback(() => () => stopSpeech(), [])
  );

  // Voice lost before the quiz starts: do not keep an unusable mode selected.
  useEffect(() => {
    if (mode === 'listen' && !listenAvailability.enabled && listenAvailability.reason === 'noVoice') {
      setMode('definition');
    }
  }, [mode, listenAvailability.enabled, listenAvailability.reason]);

  const handleGotIt = useCallback(() => {
    setShowSkipFeedback(false);
    advanceToNext(false);
  }, [advanceToNext]);

  const handleSkip = useCallback(() => {
    if (answered || currentQ >= questions.length) return;
    setAnswered(true);
    setLastCorrect(null);
    setResults(prev => {
      const copy = [...prev];
      copy[currentQ] = false;
      return copy;
    });
    setShowSkipFeedback(true);
  }, [answered, currentQ, questions]);

  // Web only. Options follow the on-screen order: cloze/listen 1–4; true/false 1 = false, 2 = skip, 3 = true.
  useWebKeyboard((e) => {
    if (quizState !== 'active' || showPaywall) return false;
    const q = questions[currentQ];
    if (!q) return false;
    const choice = q.cloze ?? q.listen;
    const action = mapQuizKey(e, choice ? choice.options.length : 3);
    if (!action) return false;

    if (action.type === 'next') {
      if (showCorrection || showSkipFeedback) {
        handleGotIt();
        return true;
      }
      if (answered && lastCorrect === true) {
        // Skip the short auto-advance delay after a correct answer.
        if (advanceTimer.current) clearTimeout(advanceTimer.current);
        // `false` on purpose: this handler runs from the latest render, where `score` already
        // includes this answer (setScore ran with setAnswered). Passing `true` would count it twice.
        // The 600 ms timer keeps `true` because it holds the pre-answer closure.
        advanceToNext(false);
        return true;
      }
      return false;
    }

    if (answered) return false;
    if (choice) {
      handleChoiceAnswer(action.index);
    } else if (action.index === 0) {
      handleAnswer(false);
    } else if (action.index === 1) {
      handleSkip();
    } else {
      handleAnswer(true);
    }
    return true;
  });

  const getResultMessage = () => {
    const total = questions.length;
    const finalScore = score;
    if (finalScore === total) return tr('quiz.perfect');
    if (finalScore >= 7) return tr('quiz.great');
    return tr('quiz.tryAgain');
  };

  // --- IDLE STATE ---
  if (quizState === 'idle') {
    const startControls = (
      <>
        <View
          style={[styles.modePicker, { flexDirection: rowDir, backgroundColor: t.bgSubtle }]}
          accessibilityRole="radiogroup"
        >
          {QUIZ_MODES.map(m => {
            const active = mode === m;
            const { enabled } = quizModeAvailability(m, speechAvailable);
            return (
              <Pressable
                key={m}
                style={[
                  styles.modeOption,
                  active && { backgroundColor: t.bgElevated, borderColor: accent },
                  !enabled && styles.modeOptionDisabled,
                ]}
                onPress={() => setMode(m)}
                disabled={!enabled}
                accessibilityRole="radio"
                accessibilityState={{ selected: active, disabled: !enabled }}
                accessibilityHint={!enabled && m === 'listen'
                  ? tr(listenAvailability.reason === 'checking' ? 'quiz.listenChecking' : 'quiz.listenNoVoice')
                  : undefined}
              >
                <Text style={[typography.subhead, { color: active ? accent : t.textSecondary, fontWeight: '600', textAlign: 'center' }]}>
                  {tr(MODE_LABEL_KEYS[m])}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {!listenAvailability.enabled && (
          <Text style={[typography.footnote, styles.modeNote, { color: t.textTertiary }, isArabic && { writingDirection: 'rtl' }]}>
            {tr(listenAvailability.reason === 'checking' ? 'quiz.listenChecking' : 'quiz.listenNoVoice')}
          </Text>
        )}
        {mode === 'listen' && (
          <View style={styles.rateToggleWrap}>
            <SpeechRateToggle isArabic={isArabic} />
          </View>
        )}
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
      </>
    );

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top']}>
        <View style={styles.header}>
          <Text style={[typography.largeTitle, { color: t.text }]}>{tr('quiz.title')}</Text>
        </View>
        <View style={styles.centerContent}>
          {quizScope ? (
            <Animated.View entering={FadeIn.duration(300)} style={styles.emptyInner}>
              <Target size={32} color={scopedReady >= MIN_SCOPED_QUIZ_SIZE ? accent : t.textMuted} strokeWidth={1.5} />
              <Text style={[typography.headline, { color: t.text, marginTop: spacing.xl, textAlign: 'center' }]}>
                {tr('quiz.scopeTitle')}
              </Text>
              <Text style={[typography.callout, { color: t.textTertiary, textAlign: 'center', marginTop: spacing.sm }]}>
                {tr('quiz.scopeSub', { label: quizScope.label, count: scopedReady })}
              </Text>
              {scopedReady >= MIN_SCOPED_QUIZ_SIZE ? (
                startControls
              ) : (
                <Text style={[typography.callout, { color: t.textSecondary, textAlign: 'center', marginTop: spacing.lg }]}>
                  {tr('quiz.scopeNotEnough', { min: MIN_SCOPED_QUIZ_SIZE })}
                </Text>
              )}
              <Pressable onPress={() => setQuizScope(null)} hitSlop={8} style={{ marginTop: spacing.lg }}>
                <Text style={[typography.subhead, { color: accent, fontWeight: '600' }]}>
                  {tr('quiz.scopeClear')}
                </Text>
              </Pressable>
            </Animated.View>
          ) : knownCount === 0 ? (
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
              {startControls}
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
  const choice = q.cloze ?? q.listen;

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

            {q.listen && listenKind === 'audio' ? (
              <>
                {/* Spelling stays hidden until the answer; only the sound is offered. */}
                <Text style={[typography.subhead, { color: t.textTertiary, textAlign: 'center', marginBottom: spacing.lg }]}>
                  {tr('quiz.listenPrompt')}
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.listenPlay,
                    { borderColor: accent, backgroundColor: accent + '15' },
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={playListenTerm}
                  accessibilityRole="button"
                  accessibilityLabel={tr('quiz.listenReplay')}
                >
                  <Volume2 size={32} color={accent} strokeWidth={2} />
                </Pressable>
                <Text style={[typography.footnote, { color: t.textTertiary, textAlign: 'center', marginTop: spacing.sm }]}>
                  {tr('quiz.listenReplay')}
                </Text>
                <View style={styles.rateToggleWrap}>
                  <SpeechRateToggle isArabic={isArabic} />
                </View>
              </>
            ) : q.listen ? (
              <>
                {/* Written fallback: same options, the definition replaces the sound. */}
                <Text style={[typography.subhead, { color: t.textTertiary, textAlign: 'center', marginBottom: spacing.lg }]}>
                  {tr('quiz.listenWrittenPrompt')}
                </Text>
                <Text style={[styles.quizDefinition, { color: t.text }]}>
                  {q.correctDefinition}
                </Text>
              </>
            ) : q.cloze ? (
              <>
                <Text style={[typography.subhead, { color: t.textTertiary, textAlign: 'center', marginBottom: spacing.lg }]}>
                  {tr('quiz.clozePrompt')}
                </Text>
                {/* The example sentence is English, so it stays LTR in every locale. */}
                <Text style={[styles.clozeSentence, { color: t.text }]}>
                  {q.cloze.masked}
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.quizTerm, { color: t.text }]}>
                  {q.term.term}
                </Text>
                <View style={styles.termSpeak}>
                  <SpeakButton
                    text={q.term.term}
                    accessibilityLabel={tr('speech.playTerm', { term: q.term.term })}
                  />
                </View>

                <View style={[styles.quizDivider, { backgroundColor: t.border }]} />

                <Text style={[styles.quizDefinition, { color: t.textSecondary }]}>
                  {q.displayedDefinition}
                </Text>
              </>
            )}

          </View>
        </Animated.View>

        {choice && !showCorrection && !showSkipFeedback && (
          <View style={styles.clozeOptions}>
            {choice.options.map((option, index) => {
              const isPicked = selectedOption === index;
              const pickedColor = lastCorrect ? colors.success : colors.danger;
              return (
                <Pressable
                  key={option.id}
                  style={({ pressed }) => [
                    styles.clozeOption,
                    { backgroundColor: t.bgElevated, borderColor: t.border },
                    isPicked && { borderColor: pickedColor, backgroundColor: pickedColor + '15' },
                    pressed && !answered && { opacity: 0.7 },
                  ]}
                  onPress={() => handleChoiceAnswer(index)}
                  disabled={answered}
                  accessibilityRole="button"
                >
                  <Text style={[typography.headline, { color: isPicked ? pickedColor : t.text, textAlign: 'center', writingDirection: 'ltr' }]}>
                    {option.term}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              style={({ pressed }) => [styles.clozeSkip, pressed && !answered && { opacity: 0.7 }]}
              onPress={handleSkip}
              disabled={answered}
              accessibilityRole="button"
            >
              <HelpCircle size={18} color={colors.warning} strokeWidth={2} />
              <Text style={[typography.subhead, { color: colors.warning, fontWeight: '600' }]}>{tr('quiz.skip')}</Text>
            </Pressable>
          </View>
        )}

        {showCorrection && (
          <Animated.View
            entering={FadeIn.duration(250)}
            style={[styles.correctionBox, { borderColor: colors.danger, backgroundColor: colors.dangerMuted }]}
          >
            {q.listen ? (
              <>
                <Text style={[typography.subhead, { color: colors.danger }]}>
                  {tr('quiz.correctAnswerLabel')}
                </Text>
                <View style={styles.answerRow}>
                  <Text style={[typography.headline, styles.answerText, { color: t.text }]}>
                    {q.term.term}
                  </Text>
                  <SpeakButton text={q.term.term} accessibilityLabel={tr('speech.playTerm', { term: q.term.term })} />
                </View>
                <Text style={[typography.body, { color: t.textSecondary, marginTop: spacing.xs }]}>
                  {q.correctDefinition}
                </Text>
              </>
            ) : q.cloze ? (
              <>
                <Text style={[typography.subhead, { color: colors.danger }]}>
                  {tr('quiz.correctAnswerLabel')}
                </Text>
                <Text style={[typography.headline, { color: t.text, marginTop: spacing.xs, writingDirection: 'ltr' }]}>
                  {q.cloze.answerForm}
                </Text>
                <View style={styles.answerRow}>
                  <Text style={[typography.body, styles.answerText, { color: t.textSecondary, fontStyle: 'italic' }]}>
                    {q.term.translations.en.example}
                  </Text>
                  <SpeakButton text={q.term.translations.en.example} accessibilityLabel={tr('speech.playExample')} size={14} />
                </View>
              </>
            ) : (
              <>
                <Text style={[typography.subhead, { color: colors.danger }]}>
                  {tr('quiz.correctDefinitionLabel')}
                </Text>
                <Text style={[typography.body, { color: t.text, marginTop: spacing.xs }]}>
                  {q.correctDefinition}
                </Text>
              </>
            )}
            {!choice && q.sourceTerm && (
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

        {showSkipFeedback && (
          <Animated.View
            entering={FadeIn.duration(250)}
            style={[styles.correctionBox, { borderColor: accent, backgroundColor: accent + '10' }]}
          >
            {q.listen ? (
              <>
                <Text style={[typography.subhead, { color: accent }]}>
                  {tr('quiz.correctAnswerLabel')}
                </Text>
                <View style={styles.answerRow}>
                  <Text style={[typography.headline, styles.answerText, { color: t.text }]}>
                    {q.term.term}
                  </Text>
                  <SpeakButton text={q.term.term} accessibilityLabel={tr('speech.playTerm', { term: q.term.term })} />
                </View>
                <Text style={[typography.body, { color: t.text, marginTop: spacing.md }]}>
                  {tr('quiz.skipRealDefinition')}
                </Text>
                <Text style={[typography.body, { color: t.textSecondary, marginTop: spacing.xs, fontStyle: 'italic' }]}>
                  {q.correctDefinition}
                </Text>
              </>
            ) : q.cloze ? (
              <>
                <Text style={[typography.subhead, { color: accent }]}>
                  {tr('quiz.correctAnswerLabel')}
                </Text>
                <Text style={[typography.headline, { color: t.text, marginTop: spacing.xs, writingDirection: 'ltr' }]}>
                  {q.cloze.answerForm}
                </Text>
                <Text style={[typography.body, { color: t.textSecondary, marginTop: spacing.xs, fontStyle: 'italic', writingDirection: 'ltr' }]}>
                  {q.term.translations.en.example}
                </Text>
                <Text style={[typography.body, { color: t.text, marginTop: spacing.md }]}>
                  {tr('quiz.skipRealDefinition')}
                </Text>
                <Text style={[typography.body, { color: t.textSecondary, marginTop: spacing.xs, fontStyle: 'italic' }]}>
                  {q.correctDefinition}
                </Text>
              </>
            ) : q.isCorrect ? (
              <>
                <Text style={[typography.subhead, { color: colors.success }]}>
                  {tr('quiz.skipMatchCorrect')}
                </Text>
                <Text style={[typography.body, { color: t.text, marginTop: spacing.xs }]}>
                  {tr('quiz.skipRealDefinition')}
                </Text>
                <Text style={[typography.body, { color: t.textSecondary, marginTop: spacing.xs, fontStyle: 'italic' }]}>
                  {q.correctDefinition}
                </Text>
              </>
            ) : (
              <>
                <Text style={[typography.subhead, { color: colors.warning }]}>
                  {tr('quiz.skipMatchWrong')}
                </Text>
                {q.sourceTerm && (
                  <Text style={[typography.body, { color: t.textSecondary, marginTop: spacing.xs }]}>
                    {tr('quiz.skipBelongsTo', { term: q.sourceTerm.term })}
                  </Text>
                )}
                <Text style={[typography.body, { color: t.text, marginTop: spacing.md }]}>
                  {tr('quiz.skipRealDefinition')}
                </Text>
                <Text style={[typography.body, { color: t.textSecondary, marginTop: spacing.xs, fontStyle: 'italic' }]}>
                  {q.correctDefinition}
                </Text>
              </>
            )}
            <Animated.View style={[styles.gotItBtnWrap, gotItBtnStyle]}>
              <Pressable
                style={[styles.gotItBtn, { backgroundColor: accent }]}
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

      {/* Action buttons — hide when feedback is visible; cloze questions show their options in the scroll view */}
      {!choice && !showCorrection && !showSkipFeedback && (
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

      {Platform.OS === 'web' && (
        <Text style={[styles.shortcutHint, { color: t.textMuted }]}>
          {choice
            ? tr('shortcuts.quizChoiceHint', { max: choice.options.length })
            : tr('shortcuts.quizTrueFalseHint', { no: tr('quiz.false'), skip: tr('quiz.skip'), yes: tr('quiz.true') })}
        </Text>
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
  modePicker: {
    width: '100%',
    marginTop: spacing['2xl'],
    padding: spacing.xs,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  modeOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modeOptionDisabled: {
    opacity: 0.45,
  },
  modeNote: {
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  rateToggleWrap: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  listenPlay: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termSpeak: {
    alignItems: 'center',
    marginTop: -spacing.md,
    marginBottom: spacing.xl,
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  answerText: {
    flex: 1,
    writingDirection: 'ltr',
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
  clozeSentence: {
    ...typography.body,
    fontSize: 20,
    lineHeight: 30,
    textAlign: 'center',
    writingDirection: 'ltr',
  },
  clozeOptions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  clozeOption: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clozeSkip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
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
  shortcutHint: {
    ...typography.footnote,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
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
