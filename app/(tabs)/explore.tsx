import React, { useState, useMemo, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X, ChevronRight, ArrowUpRight, Shuffle, Check } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/lib/useTheme';
import { colors, spacing, radius, typography } from '@/constants/theme';
import { categories, Category, getAllTags, findCategoryById, getDescendantIds, findParentCategory } from '@/data/categories';
import { Term, Language, getTermLanguage } from '@/types';

function getCategoryLabel(category: Category, language: Language): string {
  const tl = getTermLanguage(language);
  const other = tl === 'tr' ? 'en' : 'tr';
  const primary = category.name[tl];
  const secondary = category.name[other];
  if (primary === secondary) return primary;
  const primaryBase = primary.split('(')[0].trim();
  const secondaryBase = secondary.split('(')[0].trim();
  if (primaryBase === secondaryBase) return primary;
  return `${primary} (${secondary})`;
}

function CategoryCheckbox({
  category,
  depth,
  language,
  selectedIds,
  onToggle,
  t,
  accent,
}: {
  category: Category;
  depth: number;
  language: Language;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  t: ReturnType<typeof useTheme>['colors'];
  accent: string;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasSubs = category.subcategories && category.subcategories.length > 0;
  const isSelected = selectedIds.has(category.id);

  return (
    <View style={{ marginLeft: depth > 0 ? spacing.xl : 0 }}>
      <Pressable
        style={[styles.nodeRow, { borderColor: t.border }]}
        onPress={() => onToggle(category.id)}
      >
        {depth > 0 && (
          <View style={[styles.treeLine, { backgroundColor: t.border }]} />
        )}

        <View style={[
          styles.checkbox,
          {
            borderColor: isSelected ? accent : t.textTertiary,
            backgroundColor: isSelected ? accent : 'transparent',
          },
        ]}>
          {isSelected && <Check size={10} color="#fff" strokeWidth={3} />}
        </View>

        <View style={[styles.nodeDot, { backgroundColor: category.color }]} />
        <Text style={[
          depth === 0 ? typography.headline : typography.subhead,
          { color: t.text, flex: 1 }
        ]}>
          {getCategoryLabel(category, language)}
        </Text>
        {hasSubs && (
          <Pressable onPress={() => setExpanded(!expanded)} hitSlop={12}>
            <ChevronRight
              size={14}
              color={t.textTertiary}
              strokeWidth={1.5}
              style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
            />
          </Pressable>
        )}
      </Pressable>
      {expanded && hasSubs && category.subcategories!.map((sub: Category) => (
        <CategoryCheckbox
          key={sub.id}
          category={sub}
          depth={depth + 1}
          language={language}
          selectedIds={selectedIds}
          onToggle={onToggle}
          t={t}
          accent={accent}
        />
      ))}
    </View>
  );
}

export default function ExploreScreen() {
  const { colors: t, accent } = useTheme();
  const router = useRouter();
  const { t: tr } = useTranslation();
  const { terms, language, selectedTags, toggleTag, setSelectedTags } = useAppStore();
  const [query, setQuery] = useState('');

  const selectedSet = useMemo(() => new Set(selectedTags), [selectedTags]);

  const handleSmartToggle = useCallback((id: string) => {
    const category = findCategoryById(id);
    if (!category) return;

    const current = new Set(selectedTags);
    const isSelected = current.has(id);
    const descendants = getDescendantIds(category);

    if (isSelected) {
      current.delete(id);
      descendants.forEach(d => current.delete(d));
    } else {
      current.add(id);
      descendants.forEach(d => current.add(d));
    }

    let parent = findParentCategory(id);
    while (parent) {
      const siblings = parent.subcategories ?? [];
      const allSiblingsSelected = siblings.every(s => current.has(s.id));
      if (allSiblingsSelected) {
        current.add(parent.id);
      } else {
        current.delete(parent.id);
      }
      parent = findParentCategory(parent.id);
    }

    setSelectedTags(Array.from(current));
  }, [selectedTags, setSelectedTags]);

  const results = useMemo(() => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    return terms.filter(term =>
      term.term.toLowerCase().includes(q) ||
      term.translations[getTermLanguage(language)].definition.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [query, terms, language]);

  const handleShuffle = () => {
    if (selectedTags.length === 0) {
      const allTopLevel = categories.map(c => c.id);
      setSelectedTags(allTopLevel);
    }
    router.push('/(tabs)/learn');
  };

  const showSearch = query.length >= 2;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[typography.largeTitle, { color: t.text }]}>{tr('explore.title')}</Text>
        <View style={[styles.searchContainer, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
          <Search size={16} color={t.textTertiary} strokeWidth={1.8} />
          <TextInput
            style={[typography.body, styles.searchInput, { color: t.text }]}
            placeholder={tr('explore.search')}
            placeholderTextColor={t.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')}>
              <X size={16} color={t.textTertiary} strokeWidth={1.8} />
            </Pressable>
          )}
        </View>
      </View>

      {showSearch ? (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.resultsList}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.resultItem, { borderColor: t.border }]}
              onPress={() => router.push(`/term/${item.id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[typography.headline, { color: t.text }]}>{item.term}</Text>
                <Text style={[typography.caption, { color: t.textTertiary, marginTop: spacing.xs }]}>
                  {item.tags[0]?.toUpperCase().replace(/-/g, ' ')}
                </Text>
                <Text
                  style={[typography.callout, { color: t.textSecondary, marginTop: spacing.sm }]}
                  numberOfLines={2}
                >
                  {item.translations[getTermLanguage(language)].definition}
                </Text>
              </View>
              <ArrowUpRight size={16} color={t.textTertiary} strokeWidth={1.5} />
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptySearch}>
              <Text style={[typography.body, { color: t.textTertiary }]}>
                {tr('home.noResults', { query })}
              </Text>
            </View>
          }
        />
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.mapContent}
          >
            <View style={styles.sectionHeader}>
              <Text style={[typography.caption, { color: t.textTertiary }]}>
                {tr('explore.knowledgeMap')}
              </Text>
              {selectedTags.length > 0 && (
                <Pressable onPress={() => setSelectedTags([])}>
                  <Text style={[typography.caption, { color: accent }]}>
                    {tr('common.cancel')}
                  </Text>
                </Pressable>
              )}
            </View>

            {categories.map(cat => (
              <CategoryCheckbox
                key={cat.id}
                category={cat}
                depth={0}
                language={language}
                selectedIds={selectedSet}
                onToggle={handleSmartToggle}
                t={t}
                accent={accent}
              />
            ))}
          </ScrollView>

          {/* Shuffle FAB */}
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={styles.fabContainer}
          >
            <Pressable
              style={[styles.fab, { backgroundColor: accent }]}
              onPress={handleShuffle}
            >
              <Shuffle size={18} color="#fff" strokeWidth={2} />
              <Text style={[typography.headline, { color: '#fff' }]}>
                {selectedTags.length > 0
                  ? `${tr('explore.shuffle')} (${selectedTags.length})`
                  : tr('explore.shuffleAll')}
              </Text>
            </Pressable>
          </Animated.View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: spacing.xl, gap: spacing.lg },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 0.5,
    paddingHorizontal: spacing.lg,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.md,
    padding: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  mapContent: { padding: spacing.xl, paddingTop: 0, paddingBottom: 120 },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  treeLine: {
    position: 'absolute',
    left: -spacing.md,
    top: 0,
    bottom: '50%',
    width: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nodeDot: { width: 8, height: 8, borderRadius: 4 },
  resultsList: { padding: spacing.xl, paddingTop: 0 },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.lg,
    borderBottomWidth: 0.5,
    gap: spacing.md,
  },
  emptySearch: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
  },
  fabContainer: {
    position: 'absolute',
    bottom: spacing['3xl'],
    left: spacing.xl,
    right: spacing.xl,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
});
