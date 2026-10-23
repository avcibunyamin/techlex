import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Mail, Lock, KeyRound, X, Eye, EyeOff, CheckCircle, AlertCircle, Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/lib/useTheme';
import { useAuth } from '@/lib/useAuth';
import { useAppStore } from '@/lib/store';
import { colors, spacing, radius, typography } from '@/constants/theme';

const OTP_LENGTH = 6;

interface Props {
  visible: boolean;
  onClose: () => void;
  initialEmail?: string;
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

export default function ForgotPasswordModal({ visible, onClose, initialEmail = '' }: Props) {
  const { colors: t, accent } = useTheme();
  const { t: tr } = useTranslation();
  const { resetPasswordForEmail, verifyOtpAndUpdatePassword, updatePassword } = useAuth();

  const otpRef = useRef<TextInput>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState(initialEmail);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);

  const pwChecks = getPasswordChecks(newPassword);
  const pwStrong = Object.values(pwChecks).every(Boolean);

  const reset = () => {
    setStep(1);
    setEmail(initialEmail);
    setOtpCode('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirm(false);
    setLoading(false);
    setError('');
    setSuccess('');
    setOtpVerified(false);
  };

  const handleClose = () => {
    useAppStore.setState({ isResettingPassword: false });
    reset();
    onClose();
  };

  const handleOtpChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setOtpCode(cleaned);
  };

  useEffect(() => {
    if (step === 2 && otpCode.length === OTP_LENGTH && pwStrong && newPassword === confirmPassword && !loading) {
      handleUpdatePassword();
    }
  }, [otpCode]);

