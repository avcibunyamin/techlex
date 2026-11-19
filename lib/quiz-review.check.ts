// Run: npx tsx lib/quiz-review.check.ts
// Dependency-free checks for lib/quiz-review.ts; exits with a thrown error on the first failure.

import {
  DEFAULT_MIN_RETRY_SIZE,
  buildQuizReview,
  extractMissedQuizItems,
  type QuizReviewQuestion,
} from './quiz-review';

function q(id: string, term: string, correctDefinition = `Def of ${term}`): QuizReviewQuestion {
  return {
    term: { id, term },
    correctDefinition,
  };
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

check('all answers correct returns empty missed list and disables retry', () => {
  const questions = [q('ngsl-0001', 'the'), q('ngsl-0002', 'be'), q('ngsl-0003', 'and'), q('ngsl-0004', 'of')];
  const summary = buildQuizReview(questions, [true, true, true, true], DEFAULT_MIN_RETRY_SIZE);
  expectEqual(summary.missedItems.length, 0, 'missedItems count');
  expectEqual(summary.missedIds.length, 0, 'missedIds count');
  expectEqual(summary.canRetryMissed, false, 'canRetryMissed');
});

check('mixed results extracts only wrong answers in question order', () => {
  const questions = [
    q('ngsl-0001', 'analyze', 'Analiz etmek'),
    q('ngsl-0002', 'benefit', 'Fayda'),
    q('ngsl-0003', 'create', 'Oluşturmak'),
    q('ngsl-0004', 'derive', 'Türetmek'),
  ];
  const summary = buildQuizReview(questions, [true, false, true, false], 4);
  expectEqual(summary.missedIds.join(','), 'ngsl-0002,ngsl-0004', 'missed ids');
  expectEqual(summary.missedItems[0]?.term, 'benefit', 'first missed term');
  expectEqual(summary.missedItems[0]?.correctDefinition, 'Fayda', 'first missed definition');
  expectEqual(summary.missedItems[1]?.term, 'derive', 'second missed term');
  expectEqual(summary.canRetryMissed, false, '2 missed is below threshold 4');
});

check('unanswered or skipped slots (null, undefined, shorter results) are included as missed', () => {
  const questions = [
    q('nawl-0001', 'abstract'),
    q('nawl-0002', 'axis'),
    q('nawl-0003', 'bracket'),
    q('nawl-0004', 'cue'),
  ];
  const items = extractMissedQuizItems(questions, [true, null, undefined]);
  expectEqual(
    items.map((item) => item.id).join(','),
    'nawl-0002,nawl-0003,nawl-0004',
    'null, undefined, and missing slots treated as missed'
  );
});

check('duplicate terms are deduplicated by id in first-missed order without inflating count', () => {
  const questions = [
    q('bsl-0001', 'equity', 'Özkaynak'),
    q('bsl-0002', 'audit', 'Denetim'),
    q('bsl-0001', 'equity', 'Özkaynak'),
    q('bsl-0003', 'lease', 'Kiralama'),
    q('bsl-0002', 'audit', 'Denetim'),
    q('bsl-0004', 'quota', 'Kota'),
  ];
  // bsl-0001 is right first then wrong later; bsl-0002 is wrong twice; bsl-0003 is wrong; bsl-0004 is right.
  const summary = buildQuizReview(questions, [true, false, false, false, false, true], 4);
  expectEqual(summary.missedIds.join(','), 'bsl-0002,bsl-0001,bsl-0003', 'unique missed ids in first-missed order');
  expectEqual(summary.missedItems.length, 3, '3 unique missed items despite 4 false slots');
  expectEqual(summary.canRetryMissed, false, 'deduplicated count 3 is below threshold 4');
});

check('retry threshold boundary checks below, at, and above MIN_SCOPED_QUIZ_SIZE', () => {
  const questions = [
    q('tsl-0001', 'agenda'),
    q('tsl-0002', 'budget'),
    q('tsl-0003', 'client'),
    q('tsl-0004', 'dealer'),
    q('tsl-0005', 'export'),
  ];
  const threeMissed = buildQuizReview(questions, [false, false, false, true, true], 4);
  expectEqual(threeMissed.missedIds.length, 3, '3 missed count');
  expectEqual(threeMissed.canRetryMissed, false, '3 < 4 disables retry');

  const fourMissed = buildQuizReview(questions, [false, false, false, false, true], 4);
  expectEqual(fourMissed.missedIds.length, 4, '4 missed count');
  expectEqual(fourMissed.canRetryMissed, true, '4 === 4 enables retry');

  const fiveMissed = buildQuizReview(questions, [false, null, false, false, false], Number.NaN);
  expectEqual(fiveMissed.missedIds.length, 5, '5 missed count');
  expectEqual(fiveMissed.canRetryMissed, true, '5 >= default 4 enables retry');
});

console.log(`quiz-review: ${passed} checks passed`);
