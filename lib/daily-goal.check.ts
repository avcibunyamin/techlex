// Run: npx tsx lib/daily-goal.check.ts
// Dependency-free checks for lib/daily-goal.ts; exits with a thrown error on the first failure.

import {
  DAILY_GOAL_OPTIONS,
  DEFAULT_DAILY_GOAL,
  resolvePersistedDailyGoal,
} from './daily-goal';

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

check('DAILY_GOAL_OPTIONS exposes 10, 20, 30, 50 in ascending order', () => {
  expectEqual(DAILY_GOAL_OPTIONS.join(','), '10,20,30,50', 'goal options');
  expectEqual(DEFAULT_DAILY_GOAL, 30, 'default daily goal');
});

check('missing or invalid stored goal falls back to 30', () => {
  expectEqual(resolvePersistedDailyGoal(undefined), 30, 'undefined');
  expectEqual(resolvePersistedDailyGoal(null), 30, 'null');
  expectEqual(resolvePersistedDailyGoal(0), 30, 'zero');
  expectEqual(resolvePersistedDailyGoal(-10), 30, 'negative');
  expectEqual(resolvePersistedDailyGoal(Number.NaN), 30, 'NaN');
});

check('legacy stored goal of 10 without dailyGoalUserSet migrates to 30', () => {
  expectEqual(resolvePersistedDailyGoal(10), 30, 'implicit legacy 10');
  expectEqual(resolvePersistedDailyGoal(10, false), 30, 'false flag legacy 10');
  expectEqual(resolvePersistedDailyGoal(10, undefined), 30, 'undefined flag legacy 10');
});

check('user-selected goal of 10 is preserved when dailyGoalUserSet is true', () => {
  expectEqual(resolvePersistedDailyGoal(10, true), 10, 'explicit user-set 10');
});

check('non-10 goals are preserved regardless of dailyGoalUserSet flag', () => {
  expectEqual(resolvePersistedDailyGoal(20, false), 20, '20 without flag');
  expectEqual(resolvePersistedDailyGoal(30, false), 30, '30 without flag');
  expectEqual(resolvePersistedDailyGoal(50, false), 50, '50 without flag');
  expectEqual(resolvePersistedDailyGoal(20, true), 20, '20 with flag');
  expectEqual(resolvePersistedDailyGoal(50, true), 50, '50 with flag');
});

console.log(`daily-goal: ${passed} checks passed`);
