import { getSupabase, isSupabaseConfigured } from './supabase';
import { UserProgress } from '@/types';

export async function pushProgress(
  userId: string,
  progress: Record<string, UserProgress>,
  meta: {
    streak: number;
    lastActiveDate: string | null;
    dailyGoal: number;
    todayCount: number;
    totalSwipes: number;
    selectedTags: string[];
    language: string;
    hasCompletedOnboarding: boolean;
  }
) {
  if (!isSupabaseConfigured) return;
  const supabase = getSupabase();

  const progressRows = Object.values(progress).map((p) => ({
    user_id: userId,
    term_id: p.termId,
    box: p.box,
    last_seen: new Date(p.lastSeen).toISOString(),
    next_review: new Date(p.nextReview).toISOString(),
    times_correct: p.timesCorrect,
    times_seen: p.timesSeen,
  }));

  if (progressRows.length > 0) {
    await supabase
      .from('user_progress')
      .upsert(progressRows, { onConflict: 'user_id,term_id' });
  }

  await supabase
    .from('user_profiles')
    .upsert(
      {
        id: userId,
        streak: meta.streak,
        last_active_date: meta.lastActiveDate,
        daily_goal: meta.dailyGoal,
        today_count: meta.todayCount,
        total_swipes: meta.totalSwipes,
        selected_tags: meta.selectedTags,
        language: meta.language,
        has_completed_onboarding: meta.hasCompletedOnboarding,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
}

export async function pullProgress(userId: string) {
  if (!isSupabaseConfigured) return { progress: {}, profile: null };
  const supabase = getSupabase();

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  const { data: rows } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId);

  const progress: Record<string, UserProgress> = {};
  if (rows) {
    for (const row of rows) {
      progress[row.term_id] = {
        termId: row.term_id,
        box: row.box,
        lastSeen: new Date(row.last_seen).getTime(),
        nextReview: new Date(row.next_review).getTime(),
        timesCorrect: row.times_correct,
        timesSeen: row.times_seen,
      };
    }
  }

  return {
    progress,
    profile: profile
      ? {
          streak: profile.streak ?? 0,
          lastActiveDate: profile.last_active_date ?? null,
          dailyGoal: profile.daily_goal ?? 10,
          todayCount: profile.today_count ?? 0,
          totalSwipes: profile.total_swipes ?? 0,
          selectedTags: profile.selected_tags ?? [],
          language: profile.language ?? 'tr',
          hasCompletedOnboarding: profile.has_completed_onboarding ?? false,
        }
      : null,
  };
}
