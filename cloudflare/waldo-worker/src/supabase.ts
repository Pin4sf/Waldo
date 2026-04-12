/**
 * Supabase client for the Durable Object.
 * Health data lives in Supabase — DO reads it via REST, never stores raw values.
 */
import type { Env, UserProfile, CrsScore, HealthSnapshot } from './types';

export function supabaseFetch(env: Env, path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options?.headers ?? {}),
    },
  });
}

export async function fetchUserProfile(userId: string, env: Env): Promise<UserProfile | null> {
  const res = await supabaseFetch(env,
    `users?id=eq.${userId}&select=id,name,timezone,wake_time_estimate,preferred_evening_time,wearable_type,telegram_chat_id,is_admin`
  );
  if (!res.ok) return null;
  const data = await res.json() as Array<Record<string, unknown>>;
  const u = data[0];
  if (!u) return null;
  return {
    id: u['id'] as string,
    name: u['name'] as string,
    timezone: (u['timezone'] as string) ?? 'UTC',
    wakeTimeEstimate: (u['wake_time_estimate'] as string) ?? '07:00',
    preferredEveningTime: (u['preferred_evening_time'] as string) ?? '21:00',
    wearableType: (u['wearable_type'] as string) ?? 'unknown',
    telegramChatId: (u['telegram_chat_id'] as number | null),
    isAdmin: (u['is_admin'] as boolean) ?? false,
  };
}

export async function fetchLatestCRS(userId: string, env: Env): Promise<CrsScore | null> {
  const res = await supabaseFetch(env,
    `crs_scores?user_id=eq.${userId}&score=gte.0&order=date.desc&limit=1&select=date,score,zone,sleep_json,hrv_json`
  );
  if (!res.ok) return null;
  const data = await res.json() as Array<Record<string, unknown>>;
  const row = data[0];
  if (!row) return null;
  return {
    date: row['date'] as string,
    score: row['score'] as number,
    zone: row['zone'] as CrsScore['zone'],
    sleepJson: row['sleep_json'] as Record<string, unknown> | null,
    hrvJson: row['hrv_json'] as Record<string, unknown> | null,
  };
}

export async function fetchHealthSnapshot(userId: string, date: string, env: Env): Promise<HealthSnapshot | null> {
  const res = await supabaseFetch(env,
    `health_snapshots?user_id=eq.${userId}&date=eq.${date}&select=date,hrv_rmssd,resting_hr,sleep_duration_hours,sleep_efficiency,steps,data_tier`
  );
  if (!res.ok) return null;
  const data = await res.json() as Array<Record<string, unknown>>;
  const row = data[0];
  if (!row) return null;
  return row as unknown as HealthSnapshot;
}

export async function fetchCoreMemoryFromSupabase(userId: string, env: Env): Promise<Record<string, string>> {
  const res = await supabaseFetch(env, `core_memory?user_id=eq.${userId}&select=key,value`);
  if (!res.ok) return {};
  const data = await res.json() as Array<{ key: string; value: string }>;
  return Object.fromEntries(data.map(r => [r.key, r.value]));
}

export async function syncMemoryToSupabase(userId: string, key: string, value: string, env: Env): Promise<void> {
  await supabaseFetch(env, 'core_memory', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, key, value, updated_at: new Date().toISOString() }),
    headers: { Prefer: 'resolution=merge-duplicates' },
  });
}

export async function saveConversationToSupabase(
  userId: string,
  role: 'user' | 'waldo',
  content: string,
  triggerType: string,
  env: Env,
): Promise<void> {
  await supabaseFetch(env, 'conversation_history', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, role, content, mode: triggerType, channel: 'cloudflare_do' }),
  });
}

export async function saveAgentLog(
  userId: string,
  triggerType: string,
  tokensIn: number,
  tokensOut: number,
  latencyMs: number,
  deliveryStatus: string,
  costUsd: number,
  env: Env,
): Promise<void> {
  await supabaseFetch(env, 'agent_logs', {
    method: 'POST',
    body: JSON.stringify({
      trace_id: crypto.randomUUID(),
      user_id: userId,
      trigger_type: triggerType,
      tools_called: [],
      iterations: 1,
      total_tokens: tokensIn + tokensOut,
      latency_ms: latencyMs,
      delivery_status: deliveryStatus,
      llm_fallback_level: 1,
      estimated_cost_usd: costUsd,
    }),
  });
}

/** Log an agent action to waldo_actions (The Patrol feed). Fire-and-forget. */
export async function saveWaldoAction(
  userId: string,
  date: string,
  triggerType: string,
  zone: string,
  score: number,
  toolsCalled: string[],
  env: Env,
): Promise<void> {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  const actionMap: Record<string, string> = {
    morning_wag: 'Sent The Brief',
    evening_review: 'Sent The Close',
    fetch_alert: 'Fired The Fetch — stress elevated',
    conversational: 'Responded to chat',
    onboarding: 'Completed onboarding step',
  };
  const actionText = actionMap[triggerType] ?? `Ran ${triggerType}`;
  const actionType = triggerType === 'conversational' ? 'reactive' : 'proactive';
  const reasonText = toolsCalled.length > 0
    ? `Used ${toolsCalled.slice(0, 3).join(', ')}${toolsCalled.length > 3 ? ` +${toolsCalled.length - 3} more` : ''}`
    : `${zone} zone · Form ${Math.round(score)}`;

  await supabaseFetch(env, 'waldo_actions', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId, date, time: timeStr,
      action: actionText, reason: reasonText,
      type: actionType,
    }),
    headers: { Prefer: 'return=minimal' },
  });
}

export async function sendTelegramMessage(chatId: number, text: string, env: Env): Promise<boolean> {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  return res.ok;
}
