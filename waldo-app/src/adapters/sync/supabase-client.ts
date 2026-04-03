/**
 * Typed Supabase client for the Waldo app.
 *
 * NOTE: Supabase free tier pauses after 7 days of inactivity.
 * The pg_cron check-triggers function fires every 15 minutes and acts as a keep-alive.
 * If the project appears to be paused, check the Supabase dashboard.
 *
 * Credentials come from environment variables — NEVER hardcode or log these.
 */

import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (__DEV__ && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn('[Supabase] Missing credentials. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** Returns true if the current session is valid (authenticated with a real account). */
export async function ensureAuth(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  return session !== null;
}

/**
 * Get the Waldo users.id (NOT auth.uid()) for the current user.
 * This is the foreign key used in health_snapshots, crs_scores, etc.
 * Returns null if not authenticated or no matching users row.
 */
export async function getWaldoUserId(): Promise<string | null> {
  const { data, error } = await supabase.rpc('waldo_user_id');
  if (error || !data) return null;
  return data as string;
}

/** Get the Supabase Auth user ID (auth.uid()) — used for auth flows only. */
export async function getAuthUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}
