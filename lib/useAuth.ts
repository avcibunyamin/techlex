import { useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from './supabase';

interface SignUpProfile {
  username: string;
  firstName: string;
  lastName: string;
  dob: string;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const sb = getSupabase();
    sb.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    if (!isSupabaseConfigured) return { error: { message: 'Supabase not configured' } };
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUpWithProfile = async (email: string, password: string, profile: SignUpProfile) => {
    if (!isSupabaseConfigured) return { data: null, error: { message: 'Supabase not configured' } };

    const sb = getSupabase();

    const { data: available, error: rpcErr } = await sb.rpc('is_username_available', { uname: profile.username });
    if (rpcErr) return { data: null, error: { message: rpcErr.message } };
    if (!available) return { data: null, error: { message: 'This username is already taken' } };

    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: profile.username,
          first_name: profile.firstName,
          last_name: profile.lastName,
          dob: profile.dob,
        },
      },
    });

    return { data, error };
  };

  const checkUsername = async (username: string): Promise<boolean> => {
    if (!isSupabaseConfigured) return true;
    const { data } = await getSupabase().rpc('is_username_available', { uname: username });
    return data ?? false;
  };

  const resetPasswordForEmail = async (email: string) => {
    if (!isSupabaseConfigured) return { error: { message: 'Supabase not configured' } };
    const { error } = await getSupabase().auth.resetPasswordForEmail(email);
    return { error };
  };

  const verifyOtpAndUpdatePassword = async (email: string, token: string, newPassword: string) => {
    if (!isSupabaseConfigured) return { error: { message: 'Supabase not configured' }, phase: 'verify' as const };
    const sb = getSupabase();
    const { error: verifyErr } = await sb.auth.verifyOtp({ email, token, type: 'recovery' });
    if (verifyErr) return { error: verifyErr, phase: 'verify' as const };
    const { error: updateErr } = await sb.auth.updateUser({ password: newPassword });
    return { error: updateErr, phase: 'update' as const };
  };

  const updatePassword = async (newPassword: string) => {
    if (!isSupabaseConfigured) return { error: { message: 'Supabase not configured' } };
    const { error } = await getSupabase().auth.updateUser({ password: newPassword });
    return { error };
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) return { error: null };
    const { error } = await getSupabase().auth.signOut();
    return { error };
  };

  const deleteAccount = async () => {
    if (!isSupabaseConfigured) return { error: { message: 'Supabase not configured' } };
    const sb = getSupabase();
    const { data, error } = await sb.rpc('delete_own_account');
    if (error) return { error };
    const result = data as { success?: boolean; error?: string } | null;
    if (!result?.success) return { error: { message: result?.error || 'delete_failed' } };
    await sb.auth.signOut();
    return { error: null };
  };

  return {
    session,
    user,
    loading,
    isConfigured: isSupabaseConfigured,
    signInWithEmail,
    signUpWithProfile,
    checkUsername,
    resetPasswordForEmail,
    verifyOtpAndUpdatePassword,
    updatePassword,
    signOut,
    deleteAccount,
  };
}
