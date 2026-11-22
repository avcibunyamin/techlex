// Pure helpers for daily goal options and legacy default migration.
// No React/Expo imports, so it can be checked with `npx tsx lib/daily-goal.check.ts`.

export const DAILY_GOAL_OPTIONS = [10, 20, 30, 50] as const;
export type DailyGoalOption = (typeof DAILY_GOAL_OPTIONS)[number];

export const DEFAULT_DAILY_GOAL = 30;
export const LEGACY_DEFAULT_DAILY_GOAL = 10;

/**
 * Resolves a stored or cloud daily goal while preserving the legacy 10 -> 30 migration
 * for existing users who have never explicitly changed their daily goal (`dailyGoalUserSet !== true`).
 * Once the user explicitly chooses a goal (including 10), `dailyGoalUserSet` is true and 10 is kept.
 */
export function resolvePersistedDailyGoal(
  rawGoal: unknown,
  dailyGoalUserSet?: unknown
): number {
  const goal =
    typeof rawGoal === 'number' && Number.isFinite(rawGoal) && rawGoal > 0
      ? Math.floor(rawGoal)
      : 0;
  if (!goal) return DEFAULT_DAILY_GOAL;
  if (goal === LEGACY_DEFAULT_DAILY_GOAL && dailyGoalUserSet !== true) {
    return DEFAULT_DAILY_GOAL;
  }
  return goal;
}
