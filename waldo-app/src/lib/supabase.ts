/**
 * Waldo Supabase client — shared across all screens.
 * All data helpers live here so screens stay clean.
 */
import { createClient } from '@supabase/supabase-js';
import { Linking } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
  ?? 'https://ogjgbudoedwxebxfgxpa.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9namdidWRvZWR3eGVieGZneHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NDg0NTgsImV4cCI6MjA5MDUyNDQ1OH0.z2AZE7K8d1irAx3Jm7jziC0MZj3azZgzgGtb9T2LNvc';

export const AGENT_URL = `${SUPABASE_URL}/functions/v1/invoke-agent`;
export const FN_URL    = `${SUPABASE_URL}/functions/v1`;
export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Accept: 'application/json' } },
});

// ─── Session-level active user ────────────────────────────────────
// Defaults to DEMO_USER_ID. Can be switched by admin.
let _activeUserId: string = DEMO_USER_ID;

export function getActiveUserId(): string { return _activeUserId; }
export function setActiveUserId(id: string): void { _activeUserId = id; }
export function resetToDefaultUser(): void { _activeUserId = DEMO_USER_ID; }

// ─── Onboarding state (SecureStore) ──────────────────────────────

export async function isOnboardingDone(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync('waldo_onboarding_done');
    return v === 'true';
  } catch { return false; }
}

export async function markOnboardingComplete(): Promise<void> {
  await SecureStore.setItemAsync('waldo_onboarding_done', 'true');
}

// ─── Integration / Sync Status ───────────────────────────────────

export interface SyncStatusEntry {
  provider: string;
  label: string;
  connected: boolean;
  status: 'ok' | 'error' | 'no_token' | 'token_expired' | 'pending' | 'not_connected';
  lastSyncAt: string | null;
  recordsSynced: number;
  lastError: string | null;
}

export async function fetchSyncStatus(userId = DEMO_USER_ID): Promise<SyncStatusEntry[]> {
  const [{ data: token }, { data: logs }] = await Promise.all([
    supabase.from('oauth_tokens').select('id').eq('user_id', userId).eq('provider', 'google').maybeSingle(),
    supabase.from('sync_log').select('provider, last_sync_at, last_sync_status, records_synced, last_error').eq('user_id', userId),
  ]);
  const connected = token !== null;
  return [
    { provider: 'google_calendar', label: 'Google Calendar', connected, lastSyncAt: null, recordsSynced: 0, lastError: null, status: 'not_connected' },
    { provider: 'gmail',           label: 'Gmail',           connected, lastSyncAt: null, recordsSynced: 0, lastError: null, status: 'not_connected' },
    { provider: 'google_tasks',    label: 'Google Tasks',    connected, lastSyncAt: null, recordsSynced: 0, lastError: null, status: 'not_connected' },
    { provider: 'spotify',         label: 'Spotify',         connected: false, lastSyncAt: null, recordsSynced: 0, lastError: null, status: 'not_connected' },
  ].map(base => {
    const log = (logs ?? []).find((l: Record<string, unknown>) => l['provider'] === base.provider);
    return {
      ...base,
      status: !connected ? 'not_connected' : ((log?.['last_sync_status'] as SyncStatusEntry['status']) ?? 'pending'),
      lastSyncAt: (log?.['last_sync_at'] as string | null) ?? null,
      recordsSynced: (log?.['records_synced'] as number) ?? 0,
      lastError: (log?.['last_error'] as string | null) ?? null,
    };
  });
}

export async function triggerSync(provider: string, userId = DEMO_USER_ID): Promise<void> {
  const fnMap: Record<string, string> = {
    google_calendar: 'sync-google-calendar',
    gmail:           'sync-gmail',
    google_tasks:    'sync-tasks',
    spotify:         'sync-spotify',
  };
  const fn = fnMap[provider];
  if (!fn) return;
  await fetch(`${FN_URL}/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  }).catch(() => {});
}

export function openGoogleConnect(userId = DEMO_USER_ID): void {
  const url = `${FN_URL}/oauth-google/connect?user_id=${userId}&scopes=calendar,gmail,tasks`;
  Linking.openURL(url).catch(() => {});
}

// ─── User Profile ─────────────────────────────────────────────────

export interface WaldoProfile {
  name: string;
  timezone: string;
  wakeTimeEstimate: string;
  preferredEveningTime: string;
  wearableType: string;
  telegramLinked: boolean;
  lastHealthSync: string | null;
  chronotype: string;
}

export async function fetchWaldoProfile(userId = DEMO_USER_ID): Promise<WaldoProfile | null> {
  const { data } = await supabase
    .from('users')
    .select('name, timezone, wake_time_estimate, preferred_evening_time, wearable_type, telegram_chat_id, last_health_sync, chronotype')
    .eq('id', userId)
    .maybeSingle();
  if (!data) return null;
  return {
    name:                 (data as Record<string, unknown>)['name'] as string ?? 'User',
    timezone:             (data as Record<string, unknown>)['timezone'] as string ?? 'UTC',
    wakeTimeEstimate:     (data as Record<string, unknown>)['wake_time_estimate'] as string ?? '07:00',
    preferredEveningTime: (data as Record<string, unknown>)['preferred_evening_time'] as string ?? '21:00',
    wearableType:         (data as Record<string, unknown>)['wearable_type'] as string ?? 'unknown',
    telegramLinked:       (data as Record<string, unknown>)['telegram_chat_id'] !== null,
    lastHealthSync:       (data as Record<string, unknown>)['last_health_sync'] as string | null ?? null,
    chronotype:           (data as Record<string, unknown>)['chronotype'] as string ?? 'normal',
  };
}

// ─── Core Memory ─────────────────────────────────────────────────

export interface MemoryEntry { key: string; value: string }

export async function fetchCoreMemory(userId = DEMO_USER_ID): Promise<MemoryEntry[]> {
  const { data } = await supabase.from('core_memory').select('key, value').eq('user_id', userId).order('key');
  return (data ?? []).map((m: Record<string, unknown>) => ({ key: m['key'] as string, value: m['value'] as string }));
}

// ─── Agent Logs ───────────────────────────────────────────────────

export interface AgentLogSummary {
  traceId: string; triggerType: string; totalTokens: number;
  latencyMs: number; deliveryStatus: string; estimatedCostUsd: number; createdAt: string;
}

export async function fetchRecentAgentLogs(userId = DEMO_USER_ID): Promise<AgentLogSummary[]> {
  const { data } = await supabase
    .from('agent_logs')
    .select('trace_id, trigger_type, total_tokens, latency_ms, delivery_status, estimated_cost_usd, created_at')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(10);
  return (data ?? []).map((l: Record<string, unknown>) => ({
    traceId:          l['trace_id'] as string,
    triggerType:      l['trigger_type'] as string,
    totalTokens:      l['total_tokens'] as number ?? 0,
    latencyMs:        l['latency_ms'] as number ?? 0,
    deliveryStatus:   l['delivery_status'] as string,
    estimatedCostUsd: l['estimated_cost_usd'] as number ?? 0,
    createdAt:        l['created_at'] as string,
  }));
}
