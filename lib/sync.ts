import { getSupabase, isSupabaseConfigured } from './supabase';
import { UserProgress } from '@/types';
import { getDeviceTimeZone } from './date-utils';

export interface SwipeEvent {
  id: string;
  termId: string;
  action: 'right' | 'left';
  timestamp: number;
}

export interface BatchResult {
  synced: boolean;
  accepted: number;
  rejected: number;
  duplicates: number;
  sentCount: number;
  energy?: number;
  error: unknown;
}

const BATCH_LIMIT = 50;

export async function pushBatchSwipes(
  events: SwipeEvent[],
): Promise<BatchResult> {
  const empty: BatchResult = { synced: false, accepted: 0, rejected: 0, duplicates: 0, sentCount: 0, error: null };
  if (!isSupabaseConfigured || events.length === 0) return empty;

  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const startUserId = sessionData.session?.user?.id;
  if (!startUserId) return empty;

  let totalAccepted = 0;
  let totalRejected = 0;
  let totalDuplicates = 0;
  let totalSent = 0;
  let lastEnergy: number | undefined;

  for (let i = 0; i < events.length; i += BATCH_LIMIT) {
    if (i > 0) {
      const { data: check } = await supabase.auth.getSession();
      if (check.session?.user?.id !== startUserId) {
        return { synced: false, accepted: totalAccepted, rejected: totalRejected, duplicates: totalDuplicates, sentCount: totalSent, energy: lastEnergy, error: 'user_changed' };
      }
    }

    const chunk = events.slice(i, i + BATCH_LIMIT);
    const { data, error } = await supabase.rpc('process_swipe_events', {
      p_events: chunk.map((event) => ({
        event_id: event.id,
        term_id: event.termId,
        action: event.action,
        occurred_at: new Date(event.timestamp).toISOString(),
      })),
    });

    if (error) {
      return { synced: false, accepted: totalAccepted, rejected: totalRejected, duplicates: totalDuplicates, sentCount: totalSent, energy: lastEnergy, error };
    }

    const result = data as { success?: boolean; accepted?: number; rejected?: number; duplicates?: number; energy?: number } | null;
    if (!result?.success) {
      return { synced: false, accepted: totalAccepted, rejected: totalRejected, duplicates: totalDuplicates, sentCount: totalSent, energy: lastEnergy, error: data };
    }

    totalSent += chunk.length;
    totalAccepted += result.accepted ?? 0;
    totalRejected += result.rejected ?? 0;
    totalDuplicates += result.duplicates ?? 0;
    lastEnergy = result.energy;
  }

  return { synced: true, accepted: totalAccepted, rejected: totalRejected, duplicates: totalDuplicates, sentCount: totalSent, energy: lastEnergy, error: null };
}

export async function pushPreferences(meta: {
    dailyGoal: number;
    selectedTags: string[];
    language: string;
    hasCompletedOnboarding: boolean;
  }): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { data, error } = await getSupabase().rpc('sync_user_preferences', {
    p_daily_goal: meta.dailyGoal,
    p_selected_tags: meta.selectedTags,
    p_language: meta.language,
    p_has_completed_onboarding: meta.hasCompletedOnboarding,
    p_timezone: getDeviceTimeZone(),
  });
  if (error) throw error;
  const result = data as { success?: boolean; error?: string } | null;
  if (result?.success !== true) {
    throw new Error(result?.error || 'preference_sync_failed');
  }
}

export async function pullProgress(userId: string) {
  if (!isSupabaseConfigured) return { progress: {}, profile: null };
  const supabase = getSupabase();

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError && profileError.code !== 'PGRST116') throw profileError;

  const { data: rows, error: rowsError } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId);
  if (rowsError) throw rowsError;

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
          xp: profile.xp ?? 0,
          longestStreak: profile.longest_streak ?? 0,
          subscriptionTier: profile.subscription_tier ?? 'free',
          cancelAtPeriodEnd: profile.cancel_at_period_end ?? false,
          currentPeriodEnd: profile.current_period_end
            ? new Date(profile.current_period_end).getTime()
            : null,
          energyLevel: profile.subscription_tier === 'free'
            ? (profile.energy_level ?? 30)
            : 999,
          lastEnergyRefill: profile.last_energy_refill
            ? new Date(profile.last_energy_refill).getTime()
            : Date.now(),
          selectedTags: profile.selected_tags ?? [],
          language: profile.language ?? 'tr',
          hasCompletedOnboarding: profile.has_completed_onboarding ?? false,
        }
      : null,
  };
}
