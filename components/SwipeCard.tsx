import React, { useRef, useState, useCallback, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import { StyleSheet, Text, View, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Term, Language, getTermLanguage } from '@/types';
import { colors as palette, spacing, radius, typography } from '@/constants/theme';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/lib/useTheme';
import { getCategoryByTag } from '@/data/categories';
import { findPackById } from '@/data/packs';
import { useAppStore } from '@/lib/store';
import { toLocaleUpper } from '@/lib/text-utils';
import { useTranslation } from 'react-i18next';
import SpeakButton from './SpeakButton';

// A tap on a speaker button must not also flip the card (the card tap gesture still fires).
const SPEAK_TAP_GUARD_MS = 500;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_X_THRESHOLD = SCREEN_WIDTH * 0.28;
const SWIPE_Y_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 800;
const MAX_CARD_WIDTH = 600;
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 48, MAX_CARD_WIDTH);

export interface SwipeCardRef {
  triggerSwipe: (direction: 'right' | 'left') => void;
  flip: () => void;
}

interface SwipeCardProps {
  term: Term;
  language: Language;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onSwipeBlocked?: () => void;
  canSwipe?: boolean;
  stackIndex: number;
  dragX?: SharedValue<number>;
  dragY?: SharedValue<number>;
  isReviewMode?: boolean;
}

