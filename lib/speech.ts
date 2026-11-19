// Thin wrapper around expo-speech: English voice lookup (cached), speak and stop.
// Pure decisions live in speech-logic.ts.
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import {
  pickEnglishVoice,
  speechRateValue,
  PREFERRED_SPEECH_LANGUAGE,
  DEFAULT_SPEECH_RATE,
  type SpeechRate,
} from './speech-logic';

// The web voice list can stay empty forever (expo-speech then waits for `voiceschanged`).
const VOICE_LOOKUP_TIMEOUT_MS = 2500;

interface ResolvedVoice {
  identifier: string;
  language: string;
}

let voicePromise: Promise<ResolvedVoice | null> | null = null;
let resolvedVoice: ResolvedVoice | null = null;
let lastAvailable: boolean | null = null;
let speakToken = 0;
let activeDone: (() => void) | null = null;
let webVoicesListenerAttached = false;
const listeners = new Set<(available: boolean) => void>();

function setAvailable(available: boolean): void {
  if (lastAvailable === available) return;
  lastAvailable = available;
  listeners.forEach((fn) => fn(available));
}

function webSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function ensureWebVoicesListener(): void {
  if (webVoicesListenerAttached || Platform.OS !== 'web' || !webSpeechSupported()) return;
  const synth = window.speechSynthesis;
  if (!synth || typeof synth.addEventListener !== 'function') return;
  webVoicesListenerAttached = true;
  synth.addEventListener('voiceschanged', () => {
    if (!resolvedVoice) {
      voicePromise = null;
      void resolveVoice();
    }
  });
}

function resolveVoice(): Promise<ResolvedVoice | null> {
  if (resolvedVoice) return Promise.resolve(resolvedVoice);
  if (!voicePromise) {
    ensureWebVoicesListener();
    let lookupPromise: Promise<ResolvedVoice | null> | undefined;
    lookupPromise = (async (): Promise<ResolvedVoice | null> => {
      if (Platform.OS === 'web' && !webSpeechSupported()) {
        setAvailable(false);
        return null;
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), VOICE_LOOKUP_TIMEOUT_MS);
      });
      const voices = await Promise.race([Speech.getAvailableVoicesAsync(), timeout]).catch(() => null);
      if (timer !== undefined) clearTimeout(timer);
      if (!voices || voices.length === 0) {
        // Do not permanently cache an empty or timed-out voice list, and leave availability
        // unknown (null) so SpeakButton stays clickable and retries on voiceschanged or next speak().
        if (voicePromise === lookupPromise) {
          voicePromise = null;
        }
        return null;
      }
      const voice = pickEnglishVoice(voices);
      if (!voice) {
        setAvailable(false);
        return null;
      }
      resolvedVoice = { identifier: voice.identifier, language: voice.language };
      setAvailable(true);
      return resolvedVoice;
    })();
    voicePromise = lookupPromise;
  }
  return voicePromise;
}

/** True when an English voice exists. Cached once a non-empty voice list is resolved. */
export async function isAvailable(): Promise<boolean> {
  return (await resolveVoice()) !== null;
}

/** Last known availability without waiting: null until the first check finishes. */
export function getCachedAvailability(): boolean | null {
  return lastAvailable;
}

/** Called when availability changes (first result, or voiceschanged resolving later). */
export function subscribeAvailability(fn: (available: boolean) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export interface SpeakOptions {
  rate?: SpeechRate;
  onDone?: () => void;
  /** Speech failed (no engine, no voice, platform error). Not called for our own stop(). */
  onError?: () => void;
}

/** Speaks English text, interrupting anything already speaking. */
export async function speak(text: string, options: SpeakOptions = {}): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) {
    options.onDone?.();
    return;
  }
  const prevDone = activeDone;
  activeDone = null;
  prevDone?.();

  const token = ++speakToken;
  activeDone = options.onDone ?? null;

  await Speech.stop().catch(() => {});
  if (token !== speakToken) return;

  const voice = await resolveVoice();
  // A newer speak() or stop() came in while stopping or loading the voice.
  if (token !== speakToken) return;
  if (!voice) {
    activeDone = null;
    options.onError?.();
    return;
  }
  const fail = () => {
    // Stopping or replacing an utterance raises 'interrupted'/'canceled' on web; ignore those.
    // Transient playback errors (e.g. web autoplay 'not-allowed' or audio interruption) must not
    // permanently disable speech availability for the session.
    if (token !== speakToken) return;
    activeDone = null;
    options.onError?.();
  };
  try {
    Speech.speak(trimmed, {
      language: voice.language || PREFERRED_SPEECH_LANGUAGE,
      voice: voice.identifier,
      rate: speechRateValue(options.rate ?? DEFAULT_SPEECH_RATE),
      onDone: () => {
        if (token !== speakToken) return;
        activeDone = null;
        options.onDone?.();
      },
      onError: fail,
    });
  } catch {
    fail();
  }
}

export function stop(): void {
  speakToken += 1;
  const prevDone = activeDone;
  activeDone = null;
  prevDone?.();
  Speech.stop().catch(() => {});
}
