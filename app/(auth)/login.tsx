import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Modal,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Layers, Mail, Lock, Eye, EyeOff, AlertCircle,
  AtSign, User, Calendar, Check, X, CheckCircle, Globe, ChevronDown,
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/lib/useTheme';
import { colors, spacing, radius, typography } from '@/constants/theme';
import { useAuth } from '@/lib/useAuth';
import { useAppStore } from '@/lib/store';
import { Language } from '@/types';
import { changeLanguage } from '@/lib/i18n';
import ForgotPasswordModal from '@/components/ForgotPasswordModal';

const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
];

const AUTH_ERROR_MAP: Record<string, string> = {
  'User already registered': 'auth.errors.alreadyRegistered',
  'Invalid login credentials': 'auth.errors.invalidCredentials',
  'Email not confirmed': 'auth.errors.emailNotConfirmed',
  'Too many requests': 'auth.errors.tooManyRequests',
  'Password should be at least 6 characters': 'auth.errors.passwordTooShort',
  'Unable to validate email address: invalid format': 'auth.errors.emailInvalid',
};

// --- Validation ---

function validateUsername(v: string, t: (key: string, opts?: any) => string): string | null {
  if (!v) return t('auth.validation.usernameRequired');
  if (v.length < 3) return t('auth.validation.usernameMinLength');
  if (v.length > 20) return t('auth.validation.usernameMaxLength');
  if (!/^[a-z0-9]+$/.test(v)) return t('auth.validation.usernamePattern');
  return null;
}

function validateName(v: string, fieldLabel: string, t: (key: string, opts?: any) => string): string | null {
  if (!v.trim()) return t('auth.validation.fieldRequired', { field: fieldLabel });
  if (v.trim().length < 2) return t('auth.validation.minLength2');
  return null;
}

function validateEmail(v: string, t: (key: string, opts?: any) => string): string | null {
  if (!v.trim()) return t('auth.validation.emailRequired');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return t('auth.validation.emailInvalid');
  return null;
}

function validateDob(v: string, t: (key: string, opts?: any) => string): string | null {
  if (!v) return t('auth.validation.dobRequired');
  const match = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return t('auth.validation.dobFormat');
  const [, ds, ms, ys] = match;
  const d = +ds, m = +ms, y = +ys;
  const date = new Date(y, m - 1, d);
  if (date.getDate() !== d || date.getMonth() !== m - 1 || date.getFullYear() !== y) return t('auth.validation.dobInvalid');
  if (date > new Date()) return t('auth.validation.dobFuture');
  const age = new Date().getFullYear() - y;
  if (age > 120 || age < 10) return t('auth.validation.dobRange');
  return null;
}

function getPasswordChecks(v: string) {
  return {
    minLength: v.length >= 8,
    hasUpper: /[A-Z]/.test(v),
    hasLower: /[a-z]/.test(v),
    hasDigit: /[0-9]/.test(v),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(v),
  };
}

function isPasswordStrong(checks: ReturnType<typeof getPasswordChecks>) {
  return Object.values(checks).every(Boolean);
}

// --- Hero Panel for Web Split-Screen ---

function FloatingCard({ delay, emoji, label, x, y }: { delay: number; emoji: string; label: string; x: number; y: number }) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 800 }));
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-10, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(10, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      ),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: `${x}%`,
          top: `${y}%`,
          backgroundColor: 'rgba(255,255,255,0.12)',
          borderRadius: 16,
          paddingHorizontal: 18,
          paddingVertical: 14,
          backdropFilter: 'blur(8px)',
        } as any,
        animStyle,
      ]}
    >
      <Text style={{ fontSize: 28 }}>{emoji}</Text>
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', marginTop: 4 }}>{label}</Text>
    </Animated.View>
  );
}