const SwipeCard = forwardRef<SwipeCardRef, SwipeCardProps>(function SwipeCard(
  {
    term,
    language,
    onSwipeRight,
    onSwipeLeft,
    onSwipeBlocked,
    canSwipe = true,
    stackIndex,
    dragX,
    dragY,
    isReviewMode = false,
  },
  ref
) {
  const { colors: t, accent } = useTheme();
  const { t: tr, i18n } = useTranslation();
  const getTermById = useAppStore((s) => s.getTermById);
  const flipped = useRef(false);
  // Mirrors `flipped` for render: only the visible face takes touches.
  const [isFlipped, setIsFlipped] = useState(false);
  const speakPressedAt = useRef(0);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const flipProgress = useSharedValue(0);
  const cardScale = useSharedValue(1);
  const cardOpacity = useSharedValue(1);
  const canSwipeShared = useSharedValue(canSwipe ? 1 : 0);

  useEffect(() => {
    canSwipeShared.value = canSwipe ? 1 : 0;
  }, [canSwipe, canSwipeShared]);

  const toggleFlip = useCallback(() => {
    haptic.light();
    flipped.current = !flipped.current;
    setIsFlipped(flipped.current);
    flipProgress.value = withSpring(flipped.current ? 1 : 0, {
      damping: 18,
      stiffness: 180,
      mass: 0.8,
    });
  }, [flipProgress]);

  const handleTapFlip = useCallback(() => {
    if (Date.now() - speakPressedAt.current < SPEAK_TAP_GUARD_MS) return;
    toggleFlip();
  }, [toggleFlip]);

  const markSpeakPress = useCallback(() => {
    speakPressedAt.current = Date.now();
  }, []);

  useImperativeHandle(ref, () => ({
    flip: toggleFlip,
    triggerSwipe(direction: 'right' | 'left') {
      if (direction === 'right') {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 280 });
        rotation.value = withTiming(20, { duration: 280 });
      } else {
        translateX.value = withTiming(-160, { duration: 380 });
        translateY.value = withTiming(180, { duration: 380 });
        rotation.value = withTiming(-10, { duration: 380 });
        cardScale.value = withTiming(0.55, { duration: 380 });
        cardOpacity.value = withTiming(0, { duration: 440 });
      }
    },
  }), [translateX, translateY, rotation, cardScale, cardOpacity, toggleFlip]);

  const isTopCard = stackIndex === 0;

  const pan = Gesture.Pan()
    .enabled(isTopCard)
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
      rotation.value = interpolate(
        e.translationX,
        [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
        [-12, 0, 12],
        Extrapolation.CLAMP
      );
      if (dragX) dragX.value = e.translationX;
      if (dragY) dragY.value = e.translationY;
    })
    .onEnd((e) => {
      if (dragX) dragX.value = withTiming(0, { duration: 200 });
      if (dragY) dragY.value = withTiming(0, { duration: 200 });

      const swipedRight =
        e.translationX > SWIPE_X_THRESHOLD || e.velocityX > VELOCITY_THRESHOLD;
      const swipedLeft =
        e.translationX < -SWIPE_X_THRESHOLD || e.velocityX < -VELOCITY_THRESHOLD;

      const blocked = canSwipeShared.value === 0 && (swipedRight || swipedLeft);

      if (blocked) {
        translateX.value = withSpring(0, { damping: 18, stiffness: 200 });
        translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
        rotation.value = withSpring(0, { damping: 18, stiffness: 200 });
        if (onSwipeBlocked) runOnJS(onSwipeBlocked)();
        runOnJS(haptic.error)();
      } else if (swipedRight) {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 280 });
        rotation.value = withTiming(20, { duration: 280 });
        runOnJS(onSwipeRight)();
        runOnJS(haptic.success)();
      } else if (swipedLeft) {
        translateX.value = withTiming(-160, { duration: 380 });
        translateY.value = withTiming(180, { duration: 380 });
        rotation.value = withTiming(-10, { duration: 380 });
        cardScale.value = withTiming(0.55, { duration: 380 });
        cardOpacity.value = withTiming(0, { duration: 440 });
        runOnJS(onSwipeLeft)();
        runOnJS(haptic.medium)();
      } else {
        translateX.value = withSpring(0, { damping: 14, stiffness: 120 });
        translateY.value = withSpring(0, { damping: 14, stiffness: 120 });
        rotation.value = withSpring(0, { damping: 14, stiffness: 120 });
        cardScale.value = withSpring(1, { damping: 14, stiffness: 120 });
        cardOpacity.value = withSpring(1, { damping: 14, stiffness: 120 });
      }
    });

  const tap = Gesture.Tap()
    .enabled(isTopCard)
    .onEnd(() => {
      runOnJS(handleTapFlip)();
    });

  const gesture = Gesture.Race(pan, tap);

  const stackScale = 1 - stackIndex * 0.04;
  const stackOffset = stackIndex * 8;

  const containerAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value + stackOffset },
      { rotate: `${rotation.value}deg` },
      { scale: stackScale * cardScale.value },
    ],
    opacity: cardOpacity.value,
  }));

  const frontStyle = useAnimatedStyle(() => {
    const ry = interpolate(flipProgress.value, [0, 1], [0, 180]);
    return {
      transform: [{ perspective: 1200 }, { rotateY: `${ry}deg` }],
      backfaceVisibility: 'hidden' as const,
    };
  });

  const backAnimStyle = useAnimatedStyle(() => {
    const ry = interpolate(flipProgress.value, [0, 1], [180, 360]);
    return {
      transform: [{ perspective: 1200 }, { rotateY: `${ry}deg` }],
      backfaceVisibility: 'hidden' as const,
    };
  });

  const rightTint = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_X_THRESHOLD],
      [0, 0.12],
      Extrapolation.CLAMP
    ),
  }));

  const leftTint = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_X_THRESHOLD, 0],
      [0.12, 0],
      Extrapolation.CLAMP
    ),
  }));

  const tl = getTermLanguage(language);
  const translation = term.translations[tl];
  const primaryTag = term.tags[0];
  const cat = primaryTag ? getCategoryByTag(primaryTag) : undefined;
  const pack = !cat && primaryTag ? findPackById(primaryTag) : undefined;
  const categoryLabel = cat
    ? cat.name[tl]
    : primaryTag && i18n.exists(`categories.${primaryTag}`)
      ? tr(`categories.${primaryTag}`)
      : pack?.title[tl] ?? primaryTag?.replace(/-/g, ' ') ?? '';

  const resolvedRelatedTerms = useMemo(
    () =>
      Array.from(new Set(term.relatedTerms))
        .slice(0, 6)
        .map((rt) => getTermById(rt))
        .filter((item): item is Term => Boolean(item)),
    [term.relatedTerms, getTermById]
  );

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.container, containerAnimStyle]}>
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: t.bgElevated, borderColor: isReviewMode ? palette.warning + '60' : t.border },
            isReviewMode && { borderWidth: 1.5 },
            frontStyle,
          ]}
          pointerEvents={isFlipped ? 'none' : 'auto'}
        >
          <View style={styles.header}>
            {isReviewMode && (
              <View style={styles.reviewBadge}>
                <Text style={styles.reviewBadgeText}>{tr('learn.review')}</Text>
              </View>
            )}
            <Text style={[styles.categoryLabel, { color: t.textTertiary }]}>
              {toLocaleUpper(categoryLabel, language)}
            </Text>
          </View>

          <View style={styles.frontCenter}>
            <Text style={[styles.termText, { color: t.text }]}>
              {term.term}
            </Text>
            {isTopCard && (
              <View style={styles.frontSpeak}>
                <SpeakButton
                  text={term.term}
                  accessibilityLabel={tr('speech.playTerm', { term: term.term })}
                  onPressIn={markSpeakPress}
                />
              </View>
            )}
          </View>

          <View style={styles.frontFooter}>
            <View style={styles.dots}>
              {[1, 2, 3].map((n) => (
                <View
                  key={n}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        n <= term.difficulty ? t.textTertiary : t.bgSubtle,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            styles.backFace,
            { backgroundColor: t.bgElevated, borderColor: isReviewMode ? palette.warning + '60' : t.border },
            isReviewMode && { borderWidth: 1.5 },
            backAnimStyle,
          ]}
          pointerEvents={isFlipped ? 'auto' : 'none'}
        >
          <View style={styles.backTitleRow}>
            <Text style={[styles.backTitle, styles.backTitleText, { color: t.text }]}>
              {term.term}
            </Text>
            {isTopCard && (
              <SpeakButton
                text={term.term}
                accessibilityLabel={tr('speech.playTerm', { term: term.term })}
                onPressIn={markSpeakPress}
              />
            )}
          </View>
          <View style={[styles.divider, { backgroundColor: t.border }]} />

            <View style={styles.backContent}>
              <Text style={[styles.definition, { color: t.textSecondary }]}>
                {translation.definition}
              </Text>

              {translation.example ? (
                <View
                  style={[
                    styles.codeBlock,
                    { backgroundColor: t.bg, borderColor: t.border },
                  ]}
                >
                  <View style={styles.codeLabelRow}>
                    <Text style={[styles.codeLabel, { color: t.textTertiary }]}>
                      {tr('term.example')}
                    </Text>
                    {/* The TR example starts with the English sentence, so English is what gets read. */}
                    {isTopCard && term.translations.en.example ? (
                      <SpeakButton
                        text={term.translations.en.example}
                        accessibilityLabel={tr('speech.playExample')}
                        size={14}
                        onPressIn={markSpeakPress}
                      />
                    ) : null}
                  </View>
                  <Text style={[styles.codeText, { color: t.textSecondary }]}>
                    {translation.example}
                  </Text>
                </View>
              ) : null}

              {resolvedRelatedTerms.length > 0 && (
                <View style={styles.relatedSection}>
                  <Text style={[styles.relatedTitle, { color: t.textTertiary }]}>
                    {tr('term.relatedTerms')}
                  </Text>
                  <View style={styles.chipRow}>
                    {resolvedRelatedTerms.map((related) => (
                      <View key={related.id} style={[styles.passiveChip, { backgroundColor: t.bgSubtle }]}>
                        <Text style={[styles.chipText, { color: t.textSecondary }]}>
                          #{related.term}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
        </Animated.View>

        <Animated.View
          style={[styles.tint, { backgroundColor: palette.success }, rightTint]}
          pointerEvents="none"
        />
        <Animated.View
          style={[styles.tint, { backgroundColor: palette.warning }, leftTint]}
          pointerEvents="none"
        />
      </Animated.View>
    </GestureDetector>
  );
});

export default SwipeCard;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: CARD_WIDTH,
    alignSelf: 'center',
  },
  card: {
    width: '100%',
    minHeight: 400,
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
  backFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  reviewBadge: {
    backgroundColor: palette.warning + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  reviewBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: palette.warning,
  },
  frontCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  termText: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
    lineHeight: 38,
  },
  frontFooter: {
    alignItems: 'flex-start',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  frontSpeak: {
    marginTop: spacing.lg,
  },
  backTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  backTitle: {
    ...typography.headline,
    marginBottom: spacing.md,
  },
  backTitleText: {
    flexShrink: 1,
    marginBottom: 0,
  },
  codeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: spacing.lg,
  },
  backContent: {
    flex: 1,
  },
  definition: {
    ...typography.body,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  codeBlock: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  codeText: {
    ...typography.mono,
  },
  relatedSection: {
    gap: spacing.xs,
  },
  relatedTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  passiveChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '500',
  },
  tint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.xl,
  },
});
