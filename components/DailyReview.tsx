import React from 'react';
import { StyleSheet, View, Text, Pressable, TouchableOpacity, I18nManager } from 'react-native';
import { RotateCcw, CheckCircle, ChevronRight, Flame, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/lib/useTheme';
import { colors, spacing, radius, typography } from '@/constants/theme';
import { Language, Term } from '@/types';
import CardDeck from '@/components/CardDeck';

function useDirection(language: Language) {
  const isArabic = language === 'ar';
  const shouldMirror = isArabic && !I18nManager.isRTL;
  return {
    isArabic,
    rowDir: shouldMirror ? ('row-reverse' as const) : ('row' as const),
    textDirStyle: isArabic
      ? ({ writingDirection: 'rtl' as const, textAlign: (shouldMirror ? 'right' : 'left') as 'right' | 'left' })
      : undefined,
  };
}

interface ContinuePackButtonProps {
  language: Language;
  lastPackTitle: string | null;
  onPress: () => void;
}

function ContinuePackButton({ language, lastPackTitle, onPress }: ContinuePackButtonProps) {
  const { accent } = useTheme();
  const { t: tr } = useTranslation();
  const { isArabic, rowDir } = useDirection(language);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.continueBtn, { flexDirection: rowDir, backgroundColor: accent, borderColor: accent }]}
    >
      <Text style={[typography.subhead, { color: colors.dark.text, fontWeight: '600', flexShrink: 1 }]} numberOfLines={1}>
        {lastPackTitle ? tr('dailyReview.continuePack', { pack: lastPackTitle }) : tr('dailyReview.browsePacks')}
      </Text>
      <ChevronRight
        size={16}
        color={colors.dark.text}
        strokeWidth={2}
        style={isArabic ? { transform: [{ rotate: '180deg' }] } : undefined}
      />
    </Pressable>
  );
}

interface DailyReviewCardProps {
  totalDue: number;
  language: Language;
  lastPackTitle: string | null;
  onStart: () => void;
  onContinuePack: () => void;
}

/** Entry card: due-count badge and one-tap start, or a congrats state when nothing is due. */
export function DailyReviewCard({ totalDue, language, lastPackTitle, onStart, onContinuePack }: DailyReviewCardProps) {
  const { colors: t } = useTheme();
  const { t: tr } = useTranslation();
  const { isArabic, rowDir, textDirStyle } = useDirection(language);

  if (totalDue === 0) {
    return (
      <View style={[styles.card, { backgroundColor: colors.successMuted, borderColor: colors.success }]}>
        <View style={[styles.cardRow, { flexDirection: rowDir }]}>
          <CheckCircle size={22} color={colors.success} strokeWidth={2} />
          <View style={styles.cardText}>
            <Text style={[typography.headline, { color: t.text }, textDirStyle]}>{tr('dailyReview.allDoneTitle')}</Text>
            <Text style={[typography.footnote, { color: t.textSecondary, marginTop: spacing.xs }, textDirStyle]}>
              {tr('dailyReview.allDoneSub')}
            </Text>
          </View>
        </View>
        <ContinuePackButton language={language} lastPackTitle={lastPackTitle} onPress={onContinuePack} />
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onStart}
      accessibilityRole="button"
      style={[styles.card, { backgroundColor: colors.warningMuted, borderColor: colors.warning }]}
    >
      <View style={[styles.cardRow, { flexDirection: rowDir }]}>
        <RotateCcw size={22} color={colors.warning} strokeWidth={2} />
        <View style={styles.cardText}>
          <Text style={[typography.headline, { color: t.text }, textDirStyle]}>{tr('dailyReview.title')}</Text>
          <Text style={[typography.footnote, { color: t.textSecondary, marginTop: spacing.xs }, textDirStyle]}>
            {tr('dailyReview.subtitle', { count: totalDue })}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: colors.warning }]}>
          <Text style={[typography.subhead, { color: colors.dark.text, fontWeight: '700' }]}>{totalDue}</Text>
        </View>
        <ChevronRight
          size={16}
          color={t.textTertiary}
          strokeWidth={1.8}
          style={isArabic ? { transform: [{ rotate: '180deg' }] } : undefined}
        />
      </View>
    </TouchableOpacity>
  );
}

interface DailyReviewSessionProps {
  terms: Term[];
  totalDue: number;
  language: Language;
  streak: number;
  lastPackTitle: string | null;
  onClose: () => void;
  onRestart: () => void;
  onContinuePack: () => void;
}

/**
 * Review session over a snapshot of the due queue. Swipes go through CardDeck, so XP,
 * streak, Leitner boxes and the batched swipe sync behave exactly as in the review mode.
 */
export function DailyReviewSession({
  terms,
  totalDue,
  language,
  streak,
  lastPackTitle,
  onClose,
  onRestart,
  onContinuePack,
}: DailyReviewSessionProps) {
  const { colors: t } = useTheme();
  const { t: tr } = useTranslation();
  const { rowDir, textDirStyle } = useDirection(language);

  return (
    <View style={styles.session}>
      <View style={[styles.header, { flexDirection: rowDir }]}>
        <Pressable onPress={onClose} hitSlop={12} style={styles.headerTitle}>
          <Text style={[typography.headline, { color: t.text }, textDirStyle]} numberOfLines={1}>
            {tr('dailyReview.title')}
          </Text>
          {terms.length > 0 && (
            <Text style={[typography.footnote, { color: t.textSecondary, marginTop: spacing.xs }, textDirStyle]}>
              {tr('dailyReview.sessionInfo', { count: terms.length, total: totalDue })}
            </Text>
          )}
        </Pressable>
        <View style={[styles.headerActions, { flexDirection: rowDir }]}>
          {streak > 0 && (
            <View style={[styles.chip, { flexDirection: rowDir, backgroundColor: t.bgElevated, borderColor: t.border }]}>
              <Flame size={14} color={colors.warning} strokeWidth={1.8} />
              <Text style={[typography.subhead, { color: colors.warning, fontWeight: '600' }]}>{streak}</Text>
            </View>
          )}
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <X size={22} color={t.textTertiary} strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      {terms.length === 0 ? (
        <View style={styles.doneWrap}>
          <CheckCircle size={48} color={colors.success} strokeWidth={1.8} />
          <Text style={[typography.title, { color: t.text, marginTop: spacing.lg, textAlign: 'center' }]}>
            {tr('dailyReview.allDoneTitle')}
          </Text>
          <Text style={[typography.callout, { color: t.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
            {tr('dailyReview.allDoneSub')}
          </Text>
          <View style={styles.doneAction}>
            <ContinuePackButton language={language} lastPackTitle={lastPackTitle} onPress={onContinuePack} />
          </View>
        </View>
      ) : (
        <CardDeck terms={terms} language={language} isReviewMode onRestart={onRestart} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  cardRow: {
    alignItems: 'center',
    gap: spacing.md,
  },
  cardText: {
    flex: 1,
    minWidth: 0,
  },
  badge: {
    minWidth: 32,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  session: {
    flex: 1,
  },
  header: {
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.md,
    zIndex: 10,
  },
  headerTitle: {
    flex: 1,
  },
  headerActions: {
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  chip: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 0.5,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  doneAction: {
    marginTop: spacing.xl,
    alignSelf: 'stretch',
  },
});
