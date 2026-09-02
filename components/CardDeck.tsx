import React, { useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Term, Language } from '@/types';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/lib/useTheme';
import { colors, spacing, radius, typography } from '@/constants/theme';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import SwipeCard from './SwipeCard';
import PaywallModal from './PaywallModal';

interface CardDeckProps {
  terms: Term[];
  language: Language;
}

export default function CardDeck({ terms, language }: CardDeckProps) {
  const { colors: t, accent } = useTheme();
  const { t: tr } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const { swipeRight, swipeLeft, toggleSave, savedTerms, progress, consumeEnergy, energyLevel, hasActivePremium } = useAppStore();

  const [showPaywall, setShowPaywall] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const isPremium = hasActivePremium();
  const hasEnergy = isPremium || energyLevel > 0;

  const showToast = useCallback((msg: string) => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const syncSwipeToCloud = useCallback(async (direction: 'right' | 'left', termId: string) => {
    if (!isPremium || !isSupabaseConfigured) return;
    const rpc = direction === 'right' ? 'swipe_right' : 'swipe_left';
    const { error } = await getSupabase().rpc(rpc, { p_term_id: termId });
    if (error) {
      if (direction === 'right') {
        useAppStore.setState((s) => ({ energyLevel: Math.min(s.energyLevel + 1, 30) }));
      }
      showToast(tr('energyModal.connectionError'));
    }
  }, [isPremium, showToast, tr]);

  const consumeWithRollback = useCallback(async () => {
    if (isPremium) return;
    if (isSupabaseConfigured) {
      const { error } = await getSupabase().rpc('consume_energy');
      if (error) {
        useAppStore.setState((s) => ({ energyLevel: Math.min(s.energyLevel + 1, 30) }));
        showToast(tr('energyModal.connectionError'));
      }
    }
  }, [isPremium, showToast, tr]);

  const handleSwipeRight = useCallback(() => {
    if (currentIndex >= terms.length) return;
    const ok = consumeEnergy();
    if (!ok) { setShowPaywall(true); return; }
    const termId = terms[currentIndex].id;
    swipeRight(termId);
    setCurrentIndex((i) => i + 1);
    syncSwipeToCloud('right', termId);
    consumeWithRollback();
  }, [currentIndex, terms, swipeRight, consumeEnergy, syncSwipeToCloud, consumeWithRollback]);

  const handleSwipeLeft = useCallback(() => {
    if (currentIndex >= terms.length) return;
    const ok = consumeEnergy();
    if (!ok) { setShowPaywall(true); return; }
    const termId = terms[currentIndex].id;
    swipeLeft(termId);
    setCurrentIndex((i) => i + 1);
    syncSwipeToCloud('left', termId);
    consumeWithRollback();
  }, [currentIndex, terms, swipeLeft, consumeEnergy, syncSwipeToCloud, consumeWithRollback]);

  const handleSwipeUp = useCallback(() => {
    if (currentIndex >= terms.length) return;
    toggleSave(terms[currentIndex].id);
  }, [currentIndex, terms, toggleSave]);

  const handleSwipeBlocked = useCallback(() => {
    setShowPaywall(true);
  }, []);

  const handleRestart = () => setCurrentIndex(0);

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
        {visible
          .map((term, i) => (
            <SwipeCard
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
            />
          ))
          .reverse()}
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
