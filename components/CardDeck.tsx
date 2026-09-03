import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, Platform } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  RefreshCw, CheckCircle, AlertCircle,
  Check, Bookmark, ArrowLeft, ArrowRight, ArrowUp,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Term, Language } from '@/types';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/lib/useTheme';
import { colors, spacing, radius, typography } from '@/constants/theme';
import SwipeCard, { SwipeCardRef } from './SwipeCard';
import PaywallModal from './PaywallModal';

const isWeb = Platform.OS === 'web';
const SWIPE_X_THRESHOLD = 90;
const SWIPE_Y_THRESHOLD = 120;

interface CardDeckProps {
  terms: Term[];
  language: Language;
}

export default function CardDeck({ terms, language }: CardDeckProps) {
  const { colors: t, accent } = useTheme();
  const { t: tr } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const { swipeRight, swipeLeft, toggleSave, savedTerms, consumeEnergy, energyLevel, hasActivePremium, flushSwipeQueue } = useAppStore();

  const [showPaywall, setShowPaywall] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const cardRef = useRef<SwipeCardRef>(null);

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);

  const isPremium = hasActivePremium();
  const hasEnergy = isPremium || energyLevel > 0;

  useEffect(() => {
    return () => {
      flushSwipeQueue();
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const handleSwipeRight = useCallback(() => {
    if (currentIndex >= terms.length) return;
    const ok = consumeEnergy();
    if (!ok) { setShowPaywall(true); return; }
    const termId = terms[currentIndex].id;
    swipeRight(termId);
    setCurrentIndex((i) => i + 1);
  }, [currentIndex, terms, swipeRight, consumeEnergy]);

  const handleSwipeLeft = useCallback(() => {
    if (currentIndex >= terms.length) return;
    const ok = consumeEnergy();
    if (!ok) { setShowPaywall(true); return; }
    const termId = terms[currentIndex].id;
    swipeLeft(termId);
    setCurrentIndex((i) => i + 1);
  }, [currentIndex, terms, swipeLeft, consumeEnergy]);

  const handleSwipeUp = useCallback(() => {
    if (currentIndex >= terms.length) return;
    const ok = consumeEnergy();
    if (!ok) { setShowPaywall(true); return; }
    const termId = terms[currentIndex].id;
    toggleSave(termId);
    swipeRight(termId);
    setCurrentIndex((i) => i + 1);
  }, [currentIndex, terms, toggleSave, swipeRight, consumeEnergy]);

  const handleSwipeBlocked = useCallback(() => {
    setShowPaywall(true);
  }, []);

  const handleWebSwipe = useCallback((direction: 'right' | 'left' | 'up') => {
    if (currentIndex >= terms.length) return;
    const ok = consumeEnergy();
    if (!ok) { setShowPaywall(true); return; }

    cardRef.current?.triggerSwipe(direction);

    const termId = terms[currentIndex].id;
    if (direction === 'up') {
      toggleSave(termId);
      swipeRight(termId);
    } else if (direction === 'right') {
      swipeRight(termId);
    } else {
      swipeLeft(termId);
    }
    setCurrentIndex((i) => i + 1);
  }, [currentIndex, terms, consumeEnergy, swipeRight, swipeLeft, toggleSave]);

  const handleRestart = () => setCurrentIndex(0);

  // Mobile hint animated styles
  const leftHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      dragX.value,
      [-SWIPE_X_THRESHOLD, -20, 0],
      [1, 0.4, 0.15],
      Extrapolation.CLAMP
    ),
    transform: [{
      scale: interpolate(
        dragX.value,
        [-SWIPE_X_THRESHOLD, 0],
        [1.1, 1],
        Extrapolation.CLAMP
      ),
    }],
  }));

  const rightHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      dragX.value,
      [0, 20, SWIPE_X_THRESHOLD],
      [0.15, 0.4, 1],
      Extrapolation.CLAMP
    ),
    transform: [{
      scale: interpolate(
        dragX.value,
        [0, SWIPE_X_THRESHOLD],
        [1, 1.1],
        Extrapolation.CLAMP
      ),
    }],
  }));

  const upHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      dragY.value,
      [-SWIPE_Y_THRESHOLD, -20, 0],
      [1, 0.4, 0.15],
      Extrapolation.CLAMP
    ),
    transform: [{
      scale: interpolate(
        dragY.value,
        [-SWIPE_Y_THRESHOLD, 0],
        [1.1, 1],
        Extrapolation.CLAMP
      ),
    }],
  }));

  if (terms.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[typography.title, { color: t.text }]}>
          {tr('learn.completed')}
        </Text>
        <Text style={[typography.body, { color: t.textTertiary, textAlign: 'center', marginTop: spacing.sm }]}>
          {tr('learn.completedSub')}
        </Text>
      </View>
    );
  }

  if (currentIndex >= terms.length) {
    return (
      <View style={styles.empty}>
        <CheckCircle size={28} color={accent} strokeWidth={1.5} />
        <Text style={[typography.title, { color: t.text, marginTop: spacing.xl }]}>
          {tr('learn.completed')}
        </Text>
        <Text style={[typography.body, { color: t.textTertiary, textAlign: 'center', marginTop: spacing.sm }]}>
          {tr('learn.completedSub')}
        </Text>
        <Pressable style={[styles.restartBtn, { borderColor: t.border }]} onPress={handleRestart}>
          <RefreshCw size={14} color={accent} strokeWidth={1.8} />
          <Text style={[typography.subhead, { color: accent, marginLeft: spacing.sm }]}>
            {tr('learn.restart')}
          </Text>
        </Pressable>
      </View>
    );
  }

  const visible = terms.slice(currentIndex, currentIndex + 3);

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.deck}>
        {/* Mobile swipe hints */}
        {!isWeb && (
          <>
            <Animated.View style={[styles.hintLeft, leftHintStyle]} pointerEvents="none">
              <ArrowLeft size={14} color={colors.danger} strokeWidth={1.5} />
              <Text style={[styles.hintText, { color: colors.danger }]}>
                {tr('learn.swipeLeft')}
              </Text>
            </Animated.View>

            <Animated.View style={[styles.hintRight, rightHintStyle]} pointerEvents="none">
              <Text style={[styles.hintText, { color: colors.success }]}>
                {tr('learn.swipeRight')}
              </Text>
              <ArrowRight size={14} color={colors.success} strokeWidth={1.5} />
            </Animated.View>

            <Animated.View style={[styles.hintUp, upHintStyle]} pointerEvents="none">
              <ArrowUp size={14} color={accent} strokeWidth={1.5} />
              <Text style={[styles.hintText, { color: accent }]}>
                {tr('learn.swipeSave')}
              </Text>
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
              onSwipeUp={i === 0 ? handleSwipeUp : () => {}}
              onSwipeBlocked={i === 0 ? handleSwipeBlocked : undefined}
              canSwipe={i === 0 ? hasEnergy : false}
              isSaved={savedTerms.includes(term.id)}
              stackIndex={i}
              dragX={i === 0 ? dragX : undefined}
              dragY={i === 0 ? dragY : undefined}
            />
          ))
          .reverse()}
      </View>

      {/* Web action buttons */}
      {isWeb && (
        <View style={styles.webActions}>
          <Pressable
            style={[styles.webBtn, styles.webBtnLeft, { borderColor: colors.danger + '40' }]}
            onPress={() => handleWebSwipe('left')}
          >
            <RefreshCw size={20} color={colors.danger} strokeWidth={2} />
            <Text style={[styles.webBtnLabel, { color: colors.danger }]}>
              {tr('learn.swipeLeft')}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.webBtn, styles.webBtnUp, { borderColor: accent + '40' }]}
            onPress={() => handleWebSwipe('up')}
          >
            <Bookmark size={20} color={accent} strokeWidth={2} />
            <Text style={[styles.webBtnLabel, { color: accent }]}>
              {tr('learn.swipeSave')}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.webBtn, styles.webBtnRight, { borderColor: colors.success + '40' }]}
            onPress={() => handleWebSwipe('right')}
          >
            <Check size={20} color={colors.success} strokeWidth={2} />
            <Text style={[styles.webBtnLabel, { color: colors.success }]}>
              {tr('learn.swipeRight')}
            </Text>
          </Pressable>
        </View>
      )}

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

      <PaywallModal
        visible={showPaywall}
        onDismiss={() => setShowPaywall(false)}
      />
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

  // Mobile hints
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
  hintUp: {
    position: 'absolute',
    top: spacing.md,
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

  // Web buttons
  webActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xl,
    paddingBottom: spacing['2xl'],
  },
  webBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
  },
  webBtnLeft: {},
  webBtnUp: {},
  webBtnRight: {},
  webBtnLabel: {
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