function HeroPanel() {
  return (
    <View style={heroStyles.container}>
      <View style={heroStyles.gradient}>
        <View style={heroStyles.content}>
          <View style={heroStyles.logoRow}>
            <View style={heroStyles.logoCircle}>
              <Layers size={32} color="#fff" strokeWidth={1.5} />
            </View>
            <Text style={heroStyles.brand}>TechLex</Text>
          </View>
          <Text style={heroStyles.headline}>Master Technology{'\n'}Concepts</Text>
          <Text style={heroStyles.sub}>
            Build your technical vocabulary with bite-sized flashcards.
            From cybersecurity to AI, learn the terms that matter.
          </Text>
        </View>

        <FloatingCard delay={0} emoji="🛡️" label="Cybersecurity" x={10} y={55} />
        <FloatingCard delay={300} emoji="🤖" label="AI & ML" x={60} y={45} />
        <FloatingCard delay={600} emoji="💻" label="Software Dev" x={15} y={75} />
        <FloatingCard delay={900} emoji="🌐" label="Networking" x={55} y={70} />
        <FloatingCard delay={1200} emoji="🎨" label="Design & UX" x={35} y={60} />
      </View>
    </View>
  );
}

const heroStyles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: '100%' as any,
  },
  gradient: {
    flex: 1,
    backgroundColor: '#6366F1',
    position: 'relative',
    overflow: 'hidden',
  },
  content: {
    paddingHorizontal: 48,
    paddingTop: 80,
    zIndex: 2,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 40,
  },
  logoCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brand: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  headline: {
    fontSize: 38,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 46,
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 24,
    marginTop: 16,
    maxWidth: 380,
  },
});

// --- Component ---

