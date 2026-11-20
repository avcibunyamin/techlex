// Run: npx tsx lib/home-shortcut.check.ts
import { buildHomeShortcut, type HomeShortcutInput } from './home-shortcut';

const base: HomeShortcutInput = {
  hasProgress: true,
  totalDue: 0,
  activePackId: 'ngsl-1',
  activePackSeen: 0,
  activePackExists: true,
};

let passed = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${name}: expected ${e}, got ${a}`);
  }
  passed += 1;
}

check('no progress -> browse', buildHomeShortcut({ ...base, hasProgress: false, totalDue: 5, activePackSeen: 3 }), {
  kind: 'browse',
});

check('progress but nothing due and default pack unseen -> browse', buildHomeShortcut(base), { kind: 'browse' });

check('due only', buildHomeShortcut({ ...base, totalDue: 12 }), {
  kind: 'study',
  dueCount: 12,
  showDailyReview: true,
  continuePackId: null,
});

check('pack only', buildHomeShortcut({ ...base, activePackSeen: 4 }), {
  kind: 'study',
  dueCount: 0,
  showDailyReview: false,
  continuePackId: 'ngsl-1',
});

check('due and pack', buildHomeShortcut({ ...base, totalDue: 3, activePackSeen: 1 }), {
  kind: 'study',
  dueCount: 3,
  showDailyReview: true,
  continuePackId: 'ngsl-1',
});

check(
  'unknown or null pack is not resumable',
  [
    buildHomeShortcut({ ...base, totalDue: 2, activePackSeen: 9, activePackExists: false }),
    buildHomeShortcut({ ...base, totalDue: 2, activePackSeen: 9, activePackId: null }),
  ],
  [
    { kind: 'study', dueCount: 2, showDailyReview: true, continuePackId: null },
    { kind: 'study', dueCount: 2, showDailyReview: true, continuePackId: null },
  ]
);

check('negative/NaN due counts clamp to 0', buildHomeShortcut({ ...base, totalDue: Number.NaN, activePackSeen: 1 }), {
  kind: 'study',
  dueCount: 0,
  showDailyReview: false,
  continuePackId: 'ngsl-1',
});

console.log(`home-shortcut: ${passed} checks passed`);
