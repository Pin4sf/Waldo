/**
 * useAuth — authentication state for the Waldo app.
 *
 * Tracks Supabase Auth session + Waldo user profile.
 * Used to route between: unauthenticated → onboarding → main app.
 *
 * States:
 *   loading    — session check in progress (show splash)
 *   signed_out — no session (show sign-in screen)
 *   onboarding — has session, no users row yet (show profile setup)
 *   ready      — has session + users row (show dashboard)
 */
import { useState, useEffect } from 'react';
import { supabase, getWaldoUserId } from '@/adapters/sync/supabase-client';

export type AuthState = 'loading' | 'signed_out' | 'onboarding' | 'ready';

export interface WaldoUser {
  authId: string;
  waldoId: string;
  name: string;
  timezone: string;
  onboardingComplete: boolean;
  telegramLinked: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [user, setUser] = useState<WaldoUser | null>(null);

  async function checkAuthState() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      setAuthState('signed_out');
      setUser(null);
      return;
    }

    // Check if Waldo user profile exists
    const waldoId = await getWaldoUserId();
    if (!waldoId) {
      // Authenticated but no users row → needs onboarding
      setAuthState('onboarding');
      setUser(null);
      return;
    }

    // Fetch profile
    const { data: profile } = await supabase
      .from('users')
      .select('id, name, timezone, onboarding_complete, telegram_chat_id')
      .eq('id', waldoId)
      .maybeSingle();

    if (!profile) {
      setAuthState('onboarding');
      return;
    }

    setUser({
      authId: session.user.id,
      waldoId: profile.id,
      name: profile.name,
      timezone: profile.timezone ?? 'UTC',
      onboardingComplete: profile.onboarding_complete ?? false,
      telegramLinked: profile.telegram_chat_id !== null,
    });
    setAuthState('ready');
  }

  useEffect(() => {
    checkAuthState();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setAuthState('signed_out');
        setUser(null);
      } else {
        checkAuthState();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setAuthState('signed_out');
    setUser(null);
  }

  return { authState, user, signOut, refresh: checkAuthState };
}
