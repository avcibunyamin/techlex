// Run: npx tsx lib/speech-logic.check.ts
// Dependency-free checks for lib/speech-logic.ts; exits with a thrown error on the first failure.

import {
  pickEnglishVoice,
  speechRateValue,
  normalizeSpeechRate,
  quizModeAvailability,
  listenQuestionKind,
  isEnglishTag,
  type VoiceLike,
} from './speech-logic';

function voice(identifier: string, language: string, quality = 'Default'): VoiceLike {
  return { identifier, language, quality };
}

function expectEqual(actual: unknown, expected: unknown, name: string): void {
  if (actual !== expected) {
    throw new Error(`${name}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

check('en-US is preferred over other English voices', () => {
  const v = pickEnglishVoice([voice('gb', 'en-GB'), voice('tr', 'tr-TR'), voice('us', 'en-US')]);
  expectEqual(v?.identifier, 'us', 'picked voice');
});

check('falls back to any en-* voice when en-US is missing', () => {
  const v = pickEnglishVoice([voice('tr', 'tr-TR'), voice('au', 'en-AU'), voice('in', 'en-IN')]);
  expectEqual(v?.identifier, 'au', 'first en-* in platform order');
});

check('returns null when there is no English voice', () => {
  expectEqual(pickEnglishVoice([voice('tr', 'tr-TR'), voice('de', 'de-DE')]), null, 'no voice');
  expectEqual(pickEnglishVoice([]), null, 'empty list');
});

check('language tags are matched case- and separator-insensitively; enhanced wins', () => {
  const v = pickEnglishVoice([voice('a', 'en_us'), voice('b', 'EN-US', 'Enhanced'), voice('c', 'en-GB', 'Enhanced')]);
  expectEqual(v?.identifier, 'b', 'enhanced en-US');
  expectEqual(isEnglishTag('en'), true, 'bare en');
  expectEqual(isEnglishTag('eng-x'), false, 'eng is not en-*');
});

check('rate preference maps to expo-speech values and unknown input falls back', () => {
  expectEqual(speechRateValue('normal'), 1, 'normal');
  const slow = speechRateValue('slow');
  if (!(slow > 0 && slow < 1)) throw new Error(`slow rate should be in (0, 1), got ${slow}`);
  expectEqual(normalizeSpeechRate('slow'), 'slow', 'persisted slow');
  expectEqual(normalizeSpeechRate(undefined), 'normal', 'missing value');
  expectEqual(normalizeSpeechRate('fast'), 'normal', 'unknown value');
});

check('listen mode is disabled while checking and without a voice; other modes always on', () => {
  expectEqual(quizModeAvailability('listen', true).enabled, true, 'listen with voice');
  expectEqual(quizModeAvailability('listen', false).reason, 'noVoice', 'listen without voice');
  expectEqual(quizModeAvailability('listen', null).reason, 'checking', 'listen while checking');
  expectEqual(quizModeAvailability('cloze', false).enabled, true, 'cloze ignores speech');
  expectEqual(quizModeAvailability('definition', null).enabled, true, 'definition ignores speech');
});

check('listen questions fall back to written when speech is lost in the session', () => {
  expectEqual(listenQuestionKind(true, false), 'audio', 'speech works');
  expectEqual(listenQuestionKind(true, true), 'written', 'failed mid-session');
  expectEqual(listenQuestionKind(false, false), 'written', 'no speech');
  expectEqual(listenQuestionKind(null, false), 'written', 'unknown');
});

console.log(`speech-logic: ${passed} checks passed`);
