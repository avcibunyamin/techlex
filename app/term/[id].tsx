import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, ArrowUpRight, ChevronDown, Bookmark, BookmarkCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/lib/useTheme';
import { colors, spacing, radius, typography } from '@/constants/theme';
import { Term, getTermLanguage } from '@/types';
import { toLocaleUpper } from '@/lib/text-utils';
import { findPackById, packIdOfTerm } from '@/data/packs';
import SpeakButton from '@/components/SpeakButton';

const INITIAL_RELATED = 3;

export default function TermDetail() {
  const { colors: t, accent } = useTheme();
  const router = useRouter();
  const { t: tr, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const termId = (Array.isArray(id) ? id[0] : id)?.trim() ?? '';
  const {
    language,
    progress,
    bookmarkedIds,
    packsLoaded,
    getTermById,
    ensurePacks,
    toggleBookmark,
  } = useAppStore();

  const [showAllRelated, setShowAllRelated] = useState(false);
  const [settledTermId, setSettledTermId] = useState<string | null>(null);

  const isArabic = language === 'ar';
  const shouldMirror = isArabic && !I18nManager.isRTL;
  const rowStyle = shouldMirror ? styles.rowReverse : styles.row;
  const textDirStyle = isArabic
    ? ({
        writingDirection: 'rtl' as const,
        textAlign: 'right' as const,
      })
    : undefined;
  const wordDirStyle = isArabic ? styles.ltrTextRight : styles.ltrText;

  useEffect(() => {
    setShowAllRelated(false);
  }, [termId]);

  const targetPackId = useMemo(() => (termId ? packIdOfTerm(termId) : undefined), [termId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const term = useMemo(
    () => (termId ? getTermById(termId) : undefined),
    [termId, packsLoaded, getTermById]
  );

  useEffect(() => {
    if (!termId) return;
    const current = getTermById(termId);
    if (current) {
      const missingRelatedPacks = Array.from(
        new Set(
          current.relatedTerms
            .filter((rid) => !getTermById(rid))
            .map((rid) => packIdOfTerm(rid))
            .filter((pid): pid is string => Boolean(pid))
        )
      );
      if (missingRelatedPacks.length > 0) {
        void ensurePacks(missingRelatedPacks);
      }
      return;
    }
    if (!targetPackId) return;
    let alive = true;
    void ensurePacks([targetPackId])
      .catch(() => {})
      .finally(() => {
        if (alive) {
          setSettledTermId(termId);
        }
      });
    return () => {
      alive = false;
    };
  }, [termId, targetPackId, packsLoaded, getTermById, ensurePacks]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allRelated = useMemo(
    () =>
      Array.from(new Set(term?.relatedTerms ?? []))
        .map((rid) => getTermById(rid))
        .filter((item): item is Term => Boolean(item)),
    [term, packsLoaded, getTermById]
  );

  const handleClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/explore' as unknown as Parameters<typeof router.replace>[0]);
    }
  }, [router]);

  const isLoading = !term && Boolean(targetPackId) && settledTermId !== termId;

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
        <View style={[styles.header, rowStyle]}>
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={tr('common.close')}
          >
            <X size={20} color={t.textSecondary} strokeWidth={1.5} />
          </Pressable>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={accent} />
          <Text style={[typography.footnote, { color: t.textSecondary }, textDirStyle]}>
            {tr('common.loading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!term) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
        <View style={[styles.header, rowStyle]}>
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={tr('common.close')}
          >
            <X size={20} color={t.textSecondary} strokeWidth={1.5} />
          </Pressable>
        </View>
        <View style={styles.loadingWrap}>
          <Text
            style={[
              typography.headline,
              { color: t.text, textAlign: 'center' },
              isArabic && { writingDirection: 'rtl' },
            ]}
          >
            {tr('term.notFound')}
          </Text>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.notFoundBtn,
              { backgroundColor: t.bgElevated, borderColor: t.border },
              pressed && { opacity: 0.7 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={tr('common.close')}
          >
            <Text
              style={[
                typography.subhead,
                { color: accent, fontWeight: '600' },
                isArabic && { writingDirection: 'rtl' },
              ]}
            >
              {tr('common.close')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const p = progress[term.id];
  const isLearnedBox = Boolean(p && p.box >= 3);
  const isMasteredBox = Boolean(p && p.box >= 4);
  const tl = getTermLanguage(language);
  const translation = term.translations[tl];
  const exampleSpeechText = (term.translations.en.example || translation.example || '').trim();
  const posText = term.pos?.trim();
  const hasRank = typeof term.rank === 'number' && Number.isFinite(term.rank);

  const pack = targetPackId ? findPackById(targetPackId) : undefined;
  const primaryTag = targetPackId ?? term.tags[0];
  const categoryLabel =
    primaryTag && i18n.exists(`categories.${primaryTag}`)
      ? tr(`categories.${primaryTag}`)
      : pack
        ? pack.title[tl]
        : (term.tags[0]?.replace(/-/g, ' ') ?? '');

  const relatedTermObjects = showAllRelated
    ? allRelated
    : allRelated.slice(0, INITIAL_RELATED);

  const hasMoreRelated = allRelated.length > INITIAL_RELATED;

  const difficultyKey = { 1: 'beginner', 2: 'intermediate', 3: 'advanced' }[term.difficulty] as string;
  const isBookmarked = bookmarkedIds.includes(term.id);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={[styles.header, rowStyle]}>
        <Pressable
          onPress={handleClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={tr('common.close')}
        >
          <X size={20} color={t.textSecondary} strokeWidth={1.5} />
        </Pressable>
        <Pressable
          onPress={() => toggleBookmark(term.id)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityState={{ selected: isBookmarked }}
          accessibilityLabel={tr(isBookmarked ? 'term.unbookmark' : 'term.bookmark')}
        >
          {isBookmarked ? (
            <BookmarkCheck size={20} color={accent} strokeWidth={1.8} />
          ) : (
            <Bookmark size={20} color={t.textSecondary} strokeWidth={1.5} />
          )}
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={[typography.caption, { color: t.textTertiary }, textDirStyle]}>
          {toLocaleUpper(categoryLabel, language)}
        </Text>

        <View style={[styles.termRow, rowStyle]}>
          <Text style={[styles.termText, { color: t.text }, wordDirStyle]}>
            {term.term}
          </Text>
          <SpeakButton
            key={`term-speak-${term.id}`}
            text={term.term}
            accessibilityLabel={tr('speech.playTerm', { term: term.term })}
          />
        </View>

        <View style={[styles.metaRow, rowStyle]}>
          <View style={[styles.difficultyGroup, rowStyle]}>
            <View style={[styles.difficultyDots, rowStyle]}>
              {[1, 2, 3].map((d) => (
                <View
                  key={d}
                  style={[
                    styles.dot,
                    { backgroundColor: d <= term.difficulty ? accent : t.bgSubtle },
                  ]}
                />
              ))}
            </View>
            <Text style={[typography.footnote, { color: t.textTertiary }, textDirStyle]}>
              {tr(`term.${difficultyKey}`)}
            </Text>
          </View>

          {Boolean(posText) && (
            <View style={[styles.metaPill, { backgroundColor: t.bgSubtle, borderColor: t.border }]}>
              <Text style={[typography.footnote, { color: t.textSecondary }]}>
                {posText}
              </Text>
            </View>
          )}

          {hasRank && (
            <View style={[styles.metaPill, { backgroundColor: t.bgSubtle, borderColor: t.border }]}>
              <Text style={[typography.footnote, { color: t.textSecondary }, textDirStyle]}>
                {tr('term.rank', { rank: term.rank })}
              </Text>
            </View>
          )}

          <View
            style={[
              styles.metaPill,
              {
                backgroundColor: !p
                  ? t.bgSubtle
                  : isLearnedBox
                    ? colors.successMuted
                    : colors.accentSubtle,
                borderColor: !p
                  ? t.border
                  : isLearnedBox
                    ? colors.success
                    : accent,
              },
            ]}
          >
            <Text
              style={[
                typography.footnote,
                {
                  color: !p ? t.textTertiary : isLearnedBox ? colors.success : accent,
                  fontWeight: '600',
                },
                textDirStyle,
              ]}
            >
              {p ? tr('packs.filterBox', { box: p.box }) : tr('packs.filterNew')}
            </Text>
          </View>

          {isMasteredBox && (
            <Text style={[typography.footnote, { color: colors.success, fontWeight: '600' }, textDirStyle]}>
              {tr('term.mastered')}
            </Text>
          )}
        </View>

        <View style={[styles.section, { borderColor: t.border }]}>
          <Text style={[typography.caption, { color: t.textTertiary, marginBottom: spacing.md }, textDirStyle]}>
            {tr('term.definition')}
          </Text>
          <Text style={[typography.body, { color: t.text, lineHeight: 24 }, wordDirStyle]}>
            {translation.definition}
          </Text>
        </View>

        {Boolean(translation.example) && (
          <View style={[styles.exampleBox, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
            <View style={[styles.exampleHeaderRow, rowStyle]}>
              <Text style={[typography.caption, { color: t.textTertiary }, textDirStyle]}>
                {tr('term.example')}
              </Text>
              {Boolean(exampleSpeechText) && (
                <SpeakButton
                  key={`example-speak-${term.id}`}
                  text={exampleSpeechText}
                  accessibilityLabel={tr('speech.playExample')}
                  size={15}
                />
              )}
            </View>
            <Text style={[typography.mono, { color: t.textSecondary, marginTop: spacing.sm }, wordDirStyle]}>
              {translation.example}
            </Text>
          </View>
        )}

        {relatedTermObjects.length > 0 && (
          <View style={[styles.section, { borderColor: t.border }]}>
            <Text style={[typography.caption, { color: t.textTertiary, marginBottom: spacing.lg }, textDirStyle]}>
              {tr('term.relatedConcepts')}
            </Text>
            {relatedTermObjects.map((rel) => (
              <Pressable
                key={rel.id}
                style={({ pressed }) => [
                  styles.relatedItem,
                  rowStyle,
                  { borderColor: t.border },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => router.push(`/term/${rel.id}`)}
                accessibilityRole="button"
                accessibilityLabel={tr('packs.openWordDetail', { term: rel.term })}
              >
                <View style={styles.relatedTextCol}>
                  <Text style={[typography.subhead, { color: t.text }, wordDirStyle]}>
                    {rel.term}
                  </Text>
                  <Text
                    style={[typography.footnote, { color: t.textTertiary }, wordDirStyle]}
                    numberOfLines={1}
                  >
                    {rel.translations[tl].definition}
                  </Text>
                </View>
                <ArrowUpRight size={14} color={t.textTertiary} strokeWidth={1.5} />
              </Pressable>
            ))}
            {hasMoreRelated && !showAllRelated && (
              <Pressable
                style={[styles.showMoreBtn, rowStyle]}
                onPress={() => setShowAllRelated(true)}
                accessibilityRole="button"
              >
                <Text style={[typography.subhead, { color: accent }, textDirStyle]}>
                  {tr('term.showMore', { count: allRelated.length - INITIAL_RELATED })}
                </Text>
                <ChevronDown size={14} color={accent} strokeWidth={1.8} />
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { flexDirection: 'row' },
  rowReverse: { flexDirection: 'row-reverse' },
  header: {
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  notFoundBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  content: { padding: spacing.xl, paddingTop: 0, paddingBottom: spacing['6xl'] },
  termRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  termText: {
    flex: 1,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  metaRow: {
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  difficultyGroup: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  difficultyDots: { gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  metaPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 0.5,
  },
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
  exampleHeaderRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  showMoreBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  relatedItem: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    gap: spacing.md,
  },
  relatedTextCol: {
    flex: 1,
    minWidth: 0,
  },
  ltrText: {
    writingDirection: 'ltr',
  },
  ltrTextRight: {
    writingDirection: 'ltr',
    textAlign: 'right',
  },
});