  const handleSendCode = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(tr('auth.validation.emailInvalid'));
      return;
    }
    setError('');
    setLoading(true);
    const { error: err } = await resetPasswordForEmail(email.trim());
    setLoading(false);
    if (err) {
      if (err.message.toLowerCase().includes('too many')) {
        setError(tr('auth.errors.tooManyRequests'));
      } else {
        setError(err.message);
      }
      return;
    }
    setSuccess(tr('auth.forgotPassword.otpSentSuccess'));
    setStep(2);
  };

  const handleUpdatePassword = async () => {
    if (!otpVerified && otpCode.length < OTP_LENGTH) {
      setError(tr('auth.forgotPassword.otpInvalid'));
      return;
    }
    if (!pwStrong) {
      setError(tr('auth.errors.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(tr('auth.pwNoMatch'));
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);
    useAppStore.setState({ isResettingPassword: true });

    let err: { message: string } | null = null;

    if (otpVerified) {
      const result = await updatePassword(newPassword);
      err = result.error;
    } else {
      const result = await verifyOtpAndUpdatePassword(email.trim(), otpCode, newPassword);
      err = result.error;
      if (err && result.phase === 'verify') {
        useAppStore.setState({ isResettingPassword: false });
      }
      if (err && result.phase === 'update') {
        setOtpVerified(true);
      }
      if (!err) {
        setOtpVerified(true);
      }
    }

    setLoading(false);
    if (err) {
      if (err.message.toLowerCase().includes('token') || err.message.toLowerCase().includes('otp')) {
        setError(tr('auth.forgotPassword.otpInvalid'));
      } else if (err.message.toLowerCase().includes('too many')) {
        setError(tr('auth.errors.tooManyRequests'));
      } else {
        setError(err.message);
      }
      return;
    }
    setSuccess(tr('auth.forgotPassword.passwordUpdated'));
    setTimeout(() => {
      handleClose();
    }, 1500);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={[styles.card, { backgroundColor: t.bgElevated }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[typography.title, { color: t.text, fontSize: 20 }]}>
              {step === 1 ? tr('auth.forgotPassword.step1Title') : tr('auth.forgotPassword.step2Title')}
            </Text>
            <Pressable onPress={handleClose} hitSlop={12}>
              <X size={20} color={t.textTertiary} strokeWidth={1.5} />
            </Pressable>
          </View>

          <Text style={[typography.callout, { color: t.textTertiary, marginBottom: spacing.xl }]}>
            {step === 1 ? tr('auth.forgotPassword.step1Subtitle') : tr('auth.forgotPassword.step2Subtitle')}
          </Text>

          {/* Error */}
          {error ? (
            <View style={[styles.msgBox, { backgroundColor: colors.dangerMuted }]}>
              <AlertCircle size={14} color={colors.danger} strokeWidth={2} />
              <Text style={[typography.footnote, { color: colors.danger, flex: 1 }]}>{error}</Text>
            </View>
          ) : null}

          {/* Success */}
          {success ? (
            <View style={[styles.msgBox, { backgroundColor: colors.successMuted }]}>
              <CheckCircle size={14} color={colors.success} strokeWidth={2} />
              <Text style={[typography.footnote, { color: colors.success, flex: 1 }]}>{success}</Text>
            </View>
          ) : null}

          {/* Step 1: Email */}
          {step === 1 && (
            <>
              <View style={[styles.inputRow, { backgroundColor: t.bg, borderColor: t.border }]}>
                <Mail size={16} color={t.textTertiary} strokeWidth={1.5} />
                <TextInput
                  style={[typography.body, styles.input, { color: t.text }]}
                  placeholder={tr('auth.forgotPassword.enterEmail')}
                  placeholderTextColor={t.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />
              </View>
              <Pressable
                style={[styles.btn, { backgroundColor: accent, opacity: loading ? 0.7 : 1 }]}
                onPress={handleSendCode}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[typography.headline, { color: '#fff' }]}>
                    {tr('auth.forgotPassword.sendCode')}
                  </Text>
                )}
              </Pressable>
            </>
          )}

          {/* Step 2: OTP + New Password */}
          {step === 2 && (
            <>
              {/* OTP Boxes */}
              <Text style={[typography.footnote, { color: t.textTertiary, marginBottom: spacing.sm, textAlign: 'center' }]}>
                {tr('auth.forgotPassword.enterOtp')}
              </Text>
              <Pressable style={styles.otpRow} onPress={() => otpRef.current?.focus()}>
                {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.otpBox,
                      {
                        backgroundColor: t.bg,
                        borderColor: otpCode.length === i ? accent : otpCode[i] ? colors.success : t.border,
                        borderWidth: otpCode.length === i ? 1.5 : 0.5,
                      },
                    ]}
                  >
                    <Text style={[styles.otpDigit, { color: t.text }]}>
                      {otpCode[i] ?? ''}
                    </Text>
                  </View>
                ))}
              </Pressable>
              <TextInput
                ref={otpRef}
                style={{ position: 'absolute', opacity: 0, height: 0 }}
                value={otpCode}
                onChangeText={handleOtpChange}
                keyboardType="number-pad"
                maxLength={OTP_LENGTH}
                autoFocus
              />

              <View style={[styles.inputRow, { backgroundColor: t.bg, borderColor: t.border, marginTop: spacing.md }]}>
                <Lock size={16} color={t.textTertiary} strokeWidth={1.5} />
                <TextInput
                  style={[typography.body, styles.input, { color: t.text }]}
                  placeholder={tr('auth.forgotPassword.newPassword')}
                  placeholderTextColor={t.textMuted}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                  {showPassword
                    ? <EyeOff size={16} color={t.textTertiary} strokeWidth={1.5} />
                    : <Eye size={16} color={t.textTertiary} strokeWidth={1.5} />}
                </Pressable>
              </View>

              {newPassword.length > 0 && (
                <View style={styles.pwChecklist}>
                  {([
                    [pwChecks.minLength, tr('auth.pwMin')],
                    [pwChecks.hasUpper, tr('auth.pwUpper')],
                    [pwChecks.hasLower, tr('auth.pwLower')],
                    [pwChecks.hasDigit, tr('auth.pwDigit')],
                    [pwChecks.hasSpecial, tr('auth.pwSpecial')],
                  ] as const).map(([met, label], i) => (
                    <View key={i} style={styles.pwCheckRow}>
                      <Check size={12} color={met ? colors.success : t.textMuted} strokeWidth={met ? 2.5 : 2} />
                      <Text style={[typography.footnote, { color: met ? colors.success : t.textTertiary }]}>
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={[styles.inputRow, { backgroundColor: t.bg, borderColor: confirmPassword ? (confirmPassword === newPassword ? colors.success : colors.danger) : t.border, marginTop: spacing.md }]}>
                <Lock size={16} color={t.textTertiary} strokeWidth={1.5} />
                <TextInput
                  style={[typography.body, styles.input, { color: t.text }]}
                  placeholder={tr('auth.confirmPassword')}
                  placeholderTextColor={t.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable onPress={() => setShowConfirm(!showConfirm)} hitSlop={8}>
                  {showConfirm
                    ? <EyeOff size={16} color={t.textTertiary} strokeWidth={1.5} />
                    : <Eye size={16} color={t.textTertiary} strokeWidth={1.5} />}
                </Pressable>
              </View>
              {confirmPassword !== '' && confirmPassword !== newPassword && (
                <Text style={[typography.footnote, { color: colors.danger, marginTop: spacing.xs, paddingLeft: spacing.sm }]}>
                  {tr('auth.pwNoMatch')}
                </Text>
              )}
              {confirmPassword !== '' && confirmPassword === newPassword && (
                <Text style={[typography.footnote, { color: colors.success, marginTop: spacing.xs, paddingLeft: spacing.sm }]}>
                  {tr('auth.pwMatch')}
                </Text>
              )}

              <Pressable
                style={[styles.btn, { backgroundColor: accent, opacity: loading || !pwStrong || newPassword !== confirmPassword ? 0.7 : 1 }]}
                onPress={handleUpdatePassword}
                disabled={loading || !pwStrong || newPassword !== confirmPassword}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[typography.headline, { color: '#fff' }]}>
                    {tr('auth.forgotPassword.updatePassword')}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 20,
    padding: spacing['2xl'],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  msgBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
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
  btn: {
    height: 48,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: spacing.lg,
  },
  otpBox: {
    width: 44,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpDigit: {
    fontSize: 22,
    fontWeight: '700',
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
});
