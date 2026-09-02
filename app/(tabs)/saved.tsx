import React from 'react';
import { StyleSheet, Text, View, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bookmark, ArrowUpRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/lib/useTheme';
import { spacing, typography } from '@/constants/theme';

export default function SavedScreen() {
  const { colors: t } = useTheme();
  const router = useRouter();
  const { t: tr } = useTranslation();
  const { getSavedTerms, language } = useAppStore();
  const saved = getSavedTerms();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[typography.largeTitle, { color: t.text }]}>{tr('saved.title')}</Text>
        {saved.length > 0 && (
          <Text style={[typography.callout, { color: t.textTertiary }]}>
            {saved.length} {tr('explore.categories').toLowerCase()}
          </Text>
        )}
      </View>

      <FlatList
        data={saved}
        keyExtractor={item => item.id}
        contentContainerStyle={saved.length === 0 ? styles.emptyContainer : styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.item, { borderColor: t.border }]}
            onPress={() => router.push(`/term/${item.id}`)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: t.textTertiary }]}>
                {item.tags[0]?.toUpperCase().replace(/-/g, ' ')}
              </Text>
              <Text style={[typography.headline, { color: t.text, marginTop: spacing.xs }]}>
                {item.term}
              </Text>
              <Text
                style={[typography.callout, { color: t.textSecondary, marginTop: spacing.xs }]}
                numberOfLines={1}
              >
                {item.translations[language].definition}
              </Text>
            </View>
            <ArrowUpRight size={16} color={t.textTertiary} strokeWidth={1.5} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyInner}>
            <Bookmark size={32} color={t.textMuted} strokeWidth={1} />
            <Text style={[typography.headline, { color: t.text, marginTop: spacing.xl }]}>
              {tr('saved.empty')}
            </Text>
            <Text style={[typography.callout, { color: t.textTertiary, textAlign: 'center', marginTop: spacing.sm }]}>
              {tr('saved.emptySub')}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: spacing.xl, gap: spacing.xs },
  list: { padding: spacing.xl, paddingTop: 0, paddingBottom: spacing['6xl'] },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderBottomWidth: 0.5,
    gap: spacing.md,
  },
  emptyContainer: { flex: 1 },
  emptyInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['4xl'],
    paddingBottom: spacing['6xl'],
  },
});
