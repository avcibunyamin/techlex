// Run: npx tsx lib/spaced-repetition.check.ts
// Dependency-free checks for lib/spaced-repetition.ts; exits with a thrown error on the first failure.

import type { UserProgress } from '@/types';
import { createProgress, markKnown, markUnknown } from './spaced-repetition';

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

check('markKnown and markUnknown normalize out-of-range, decimal, or NaN box to 1 and keep nextReview finite', () => {
  const base = createProgress('ngsl-0001');
  const badBoxes = [0, -3, 6, 99, 2.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

  for (const badBox of badBoxes) {
    const corrupted: UserProgress = { ...base, box: badBox as UserProgress['box'] };
    const known = markKnown(corrupted);
    expectEqual(known.box, 2, `markKnown box for ${String(badBox)}`);
    if (!Number.isFinite(known.nextReview) || known.nextReview <= known.lastSeen) {
      throw new Error(`markKnown nextReview invalid for box=${String(badBox)}: ${String(known.nextReview)}`);
    }

    const unknown = markUnknown(corrupted);
    expectEqual(unknown.box, 1, `markUnknown box for ${String(badBox)}`);
    if (!Number.isFinite(unknown.nextReview) || unknown.nextReview !== unknown.lastSeen) {
      throw new Error(`markUnknown nextReview invalid for box=${String(badBox)}: ${String(unknown.nextReview)}`);
    }
  }
});

check('valid boxes 1..5 advance up to 5 on markKnown and reset to 1 on markUnknown', () => {
  let p = createProgress('ngsl-0002');
  expectEqual(p.box, 1, 'initial box');
  for (const expectedBox of [2, 3, 4, 5, 5] as const) {
    p = markKnown(p);
    expectEqual(p.box, expectedBox, `advance to ${expectedBox}`);
    if (!Number.isFinite(p.nextReview)) throw new Error('nextReview must be finite');
  }
  p = markUnknown(p);
  expectEqual(p.box, 1, 'reset to box 1');
  if (!Number.isFinite(p.nextReview)) throw new Error('nextReview after reset must be finite');
});

console.log(`spaced-repetition: ${passed} checks passed`);
