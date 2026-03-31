/**
 * Waldo — check-triggers Edge Function
 *
 * Called by pg_cron every 15 minutes (or manually for demo).
 * Checks if Morning Wag or Fetch Alert should fire.
 * If trigger fires → calls invoke-agent → sends via Telegram.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const forceTrigger: string | null = body.force_trigger ?? null; // 'morning_wag' | 'fetch_alert'

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Get user with telegram chat ID
    const { data: user } = await supabase
      .from('users')
      .select('id, telegram_chat_id, wake_time_estimate')
      .eq('id', DEMO_USER_ID)
      .single();

    if (!user?.telegram_chat_id) {
      return new Response(JSON.stringify({
        triggered: false,
        reason: 'No Telegram chat ID. User must /start the bot first.',
      }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    const now = new Date();
    const istHour = new Date(now.getTime() + 5.5 * 60 * 60 * 1000).getHours();
    const istMin = new Date(now.getTime() + 5.5 * 60 * 60 * 1000).getMinutes();
    const today = new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

    let triggerType: string | null = forceTrigger;
    let triggerReason = '';

    if (!triggerType) {
      // ─── Morning Wag check ────────────────────────────────
      // Parse wake time estimate (default 07:00)
      const [wakeH, wakeM] = (user.wake_time_estimate ?? '07:00').split(':').map(Number);
      const isWakeWindow = istHour === wakeH && istMin >= (wakeM ?? 0) && istMin < (wakeM ?? 0) + 15;

      if (isWakeWindow) {
        // Check if morning wag already sent today
        const { data: existing } = await supabase
          .from('conversation_history')
          .select('id')
          .eq('user_id', DEMO_USER_ID)
          .eq('mode', 'morning_wag')
          .gte('created_at', `${today}T00:00:00`)
          .limit(1);

        if (!existing || existing.length === 0) {
          triggerType = 'morning_wag';
          triggerReason = `Wake window (${istHour}:${String(istMin).padStart(2, '0')} IST)`;
        }
      }

      // ─── Fetch Alert check (rules pre-filter) ─────────────
      if (!triggerType) {
        const { data: latestCrs } = await supabase
          .from('crs_scores')
          .select('score, zone')
          .eq('user_id', DEMO_USER_ID)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: latestStress } = await supabase
          .from('stress_events')
          .select('confidence, severity')
          .eq('user_id', DEMO_USER_ID)
          .eq('date', today)
          .order('confidence', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Rules pre-filter: skip if CRS > 60 AND no high-confidence stress
        const crsScore = latestCrs?.score ?? 100;
        const stressConf = latestStress?.confidence ?? 0;

        if (crsScore <= 60 || stressConf >= 0.6) {
          // Check 2h cooldown
          const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
          const { data: recentAlerts } = await supabase
            .from('conversation_history')
            .select('id')
            .eq('user_id', DEMO_USER_ID)
            .eq('mode', 'fetch_alert')
            .gte('created_at', twoHoursAgo)
            .limit(1);

          if (!recentAlerts || recentAlerts.length === 0) {
            triggerType = 'fetch_alert';
            triggerReason = `CRS ${crsScore}, stress confidence ${(stressConf * 100).toFixed(0)}%`;
          }
        }
      }
    }

    if (!triggerType) {
      return new Response(JSON.stringify({
        triggered: false,
        reason: `No trigger. IST ${istHour}:${String(istMin).padStart(2, '0')}, date ${today}`,
      }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    // ─── Trigger fired → call invoke-agent ──────────────────
    console.log(`Trigger: ${triggerType} (${triggerReason || 'forced'})`);

    const agentUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/invoke-agent`;
    const agentResponse = await fetch(agentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        user_id: DEMO_USER_ID,
        trigger_type: triggerType,
        channel: 'telegram',
      }),
    });

    const agentResult = await agentResponse.json();
    const message = agentResult.message;

    if (!message) {
      return new Response(JSON.stringify({
        triggered: true,
        trigger_type: triggerType,
        delivered: false,
        reason: 'Agent returned no message',
        error: agentResult.error,
      }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    // ─── Send via Telegram ──────────────────────────────────
    const telegramUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-bot/send`;
    await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        chat_id: user.telegram_chat_id,
        message,
      }),
    });

    return new Response(JSON.stringify({
      triggered: true,
      trigger_type: triggerType,
      reason: triggerReason || 'forced',
      delivered: true,
      message,
      zone: agentResult.zone,
      crs_score: agentResult.crs_score,
    }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  } catch (err) {
    console.error('Check-triggers error:', err);
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : String(err),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
