import React, { useRef, useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, Dimensions, Pressable, ScrollView, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bookmark, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/lib/useTheme';
import { spacing, radius, typography } from '@/constants/theme';
import { getTermLanguage } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = spacing.xl;
const CARD_WIDTH = SCREEN_WIDTH - CARD_MARGIN * 2;

export default function SavedScreen() {
  const { colors: t, accent } = useTheme();
  const router = useRouter();
  const { t: tr } = useTranslation();
  const { getSavedTerms, language, toggleSave } = useAppStore();
  const saved = getSavedTerms();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / SCREEN_WIDTH);
    setActiveIndex(idx);
  }, []);

  const goTo = useCallback((dir: 'prev' | 'next') => {
    const next = dir === 'next'
      ? Math.min(activeIndex + 1, saved.length - 1)
      : Math.max(activeIndex - 1, 0);
    scrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
    setActiveIndex(next);
  }, [activeIndex, saved.length]);

  if (saved.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top']}>
        <View style={styles.header}>
          <Text style={[typography.largeTitle, { color: t.text }]}>{tr('saved.title')}</Text>
        </View>
        <View style={styles.emptyInner}>
          <Bookmark size={32} color={t.textMuted} strokeWidth={1} />
          <Text style={[typography.headline, { color: t.text, marginTop: spacing.xl }]}>
            {tr('saved.empty')}
          </Text>
          <Text style={[typography.callout, { color: t.textTertiary, textAlign: 'center', marginTop: spacing.sm }]}>
            {tr('saved.emptySub')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const current = saved[activeIndex];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={[typography.largeTitle, { color: t.text }]}>{tr('saved.title')}</Text>
          <Text style={[typography.callout, { color: t.textTertiary, marginTop: spacing.xs }]}>
            {activeIndex + 1} / {saved.length}
          </Text>
        </View>
        {current && (
          <Pressable
            onPress={() => toggleSave(current.id)}
            hitSlop={12}
            style={[styles.removeBtn, { borderColor: t.border }]}
          >
            <X size={14} color={t.textTertiary} strokeWidth={1.8} />
          </Pressable>
        )}
      </View>

      <View style={styles.carouselWrapper}>
        {saved.length > 1 && activeIndex > 0 && (
          <Pressable style={[styles.arrow, styles.arrowLeft]} onPress={() => goTo('prev')}>
            <ChevronLeft size={20} color={t.textTertiary} strokeWidth={1.5} />
          </Pressable>
        )}

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          scrollEventThrottle={16}
        >
          {saved.map((item) => {
            const translation = item.translations[getTermLanguage(language)];
            return (
              <Pressable
                key={item.id}
                style={[styles.card, { backgroundColor: t.bgElevated, borderColor: t.border }]}
                onPress={() => router.push(`/term/${item.id}`)}
              >
                <Text style={[typography.caption, { color: t.textTertiary }]}>
                  {item.tags[0]?.toUpperCase().replace(/-/g, ' ')}
                </Text>

                <Text style={[styles.termText, { color: t.text }]}>
                  {item.term}
                </Text>

                <View style={[styles.divider, { backgroundColor: t.border }]} />

                <Text
                  style={[typography.body, { color: t.textSecondary, lineHeight: 24 }]}
                  numberOfLines={6}
                >
                  {translation.definition}
                </Text>

                {translation.example ? (
                  <View style={[styles.exampleBox, { backgroundColor: t.bg, borderColor: t.border }]}>
                    <Text style={[typography.caption, { color: t.textTertiary, marginBottom: spacing.xs }]}>
                      {language === 'tr' ? 'ÖRNEK' : 'EXAMPLE'}
                    </Text>
                    <Text style={[typography.mono, { color: t.textSecondary }]} numberOfLines={3}>
                      {translation.example}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.dots}>
                  {[1, 2, 3].map((n) => (
                    <View
                      key={n}
                      style={[
                        styles.dot,
                        { backgroundColor: n <= item.difficulty ? t.textTertiary : t.bgSubtle },
                      ]}
                    />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {saved.length > 1 && activeIndex < saved.length - 1 && (
          <Pressable style={[styles.arrow, styles.arrowRight]} onPress={() => goTo('next')}>
            <ChevronRight size={20} color={t.textTertiary} strokeWidth={1.5} />
          </Pressable>
        )}
      </View>

      <View style={styles.pagination}>
        {saved.map((_, i) => (
          <View
            key={i}
            style={[
              styles.pageDot,
              { backgroundColor: i === activeIndex ? accent : t.bgSubtle },
            ]}
          />
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.xl,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    width: CARD_WIDTH,
    marginHorizontal: CARD_MARGIN,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing['2xl'],
    justifyContent: 'center',
  },
  termText: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: spacing.xl,
  },
  exampleBox: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 0.5,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.xl,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  arrow: {
    position: 'absolute',
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowLeft: { left: 4 },
  arrowRight: { right: 4 },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing['2xl'],
  },
  pageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  emptyInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['4xl'],
    paddingBottom: spacing['6xl'],
  },
});
