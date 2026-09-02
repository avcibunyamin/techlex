import React from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, Bookmark, BookmarkCheck, ArrowUpRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/lib/useTheme';
import { colors, spacing, radius, typography } from '@/constants/theme';

export default function TermDetail() {
  const { colors: t, accent } = useTheme();
  const router = useRouter();
  const { t: tr } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { terms, language, progress, toggleSave, savedTerms } = useAppStore();

  const term = terms.find(t => t.id === id);
  if (!term) return null;

  const isSaved = savedTerms.includes(term.id);
  const p = progress[term.id];
  const translation = term.translations[language];

  const relatedTermObjects = term.relatedTerms
    .map(rid => terms.find(t => t.id === rid))
    .filter(Boolean)
    .slice(0, 5);

  const difficultyKey = { 1: 'beginner', 2: 'intermediate', 3: 'advanced' }[term.difficulty] as string;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <X size={20} color={t.textSecondary} strokeWidth={1.5} />
        </Pressable>
        <Pressable onPress={() => toggleSave(term.id)} hitSlop={12}>
          {isSaved
            ? <BookmarkCheck size={20} color={accent} strokeWidth={1.8} />
            : <Bookmark size={20} color={t.textTertiary} strokeWidth={1.5} />
          }
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={[typography.caption, { color: t.textTertiary }]}>
          {term.tags[0]?.toUpperCase().replace(/-/g, ' ')}
        </Text>

        <Text style={[styles.termText, { color: t.text }]}>
          {term.term}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.difficultyDots}>
            {[1, 2, 3].map(d => (
              <View
                key={d}
                style={[
                  styles.dot,
                  { backgroundColor: d <= term.difficulty ? accent : t.bgSubtle },
                ]}
              />
            ))}
          </View>
          <Text style={[typography.footnote, { color: t.textTertiary }]}>
            {tr(`term.${difficultyKey}`)}
          </Text>
          {p && p.box >= 4 && (
            <Text style={[typography.footnote, { color: colors.success, marginLeft: spacing.md }]}>
              {tr('term.mastered')}
            </Text>
          )}
        </View>

        <View style={[styles.section, { borderColor: t.border }]}>
          <Text style={[typography.caption, { color: t.textTertiary, marginBottom: spacing.md }]}>
            {tr('term.definition')}
          </Text>
          <Text style={[typography.body, { color: t.text, lineHeight: 24 }]}>
            {translation.definition}
          </Text>
        </View>

        <View style={[styles.exampleBox, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
          <Text style={[typography.caption, { color: t.textTertiary, marginBottom: spacing.md }]}>
            {tr('term.example')}
          </Text>
          <Text style={[typography.mono, { color: t.textSecondary }]}>
            {translation.example}
          </Text>
        </View>

        <View style={styles.tagsRow}>
          {term.tags.map(tag => (
            <View key={tag} style={[styles.tagChip, { backgroundColor: t.bgSubtle }]}>
              <Text style={[typography.footnote, { color: t.textSecondary }]}>
                {tag.replace(/-/g, ' ')}
              </Text>
            </View>
          ))}
        </View>

        {relatedTermObjects.length > 0 && (
          <View style={[styles.section, { borderColor: t.border }]}>
            <Text style={[typography.caption, { color: t.textTertiary, marginBottom: spacing.lg }]}>
              {tr('term.relatedConcepts')}
            </Text>
            {relatedTermObjects.map(rel => (
              <Pressable
                key={rel!.id}
                style={[styles.relatedItem, { borderColor: t.border }]}
                onPress={() => router.push(`/term/${rel!.id}`)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[typography.subhead, { color: t.text }]}>{rel!.term}</Text>
                  <Text
                    style={[typography.footnote, { color: t.textTertiary }]}
                    numberOfLines={1}
                  >
                    {rel!.translations[language].definition}
                  </Text>
                </View>
                <ArrowUpRight size={14} color={t.textTertiary} strokeWidth={1.5} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.xl,
  },
  content: { padding: spacing.xl, paddingTop: 0, paddingBottom: spacing['6xl'] },
  termText: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  difficultyDots: { flexDirection: 'row', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  section: {
    marginTop: spacing['3xl'],
    paddingTop: spacing['2xl'],
    borderTopWidth: 0.5,
  },
  exampleBox: {
    marginTop: spacing['2xl'],
    padding: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 0.5,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing['2xl'],
  },
  tagChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  relatedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    gap: spacing.md,
  },
});
