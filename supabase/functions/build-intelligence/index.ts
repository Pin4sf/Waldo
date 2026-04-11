/**
 * Waldo — build-intelligence Edge Function
 *
 * Runs IMMEDIATELY after health data upload or first Google sync.
 * Builds intelligence from historical data — no LLM cost, pure computation.
 *
 * Pipeline:
 *   1. BASELINES — 7-day rolling averages (HRV, sleep, HR, steps, activity)
 *   2. SPOTS — Individual observations about the user's data
 *   3. PATTERNS — Recurring themes across days (3+ occurrences)
 *   4. USER INTELLIGENCE — Summary profile from all computed data
 *   5. PROVISION DO — Activate the Cloudflare Durable Object agent brain
 *
 * Called by:
 *   - health-import (after successful XML upload)
 *   - OAuth callbacks (after first Google/Spotify sync)
 *   - Manually via POST with { user_id }
 *
 * Cost: $0.00 per run (no LLM calls — pure TypeScript computation)
 */
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'build-intelligence', level, event, ...data }));
}

// ─── 1. Compute Baselines ────────────────────────────────────────

async function computeBaselines(supabase: SupabaseClient, userId: string): Promise<Record<string, unknown>> {
  const { data: health } = await supabase
    .from('health_snapshots')
    .select('date, hrv_rmssd, resting_hr, sleep_duration_hours, sleep_efficiency, steps, exercise_minutes')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(30);

  if (!health || health.length === 0) return {};

  const last7 = health.slice(0, 7);
  const last14 = health.slice(0, 14);
  const last30 = health;

  const avg = (arr: any[], key: string) => {
    const nums = arr.map(d => d[key]).filter((n: any) => n != null && n > 0);
    return nums.length > 0 ? nums.reduce((s: number, n: number) => s + n, 0) / nums.length : null;
  };

  const baselines = {
    hrv_baseline_7d: avg(last7, 'hrv_rmssd'),
    hrv_baseline_14d: avg(last14, 'hrv_rmssd'),
    sleep_avg_7d: avg(last7, 'sleep_duration_hours'),
    sleep_avg_14d: avg(last14, 'sleep_duration_hours'),
    resting_hr_baseline: avg(last7, 'resting_hr'),
    steps_avg_7d: avg(last7, 'steps'),
    steps_avg_30d: avg(last30, 'steps'),
    exercise_avg_7d: avg(last7, 'exercise_minutes'),
    days_of_data: health.length,
    baselines_established: health.length >= 7,
    data_richness: health.filter((d: any) => d.hrv_rmssd && d.sleep_duration_hours).length,
  };

  // Store in core_memory
  for (const [key, value] of Object.entries(baselines)) {
    if (value == null) continue;
    await supabase.from('core_memory').upsert({
      user_id: userId,
      key,
      value: String(typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(2)) : value),
      hall_type: 'facts',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,key' });
  }

  return baselines;
}

// ─── 2. Generate Spots (Observations) ────────────────────────────

interface Spot {
  date: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
}

async function generateSpots(supabase: SupabaseClient, userId: string): Promise<number> {
  // Load ALL data dimensions for cross-domain spot generation
  const [
    { data: crsData }, { data: healthData },
    { data: calData }, { data: emailData },
    { data: taskData }, { data: moodData },
  ] = await Promise.all([
    supabase.from('crs_scores').select('date, score, zone').eq('user_id', userId).gte('score', 0).order('date', { ascending: true }),
    supabase.from('health_snapshots').select('date, hrv_rmssd, resting_hr, sleep_duration_hours, sleep_efficiency, steps, exercise_minutes').eq('user_id', userId).order('date', { ascending: true }),
    supabase.from('calendar_metrics').select('date, meeting_load_score, event_count, back_to_back_count, boundary_violations, total_meeting_minutes').eq('user_id', userId).order('date'),
    supabase.from('email_metrics').select('date, total_emails, after_hours_count, after_hours_ratio, sent_count').eq('user_id', userId).order('date'),
    supabase.from('task_metrics').select('date, pending_count, overdue_count, completed_today').eq('user_id', userId).order('date'),
    supabase.from('mood_metrics').select('date, dominant_mood, avg_energy, avg_valence, late_night_listening, listening_minutes').eq('user_id', userId).order('date'),
  ]);

  if (!crsData || !healthData || crsData.length < 3) return 0;

  // Build lookup maps for cross-domain joins
  const calMap = new Map((calData ?? []).map((c: any) => [c.date, c]));
  const emailMap = new Map((emailData ?? []).map((e: any) => [e.date, e]));
  const taskMap = new Map((taskData ?? []).map((t: any) => [t.date, t]));
  const moodMap = new Map((moodData ?? []).map((m: any) => [m.date, m]));

  const spots: Spot[] = [];
  const crsMap = new Map(crsData.map((c: any) => [c.date, c]));
  const healthMap = new Map(healthData.map((h: any) => [h.date, h]));

  // Compute averages for comparison
  const avgCrs = crsData.reduce((s: number, c: any) => s + c.score, 0) / crsData.length;
  const sleepDays = healthData.filter((h: any) => h.sleep_duration_hours);
  const avgSleep = sleepDays.length > 0 ? sleepDays.reduce((s: number, h: any) => s + h.sleep_duration_hours, 0) / sleepDays.length : 7;
  const hrvDays = healthData.filter((h: any) => h.hrv_rmssd);
  const avgHrv = hrvDays.length > 0 ? hrvDays.reduce((s: number, h: any) => s + h.hrv_rmssd, 0) / hrvDays.length : null;

  for (const crs of crsData) {
    const health = healthMap.get(crs.date) as any;
    if (!health) continue;

    // Low CRS days
    if (crs.score < 40) {
      spots.push({
        date: crs.date, type: 'health', severity: 'warning',
        title: `Depleted day (Nap Score ${crs.score})`,
        detail: `Score significantly below your average of ${avgCrs.toFixed(0)}`,
      });
    }

    // Peak CRS days
    if (crs.score >= 85) {
      spots.push({
        date: crs.date, type: 'health', severity: 'info',
        title: `Peak day (Nap Score ${crs.score})`,
        detail: `One of your best days — strong recovery`,
      });
    }

    // Short sleep
    if (health.sleep_duration_hours && health.sleep_duration_hours < 5.5) {
      spots.push({
        date: crs.date, type: 'health', severity: 'warning',
        title: `Short sleep (${health.sleep_duration_hours.toFixed(1)}h)`,
        detail: `Well below your average of ${avgSleep.toFixed(1)}h`,
      });
    }

    // Great sleep
    if (health.sleep_duration_hours && health.sleep_duration_hours > 8) {
      spots.push({
        date: crs.date, type: 'health', severity: 'info',
        title: `Solid sleep (${health.sleep_duration_hours.toFixed(1)}h)`,
        detail: `Above your average — good recovery night`,
      });
    }

    // HRV drops
    if (avgHrv && health.hrv_rmssd && health.hrv_rmssd < avgHrv * 0.7) {
      spots.push({
        date: crs.date, type: 'health', severity: 'warning',
        title: `HRV drop (${Math.round(health.hrv_rmssd)}ms vs ${Math.round(avgHrv)}ms avg)`,
        detail: `30%+ below your baseline — body under stress`,
      });
    }

    // High activity days
    if (health.steps && health.steps > 15000) {
      spots.push({
        date: crs.date, type: 'activity', severity: 'info',
        title: `High activity day (${health.steps.toLocaleString()} steps)`,
        detail: `Significantly above average — check next-day recovery`,
      });
    }

    // Low activity days
    if (health.steps != null && health.steps < 2000 && health.steps > 0) {
      spots.push({
        date: crs.date, type: 'activity', severity: 'info',
        title: `Sedentary day (${health.steps.toLocaleString()} steps)`,
        detail: `Movement was very low`,
      });
    }
  }

  // CRS streak detection — consecutive days below 50
  let streakStart = '';
  let streakLen = 0;
  for (const crs of crsData) {
    if (crs.score < 50) {
      if (streakLen === 0) streakStart = crs.date;
      streakLen++;
    } else {
      if (streakLen >= 3) {
        spots.push({
          date: streakStart, type: 'pattern', severity: 'warning',
          title: `${streakLen}-day low streak starting ${streakStart}`,
          detail: `CRS below 50 for ${streakLen} consecutive days — burnout signal`,
        });
      }
      streakLen = 0;
    }
  }

  // Day-of-week analysis
  const dayScores: Record<string, number[]> = {};
  for (const crs of crsData) {
    const dayName = new Date(crs.date + 'T12:00:00Z').toLocaleDateString('en', { weekday: 'long' });
    if (!dayScores[dayName]) dayScores[dayName] = [];
    dayScores[dayName]!.push(crs.score);
  }

  for (const [day, scores] of Object.entries(dayScores)) {
    if (scores.length < 3) continue;
    const dayAvg = scores.reduce((s, n) => s + n, 0) / scores.length;
    if (dayAvg < avgCrs - 10) {
      spots.push({
        date: crsData[crsData.length - 1]!.date, type: 'pattern', severity: 'info',
        title: `${day}s tend to be your worst day (avg ${dayAvg.toFixed(0)} vs ${avgCrs.toFixed(0)})`,
        detail: `Based on ${scores.length} ${day}s in your data`,
      });
    }
    if (dayAvg > avgCrs + 10) {
      spots.push({
        date: crsData[crsData.length - 1]!.date, type: 'pattern', severity: 'info',
        title: `${day}s tend to be your best day (avg ${dayAvg.toFixed(0)} vs ${avgCrs.toFixed(0)})`,
        detail: `Based on ${scores.length} ${day}s in your data`,
      });
    }
  }

  // ─── CROSS-DOMAIN SPOTS ─────────────────────────────────────────

  // Calendar × Health: heavy meeting days → next-day health impact
  if ((calData ?? []).length >= 3) {
    const avgMeetingLoad = (calData ?? []).reduce((s: number, c: any) => s + (c.meeting_load_score ?? 0), 0) / calData!.length;

    for (const cal of (calData ?? [])) {
      // Heavy meeting day
      if (cal.meeting_load_score > 8) {
        spots.push({
          date: cal.date, type: 'schedule', severity: 'warning',
          title: `Heavy meeting load (${cal.meeting_load_score.toFixed(1)}/15)`,
          detail: `${cal.event_count} meetings, ${cal.total_meeting_minutes}min total. Above your avg of ${avgMeetingLoad.toFixed(1)}.`,
        });
      }
      // Back-to-back meetings
      if (cal.back_to_back_count >= 2) {
        spots.push({
          date: cal.date, type: 'schedule', severity: 'warning',
          title: `${cal.back_to_back_count} back-to-back meetings`,
          detail: `No recovery gaps between meetings — cognitive load compounds`,
        });
      }
      // Boundary violations (meetings outside 7am-7pm)
      if (cal.boundary_violations > 0) {
        spots.push({
          date: cal.date, type: 'schedule', severity: 'info',
          title: `${cal.boundary_violations} meetings outside core hours`,
          detail: `Boundary violations affect recovery and sleep onset`,
        });
      }

      // Meeting load → next-day CRS correlation
      const nextDate = new Date(new Date(cal.date + 'T12:00:00Z').getTime() + 86400000).toISOString().slice(0, 10);
      const nextCrs = crsMap.get(nextDate);
      if (nextCrs && cal.meeting_load_score > avgMeetingLoad + 3 && nextCrs.score < avgCrs - 10) {
        spots.push({
          date: cal.date, type: 'correlation', severity: 'warning',
          title: `Heavy meetings → low score next day`,
          detail: `Meeting load ${cal.meeting_load_score.toFixed(1)} on ${cal.date} → CRS ${nextCrs.score} on ${nextDate}. Pattern suggests meetings drain recovery.`,
        });
      }
    }
  }

  // Email × Health: after-hours email → sleep impact
  if ((emailData ?? []).length >= 3) {
    const avgEmails = (emailData ?? []).reduce((s: number, e: any) => s + (e.total_emails ?? 0), 0) / emailData!.length;

    for (const email of (emailData ?? [])) {
      // High after-hours ratio
      if (email.after_hours_ratio > 0.4) {
        spots.push({
          date: email.date, type: 'communication', severity: 'warning',
          title: `${Math.round(email.after_hours_ratio * 100)}% emails after hours`,
          detail: `${email.after_hours_count} of ${email.total_emails} emails outside working hours — late digital load`,
        });
      }
      // Volume spike
      if (email.total_emails > avgEmails * 1.5 && avgEmails > 5) {
        spots.push({
          date: email.date, type: 'communication', severity: 'info',
          title: `Email volume spike (${email.total_emails} vs avg ${Math.round(avgEmails)})`,
          detail: `${Math.round((email.total_emails / avgEmails) * 100)}% of your normal volume`,
        });
      }

      // After-hours email → next-day sleep impact
      if (email.after_hours_ratio > 0.5) {
        const nextDate = new Date(new Date(email.date + 'T12:00:00Z').getTime() + 86400000).toISOString().slice(0, 10);
        const nextHealth = healthMap.get(nextDate) as any;
        if (nextHealth?.sleep_duration_hours && nextHealth.sleep_duration_hours < avgSleep - 1) {
          spots.push({
            date: email.date, type: 'correlation', severity: 'warning',
            title: `Late emails → short sleep`,
            detail: `${Math.round(email.after_hours_ratio * 100)}% after-hours email on ${email.date} → ${nextHealth.sleep_duration_hours.toFixed(1)}h sleep (${(avgSleep - nextHealth.sleep_duration_hours).toFixed(1)}h below avg)`,
          });
        }
      }
    }
  }

  // Task × Health: overdue tasks + low CRS = burnout signal
  for (const task of (taskData ?? [])) {
    if (task.overdue_count >= 3) {
      spots.push({
        date: task.date, type: 'tasks', severity: 'warning',
        title: `${task.overdue_count} overdue tasks`,
        detail: `Task pile-up — ${task.pending_count} pending total`,
      });
    }
    const dayCrs = crsMap.get(task.date);
    if (task.overdue_count >= 2 && dayCrs && dayCrs.score < 50) {
      spots.push({
        date: task.date, type: 'correlation', severity: 'warning',
        title: `Task overload + low energy`,
        detail: `${task.overdue_count} overdue tasks on a day with CRS ${dayCrs.score}. Prioritize or defer.`,
      });
    }
  }

  // Mood × Health: music mood correlations
  for (const mood of (moodData ?? [])) {
    if (mood.late_night_listening) {
      spots.push({
        date: mood.date, type: 'behavior', severity: 'info',
        title: `Late-night listening detected`,
        detail: `Music activity after 11pm — may delay sleep onset`,
      });
    }
    if (mood.dominant_mood === 'melancholic' || mood.dominant_mood === 'intense') {
      const dayCrs = crsMap.get(mood.date);
      if (dayCrs && dayCrs.score < 50) {
        spots.push({
          date: mood.date, type: 'correlation', severity: 'info',
          title: `${mood.dominant_mood} music + low Form`,
          detail: `Music mood aligns with CRS ${dayCrs.score} — body and mind in sync`,
        });
      }
    }
  }

  // Sleep-CRS correlation spot
  const sleepCrsPairs = crsData
    .map((c: any) => ({ score: c.score, sleep: (healthMap.get(c.date) as any)?.sleep_duration_hours }))
    .filter((p: any) => p.sleep);

  if (sleepCrsPairs.length >= 10) {
    const goodSleep = sleepCrsPairs.filter((p: any) => p.sleep >= 7);
    const badSleep = sleepCrsPairs.filter((p: any) => p.sleep < 6);
    if (goodSleep.length >= 3 && badSleep.length >= 3) {
      const goodAvg = goodSleep.reduce((s: number, p: any) => s + p.score, 0) / goodSleep.length;
      const badAvg = badSleep.reduce((s: number, p: any) => s + p.score, 0) / badSleep.length;
      if (goodAvg - badAvg > 10) {
        spots.push({
          date: crsData[crsData.length - 1]!.date, type: 'correlation', severity: 'info',
          title: `Sleep drives your score: 7h+ → ${goodAvg.toFixed(0)} avg, <6h → ${badAvg.toFixed(0)} avg`,
          detail: `${(goodAvg - badAvg).toFixed(0)} point difference based on ${sleepCrsPairs.length} days`,
        });
      }
    }
  }

  // Aggregate: meeting load vs CRS (if enough data)
  if ((calData ?? []).length >= 5) {
    const heavyMeetingDays = (calData ?? []).filter((c: any) => c.meeting_load_score >= 6);
    const lightMeetingDays = (calData ?? []).filter((c: any) => c.meeting_load_score < 4);
    const heavyCrs = heavyMeetingDays.map((c: any) => crsMap.get(c.date)?.score).filter(Boolean) as number[];
    const lightCrs = lightMeetingDays.map((c: any) => crsMap.get(c.date)?.score).filter(Boolean) as number[];
    if (heavyCrs.length >= 2 && lightCrs.length >= 2) {
      const heavyAvg = heavyCrs.reduce((a, b) => a + b, 0) / heavyCrs.length;
      const lightAvg = lightCrs.reduce((a, b) => a + b, 0) / lightCrs.length;
      if (Math.abs(lightAvg - heavyAvg) > 8) {
        spots.push({
          date: crsData[crsData.length - 1]!.date, type: 'correlation', severity: 'info',
          title: `Meeting load affects your Form: light days → ${lightAvg.toFixed(0)} avg, heavy → ${heavyAvg.toFixed(0)} avg`,
          detail: `${Math.abs(lightAvg - heavyAvg).toFixed(0)} point difference across ${heavyCrs.length + lightCrs.length} measured days`,
        });
      }
    }
  }

  // Aggregate: after-hours email vs next-day sleep (if enough data)
  if ((emailData ?? []).length >= 5) {
    const highAH = (emailData ?? []).filter((e: any) => e.after_hours_ratio > 0.4);
    const lowAH = (emailData ?? []).filter((e: any) => e.after_hours_ratio <= 0.2);
    const getNextSleep = (date: string) => {
      const next = new Date(new Date(date + 'T12:00:00Z').getTime() + 86400000).toISOString().slice(0, 10);
      return (healthMap.get(next) as any)?.sleep_duration_hours;
    };
    const highAHSleep = highAH.map((e: any) => getNextSleep(e.date)).filter(Boolean) as number[];
    const lowAHSleep = lowAH.map((e: any) => getNextSleep(e.date)).filter(Boolean) as number[];
    if (highAHSleep.length >= 2 && lowAHSleep.length >= 2) {
      const highAvg = highAHSleep.reduce((a, b) => a + b, 0) / highAHSleep.length;
      const lowAvg = lowAHSleep.reduce((a, b) => a + b, 0) / lowAHSleep.length;
      if (lowAvg - highAvg > 0.5) {
        spots.push({
          date: crsData[crsData.length - 1]!.date, type: 'correlation', severity: 'warning',
          title: `After-hours email costs you ${(lowAvg - highAvg).toFixed(1)}h of sleep`,
          detail: `High after-hours email nights → ${highAvg.toFixed(1)}h sleep. Low email nights → ${lowAvg.toFixed(1)}h sleep.`,
        });
      }
    }
  }

  // Store spots (delete existing + re-insert for this user)
  if (spots.length > 0) {
    const spotRows = spots.map(s => ({
      user_id: userId,
      date: s.date,
      type: s.type,
      severity: s.severity,
      title: s.title,
      detail: s.detail,
      signals: [],
    }));

    // Delete previous spots for this user to avoid duplicates on re-run
    await supabase.from('spots').delete().eq('user_id', userId);
    // Insert in batches
    for (let i = 0; i < spotRows.length; i += 100) {
      const { error } = await supabase.from('spots').insert(spotRows.slice(i, i + 100));
      if (error) log('error', 'spots_insert_failed', { batch: Math.floor(i / 100), error: error.message });
    }
  }

  return spots.length;
}

// ─── 3. Promote Patterns ─────────────────────────────────────────

async function promotePatterns(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data: spots } = await supabase
    .from('spots')
    .select('type, title, date, severity')
    .eq('user_id', userId)
    .order('date', { ascending: true });

  if (!spots || spots.length < 3) return 0;

  // Count title occurrences (normalized)
  const titleCounts = new Map<string, { count: number; dates: string[]; type: string; severity: string }>();
  for (const s of spots) {
    const key = s.title?.toLowerCase().trim().slice(0, 60);
    if (!key) continue;
    const existing = titleCounts.get(key) ?? { count: 0, dates: [], type: s.type, severity: s.severity };
    existing.count++;
    existing.dates.push(s.date);
    titleCounts.set(key, existing);
  }

  let promoted = 0;
  for (const [title, info] of titleCounts) {
    if (info.count < 3) continue;

    const confidence = Math.min(0.9, 0.5 + info.count * 0.05);
    const firstSeen = info.dates.sort()[0];
    const lastSeen = info.dates.sort().reverse()[0];

    const { data: existing } = await supabase
      .from('patterns')
      .select('id, evidence_count')
      .eq('user_id', userId)
      .ilike('summary', `%${title.slice(0, 30)}%`)
      .maybeSingle();

    if (existing) {
      await supabase.from('patterns').update({
        evidence_count: Math.max(existing.evidence_count, info.count),
        confidence, last_seen: lastSeen,
      }).eq('id', existing.id);
    } else {
      await supabase.from('patterns').insert({
        user_id: userId,
        type: info.type === 'correlation' ? 'correlation' : info.type === 'pattern' ? 'weekly' : 'health',
        confidence,
        summary: title.slice(0, 200),
        evidence_count: info.count,
        first_seen: firstSeen,
        last_seen: lastSeen,
      });
      promoted++;
    }
  }

  return promoted;
}

