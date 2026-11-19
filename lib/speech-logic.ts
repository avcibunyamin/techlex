// Pure helpers for pronunciation: voice choice, rate mapping and quiz mode availability.
// No React/expo imports, so it can be checked with `npx tsx lib/speech-logic.check.ts`.

export type SpeechRate = 'normal' | 'slow';

export const SPEECH_RATES: readonly SpeechRate[] = ['normal', 'slow'];
export const DEFAULT_SPEECH_RATE: SpeechRate = 'normal';
export const PREFERRED_SPEECH_LANGUAGE = 'en-US';

/** Rate passed to expo-speech; 1 is the platform's normal speaking rate on iOS, Android and web. */
const RATE_VALUES: Record<SpeechRate, number> = { normal: 1, slow: 0.6 };

export interface VoiceLike {
  identifier: string;
  language: string;
  /** expo-speech VoiceQuality: 'Default' | 'Enhanced'. */
  quality?: string;
}

/** 'en_us' / 'EN-us' → 'en-us'. */
export function normalizeLanguageTag(tag: string): string {
  return tag.trim().replace(/_/g, '-').toLowerCase();
}

export function isEnglishTag(tag: string): boolean {
  const t = normalizeLanguageTag(tag);
  return t === 'en' || t.startsWith('en-');
}

/**
 * Picks the voice to speak English terms with: en-US first, otherwise any en-* voice.
 * Within a group, enhanced voices win; ties keep the platform's order. Null when none.
 */
export function pickEnglishVoice<T extends VoiceLike>(voices: readonly T[]): T | null {
  const preferred = normalizeLanguageTag(PREFERRED_SPEECH_LANGUAGE);
  const rank = (v: T): number => {
    const tag = normalizeLanguageTag(v.language);
    if (!isEnglishTag(tag)) return -1;
    const langScore = tag === preferred ? 2 : 0;
    return langScore + (v.quality === 'Enhanced' ? 1 : 0);
  };
  let best: T | null = null;
  let bestRank = -1;
  for (const v of voices) {
    const r = rank(v);
    if (r > bestRank) {
      best = v;
      bestRank = r;
    }
  }
  return best;
}

export function speechRateValue(rate: SpeechRate): number {
  return RATE_VALUES[rate] ?? RATE_VALUES[DEFAULT_SPEECH_RATE];
}

/** Reads a persisted value; anything unknown becomes the default. */
export function normalizeSpeechRate(raw: unknown): SpeechRate {
  return raw === 'slow' || raw === 'normal' ? raw : DEFAULT_SPEECH_RATE;
}

export type ModeUnavailableReason = 'checking' | 'noVoice';

export interface ModeAvailability {
  enabled: boolean;
  reason?: ModeUnavailableReason;
}

/**
 * Whether a quiz mode can be picked. Only 'listen' needs speech; `speechAvailable` is
 * null while the voice check is still running.
 */
export function quizModeAvailability(mode: string, speechAvailable: boolean | null): ModeAvailability {
  if (mode !== 'listen') return { enabled: true };
  if (speechAvailable === null) return { enabled: false, reason: 'checking' };
  return speechAvailable ? { enabled: true } : { enabled: false, reason: 'noVoice' };
}

/**
 * How a listen question is shown: spoken (spelling hidden) while speech works, otherwise a
 * written prompt with the same options. Once speech fails in a session it stays written.
 */
export function listenQuestionKind(speechAvailable: boolean | null, failedInSession: boolean): 'audio' | 'written' {
  return speechAvailable === true && !failedInSession ? 'audio' : 'written';
}
