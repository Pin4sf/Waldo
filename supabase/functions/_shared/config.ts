// Shared configuration for all Edge Functions
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

export function getSupabaseClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

/** Look up users.id from a Telegram chat_id. Returns null if not linked. */
export async function getUserByChatId(
  supabase: SupabaseClient,
  chatId: number,
): Promise<{ id: string; onboarding_complete: boolean; timezone: string; wake_time_estimate: string; preferred_evening_time: string } | null> {
  const { data } = await supabase
    .from('users')
    .select('id, onboarding_complete, timezone, wake_time_estimate, preferred_evening_time')
    .eq('telegram_chat_id', chatId)
    .maybeSingle();
  return data ?? null;
}

/** Generate a 6-digit linking code and store it. Expires in 10 minutes. */
export async function createLinkingCode(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  // Invalidate any existing unused codes for this user
  await supabase
    .from('telegram_linking_codes')
    .update({ used: true })
    .eq('user_id', userId)
    .eq('used', false);

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await supabase
    .from('telegram_linking_codes')
    .insert({ user_id: userId, code, expires_at: expiresAt });

  return code;
}

/** Check idempotency — returns true if this message was already sent. */
export async function checkIdempotency(
  supabase: SupabaseClient,
  userId: string,
  triggerType: string,
  timeBucketMs = 15 * 60 * 1000,
): Promise<boolean> {
  const bucket = Math.floor(Date.now() / timeBucketMs);
  const key = `${userId}:${triggerType}:${bucket}`;
  const { data } = await supabase
    .from('sent_messages')
    .select('id')
    .eq('idempotency_key', key)
    .maybeSingle();
  return data !== null;
}

/** Record that a message was sent (idempotency write). */
export async function recordSent(
  supabase: SupabaseClient,
  userId: string,
  triggerType: string,
  channel: string,
  messagePreview: string,
  timeBucketMs = 15 * 60 * 1000,
): Promise<void> {
  const bucket = Math.floor(Date.now() / timeBucketMs);
  const key = `${userId}:${triggerType}:${bucket}`;
  await supabase.from('sent_messages').upsert(
    { user_id: userId, idempotency_key: key, trigger_type: triggerType, channel, message_preview: messagePreview.slice(0, 100) },
    { onConflict: 'idempotency_key', ignoreDuplicates: true },
  );
}
