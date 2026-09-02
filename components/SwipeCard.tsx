import React, { useRef, useCallback, useEffect } from 'react';
import { StyleSheet, Text, View, Dimensions, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Bookmark, BookmarkCheck } from 'lucide-react-native';
import { Term, Language } from '@/types';
import { colors as palette, spacing, radius, typography } from '@/constants/theme';
import { useTheme } from '@/lib/useTheme';
import { getCategoryByTag } from '@/data/categories';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_X_THRESHOLD = SCREEN_WIDTH * 0.28;
const SWIPE_Y_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 800;
const CARD_WIDTH = SCREEN_WIDTH - 48;

interface SwipeCardProps {
  term: Term;
  language: Language;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onSwipeUp: () => void;
  onSwipeBlocked?: () => void;
  canSwipe?: boolean;
  isSaved?: boolean;
  onRelatedTermPress?: (term: string) => void;
  stackIndex: number;
}

export default function SwipeCard({
  term,
  language,
  onSwipeRight,
  onSwipeLeft,
  onSwipeUp,
  onSwipeBlocked,
  canSwipe = true,
  isSaved = false,
  onRelatedTermPress,
  stackIndex,
}: SwipeCardProps) {
  const { colors: t, accent } = useTheme();
  const flipped = useRef(false);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const flipProgress = useSharedValue(0);
  const canSwipeShared = useSharedValue(canSwipe ? 1 : 0);

  useEffect(() => {
    canSwipeShared.value = canSwipe ? 1 : 0;
  }, [canSwipe, canSwipeShared]);

  const toggleFlip = useCallback(() => {
    flipped.current = !flipped.current;
    flipProgress.value = withSpring(flipped.current ? 1 : 0, {
      damping: 18,
      stiffness: 180,
      mass: 0.8,
    });
  }, [flipProgress]);

  const isTopCard = stackIndex === 0;

  const pan = Gesture.Pan()
    .enabled(isTopCard)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
      rotation.value = interpolate(
        e.translationX,
        [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
        [-12, 0, 12],
        Extrapolation.CLAMP
      );
    })
    .onEnd((e) => {
      const swipedUp =
        e.translationY < -SWIPE_Y_THRESHOLD ||
        (e.velocityY < -VELOCITY_THRESHOLD && e.translationY < -40);
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
      } else if (swipedUp) {
        translateY.value = withTiming(-SCREEN_HEIGHT, { duration: 350 });
        runOnJS(onSwipeUp)();
      } else if (swipedRight) {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 280 });
        rotation.value = withTiming(20, { duration: 280 });
        runOnJS(onSwipeRight)();
      } else if (swipedLeft) {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 280 });
        rotation.value = withTiming(-20, { duration: 280 });
        runOnJS(onSwipeLeft)();
      } else {
        translateX.value = withSpring(0, { damping: 14, stiffness: 120 });
        translateY.value = withSpring(0, { damping: 14, stiffness: 120 });
        rotation.value = withSpring(0, { damping: 14, stiffness: 120 });
      }
    });

  const tap = Gesture.Tap()
    .enabled(isTopCard)
    .onEnd(() => {
      runOnJS(toggleFlip)();
    });

  const gesture = Gesture.Race(pan, tap);

  const stackScale = 1 - stackIndex * 0.04;
  const stackOffset = stackIndex * 8;

  const containerAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value + stackOffset },
      { rotate: `${rotation.value}deg` },
      { scale: stackScale },
    ],
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

  const upTint = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [-SWIPE_Y_THRESHOLD, 0],
      [0.12, 0],
      Extrapolation.CLAMP
    ),
  }));

  const translation = term.translations[language];
  const primaryTag = term.tags[0];
  const cat = primaryTag ? getCategoryByTag(primaryTag) : undefined;
  const categoryLabel = cat?.name[language] ?? primaryTag?.replace(/-/g, ' ') ?? '';

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.container, containerAnimStyle]}>
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: t.bgElevated, borderColor: t.border },
            frontStyle,
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.categoryLabel, { color: t.textTertiary }]}>
              {categoryLabel.toUpperCase()}
            </Text>
            {isSaved ? (
              <BookmarkCheck size={18} color={accent} strokeWidth={1.5} />
            ) : (
              <Bookmark size={18} color={t.textMuted} strokeWidth={1.5} />
            )}
          </View>

          <View style={styles.frontCenter}>
            <Text style={[styles.termText, { color: t.text }]}>
              {term.term}
            </Text>
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
            { backgroundColor: t.bgElevated, borderColor: t.border },
            backAnimStyle,
          ]}
        >
          <Text style={[styles.backTitle, { color: t.text }]}>
            {term.term}
          </Text>
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
                <Text style={[styles.codeLabel, { color: t.textTertiary }]}>
                  {language === 'tr' ? 'ÖRNEK' : 'EXAMPLE'}
                </Text>
                <Text style={[styles.codeText, { color: t.textSecondary }]}>
                  {translation.example}
                </Text>
              </View>
            ) : null}

            {term.relatedTerms.length > 0 ? (
              <View style={styles.chips}>
                {term.relatedTerms.slice(0, 4).map((rt) => (
                  <Pressable
                    key={rt}
                    style={[styles.chip, { borderColor: t.border }]}
                    onPress={() => onRelatedTermPress?.(rt)}
                  >
                    <Text style={[styles.chipText, { color: t.textTertiary }]}>
                      {rt}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </Animated.View>

        <Animated.View
          style={[styles.tint, { backgroundColor: palette.success }, rightTint]}
          pointerEvents="none"
        />
        <Animated.View
          style={[styles.tint, { backgroundColor: palette.danger }, leftTint]}
          pointerEvents="none"
        />
        <Animated.View
          style={[styles.tint, { backgroundColor: accent }, upTint]}
          pointerEvents="none"
        />
      </Animated.View>
    </GestureDetector>
  );
}

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
  backTitle: {
    ...typography.headline,
    marginBottom: spacing.md,
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
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
