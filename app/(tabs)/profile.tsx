import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Pressable,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Flame, Target, BookCheck, Brain, ChevronRight,
  LogIn, LogOut, Cloud, Globe, Sun, Moon, Monitor,
  Zap, Infinity, Crown, AtSign, Check, X, AlertCircle,
  Award, RotateCcw,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/lib/store';
import { useAuth } from '@/lib/useAuth';
import { useTheme, ThemeMode } from '@/lib/useTheme';
import { colors, spacing, radius, typography } from '@/constants/theme';
import { getStats } from '@/lib/spaced-repetition';
import { categories } from '@/data/categories';
import { changeLanguage } from '@/lib/i18n';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

export default function ProfileScreen() {
  const { colors: t, accent, themeMode } = useTheme();
  const router = useRouter();
  const { t: tr, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const {
    streak, language, setLanguage, progress, terms,
    dailyGoal, todayCount, syncToCloud,
    setThemeMode, subscriptionTier, energyLevel,
    totalSwipes, getLevel, hasActivePremium,
    cancelAtPeriodEnd, currentPeriodEnd, setCancelAtPeriodEnd,
  } = useAppStore();

  const progressValues = Object.values(progress);
  const stats = getStats(progressValues);
  const isPremium = hasActivePremium();
  const level = getLevel();
  const nextLevelSwipes = level * 100;
  const levelProgress = (totalSwipes % 100) / 100;

  const periodEndDate = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '';

  const [showUsernameEdit, setShowUsernameEdit] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState('');
  const [cooldownDays, setCooldownDays] = useState<number | null>(null);
  const usernameTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    if (!showUsernameEdit || !newUsername || newUsername.length < 3 || !/^[a-z0-9]+$/.test(newUsername)) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    clearTimeout(usernameTimer.current);
    usernameTimer.current = setTimeout(async () => {
      if (!isSupabaseConfigured) return;
      const { data } = await getSupabase().rpc('is_username_available', { uname: newUsername });
      setUsernameStatus(data ? 'available' : 'taken');
    }, 500);
    return () => clearTimeout(usernameTimer.current);
  }, [newUsername, showUsernameEdit]);

  const handleChangeUsername = async () => {
    if (!isSupabaseConfigured || usernameStatus !== 'available') return;
    setUsernameLoading(true);
    const { data, error } = await getSupabase().rpc('change_username', { new_username: newUsername });
    setUsernameLoading(false);

    if (error) {
      setUsernameMsg(error.message);
      return;
    }
    const result = data as { success: boolean; error?: string; days_left?: number };
    if (!result.success) {
      if (result.days_left) setCooldownDays(result.days_left);
      setUsernameMsg(result.error || 'Error');
      return;
    }
    setUsernameMsg(tr('profile.usernameChanged'));
    setShowUsernameEdit(false);
    setNewUsername('');
  };

  const handleCancelSubscription = () => {
    Alert.alert(
      tr('profile.confirmCancel'),
      tr('profile.confirmCancelSub'),
      [
        { text: tr('common.cancel'), style: 'cancel' },
        {
          text: tr('profile.confirm'),
          style: 'destructive',
          onPress: async () => {
            setCancelLoading(true);
            if (isSupabaseConfigured) {
              const { data } = await getSupabase().rpc('cancel_subscription');
              const result = data as { success: boolean; period_end?: string } | null;
              if (result?.success && result.period_end) {
                setCancelAtPeriodEnd(true, new Date(result.period_end).getTime());
              }
            } else {
              const periodEnd = Date.now() + 30 * 24 * 60 * 60 * 1000;
              setCancelAtPeriodEnd(true, periodEnd);
            }
            setCancelLoading(false);
          },
        },
      ]
    );
  };

  const handleResumeSubscription = async () => {
    setCancelLoading(true);
    if (isSupabaseConfigured) {
      const { data } = await getSupabase().rpc('resume_subscription');
      const result = data as { success: boolean } | null;
      if (result?.success) {
        setCancelAtPeriodEnd(false);
      }
    } else {
      setCancelAtPeriodEnd(false);
    }
    setCancelLoading(false);
  };

  const handleLanguageToggle = async () => {
    const next = i18n.language === 'tr' ? 'en' : 'tr';
    await changeLanguage(next);
    setLanguage(next as 'tr' | 'en');
  };

  const themeCycle: ThemeMode[] = ['system', 'light', 'dark'];
  const handleThemeCycle = () => {
    const idx = themeCycle.indexOf(themeMode);
    setThemeMode(themeCycle[(idx + 1) % themeCycle.length]);
  };
  const ThemeIcon = themeMode === 'light' ? Sun : themeMode === 'dark' ? Moon : Monitor;

  const categoryProgress = categories.map(cat => {
    const catTerms = terms.filter(term => term.tags.includes(cat.id));
    const mastered = catTerms.filter(term => {
      const p = progress[term.id];
      return p && p.box >= 4;
    }).length;
    return { ...cat, total: catTerms.length, mastered };
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={[typography.largeTitle, { color: t.text }]}>{tr('profile.title')}</Text>

        {/* Level */}
        <View style={[styles.levelCard, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
          <View style={styles.levelHeader}>
            <View style={[styles.levelBadge, { backgroundColor: accent + '20' }]}>
              <Award size={20} color={accent} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.headline, { color: t.text }]}>
                {tr('profile.level')} {level}
              </Text>
              <Text style={[typography.footnote, { color: t.textTertiary }]}>
                {totalSwipes} / {nextLevelSwipes} {tr('profile.totalSwipes').toLowerCase()}
              </Text>
            </View>
          </View>
          <View style={[styles.levelBar, { backgroundColor: t.bgSubtle }]}>
            <View style={[styles.levelBarFill, { backgroundColor: accent, width: `${levelProgress * 100}%` }]} />
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
            <Flame size={18} color={streak > 0 ? '#F97316' : t.textTertiary} strokeWidth={1.8} />
            <Text style={[typography.title, { color: t.text, marginTop: spacing.sm }]}>{streak}</Text>
            <Text style={[typography.footnote, { color: t.textTertiary }]}>{tr('profile.dayStreak')}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
            <BookCheck size={18} color={colors.success} strokeWidth={1.8} />
            <Text style={[typography.title, { color: t.text, marginTop: spacing.sm }]}>{stats.mastered}</Text>
            <Text style={[typography.footnote, { color: t.textTertiary }]}>{tr('profile.mastered')}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
            <Brain size={18} color={accent} strokeWidth={1.8} />
            <Text style={[typography.title, { color: t.text, marginTop: spacing.sm }]}>
              {progressValues.filter(p => p.timesSeen > 0).length}
            </Text>
            <Text style={[typography.footnote, { color: t.textTertiary }]}>{tr('profile.seen')}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
            <Target size={18} color={colors.warning} strokeWidth={1.8} />
            <Text style={[typography.title, { color: t.text, marginTop: spacing.sm }]}>{todayCount}/{dailyGoal}</Text>
            <Text style={[typography.footnote, { color: t.textTertiary }]}>{tr('profile.today')}</Text>
          </View>
        </View>

        {/* Energy bar */}
        <View style={[styles.energyBar, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {isPremium
              ? <Infinity size={18} color={accent} strokeWidth={1.8} />
              : <Zap size={18} color={colors.warning} strokeWidth={1.8} />}
            <Text style={[typography.headline, { color: t.text }]}>
              {isPremium ? tr('profile.unlimited') : `${energyLevel}/30`}
            </Text>
            <Text style={[typography.callout, { color: t.textTertiary }]}>{tr('profile.energy')}</Text>
          </View>
          {!isPremium && (
            <Pressable
              style={[styles.upgradeChip, { backgroundColor: colors.accentSubtle }]}
              onPress={() => router.push('/paywall')}
            >
              <Crown size={12} color={accent} strokeWidth={2} />
              <Text style={[typography.subhead, { color: accent, fontWeight: '600' }]}>{tr('profile.upgrade')}</Text>
            </Pressable>
          )}
        </View>

        {/* Category Progress */}
        <Text style={[typography.caption, { color: t.textTertiary, marginTop: spacing['3xl'], marginBottom: spacing.lg }]}>
          {tr('profile.masteryByCategory')}
        </Text>
        {categoryProgress.map(cat => (
          <View key={cat.id} style={[styles.categoryRow, { borderColor: t.border }]}>
            <View style={[styles.catDot, { backgroundColor: cat.color }]} />
            <View style={{ flex: 1 }}>
              <View style={styles.catHeader}>
                <Text style={[typography.subhead, { color: t.text }]}>{cat.name[language]}</Text>
                <Text style={[typography.footnote, { color: t.textTertiary }]}>
                  {cat.mastered} / {cat.total}
                </Text>
              </View>
              <View style={[styles.catBar, { backgroundColor: t.bgSubtle }]}>
                <View style={[styles.catBarFill, {
                  backgroundColor: cat.color,
                  width: `${cat.total > 0 ? (cat.mastered / cat.total) * 100 : 0}%`,
                }]} />
              </View>
            </View>
          </View>
        ))}

        {/* ==================== HESAP AYARLARI ==================== */}
        <Text style={[typography.caption, { color: t.textTertiary, marginTop: spacing['3xl'], marginBottom: spacing.lg }]}>
          {tr('profile.accountSettings')}
        </Text>
        <View style={[styles.settingsGroup, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
          {/* Subscription */}
          <Pressable
            style={[styles.settingRow, { borderColor: t.border }]}
            onPress={() => router.push('/paywall')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Crown size={14} color={accent} strokeWidth={1.5} />
              <Text style={[typography.body, { color: t.text }]}>{tr('profile.subscription')}</Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={[typography.subhead, { color: isPremium ? accent : t.textSecondary, fontWeight: isPremium ? '600' : '500' }]}>
                {subscriptionTier !== 'free'
                  ? subscriptionTier.charAt(0).toUpperCase() + subscriptionTier.slice(1)
                  : 'Free'}
              </Text>
              <ChevronRight size={14} color={t.textTertiary} strokeWidth={1.5} />
            </View>
          </Pressable>

          {/* Cancellation banner */}
          {cancelAtPeriodEnd && subscriptionTier !== 'free' && (
            <View style={[styles.cancelBanner, { backgroundColor: colors.warningMuted, borderColor: t.border }]}>
              <AlertCircle size={14} color={colors.warning} strokeWidth={2} />
              <Text style={[typography.footnote, { color: t.textSecondary, flex: 1 }]}>
                {tr('profile.subscriptionCancelled', { date: periodEndDate })}
              </Text>
            </View>
          )}

          {/* Cancel / Resume subscription */}
          {subscriptionTier !== 'free' && (
            <Pressable
              style={[styles.settingRow, { borderColor: t.border }]}
              onPress={cancelAtPeriodEnd ? handleResumeSubscription : handleCancelSubscription}
              disabled={cancelLoading}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <RotateCcw size={14} color={cancelAtPeriodEnd ? accent : colors.danger} strokeWidth={1.5} />
                <Text style={[typography.body, { color: cancelAtPeriodEnd ? accent : colors.danger }]}>
                  {cancelAtPeriodEnd ? tr('profile.resumeSubscription') : tr('profile.cancelSubscription')}
                </Text>
              </View>
              {cancelLoading && <ActivityIndicator size="small" color={t.textTertiary} />}
            </Pressable>
          )}

          {/* Auth section */}
          {user ? (
            <>
              <View style={[styles.settingRow, { borderColor: t.border }]}>
                <Text style={[typography.body, { color: t.text }]}>{tr('profile.account')}</Text>
                <Text style={[typography.footnote, { color: t.textTertiary }]} numberOfLines={1}>
                  {user.email}
                </Text>
              </View>

              <Pressable
                style={[styles.settingRow, { borderColor: t.border }]}
                onPress={() => setShowUsernameEdit(!showUsernameEdit)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <AtSign size={14} color={accent} strokeWidth={1.5} />
                  <Text style={[typography.body, { color: t.text }]}>{tr('profile.username')}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text style={[typography.subhead, { color: t.textSecondary }]}>
                    {user.user_metadata?.username || '---'}
                  </Text>
                  <ChevronRight size={14} color={t.textTertiary} strokeWidth={1.5} />
                </View>
              </Pressable>

              {showUsernameEdit && (
                <View style={[styles.usernameEdit, { borderColor: t.border }]}>
                  {cooldownDays !== null && cooldownDays > 0 && (
                    <View style={[styles.cooldownBanner, { backgroundColor: colors.warningMuted }]}>
                      <AlertCircle size={12} color={colors.warning} strokeWidth={2} />
                      <Text style={[typography.footnote, { color: colors.warning }]}>
                        {tr('profile.cooldown', { days: cooldownDays })}
                      </Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <View style={[styles.usernameInput, { backgroundColor: t.bgSubtle, borderColor: t.border, flex: 1 }]}>
                      <TextInput
                        style={[typography.body, { color: t.text, flex: 1, padding: 0 }]}
                        placeholder={tr('profile.usernamePlaceholder')}
                        placeholderTextColor={t.textMuted}
                        value={newUsername}
                        onChangeText={(v) => setNewUsername(v.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                        autoCapitalize="none"
                        autoCorrect={false}
                        maxLength={20}
                      />
                      {usernameStatus === 'checking' && <ActivityIndicator size="small" color={t.textTertiary} />}
                      {usernameStatus === 'available' && <Check size={14} color={colors.success} strokeWidth={2.5} />}
                      {usernameStatus === 'taken' && <X size={14} color={colors.danger} strokeWidth={2.5} />}
                    </View>
                    <Pressable
                      style={[styles.usernameBtn, {
                        backgroundColor: usernameStatus === 'available' ? accent : t.bgSubtle,
                        opacity: usernameStatus === 'available' && !usernameLoading ? 1 : 0.5,
                      }]}
                      onPress={handleChangeUsername}
                      disabled={usernameStatus !== 'available' || usernameLoading}
                    >
                      {usernameLoading
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Check size={16} color={usernameStatus === 'available' ? '#fff' : t.textMuted} strokeWidth={2} />}
                    </Pressable>
                  </View>
                  {usernameMsg ? (
                    <Text style={[typography.footnote, {
                      color: usernameMsg.includes('updated') || usernameMsg.includes('güncellendi')
                        ? colors.success : colors.danger,
                      marginTop: spacing.xs,
                    }]}>
                      {usernameMsg}
                    </Text>
                  ) : null}
                </View>
              )}

              <Pressable
                style={[styles.settingRow, { borderColor: t.border }]}
                onPress={() => syncToCloud(user.id)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Cloud size={14} color={accent} strokeWidth={1.5} />
                  <Text style={[typography.body, { color: t.text }]}>{tr('profile.syncNow')}</Text>
                </View>
                <ChevronRight size={14} color={t.textTertiary} strokeWidth={1.5} />
              </Pressable>

              <Pressable
                style={styles.settingRow}
                onPress={signOut}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <LogOut size={14} color={colors.danger} strokeWidth={1.5} />
                  <Text style={[typography.body, { color: colors.danger }]}>{tr('profile.signOut')}</Text>
                </View>
              </Pressable>
            </>
          ) : (
            <Pressable
              style={styles.settingRow}
              onPress={() => router.push('/(auth)/login')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <LogIn size={14} color={accent} strokeWidth={1.5} />
                <Text style={[typography.body, { color: t.text }]}>{tr('profile.signInToSync')}</Text>
              </View>
              <ChevronRight size={14} color={t.textTertiary} strokeWidth={1.5} />
            </Pressable>
          )}
        </View>

        {/* ==================== UYGULAMA AYARLARI ==================== */}
        <Text style={[typography.caption, { color: t.textTertiary, marginTop: spacing['3xl'], marginBottom: spacing.lg }]}>
          {tr('profile.appSettings')}
        </Text>
        <View style={[styles.settingsGroup, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
          <Pressable
            style={[styles.settingRow, { borderColor: t.border }]}
            onPress={handleLanguageToggle}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Globe size={14} color={accent} strokeWidth={1.5} />
              <Text style={[typography.body, { color: t.text }]}>{tr('profile.language')}</Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={[typography.subhead, { color: t.textSecondary }]}>
                {i18n.language === 'tr' ? 'Türkçe' : 'English'}
              </Text>
              <ChevronRight size={14} color={t.textTertiary} strokeWidth={1.5} />
            </View>
          </Pressable>

          <Pressable
            style={[styles.settingRow, { borderColor: t.border }]}
            onPress={handleThemeCycle}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <ThemeIcon size={14} color={accent} strokeWidth={1.5} />
              <Text style={[typography.body, { color: t.text }]}>{tr('profile.theme')}</Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={[typography.subhead, { color: t.textSecondary }]}>
                {tr(`profile.theme${themeMode.charAt(0).toUpperCase() + themeMode.slice(1)}`)}
              </Text>
              <ChevronRight size={14} color={t.textTertiary} strokeWidth={1.5} />
            </View>
          </Pressable>

          <View style={styles.settingRow}>
            <Text style={[typography.body, { color: t.text }]}>{tr('profile.version')}</Text>
            <Text style={[typography.subhead, { color: t.textTertiary }]}>1.0.0</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing['6xl'] },
  levelCard: {
    marginTop: spacing['2xl'],
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 0.5,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  levelBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelBar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  levelBarFill: { height: '100%', borderRadius: 2, minWidth: 2 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  statCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 0.5,
  },
  energyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    marginTop: spacing.md,
  },
  upgradeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderBottomWidth: 0.5,
    gap: spacing.md,
  },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  catBar: { height: 3, borderRadius: 2, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 2, minWidth: 2 },
  settingsGroup: { borderRadius: radius.lg, borderWidth: 0.5, overflow: 'hidden' },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 0.5,
  },
  settingValue: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cancelBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.lg,
    borderBottomWidth: 0.5,
  },
  usernameEdit: {
    padding: spacing.lg,
    borderBottomWidth: 0.5,
  },
  cooldownBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  usernameInput: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: radius.md,
    borderWidth: 0.5,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  usernameBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
