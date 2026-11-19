import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Pressable, I18nManager } from 'react-native';
// Gesture-handler Pressable: inside a card's GestureDetector it claims the touch, so the
// card's tap (flip) gesture does not also fire or cancel the press on iOS.
import { Pressable as GesturePressable } from 'react-native-gesture-handler';
import { Volume2, VolumeX } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/lib/useTheme';
import { spacing, radius, typography } from '@/constants/theme';
import { speak, isAvailable, getCachedAvailability, subscribeAvailability } from '@/lib/speech';
import { SPEECH_RATES, speechRateValue, type SpeechRate } from '@/lib/speech-logic';

const MIN_FALLBACK_TIMEOUT_MS = 4000;
const BASE_FALLBACK_TIMEOUT_MS = 2000;
const MS_PER_CHAR_AT_NORMAL_RATE = 120;

let activeButtonDone: (() => void) | null = null;

/**
 * Safety-net timeout used only when the platform TTS engine never fires onDone/onError.
 * Scaled by text length and speech rate so long or slow readings do not lose their highlight early.
 */
function estimateFallbackTimeoutMs(text: string, rate: SpeechRate): number {
  const chars = text.trim().length;
  const rateFactor = speechRateValue(rate) || 1;
  const estimated = Math.ceil((BASE_FALLBACK_TIMEOUT_MS + chars * MS_PER_CHAR_AT_NORMAL_RATE) / rateFactor);
  return Math.max(MIN_FALLBACK_TIMEOUT_MS, estimated);
}

/** English voice availability: null while unknown (checking, empty list, or timeout), boolean once resolved. */
export function useSpeechAvailability(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(getCachedAvailability);
  useEffect(() => {
    let alive = true;
    const unsubscribe = subscribeAvailability((v) => {
      if (alive) setAvailable(v);
    });
    void isAvailable().then(() => {
      if (alive) setAvailable(getCachedAvailability());
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);
  return available;
}

interface SpeakButtonProps {
  text: string;
  accessibilityLabel: string;
  size?: number;
  /** Fires on touch down, e.g. so a parent card can skip its flip tap. */
  onPressIn?: () => void;
  onError?: () => void;
}

export default function SpeakButton({ text, accessibilityLabel, size = 18, onPressIn, onError }: SpeakButtonProps) {
  const { colors: t, accent } = useTheme();
  const rate = useAppStore((s) => s.speechRate);
  const available = useSpeechAvailability();
  const [speaking, setSpeaking] = useState(false);
  const mounted = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef<(() => void) | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimer();
      if (doneRef.current && activeButtonDone === doneRef.current) {
        activeButtonDone = null;
      }
      doneRef.current = null;
    };
  }, [clearTimer]);

  const handlePress = useCallback(() => {
    // Finish any in-flight press on this button before starting the new one so
    // speech.ts calling prevDone() will see finished === true and not clear the new timer/highlight.
    doneRef.current?.();
    clearTimer();
    const trimmed = text.trim();
    if (trimmed && activeButtonDone) {
      activeButtonDone();
    }
    let finished = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const done = () => {
      if (finished) return;
      finished = true;
      if (timerId !== null) {
        clearTimeout(timerId);
        if (timerRef.current === timerId) {
          timerRef.current = null;
        }
        timerId = null;
      }
      if (activeButtonDone === done) {
        activeButtonDone = null;
      }
      if (doneRef.current === done) {
        doneRef.current = null;
        if (mounted.current) setSpeaking(false);
      }
    };
    doneRef.current = done;
    if (trimmed) {
      activeButtonDone = done;
    }
    setSpeaking(true);
    // Fallback timer fires only if onDone/onError never arrives.
    timerId = setTimeout(done, estimateFallbackTimeoutMs(trimmed, rate));
    timerRef.current = timerId;
    void speak(text, {
      rate,
      onDone: done,
      onError: () => {
        done();
        onError?.();
      },
    });
  }, [text, rate, onError, clearTimer]);

  const disabled = available === false;
  const Icon = disabled ? VolumeX : Volume2;
  const color = disabled ? t.textMuted : speaking ? accent : t.textTertiary;

  return (
    <GesturePressable
      onPressIn={onPressIn ? () => onPressIn() : undefined}
      onPress={handlePress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        { borderColor: speaking ? accent : t.border, backgroundColor: t.bgSubtle },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Icon size={size} color={color} strokeWidth={2} />
    </GesturePressable>
  );
}

/** Normal / slow switch for the local speech rate preference. */
export function SpeechRateToggle({ isArabic = false }: { isArabic?: boolean }) {
  const { colors: t, accent } = useTheme();
  const { t: tr } = useTranslation();
  const rate = useAppStore((s) => s.speechRate);
  const setSpeechRate = useAppStore((s) => s.setSpeechRate);
  const rowDir = isArabic && !I18nManager.isRTL ? 'row-reverse' : 'row';

  return (
    <View style={[styles.rateRow, { flexDirection: rowDir }]}>
      <Text style={[typography.footnote, { color: t.textTertiary }]}>{tr('speech.rateLabel')}</Text>
      <View
        style={[styles.ratePicker, { flexDirection: rowDir, backgroundColor: t.bgSubtle }]}
        accessibilityRole="radiogroup"
        accessibilityLabel={tr('speech.rateLabel')}
      >
        {SPEECH_RATES.map((r) => {
          const active = r === rate;
          return (
            <Pressable
              key={r}
              onPress={() => setSpeechRate(r)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={[styles.rateOption, active && { backgroundColor: t.bgElevated, borderColor: accent }]}
            >
              <Text style={[typography.footnote, { color: active ? accent : t.textSecondary, fontWeight: '600' }]}>
                {tr(r === 'slow' ? 'speech.rateSlow' : 'speech.rateNormal')}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateRow: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  ratePicker: {
    padding: 2,
    borderRadius: radius.md,
    gap: 2,
  },
  rateOption: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
