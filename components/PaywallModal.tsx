import React from 'react';
import {
  StyleSheet, Text, View, Pressable, Modal, ScrollView,
} from 'react-native';
import {
  Zap, Crown, Users, Heart, Check, X, Infinity, Lock, Sparkles,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/lib/useTheme';
import { colors, spacing, radius, typography } from '@/constants/theme';

export type PaywallVariant = 'energy' | 'premium';
export type PaywallSource = 'energy' | 'relatedTerms' | 'quizHint';

interface PaywallModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSelectPlan?: (plan: string) => void;
  variant?: PaywallVariant;
  source?: PaywallSource;
}

const plans = [
  {
    id: 'individual',
    icon: Crown,
    color: '#6366F1',
    popular: false,
    features: ['unlimitedEnergy', 'allCategories', 'advancedAnalysis', 'relatedTermsMap', 'cloudSync'],
  },
  {
    id: 'duo',
    icon: Users,
    color: '#3B82F6',
    popular: true,
    features: ['unlimitedEnergy', 'allCategories', 'advancedAnalysis', 'relatedTermsMap', 'cloudSync', 'shareWith'],
  },
  {
    id: 'family',
    icon: Heart,
    color: '#EC4899',
    popular: false,
    features: ['unlimitedEnergy', 'allCategories', 'advancedAnalysis', 'relatedTermsMap', 'cloudSync', 'familySharing'],
  },
] as const;

export default function PaywallModal({ visible, onDismiss, onSelectPlan, variant = 'energy', source }: PaywallModalProps) {
  const { colors: t, accent } = useTheme();
  const { t: tr } = useTranslation();

  const isEnergy = variant === 'energy';

  function getSubtitleKey(): string {
    if (source === 'relatedTerms') return 'premiumModal.subtitleRelated';
    if (source === 'quizHint') return 'premiumModal.subtitleQuiz';
    if (isEnergy) return 'energyModal.subtitle';
    return 'premiumModal.subtitle';
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onDismiss} />
        <View style={[styles.sheet, { backgroundColor: t.bgElevated }]}>
          <View style={styles.handle} />

          <Pressable style={styles.closeBtn} onPress={onDismiss} hitSlop={12}>
            <X size={18} color={t.textTertiary} strokeWidth={1.5} />
          </Pressable>

          {isEnergy ? (
            <View style={[styles.iconCircle, { backgroundColor: colors.warningMuted }]}>
              <Zap size={24} color={colors.warning} strokeWidth={2} fill={colors.warning} />
            </View>
          ) : (
            <View style={[styles.iconCircle, { backgroundColor: `${accent}20` }]}>
              <Lock size={24} color={accent} strokeWidth={2} />
            </View>
          )}

          <Text style={[typography.title, { color: t.text, textAlign: 'center', marginTop: spacing.lg }]}>
            {tr(isEnergy ? 'energyModal.title' : 'premiumModal.title')}
          </Text>
          <Text style={[typography.callout, { color: t.textTertiary, textAlign: 'center', marginTop: spacing.sm }]}>
            {tr(getSubtitleKey())}
          </Text>

          {/* Side-by-side plan cards */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.planRow}
            style={styles.planScroll}
          >
            {plans.map((plan) => {
              const Icon = plan.icon;
              const isPopular = plan.popular;
              return (
                <View key={plan.id} style={styles.planCardOuter}>
                  <Pressable
                    style={[
                      styles.planCard,
                      {
                        borderColor: isPopular ? plan.color : t.border,
                        borderWidth: isPopular ? 2 : 1,
                        backgroundColor: isPopular ? plan.color + '08' : t.bg,
                      },
                    ]}
                    onPress={() => {
                      onSelectPlan?.(plan.id);
                    }}
                  >
                    <View style={[styles.planIconWrap, { backgroundColor: plan.color + '15' }]}>
                      <Icon size={20} color={plan.color} strokeWidth={1.5} />
                    </View>

                    <Text style={[typography.headline, { color: t.text, marginTop: spacing.md }]}>
                      {tr(`energyModal.${plan.id}`)}
                    </Text>
                    <Text style={[typography.subhead, { color: plan.color, fontWeight: '700', marginTop: spacing.xs }]}>
                      {tr(`energyModal.${plan.id}Price`)}
                    </Text>

                    <View style={styles.featureList}>
                      {plan.features.map((f) => (
                        <View key={f} style={styles.featureItem}>
                          <Check size={12} color={colors.success} strokeWidth={2.5} />
                          <Text style={[styles.featureText, { color: t.textSecondary }]} numberOfLines={2}>
                            {tr(`paywall.features.${f}`, { count: plan.id === 'duo' ? 2 : 6 })}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <View style={[styles.selectBtn, { backgroundColor: plan.color }]}>
                      <Text style={[typography.subhead, { color: '#fff', fontWeight: '600' }]}>
                        {tr('paywall.subscribe')}
                      </Text>
                    </View>
                  </Pressable>

                  {isPopular && (
                    <View style={[styles.popularBadge, { backgroundColor: plan.color }]}>
                      <Sparkles size={10} color="#fff" strokeWidth={2} />
                      <Text style={styles.popularText}>{tr('paywall.popular')}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <Pressable style={styles.dismissBtn} onPress={onDismiss}>
            <Text style={[typography.subhead, { color: t.textTertiary }]}>
              {tr('energyModal.maybeLater')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['4xl'],
    alignItems: 'center',
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.3)',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.xl,
    zIndex: 10,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  planScroll: {
    marginTop: spacing.xl,
    alignSelf: 'stretch',
  },
  planRow: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  planCardOuter: {
    width: 190,
    position: 'relative',
  },
  planCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: spacing.lg,
    paddingVertical: 4,
    borderRadius: 12,
    position: 'absolute',
    top: -10,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  popularText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  planIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  featureList: {
    marginTop: spacing.lg,
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  featureText: {
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
  },
  selectBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  dismissBtn: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
  },
});