// ─── 4. Build User Intelligence ──────────────────────────────────

async function buildUserIntelligence(supabase: SupabaseClient, userId: string): Promise<void> {
  const [{ data: memories }, { data: patterns }, { data: health7d }, { data: crs7d }, { data: calMetrics }, { data: emailMetrics }] = await Promise.all([
    supabase.from('core_memory').select('key, value, hall_type').eq('user_id', userId),
    supabase.from('patterns').select('summary, confidence, evidence_count').eq('user_id', userId).gte('confidence', 0.5),
    supabase.from('health_snapshots').select('date, sleep_duration_hours, hrv_rmssd, steps').eq('user_id', userId).order('date', { ascending: false }).limit(7),
    supabase.from('crs_scores').select('date, score, zone').eq('user_id', userId).gte('score', 0).order('date', { ascending: false }).limit(7),
    supabase.from('calendar_metrics').select('meeting_load_score, event_count').eq('user_id', userId).order('date', { ascending: false }).limit(7),
    supabase.from('email_metrics').select('total_emails, after_hours_ratio').eq('user_id', userId).order('date', { ascending: false }).limit(7),
  ]);

  const avg = (arr: any[], key: string) => {
    const nums = (arr ?? []).map(d => d[key]).filter((n: any) => n != null);
    return nums.length > 0 ? nums.reduce((s: number, n: number) => s + n, 0) / nums.length : null;
  };

  const avgCrs = avg(crs7d, 'score');
  const avgSleep = avg(health7d, 'sleep_duration_hours');
  const avgHrv = avg((health7d ?? []).filter((h: any) => h.hrv_rmssd), 'hrv_rmssd');
  const avgSteps = avg((health7d ?? []).filter((h: any) => h.steps > 0), 'steps');
  const avgMls = avg(calMetrics, 'meeting_load_score');
  const avgEmails = avg(emailMetrics, 'total_emails');
  const highConfPatterns = (patterns ?? []).filter((p: any) => p.confidence >= 0.7);

  const parts: string[] = [];
  if (avgCrs != null) parts.push(`7d CRS avg: ${avgCrs.toFixed(0)}`);
  if (avgSleep != null) parts.push(`Sleep avg: ${avgSleep.toFixed(1)}h`);
  if (avgHrv != null) parts.push(`HRV baseline: ${avgHrv.toFixed(0)}ms`);
  if (avgSteps != null) parts.push(`Steps avg: ${Math.round(avgSteps).toLocaleString()}`);
  if (avgMls != null) parts.push(`Meeting load avg: ${avgMls.toFixed(1)}/15`);
  if (avgEmails != null) parts.push(`Email volume avg: ${avgEmails.toFixed(0)}/day`);
  parts.push(`Patterns: ${(patterns ?? []).length} (${highConfPatterns.length} high confidence)`);
  parts.push(`Memory entries: ${(memories ?? []).length}`);
  parts.push(`Source: historical analysis (${(health7d ?? []).length > 0 ? 'last 7d' : 'limited data'})`);

  const summary = parts.join('. ');

  await supabase.from('user_intelligence').upsert({
    user_id: userId,
    summary,
    crs_patterns: {
      avg_7d: avgCrs != null ? +avgCrs.toFixed(0) : null,
      trend: (crs7d ?? []).map((c: any) => ({ date: c.date, score: c.score })),
    },
    sleep_patterns: { avg_7d: avgSleep != null ? +avgSleep.toFixed(1) : null },
    baselines: (memories ?? []).filter((m: any) => m.key?.includes('baseline') || m.key?.includes('7d')),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

// ─── 5. Provision DO (activate agent brain) ──────────────────────

async function provisionDO(userId: string): Promise<boolean> {
  const workerUrl = Deno.env.get('WALDO_WORKER_URL');
  const workerSecret = Deno.env.get('WALDO_WORKER_SECRET');
  if (!workerUrl) return false;

  try {
    const res = await fetch(`${workerUrl}/provision/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(workerSecret ? { 'x-waldo-secret': workerSecret } : {}),
      },
      body: JSON.stringify({ user_id: userId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Main handler ────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }});
  }

  const startMs = Date.now();
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const userId = body['user_id'] as string;
  const source = (body['source'] as string) ?? 'manual';

  if (!userId) {
    return new Response(JSON.stringify({ error: 'user_id required' }), {
      status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  log('info', 'intelligence_build_start', { userId, source });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Run all stages
  const [baselines, spotsCount, patternsPromoted] = await Promise.all([
    computeBaselines(supabase, userId),
    generateSpots(supabase, userId),
    promotePatterns(supabase, userId),
  ]);

  // Build intelligence (depends on baselines + patterns being computed first)
  await buildUserIntelligence(supabase, userId);

  // Provision DO (fire-and-forget — don't block response)
  const doProvisioned = await provisionDO(userId);

  const latencyMs = Date.now() - startMs;

  log('info', 'intelligence_build_complete', {
    userId, source, latencyMs,
    baselines_computed: Object.keys(baselines).length,
    spots_generated: spotsCount,
    patterns_promoted: patternsPromoted,
    do_provisioned: doProvisioned,
  });

  return new Response(JSON.stringify({
    user_id: userId,
    baselines_computed: Object.keys(baselines).length,
    spots_generated: spotsCount,
    patterns_promoted: patternsPromoted,
    user_intelligence_built: true,
    do_provisioned: doProvisioned,
    latency_ms: latencyMs,
    source,
    message: `Intelligence built from historical data. ${spotsCount} observations, ${patternsPromoted} new patterns.`,
  }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
});
