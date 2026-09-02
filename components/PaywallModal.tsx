import React from 'react';
import {
  StyleSheet, Text, View, Pressable, Modal,
} from 'react-native';
import {
  Zap, Crown, Users, Heart, Check, X, Infinity,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/lib/useTheme';
import { colors, spacing, radius, typography } from '@/constants/theme';

interface PaywallModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSelectPlan?: (plan: string) => void;
}

const plans = [
  { id: 'individual', icon: Crown, color: '#6366F1' },
  { id: 'duo', icon: Users, color: '#3B82F6' },
  { id: 'family', icon: Heart, color: '#EC4899' },
] as const;

const features = ['unlimitedEnergy', 'allCategories', 'cloudSync'] as const;

export default function PaywallModal({ visible, onDismiss, onSelectPlan }: PaywallModalProps) {
  const { colors: t, accent } = useTheme();
  const { t: tr } = useTranslation();

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

          <View style={[styles.iconCircle, { backgroundColor: colors.warningMuted }]}>
            <Zap size={24} color={colors.warning} strokeWidth={2} fill={colors.warning} />
          </View>

          <Text style={[typography.title, { color: t.text, textAlign: 'center', marginTop: spacing.lg }]}>
            {tr('energyModal.title')}
          </Text>
          <Text style={[typography.callout, { color: t.textTertiary, textAlign: 'center', marginTop: spacing.sm }]}>
            {tr('energyModal.subtitle')}
          </Text>

          <View style={styles.features}>
            {features.map((f) => (
              <View key={f} style={styles.featureRow}>
                <Check size={14} color={colors.success} strokeWidth={2.5} />
                <Text style={[typography.callout, { color: t.textSecondary }]}>
                  {tr(`energyModal.${f}`)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.planList}>
            {plans.map((plan) => {
              const Icon = plan.icon;
              return (
                <Pressable
                  key={plan.id}
                  style={[styles.planBtn, { borderColor: t.border }]}
                  onPress={() => {
                    onSelectPlan?.(plan.id);
                    console.log(`[PaywallModal] Selected plan: ${plan.id}`);
                  }}
                >
                  <View style={[styles.planIcon, { backgroundColor: `${plan.color}15` }]}>
                    <Icon size={16} color={plan.color} strokeWidth={1.5} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.subhead, { color: t.text, fontWeight: '600' }]}>
                      {tr(`energyModal.${plan.id}`)}
                    </Text>
                    <Text style={[typography.footnote, { color: t.textTertiary }]}>
                      {tr(`energyModal.${plan.id}Price`)}
                    </Text>
                  </View>
                  <Infinity size={14} color={plan.color} strokeWidth={1.5} />
                </Pressable>
              );
            })}
          </View>

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
    paddingHorizontal: spacing['2xl'],
    paddingBottom: spacing['4xl'],
    alignItems: 'center',
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
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  features: {
    marginTop: spacing.xl,
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
  },
  planList: {
    marginTop: spacing['2xl'],
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  planBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 0.5,
  },
  planIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissBtn: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
  },
});