export default function LoginScreen() {
  const { colors: t, accent } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { t: tr, i18n } = useTranslation();
  const { signInWithEmail, signUpWithProfile, checkUsername } = useAuth();
  const setLanguage = useAppStore(s => s.setLanguage);
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [mode, setMode] = useState<'login' | 'signup'>(params.mode === 'signup' ? 'signup' : 'login');
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [successEmail, setSuccessEmail] = useState('');
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showForgotPw, setShowForgotPw] = useState(false);

  function translateAuthError(message: string): string {
    const key = AUTH_ERROR_MAP[message];
    if (key) return tr(key);
    for (const [pattern, k] of Object.entries(AUTH_ERROR_MAP)) {
      if (message.toLowerCase().includes(pattern.toLowerCase())) return tr(k);
    }
    return message;
  }

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const usernameTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (mode !== 'signup') return;
    const err = validateUsername(username, tr);
    if (err) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    clearTimeout(usernameTimer.current);
    usernameTimer.current = setTimeout(async () => {
      const available = await checkUsername(username);
      setUsernameStatus(available ? 'available' : 'taken');
    }, 500);
    return () => clearTimeout(usernameTimer.current);
  }, [username, mode]);

  const usernameError = validateUsername(username, tr);
  const firstNameError = validateName(firstName, tr('auth.firstName'), tr);
  const lastNameError = validateName(lastName, tr('auth.lastName'), tr);
  const dobError = validateDob(dob, tr);
  const emailError = validateEmail(email, tr);
  const pwChecks = getPasswordChecks(password);
  const pwStrong = isPasswordStrong(pwChecks);

  const markTouched = (field: string) => setTouched(prev => ({ ...prev, [field]: true }));

  const handleUsernameChange = (text: string) => {
    setUsername(text.toLowerCase().replace(/[^a-z0-9]/g, ''));
  };

  const handleDobChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    let formatted = '';
    if (digits.length > 0) formatted = digits.slice(0, 2);
    if (digits.length > 2) formatted += '/' + digits.slice(2, 4);
    if (digits.length > 4) formatted += '/' + digits.slice(4, 8);
    setDob(formatted);
  };

  const handleLogin = async () => {
    setTouched({ email: true, password: true });
    if (emailError || !password) {
      setError(tr('auth.fillFields'));
      return;
    }
    setError('');
    setLoading(true);
    const { error: authErr } = await signInWithEmail(email, password);
    setLoading(false);
    if (authErr) {
      setError(translateAuthError(authErr.message));
      return;
    }
    // Navigation handled by _layout.tsx after sync conflict check resolves
  };

  const handleSignup = async () => {
    const all = {
      username: true, firstName: true, lastName: true,
      dob: true, email: true, password: true, confirmPassword: true,
    };
    setTouched(all);

    if (usernameError || firstNameError || lastNameError || dobError || emailError || !pwStrong || confirmPassword !== password) {
      return;
    }
    if (usernameStatus === 'taken') {
      setError(tr('auth.usernameTaken'));
      return;
    }

    setError('');
    setLoading(true);

    const [d, m, y] = dob.split('/');
    const dobISO = `${y}-${m}-${d}`;

    const { data, error: authErr } = await signUpWithProfile(email, password, {
      username,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dob: dobISO,
    });

    setLoading(false);

    if (authErr) {
      setError(translateAuthError(authErr.message));
      return;
    }

    if (data?.session) {
      // Navigation handled by _layout.tsx after sync conflict check resolves
      // For new signups, _layout.tsx will detect the user and run the sync flow
    } else {
      setSuccessEmail(email);
      setSignupSuccess(true);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
    setTouched({});
    setSignupSuccess(false);
  };

  const fieldError = (msg: string | null, field: string) => {
    if (!touched[field] || !msg) return null;
    return (
      <Text style={[typography.footnote, { color: colors.danger, marginTop: spacing.xs, paddingLeft: spacing.sm }]}>
        {msg}
      </Text>
    );
  };

  const inputBorder = (field: string, errorVal: string | null, successCondition = false) => {
    if (touched[field] && errorVal) return colors.danger;
    if (successCondition) return colors.success;
    return t.border;
  };

  // --- Success screen ---
  if (signupSuccess) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
        <View style={styles.successContent}>
          <View style={[styles.successIcon, { backgroundColor: colors.successMuted }]}>
            <CheckCircle size={32} color={colors.success} strokeWidth={1.5} />
          </View>
          <Text style={[typography.title, { color: t.text, marginTop: spacing['2xl'], textAlign: 'center' }]}>
            {tr('auth.accountCreated')}
          </Text>
          <Text style={[typography.body, { color: t.textTertiary, marginTop: spacing.md, textAlign: 'center', lineHeight: 22 }]}>
            {tr('auth.checkEmail')}{'\n'}
            <Text style={{ color: t.text, fontWeight: '600' }}>{successEmail}</Text>
          </Text>
          <Pressable
            style={[styles.submitBtn, { backgroundColor: accent, marginTop: spacing['3xl'] }]}
            onPress={switchMode}
          >
            <Text style={[typography.headline, { color: '#fff' }]}>{tr('auth.backToSignIn')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // --- Main render ---
  const formContent = (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, isWide && { paddingTop: spacing['3xl'], maxWidth: 450, alignSelf: 'center', width: '100%' }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Language selector — button only, popover is rendered via Modal */}
          <View style={styles.langRow}>
            <View style={{ flex: 1 }} />
            <Pressable
              style={[styles.langBtn, { backgroundColor: t.bgElevated, borderColor: t.border }]}
              onPress={() => setShowLangPicker(true)}
            >
              <Globe size={14} color={t.textTertiary} strokeWidth={1.5} />
              <Text style={[typography.footnote, { color: t.text }]}>
                {LANGUAGES.find(l => l.code === i18n.language)?.label ?? 'Türkçe'}
              </Text>
              <ChevronDown size={12} color={t.textTertiary} strokeWidth={1.5} />
            </Pressable>
          </View>

          {/* Logo */}
          <View style={[styles.logoCircle, { backgroundColor: colors.accentSubtle }]}>
            <Layers size={28} color={accent} strokeWidth={1.5} />
          </View>

          <Text style={[styles.title, { color: t.text }]}>
            {mode === 'login' ? tr('auth.welcomeBack') : tr('auth.createAccount')}
          </Text>
          <Text style={[typography.body, { color: t.textTertiary, marginTop: spacing.sm }]}>
            {mode === 'login'
              ? tr('auth.signInSubtitle')
              : tr('auth.signUpSubtitle')}
          </Text>

          {/* Error banner */}
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.dangerMuted }]}>
              <AlertCircle size={14} color={colors.danger} strokeWidth={2} />
              <Text style={[typography.callout, { color: colors.danger, flex: 1 }]}>{error}</Text>
            </View>
          ) : null}

          {/* ===== SIGNUP FIELDS ===== */}
          {mode === 'signup' && (
            <>
              {/* Username */}
              <View style={styles.fieldGroup}>
                <View style={[styles.inputRow, {
                  backgroundColor: t.bgElevated,
                  borderColor: usernameStatus === 'taken'
                    ? colors.danger
                    : inputBorder('username', usernameError, usernameStatus === 'available'),
                }]}>
                  <AtSign size={16} color={t.textTertiary} strokeWidth={1.5} />
                  <TextInput
                    style={[typography.body, styles.input, { color: t.text }]}
                    placeholder={tr('auth.username')}
                    placeholderTextColor={t.textMuted}
                    value={username}
                    onChangeText={handleUsernameChange}
                    onBlur={() => markTouched('username')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={20}
                  />
                  {usernameStatus === 'checking' && <ActivityIndicator size="small" color={t.textTertiary} />}
                  {usernameStatus === 'available' && <Check size={16} color={colors.success} strokeWidth={2.5} />}
                  {usernameStatus === 'taken' && <X size={16} color={colors.danger} strokeWidth={2.5} />}
                </View>
                {fieldError(usernameError, 'username')}
                {usernameStatus === 'taken' && (
                  <Text style={[typography.footnote, { color: colors.danger, marginTop: spacing.xs, paddingLeft: spacing.sm }]}>
                    {tr('auth.usernameTaken')}
                  </Text>
                )}
              </View>

              {/* First name + Last name */}
              <View style={styles.nameRow}>
                <View style={{ flex: 1 }}>
                  <View style={[styles.inputRow, {
                    backgroundColor: t.bgElevated,
                    borderColor: inputBorder('firstName', firstNameError),
                  }]}>
                    <User size={16} color={t.textTertiary} strokeWidth={1.5} />
                    <TextInput
                      style={[typography.body, styles.input, { color: t.text }]}
                      placeholder={tr('auth.firstName')}
                      placeholderTextColor={t.textMuted}
                      value={firstName}
                      onChangeText={setFirstName}
                      onBlur={() => markTouched('firstName')}
                      autoCorrect={false}
                    />
                  </View>
                  {fieldError(firstNameError, 'firstName')}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={[styles.inputRow, {
                    backgroundColor: t.bgElevated,
                    borderColor: inputBorder('lastName', lastNameError),
                  }]}>
                    <User size={16} color={t.textTertiary} strokeWidth={1.5} />
                    <TextInput
                      style={[typography.body, styles.input, { color: t.text }]}
                      placeholder={tr('auth.lastName')}
                      placeholderTextColor={t.textMuted}
                      value={lastName}
                      onChangeText={setLastName}
                      onBlur={() => markTouched('lastName')}
                      autoCorrect={false}
                    />
                  </View>
                  {fieldError(lastNameError, 'lastName')}
                </View>
              </View>

              {/* Date of birth */}
              <View style={styles.fieldGroup}>
                <View style={[styles.inputRow, {
                  backgroundColor: t.bgElevated,
                  borderColor: inputBorder('dob', dobError),
                }]}>
                  <Calendar size={16} color={t.textTertiary} strokeWidth={1.5} />
                  <TextInput
                    style={[typography.body, styles.input, { color: t.text }]}
                    placeholder={tr('auth.dob')}
                    placeholderTextColor={t.textMuted}
                    value={dob}
                    onChangeText={handleDobChange}
                    onBlur={() => markTouched('dob')}
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                </View>
                {fieldError(dobError, 'dob')}
              </View>
            </>
          )}

          {/* ===== EMAIL ===== */}
          <View style={styles.fieldGroup}>
            <View style={[styles.inputRow, {
              backgroundColor: t.bgElevated,
              borderColor: inputBorder('email', emailError),
            }]}>
              <Mail size={16} color={t.textTertiary} strokeWidth={1.5} />
              <TextInput
                style={[typography.body, styles.input, { color: t.text }]}
                placeholder={tr('auth.email')}
                placeholderTextColor={t.textMuted}
                value={email}
                onChangeText={setEmail}
                onBlur={() => markTouched('email')}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>
            {fieldError(emailError, 'email')}
          </View>

          {/* ===== PASSWORD ===== */}
          <View style={styles.fieldGroup}>
            <View style={[styles.inputRow, {
              backgroundColor: t.bgElevated,
              borderColor: mode === 'signup' ? inputBorder('password', pwStrong ? null : 'weak') : t.border,
            }]}>
              <Lock size={16} color={t.textTertiary} strokeWidth={1.5} />
              <TextInput
                style={[typography.body, styles.input, { color: t.text }]}
                placeholder={tr('auth.password')}
                placeholderTextColor={t.textMuted}
                value={password}
                onChangeText={setPassword}
                onBlur={() => markTouched('password')}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8} tabIndex={-1}>
                {showPassword
                  ? <EyeOff size={16} color={t.textTertiary} strokeWidth={1.5} />
                  : <Eye size={16} color={t.textTertiary} strokeWidth={1.5} />}
              </Pressable>
            </View>

            {mode === 'login' && (
              <Pressable onPress={() => setShowForgotPw(true)} style={{ alignSelf: 'flex-end', marginTop: spacing.sm }}>
                <Text style={[typography.footnote, { color: accent }]}>
                  {tr('auth.forgotPassword.forgotPassword')}
                </Text>
              </Pressable>
            )}

            {mode === 'signup' && password.length > 0 && (
              <View style={styles.pwChecklist}>
                {([
                  [pwChecks.minLength, tr('auth.pwMin')],
                  [pwChecks.hasUpper, tr('auth.pwUpper')],
                  [pwChecks.hasLower, tr('auth.pwLower')],
                  [pwChecks.hasDigit, tr('auth.pwDigit')],
                  [pwChecks.hasSpecial, tr('auth.pwSpecial')],
                ] as const).map(([met, label], i) => (
                  <View key={i} style={styles.pwCheckRow}>
                    {met
                      ? <Check size={12} color={colors.success} strokeWidth={2.5} />
                      : <X size={12} color={t.textMuted} strokeWidth={2} />}
                    <Text style={[typography.footnote, { color: met ? colors.success : t.textTertiary }]}>
                      {label}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ===== CONFIRM PASSWORD ===== */}
          {mode === 'signup' && (
            <View style={styles.fieldGroup}>
              <View style={[styles.inputRow, {
                backgroundColor: t.bgElevated,
                borderColor: touched.confirmPassword && confirmPassword
                  ? (confirmPassword === password ? colors.success : colors.danger)
                  : t.border,
              }]}>
                <Lock size={16} color={t.textTertiary} strokeWidth={1.5} />
                <TextInput
                  style={[typography.body, styles.input, { color: t.text }]}
                  placeholder={tr('auth.confirmPassword')}
                  placeholderTextColor={t.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onBlur={() => markTouched('confirmPassword')}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable onPress={() => setShowConfirm(!showConfirm)} hitSlop={8} tabIndex={-1}>
                  {showConfirm
                    ? <EyeOff size={16} color={t.textTertiary} strokeWidth={1.5} />
                    : <Eye size={16} color={t.textTertiary} strokeWidth={1.5} />}
                </Pressable>
              </View>
              {touched.confirmPassword && confirmPassword !== '' && confirmPassword !== password && (
                <Text style={[typography.footnote, { color: colors.danger, marginTop: spacing.xs, paddingLeft: spacing.sm }]}>
                  {tr('auth.pwNoMatch')}
                </Text>
              )}
              {confirmPassword !== '' && confirmPassword === password && (
                <Text style={[typography.footnote, { color: colors.success, marginTop: spacing.xs, paddingLeft: spacing.sm }]}>
                  {tr('auth.pwMatch')}
                </Text>
              )}
            </View>
          )}

          {/* Submit */}
          <Pressable
            style={[styles.submitBtn, { backgroundColor: accent, opacity: loading ? 0.7 : 1, marginTop: spacing.xl }]}
            onPress={mode === 'login' ? handleLogin : handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={[typography.headline, { color: '#fff' }]}>
                {mode === 'login' ? tr('auth.signIn') : tr('auth.createAccount')}
              </Text>
            )}
          </Pressable>

          {/* Toggle mode */}
          <View style={styles.toggleRow}>
            <Text style={[typography.callout, { color: t.textTertiary }]}>
              {mode === 'login' ? tr('auth.noAccount') : tr('auth.hasAccount')}
            </Text>
            <Pressable onPress={switchMode}>
              <Text style={[typography.callout, { color: accent, fontWeight: '600' }]}>
                {mode === 'login' ? ` ${tr('auth.signUp')}` : ` ${tr('auth.signIn')}`}
              </Text>
            </Pressable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
      {isWide ? (
        <View style={styles.splitRow}>
          <HeroPanel />
          <View style={styles.formPanel}>
            {formContent}
          </View>
        </View>
      ) : (
        formContent
      )}

      <ForgotPasswordModal
        visible={showForgotPw}
        onClose={() => setShowForgotPw(false)}
        initialEmail={email}
      />

      {/* Language picker modal — floating popover, no layout shift */}
      <Modal visible={showLangPicker} transparent animationType="fade" onRequestClose={() => setShowLangPicker(false)}>
        <Pressable style={styles.langOverlay} onPress={() => setShowLangPicker(false)}>
          <View style={[styles.langPopover, { backgroundColor: t.bgElevated }]}>
            {LANGUAGES.map((lang, idx) => {
              const active = i18n.language === lang.code;
              return (
                <Pressable
                  key={lang.code}
                  style={[
                    styles.langOption,
                    active && { backgroundColor: colors.accentSubtle },
                    idx < LANGUAGES.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
                  ]}
                  onPress={async () => {
                    await changeLanguage(lang.code);
                    setLanguage(lang.code);
                    setShowLangPicker(false);
                  }}
                >
                  <Text style={{ fontSize: 18 }}>{lang.flag}</Text>
                  <Text style={[typography.callout, { color: active ? accent : t.text, flex: 1, fontWeight: active ? '600' : '400' }]}>
                    {lang.label}
                  </Text>
                  {active && <Check size={14} color={accent} strokeWidth={2.5} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  splitRow: {
    flex: 1,
    flexDirection: 'row',
  },
  formPanel: {
    flex: 1,
    maxWidth: 560,
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing['4xl'],
    paddingBottom: spacing['2xl'],
  },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginTop: spacing.xl,
  },
  fieldGroup: {
    marginTop: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 0.5,
    paddingHorizontal: spacing.lg,
    height: 48,
    gap: spacing.md,
  },
  input: {
    flex: 1,
    padding: 0,
  },
  pwChecklist: {
    marginTop: spacing.sm,
    paddingLeft: spacing.sm,
    gap: 4,
  },
  pwCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  submitBtn: {
    height: 48,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  successContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['3xl'],
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 0.5,
  },
  langOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 80,
    paddingRight: spacing['2xl'],
  },
  langPopover: {
    width: 220,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 20,
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
});
