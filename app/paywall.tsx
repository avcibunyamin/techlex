import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check, Zap, Crown, Users, Heart, Infinity } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/useTheme';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radius, typography } from '@/constants/theme';

interface Plan {
  id: 'free' | 'individual' | 'duo' | 'family';
  icon: typeof Zap;
  price: string;
  features: string[];
  popular?: boolean;
}

const plans: Plan[] = [
  {
    id: 'free',
    icon: Zap,
    price: '₺0',
    features: ['limitedEnergy', 'basicCategories'],
  },
  {
    id: 'individual',
    icon: Crown,
    price: '₺39,90',
    popular: true,
    features: ['unlimitedEnergy', 'allCategories', 'cloudSync', 'offlineAccess'],
  },
  {
    id: 'duo',
    icon: Users,
    price: '₺59,90',
    features: ['unlimitedEnergy', 'allCategories', 'cloudSync', 'offlineAccess', 'shareWith'],
  },
  {
    id: 'family',
    icon: Heart,
    price: '₺99,90',
    features: ['unlimitedEnergy', 'allCategories', 'cloudSync', 'offlineAccess', 'familySharing', 'prioritySupport'],
  },
];

export default function PaywallScreen() {
  const { colors: t, accent } = useTheme();
  const router = useRouter();
  const { t: tr } = useTranslation();
  const [selected, setSelected] = useState<string>('individual');

  const featureLabel = (key: string) => {
    if (key === 'limitedEnergy') return tr('paywall.features.limitedEnergy', { count: 30 });
    if (key === 'shareWith') return tr('paywall.features.shareWith', { count: 2 });
    return tr(`paywall.features.${key}`);
  };

  const planName = (id: string) => tr(`paywall.${id}`);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={styles.header}>
        <View style={{ width: 32 }} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Infinity size={28} color={accent} strokeWidth={1.5} />
        </View>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <X size={20} color={t.textTertiary} strokeWidth={1.5} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[typography.largeTitle, { color: t.text, textAlign: 'center' }]}>
          {tr('paywall.title')}
        </Text>
        <Text style={[typography.body, { color: t.textTertiary, textAlign: 'center', marginTop: spacing.sm }]}>
          {tr('paywall.subtitle')}
        </Text>

        <View style={styles.planList}>
          {plans.map((plan) => {
            const isSelected = selected === plan.id;
            const Icon = plan.icon;
            return (
              <Pressable
                key={plan.id}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: t.bgElevated,
                    borderColor: isSelected ? accent : t.border,
                    borderWidth: isSelected ? 1.5 : 0.5,
                  },
                ]}
                onPress={() => setSelected(plan.id)}
              >
                {plan.popular && (
                  <View style={[styles.badge, { backgroundColor: accent }]}>
                    <Text style={[typography.footnote, { color: '#fff', fontWeight: '600' }]}>
                      {tr('paywall.popular')}
                    </Text>
                  </View>
                )}

                <View style={styles.planHeader}>
                  <View style={[styles.planIcon, { backgroundColor: isSelected ? colors.accentSubtle : t.bgSubtle }]}>
                    <Icon size={18} color={isSelected ? accent : t.textTertiary} strokeWidth={1.5} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.headline, { color: t.text }]}>{planName(plan.id)}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                      <Text style={[styles.price, { color: t.text }]}>{plan.price}</Text>
                      {plan.id !== 'free' && (
                        <Text style={[typography.footnote, { color: t.textTertiary }]}>{tr('paywall.perMonth')}</Text>
                      )}
                    </View>
                  </View>
                  <View style={[
                    styles.radio,
                    {
                      borderColor: isSelected ? accent : t.textMuted,
                      backgroundColor: isSelected ? accent : 'transparent',
                    },
                  ]}>
                    {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
                  </View>
                </View>

                <View style={styles.features}>
                  {plan.features.map((f) => (
                    <View key={f} style={styles.featureRow}>
                      <Check size={14} color={colors.success} strokeWidth={2} />
                      <Text style={[typography.callout, { color: t.textSecondary }]}>
                        {featureLabel(f)}
                      </Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.subscribeBtn, { backgroundColor: accent }]}
          onPress={() => router.back()}
        >
          <Text style={[typography.headline, { color: '#fff' }]}>
            {selected === 'free' ? tr('paywall.current') : tr('paywall.subscribe')}
          </Text>
        </Pressable>

        <View style={styles.footer}>
          <Pressable>
            <Text style={[typography.footnote, { color: t.textTertiary }]}>{tr('paywall.restore')}</Text>
          </Pressable>
          <Text style={[typography.footnote, { color: t.textMuted }]}> | </Text>
          <Pressable>
            <Text style={[typography.footnote, { color: t.textTertiary }]}>{tr('paywall.terms')}</Text>
          </Pressable>
          <Text style={[typography.footnote, { color: t.textMuted }]}> | </Text>
          <Pressable>
            <Text style={[typography.footnote, { color: t.textTertiary }]}>{tr('paywall.privacy')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['6xl'],
  },
  planList: {
    marginTop: spacing['2xl'],
    gap: spacing.md,
  },
  planCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomLeftRadius: radius.md,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  planIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  features: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  subscribeBtn: {
    height: 52,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing['2xl'],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
});
