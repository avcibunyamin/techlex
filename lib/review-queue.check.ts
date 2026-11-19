// Run: npx tsx lib/review-queue.check.ts
// Dependency-free checks for lib/review-queue.ts; exits with a thrown error on the first failure.

import { buildReviewQueue, DEFAULT_REVIEW_LIMIT, type ReviewProgressLike } from './review-queue';

type Card = { id: string };

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

function cards(...ids: string[]): Card[] {
  return ids.map((id) => ({ id }));
}

function ids(list: Card[]): string {
  return list.map((c) => c.id).join(',');
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

check('only cards with progress and a past/now due date are included', () => {
  const progress: Record<string, ReviewProgressLike> = {
    a: { box: 2, nextReview: NOW - DAY },
    b: { box: 2, nextReview: NOW + DAY },
    c: { box: 3, nextReview: NOW },
  };
  const result = buildReviewQueue([cards('a', 'b', 'c', 'new')], progress, NOW);
  expectEqual(ids(result.items), 'a,c', 'due ids');
  expectEqual(result.totalDue, 2, 'totalDue');
});

check('lower Leitner box comes first', () => {
  const progress: Record<string, ReviewProgressLike> = {
    a: { box: 4, nextReview: NOW - 10 * DAY },
    b: { box: 1, nextReview: NOW - 1 },
    c: { box: 2, nextReview: NOW - 5 * DAY },
  };
  const result = buildReviewQueue([cards('a', 'b', 'c')], progress, NOW);
  expectEqual(ids(result.items), 'b,c,a', 'box order');
});

check('within the same box the oldest due date comes first', () => {
  const progress: Record<string, ReviewProgressLike> = {
    a: { box: 2, nextReview: NOW - 1 * DAY },
    b: { box: 2, nextReview: NOW - 3 * DAY },
    c: { box: 2, nextReview: NOW - 2 * DAY },
  };
  const result = buildReviewQueue([cards('a', 'b', 'c')], progress, NOW);
  expectEqual(ids(result.items), 'b,c,a', 'due date order');
});

check('default limit is 25 while totalDue counts every due card', () => {
  const list: Card[] = [];
  const progress: Record<string, ReviewProgressLike> = {};
  for (let i = 0; i < 40; i++) {
    const id = `t${String(i).padStart(2, '0')}`;
    list.push({ id });
    progress[id] = { box: 2, nextReview: NOW - i };
  }
  const result = buildReviewQueue([list], progress, NOW);
  expectEqual(DEFAULT_REVIEW_LIMIT, 25, 'default constant');
  expectEqual(result.items.length, 25, 'capped length');
  expectEqual(result.totalDue, 40, 'totalDue');
  // Oldest due (t39) first.
  expectEqual(result.items[0]?.id, 't39', 'first item');
});

check('custom limit, zero and negative limits', () => {
  const progress: Record<string, ReviewProgressLike> = {
    a: { box: 1, nextReview: NOW - 2 },
    b: { box: 1, nextReview: NOW - 1 },
  };
  expectEqual(ids(buildReviewQueue([cards('a', 'b')], progress, NOW, 1).items), 'a', 'limit 1');
  expectEqual(buildReviewQueue([cards('a', 'b')], progress, NOW, 0).items.length, 0, 'limit 0');
  expectEqual(buildReviewQueue([cards('a', 'b')], progress, NOW, -5).items.length, 0, 'negative limit');
  expectEqual(buildReviewQueue([cards('a', 'b')], progress, NOW, 0).totalDue, 2, 'totalDue with limit 0');
});

check('cards from several sources (packs + IT terms) are merged and deduplicated', () => {
  const progress: Record<string, ReviewProgressLike> = {
    'ngsl-0001': { box: 3, nextReview: NOW - DAY },
    'bsl-0002': { box: 1, nextReview: NOW - DAY },
    'cyber-001': { box: 2, nextReview: NOW - DAY },
  };
  const result = buildReviewQueue(
    [cards('ngsl-0001', 'ngsl-0002'), cards('bsl-0002'), cards('cyber-001', 'ngsl-0001')],
    progress,
    NOW
  );
  expectEqual(ids(result.items), 'bsl-0002,cyber-001,ngsl-0001', 'merged order');
  expectEqual(result.totalDue, 3, 'no duplicates');
});

check('invalid box is treated as box 1 and invalid due date is skipped', () => {
  const progress: Record<string, ReviewProgressLike> = {
    a: { box: 2, nextReview: NOW - DAY },
    b: { box: 0, nextReview: NOW - 1 },
    c: { box: 2, nextReview: Number.NaN },
  };
  const result = buildReviewQueue([cards('a', 'b', 'c')], progress, NOW);
  expectEqual(ids(result.items), 'b,a', 'normalized order');
});

check('equal box and due date fall back to id order (stable output)', () => {
  const progress: Record<string, ReviewProgressLike> = {
    z: { box: 2, nextReview: NOW - DAY },
    m: { box: 2, nextReview: NOW - DAY },
  };
  const result = buildReviewQueue([cards('z', 'm')], progress, NOW);
  expectEqual(ids(result.items), 'm,z', 'tie-break');
});

check('empty input gives an empty queue', () => {
  const result = buildReviewQueue<Card>([], {}, NOW);
  expectEqual(result.items.length, 0, 'items');
  expectEqual(result.totalDue, 0, 'totalDue');
});

check('non-finite now returns an empty queue', () => {
  const progress: Record<string, ReviewProgressLike> = {
    a: { box: 1, nextReview: NOW - DAY },
  };
  for (const badNow of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const result = buildReviewQueue([cards('a')], progress, badNow);
    expectEqual(result.items.length, 0, `items for now=${String(badNow)}`);
    expectEqual(result.totalDue, 0, `totalDue for now=${String(badNow)}`);
  }
});

console.log(`review-queue: ${passed} checks passed`);
