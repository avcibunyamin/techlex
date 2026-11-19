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
let lastAvailable: boolean | null = null;
let speakToken = 0;
const listeners = new Set<(available: boolean) => void>();

function setAvailable(available: boolean): void {
  if (lastAvailable === available) return;
  lastAvailable = available;
  listeners.forEach((fn) => fn(available));
}

function webSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function resolveVoice(): Promise<ResolvedVoice | null> {
  if (!voicePromise) {
    voicePromise = (async () => {
      if (Platform.OS === 'web' && !webSpeechSupported()) return null;
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), VOICE_LOOKUP_TIMEOUT_MS));
      const voices = await Promise.race([Speech.getAvailableVoicesAsync(), timeout]).catch(() => null);
      if (!voices) return null;
      const voice = pickEnglishVoice(voices);
      return voice ? { identifier: voice.identifier, language: voice.language } : null;
    })();
    voicePromise.then((v) => setAvailable(v !== null));
  }
  return voicePromise;
}

/** True when an English voice exists. The result is cached for the app session. */
export async function isAvailable(): Promise<boolean> {
  return (await resolveVoice()) !== null;
}

/** Last known availability without waiting: null until the first check finishes. */
export function getCachedAvailability(): boolean | null {
  return lastAvailable;
}

/** Called when availability changes (first result, or speech failing later). */
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
  const token = ++speakToken;
  const trimmed = text.trim();
  if (!trimmed) return;
  Speech.stop().catch(() => {});
  const voice = await resolveVoice();
  // A newer speak() or stop() came in while the voice was loading.
  if (token !== speakToken) return;
  if (!voice) {
    options.onError?.();
    return;
  }
  const fail = () => {
    // Stopping or replacing an utterance raises 'interrupted'/'canceled' on web; ignore those.
    if (token !== speakToken) return;
    voicePromise = Promise.resolve(null);
    setAvailable(false);
    options.onError?.();
  };
  try {
    Speech.speak(trimmed, {
      language: voice.language || PREFERRED_SPEECH_LANGUAGE,
      voice: voice.identifier,
      rate: speechRateValue(options.rate ?? DEFAULT_SPEECH_RATE),
      onDone: () => {
        if (token === speakToken) options.onDone?.();
      },
      onError: fail,
    });
  } catch {
    fail();
  }
}

export function stop(): void {
  speakToken += 1;
  Speech.stop().catch(() => {});
}
