import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, Text, Pressable, AppState, AppStateStatus } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings2, Zap, Infinity } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/lib/useTheme';
import { colors, spacing, typography } from '@/constants/theme';
import CardDeck from '@/components/CardDeck';

export default function LearnScreen() {
  const { colors: t, accent } = useTheme();
  const router = useRouter();
  const { t: tr } = useTranslation();
  const { language, getTermsForReview, selectedTags, todayCount, energyLevel, hasActivePremium, progress, flushSwipeQueue } = useAppStore();

  const terms = useMemo(() => getTermsForReview(), [selectedTags, progress]);
  const isPremium = hasActivePremium();

  useEffect(() => {
    const handler = (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        useAppStore.getState().flushSwipeQueue();
      }
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.largeTitle, { color: t.text }]}>{tr('learn.title')}</Text>
          <Text style={[typography.callout, { color: t.textTertiary, marginTop: spacing.xs }]}>
            {terms.length} {tr('learn.review').toLowerCase()}
            {todayCount > 0 ? `  ·  ${todayCount} ${tr('profile.today').toLowerCase()}` : ''}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <View style={[styles.energyChip, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
            {isPremium
              ? <Infinity size={14} color={accent} strokeWidth={1.8} />
              : <Zap size={14} color={energyLevel > 0 ? colors.warning : colors.danger} strokeWidth={1.8} />}
            <Text style={[typography.subhead, {
              color: energyLevel > 0 || isPremium ? t.text : colors.danger,
              fontWeight: '600',
            }]}>
              {isPremium ? '' : `${energyLevel}/30`}
            </Text>
          </View>

          <Pressable onPress={() => router.push('/(tabs)/explore')} hitSlop={12}>
            <Settings2 size={20} color={t.textTertiary} strokeWidth={1.5} />
          </Pressable>
        </View>
      </View>

      <CardDeck terms={terms} language={language} />
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
    paddingBottom: spacing.md,
    zIndex: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  energyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 0.5,
  },
});
