import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, Platform } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  RefreshCw, CheckCircle, AlertCircle,
  Check, ArrowLeft, ArrowRight, Undo2,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Term, Language, UserProgress } from '@/types';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/lib/useTheme';
import { colors, spacing, radius, typography } from '@/constants/theme';
import SwipeCard, { SwipeCardRef } from './SwipeCard';
import PaywallModal from './PaywallModal';

const SWIPE_X_THRESHOLD = 90;
const PRESS_SPRING = { damping: 15, stiffness: 300 };

interface SwipeHistoryEntry {
  termId: string;
  direction: 'right' | 'left';
  previousProgress: UserProgress | null;
  wasReview: boolean;
}

interface CardDeckProps {
  terms: Term[];
  language: Language;
}

export default function CardDeck({ terms, language }: CardDeckProps) {
  const { colors: t, accent } = useTheme();
  const { t: tr } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const { swipeRight, swipeLeft, consumeEnergy, energyLevel, hasActivePremium, flushSwipeQueue, progress, undoSwipe } = useAppStore();

  const [showPaywall, setShowPaywall] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const cardRef = useRef<SwipeCardRef>(null);

  const [reviewQueue, setReviewQueue] = useState<Term[]>([]);
  const [deckTerms, setDeckTerms] = useState<Term[]>(terms);
  const [seenTermIds, setSeenTermIds] = useState<Set<string>>(new Set());
  const [swipeHistory, setSwipeHistory] = useState<SwipeHistoryEntry | null>(null);

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);

  const leftBtnScale = useSharedValue(1);
  const rightBtnScale = useSharedValue(1);
  const undoBtnScale = useSharedValue(1);

  const leftBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: leftBtnScale.value }],
  }));
  const rightBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rightBtnScale.value }],
  }));
  const undoBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: undoBtnScale.value }],
  }));

  const isPremium = hasActivePremium();
  const hasEnergy = isPremium || energyLevel > 0;

  const isReviewCard = useCallback((termId: string) => {
    return seenTermIds.has(termId);
  }, [seenTermIds]);

  // Reset when parent terms change
  useEffect(() => {
    setDeckTerms(terms);
    setCurrentIndex(0);
    setReviewQueue([]);
    setSeenTermIds(new Set());
    setSwipeHistory(null);
  }, [terms]);

  // Auto-feed review queue when deck is exhausted
  useEffect(() => {
    if (currentIndex >= deckTerms.length && deckTerms.length > 0 && reviewQueue.length > 0) {
      const timer = setTimeout(() => {
        const next = [...reviewQueue];
        setReviewQueue([]);
        setDeckTerms(next);
        setCurrentIndex(0);
        setSwipeHistory(null);
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, deckTerms.length, reviewQueue.length]);

  useEffect(() => {
    return () => { flushSwipeQueue(); };
  }, []);

  const showToast = useCallback((msg: string) => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const handleSwipeRight = useCallback(() => {
    if (currentIndex >= deckTerms.length) return;
    const term = deckTerms[currentIndex];
    const isReview = isReviewCard(term.id);

    if (!isReview) {
      const ok = consumeEnergy();
      if (!ok) { setShowPaywall(true); return; }
    }

    const prev = progress[term.id] ? { ...progress[term.id] } : null;
    setSwipeHistory({ termId: term.id, direction: 'right', previousProgress: prev, wasReview: isReview });

    swipeRight(term.id);
    setSeenTermIds(prev => new Set(prev).add(term.id));
    setCurrentIndex((i) => i + 1);
  }, [currentIndex, deckTerms, swipeRight, consumeEnergy, isReviewCard, progress]);

  const handleSwipeLeft = useCallback(() => {
    if (currentIndex >= deckTerms.length) return;
    const term = deckTerms[currentIndex];
    const isReview = isReviewCard(term.id);

    if (!isReview) {
      const ok = consumeEnergy();
      if (!ok) { setShowPaywall(true); return; }
    }

    const prev = progress[term.id] ? { ...progress[term.id] } : null;
    setSwipeHistory({ termId: term.id, direction: 'left', previousProgress: prev, wasReview: isReview });

    swipeLeft(term.id);
    setSeenTermIds(prev => new Set(prev).add(term.id));
    setReviewQueue((prev) => [...prev, term]);
    setCurrentIndex((i) => i + 1);
  }, [currentIndex, deckTerms, swipeLeft, consumeEnergy, isReviewCard, progress]);

  const handleSwipeBlocked = useCallback(() => {
    setShowPaywall(true);
  }, []);

  const animatingRef = useRef(false);

  const handleButtonSwipe = useCallback((direction: 'right' | 'left') => {
    if (currentIndex >= deckTerms.length || animatingRef.current) return;
    const term = deckTerms[currentIndex];
    const isReview = isReviewCard(term.id);

    if (!isReview) {
      const ok = consumeEnergy();
      if (!ok) { setShowPaywall(true); return; }
    }

    animatingRef.current = true;
    cardRef.current?.triggerSwipe(direction);

    const prev = progress[term.id] ? { ...progress[term.id] } : null;
    setSwipeHistory({ termId: term.id, direction, previousProgress: prev, wasReview: isReview });

    const delay = direction === 'right' ? 250 : 340;

    setTimeout(() => {
      if (direction === 'right') {
        swipeRight(term.id);
      } else {
        swipeLeft(term.id);
        setReviewQueue((prev) => [...prev, term]);
      }
      setSeenTermIds(prev => new Set(prev).add(term.id));
      setCurrentIndex((i) => i + 1);
      animatingRef.current = false;
    }, delay);
  }, [currentIndex, deckTerms, consumeEnergy, swipeRight, swipeLeft, isReviewCard, progress]);

  const handleUndo = useCallback(() => {
    if (!swipeHistory || currentIndex <= 0 || animatingRef.current) return;

    const entry = swipeHistory;
    undoSwipe(entry.termId, entry.direction, entry.previousProgress, entry.wasReview);

    setCurrentIndex((i) => i - 1);

    if (entry.direction === 'left') {
      setReviewQueue((prev) => {
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].id === entry.termId) {
            const copy = [...prev];
            copy.splice(i, 1);
            return copy;
          }
        }
        return prev;
      });
    }

    setSwipeHistory(null);
  }, [swipeHistory, currentIndex, undoSwipe]);

  const handleRestart = () => {
    setCurrentIndex(0);
    setReviewQueue([]);
    setDeckTerms(terms);
    setSeenTermIds(new Set());
    setSwipeHistory(null);
  };

  const isMobile = Platform.OS !== 'web';

  const leftHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragX.value, [-SWIPE_X_THRESHOLD, -20, 0], [1, 0.4, 0.15], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(dragX.value, [-SWIPE_X_THRESHOLD, 0], [1.1, 1], Extrapolation.CLAMP) }],
  }));

  const rightHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragX.value, [0, 20, SWIPE_X_THRESHOLD], [0.15, 0.4, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(dragX.value, [0, SWIPE_X_THRESHOLD], [1, 1.1], Extrapolation.CLAMP) }],
  }));

  if (deckTerms.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[typography.title, { color: t.text }]}>{tr('learn.completed')}</Text>
        <Text style={[typography.body, { color: t.textTertiary, textAlign: 'center', marginTop: spacing.sm }]}>
          {tr('learn.completedSub')}
        </Text>
      </View>
    );
  }

  if (currentIndex >= deckTerms.length) {
    if (reviewQueue.length > 0) {
      return (
        <GestureHandlerRootView style={styles.root}>
          <View style={styles.deck}>
            <Animated.View
              entering={FadeIn.duration(300)}
              style={[styles.reviewTransition, { backgroundColor: t.bgElevated, borderColor: colors.warning + '30' }]}
            >
              <RefreshCw size={24} color={colors.warning} strokeWidth={1.5} />
              <Text style={[typography.largeTitle, { color: colors.warning, marginTop: spacing.md }]}>
                {reviewQueue.length}
              </Text>
              <Text style={[typography.callout, { color: t.textTertiary, marginTop: spacing.xs }]}>
                {tr('learn.swipeLeft')}
              </Text>
            </Animated.View>
          </View>
        </GestureHandlerRootView>
      );
    }

    return (
      <View style={styles.empty}>
        <CheckCircle size={28} color={accent} strokeWidth={1.5} />
        <Text style={[typography.title, { color: t.text, marginTop: spacing.xl }]}>{tr('learn.completed')}</Text>
        <Text style={[typography.body, { color: t.textTertiary, textAlign: 'center', marginTop: spacing.sm }]}>
          {tr('learn.completedSub')}
        </Text>
        <Pressable style={[styles.restartBtn, { borderColor: t.border }]} onPress={handleRestart}>
          <RefreshCw size={14} color={accent} strokeWidth={1.8} />
          <Text style={[typography.subhead, { color: accent, marginLeft: spacing.sm }]}>{tr('learn.restart')}</Text>
        </Pressable>
      </View>
    );
  }

  const visible = deckTerms.slice(currentIndex, currentIndex + 3);

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.deck}>
        {isMobile && (
          <>
            <Animated.View style={[styles.hintLeft, leftHintStyle]} pointerEvents="none">
              <ArrowLeft size={14} color={colors.warning} strokeWidth={1.5} />
              <Text style={[styles.hintText, { color: colors.warning }]}>{tr('learn.swipeLeft')}</Text>
            </Animated.View>
            <Animated.View style={[styles.hintRight, rightHintStyle]} pointerEvents="none">
              <Text style={[styles.hintText, { color: colors.success }]}>{tr('learn.swipeRight')}</Text>
              <ArrowRight size={14} color={colors.success} strokeWidth={1.5} />
            </Animated.View>
          </>
        )}

        {visible
          .map((term, i) => (
            <SwipeCard
              ref={i === 0 ? cardRef : undefined}
              key={term.id}
              term={term}
              language={language}
              onSwipeRight={i === 0 ? handleSwipeRight : () => {}}
              onSwipeLeft={i === 0 ? handleSwipeLeft : () => {}}
              onSwipeBlocked={i === 0 ? handleSwipeBlocked : undefined}
              canSwipe={i === 0 ? (hasEnergy || isReviewCard(term.id)) : false}
              stackIndex={i}
              dragX={i === 0 ? dragX : undefined}
              dragY={i === 0 ? dragY : undefined}
            />
          ))
          .reverse()}
      </View>

      {/* Review stack indicator */}
      {reviewQueue.length > 0 && (
        <Animated.View
          entering={FadeIn.duration(250)}
          style={[styles.reviewStack, { backgroundColor: t.bgElevated, borderColor: colors.warning + '30' }]}
        >
          <RefreshCw size={14} color={colors.warning} strokeWidth={1.5} />
          <Text style={[styles.reviewStackText, { color: colors.warning }]}>
            {reviewQueue.length}
          </Text>
        </Animated.View>
      )}

      {/* Undo button */}
      {swipeHistory && currentIndex > 0 && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.undoContainer}>
          <Animated.View style={undoBtnStyle}>
            <Pressable
              style={[styles.undoBtn, { borderColor: t.border, backgroundColor: t.bgElevated }]}
              onPressIn={() => { undoBtnScale.value = withSpring(0.92, PRESS_SPRING); }}
              onPressOut={() => { undoBtnScale.value = withSpring(1, PRESS_SPRING); }}
              onPress={handleUndo}
            >
              <Undo2 size={14} color={t.textSecondary} strokeWidth={1.8} />
              <Text style={[styles.undoText, { color: t.textSecondary }]}>{tr('learn.undo')}</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        <Animated.View style={leftBtnStyle}>
          <Pressable
            style={[styles.actionBtn, { borderColor: colors.warning + '40' }]}
            onPressIn={() => { leftBtnScale.value = withSpring(0.92, PRESS_SPRING); }}
            onPressOut={() => { leftBtnScale.value = withSpring(1, PRESS_SPRING); }}
            onPress={() => handleButtonSwipe('left')}
          >
            <RefreshCw size={20} color={colors.warning} strokeWidth={2} />
            <Text style={[styles.actionLabel, { color: colors.warning }]}>{tr('learn.swipeLeft')}</Text>
          </Pressable>
        </Animated.View>

        <Animated.View style={rightBtnStyle}>
          <Pressable
            style={[styles.actionBtn, { borderColor: colors.success + '40' }]}
            onPressIn={() => { rightBtnScale.value = withSpring(0.92, PRESS_SPRING); }}
            onPressOut={() => { rightBtnScale.value = withSpring(1, PRESS_SPRING); }}
            onPress={() => handleButtonSwipe('right')}
          >
            <Check size={20} color={colors.success} strokeWidth={2} />
            <Text style={[styles.actionLabel, { color: colors.success }]}>{tr('learn.swipeRight')}</Text>
          </Pressable>
        </Animated.View>
      </View>

      {toast && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={[styles.toast, { backgroundColor: t.bgElevated, borderColor: t.border }]}
        >
          <AlertCircle size={14} color={colors.warning} strokeWidth={2} />
          <Text style={[typography.callout, { color: t.text, flex: 1 }]}>{toast}</Text>
        </Animated.View>
      )}

      <PaywallModal visible={showPaywall} onDismiss={() => setShowPaywall(false)} />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  deck: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['4xl'],
  },
  restartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing['2xl'],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderRadius: radius.sm,
  },

  reviewStack: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  reviewStackText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  reviewTransition: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing['3xl'],
    borderRadius: radius.xl,
    borderWidth: 1,
  },

  hintLeft: {
    position: 'absolute',
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    zIndex: -1,
  },
  hintRight: {
    position: 'absolute',
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    zIndex: -1,
  },
  hintText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  undoContainer: {
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
  },
  undoText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xl,
    paddingBottom: spacing['2xl'],
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  toast: {
    position: 'absolute',
    bottom: spacing['3xl'],
    left: spacing.xl,
    right: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
});
