import React, { useState } from 'react';
import {
  StyleSheet, Text, View, Pressable, Modal, ActivityIndicator,
} from 'react-native';
import { AlertTriangle, Cloud, Smartphone, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/lib/useTheme';
import { colors, spacing, radius, typography } from '@/constants/theme';
import { useAppStore } from '@/lib/store';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onUseCloud: () => void;
}

export default function SyncConflictModal({ visible, onCancel, onUseCloud }: Props) {
  const { colors: t, accent } = useTheme();
  const { t: tr } = useTranslation();
  const [loading, setLoading] = useState(false);
  const pendingCloud = useAppStore(s => s.pendingCloudData);

  const localSwipes = useAppStore(s => s.totalSwipes);
  const localTerms = useAppStore(s => Object.keys(s.progress).length);
  const cloudSwipes = pendingCloud?.profile?.totalSwipes ?? 0;
  const cloudTerms = pendingCloud ? Object.keys(pendingCloud.progress).length : 0;

  async function handleUseCloud() {
    setLoading(true);
    try {
      await useAppStore.getState().resolveSyncConflict(true);
      onUseCloud();
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    useAppStore.getState().dismissSyncConflict();
    onCancel();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: t.bgElevated }]}>
          <Pressable style={styles.closeBtn} onPress={handleCancel} hitSlop={12}>
            <X size={18} color={t.textTertiary} strokeWidth={1.5} />
          </Pressable>

          <View style={[styles.iconCircle, { backgroundColor: colors.warningMuted }]}>
            <AlertTriangle size={28} color={colors.warning} strokeWidth={2} />
          </View>

          <Text style={[typography.title, { color: t.text, textAlign: 'center', marginTop: spacing.lg }]}>
            {tr('syncConflict.title')}
          </Text>

          <Text style={[typography.callout, { color: t.textSecondary, textAlign: 'center', marginTop: spacing.md, lineHeight: 20 }]}>
            {tr('syncConflict.description')}
          </Text>

          {/* Comparison */}
          <View style={styles.comparisonRow}>
            <View style={[styles.comparisonCard, { backgroundColor: t.bg, borderColor: t.border }]}>
              <Smartphone size={18} color={accent} strokeWidth={1.5} />
              <Text style={[typography.subhead, { color: t.text, fontWeight: '600', marginTop: spacing.sm }]}>
                {tr('syncConflict.device')}
              </Text>
              <Text style={[typography.footnote, { color: t.textTertiary, marginTop: spacing.xs }]}>
                {tr('syncConflict.terms', { count: localTerms })}
              </Text>
              <Text style={[typography.footnote, { color: t.textTertiary }]}>
                {tr('syncConflict.swipes', { count: localSwipes })}
              </Text>
            </View>

            <View style={[styles.comparisonCard, { backgroundColor: t.bg, borderColor: t.border }]}>
              <Cloud size={18} color="#3B82F6" strokeWidth={1.5} />
              <Text style={[typography.subhead, { color: t.text, fontWeight: '600', marginTop: spacing.sm }]}>
                {tr('syncConflict.cloud')}
              </Text>
              <Text style={[typography.footnote, { color: t.textTertiary, marginTop: spacing.xs }]}>
                {tr('syncConflict.terms', { count: cloudTerms })}
              </Text>
              <Text style={[typography.footnote, { color: t.textTertiary }]}>
                {tr('syncConflict.swipes', { count: cloudSwipes })}
              </Text>
            </View>
          </View>

          {/* Warning */}
          <Text style={[typography.footnote, { color: colors.warning, textAlign: 'center', marginTop: spacing.md }]}>
            {tr('syncConflict.warning')}
          </Text>

          {/* Buttons */}
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: '#3B82F6', opacity: loading ? 0.7 : 1 }]}
            onPress={handleUseCloud}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Cloud size={16} color="#fff" strokeWidth={2} />
                <Text style={[typography.headline, { color: '#fff' }]}>
                  {tr('syncConflict.useCloud')}
                </Text>
              </>
            )}
          </Pressable>

          <Pressable style={[styles.secondaryBtn, { borderColor: t.border }]} onPress={handleCancel}>
            <Text style={[typography.headline, { color: t.text }]}>
              {tr('syncConflict.cancel')}
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    zIndex: 10,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  comparisonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
    alignSelf: 'stretch',
  },
  comparisonCard: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: 'center',
  },
  primaryBtn: {
    flexDirection: 'row',
    gap: spacing.sm,
    height: 48,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: spacing.xl,
  },
  secondaryBtn: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: spacing.md,
  },
});
