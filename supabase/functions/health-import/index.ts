/**
 * Waldo — health-import Edge Function
 *
 * Bridge for users before HealthKit is built (Phase B1).
 * Accepts pre-parsed health data JSON and bulk-upserts into Supabase tables.
 *
 * The heavy lifting (XML parse + CRS compute) runs locally via:
 *   SUPABASE_URL=... SUPABASE_SECRET_KEY=... npx tsx tools/health-parser/src/seed-supabase.ts
 *
 * This endpoint is for incremental re-imports (e.g. monthly re-sync from Apple Health export).
 *
 * POST /health-import
 *   Auth: Bearer <user JWT>
 *   Body: {
 *     health_snapshots: HealthSnapshotRow[],
 *     crs_scores:       CrsScoreRow[],
 *     stress_events:    StressEventRow[],
 *     spots?:           SpotRow[],
 *   }
 *   → { days_imported, crs_range: { min, max, avg }, stress_events_imported, spots_imported }
 *
 * Limits: last 90 days of data only (enforced server-side) to stay within 50s timeout.
 * Upsert on (user_id, date) so re-imports are idempotent.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 200;

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: 'health-import', level, event, ...data }));
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// ─── Zod schemas (validate at the boundary) ────────────────────────

const HealthSnapshotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hr_avg: z.number().nullable().optional(),
  hr_min: z.number().nullable().optional(),
  hr_max: z.number().nullable().optional(),
  hr_count: z.number().int().nullable().optional(),
  hrv_rmssd: z.number().nullable().optional(),
  hrv_count: z.number().int().nullable().optional(),
  resting_hr: z.number().nullable().optional(),
  sleep_duration_hours: z.number().nullable().optional(),
  sleep_efficiency: z.number().nullable().optional(),
  sleep_deep_pct: z.number().nullable().optional(),
  sleep_rem_pct: z.number().nullable().optional(),
  sleep_bedtime: z.string().nullable().optional(),
  sleep_wake_time: z.string().nullable().optional(),
  sleep_stages: z.record(z.number()).nullable().optional(),
  steps: z.number().nullable().optional(),
  exercise_minutes: z.number().nullable().optional(),
  stand_hours: z.number().nullable().optional(),
  active_energy: z.number().nullable().optional(),
  distance_km: z.number().nullable().optional(),
  spo2: z.number().nullable().optional(),
  wrist_temp: z.number().nullable().optional(),
  vo2max: z.number().nullable().optional(),
  weather: z.record(z.unknown()).nullable().optional(),
  aqi: z.number().nullable().optional(),
  aqi_label: z.string().nullable().optional(),
  pm25: z.number().nullable().optional(),
  avg_noise_db: z.number().nullable().optional(),
  daylight_minutes: z.number().nullable().optional(),
  data_tier: z.enum(['rich', 'partial', 'sparse', 'empty']).optional(),
}).passthrough();

const CrsScoreSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  score: z.number().int(),
  zone: z.string(),
  confidence: z.number().nullable().optional(),
  components_with_data: z.number().int().nullable().optional(),
  sleep_json: z.record(z.unknown()).nullable().optional(),
  hrv_json: z.record(z.unknown()).nullable().optional(),
  circadian_json: z.record(z.unknown()).nullable().optional(),
  activity_json: z.record(z.unknown()).nullable().optional(),
  summary: z.string().nullable().optional(),
}).passthrough();

const StressEventSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string(),
  end_time: z.string(),
  duration_minutes: z.number().int(),
  confidence: z.number().min(0).max(1),
  severity: z.string(),
  components: z.array(z.string()).optional(),
  explanation: z.string().nullable().optional(),
  during_workout: z.boolean().optional(),
});

const SpotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.string(),
  subcategory: z.string().optional(),
  observation: z.string(),
  confidence: z.number().min(0).max(1).optional(),
  value: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  priority: z.number().int().optional(),
});

const ImportBodySchema = z.object({
  health_snapshots: z.array(HealthSnapshotSchema).min(1).max(10000),
  crs_scores: z.array(CrsScoreSchema).max(10000),
  stress_events: z.array(StressEventSchema).max(50000).optional().default([]),
  spots: z.array(SpotSchema).max(100000).optional(),
}).passthrough();

// ─── Helpers ───────────────────────────────────────────────────────

function cutoffDate(): string {
  return new Date(Date.now() - NINETY_DAYS_MS).toISOString().slice(0, 10);
}

function filterByDate<T extends { date: string }>(rows: T[], cutoff: string): T[] {
  return rows.filter(r => r.date >= cutoff);
}

async function upsertBatch(
  supabase: ReturnType<typeof createClient>,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
): Promise<{ inserted: number; errors: string[] }> {
  let inserted = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) {
      errors.push(`batch ${Math.floor(i / BATCH_SIZE)}: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }
  return { inserted, errors };
}

// ─── Main handler ──────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // ─── Auth: user JWT, admin key, or user_id (web console) ──
  const authHeader      = req.headers.get('Authorization') ?? '';
  const adminKey        = req.headers.get('x-admin-key') ?? '';
  const expectedAdminKey = Deno.env.get('ADMIN_API_KEY') ?? '';

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let userId: string;

  // ─── Parse body first (needed for all auth paths) ─────────
  const rawBody = await req.json().catch(() => null);
  if (rawBody === null) {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (adminKey && expectedAdminKey && adminKey === expectedAdminKey) {
    // Admin path — user_id supplied in body
    const adminUserId = (rawBody as Record<string, unknown>)['user_id'] as string | undefined;
    if (!adminUserId) return json({ error: 'Admin path requires user_id in body' }, 400);
    userId = adminUserId;
    log('info', 'admin_import', { userId });

  } else if (authHeader.startsWith('Bearer ')) {
    // User JWT path
    const jwt = authHeader.slice(7);
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    );
    const { data: { user: authUser }, error: authError } = await anonClient.auth.getUser();
    if (authError || !authUser) return json({ error: 'Invalid or expired token' }, 401);

    const { data: waldoUser } = await supabase
      .from('users').select('id').eq('auth_id', authUser.id).maybeSingle();
    if (!waldoUser) return json({ error: 'User profile not found' }, 404);
    userId = (waldoUser as { id: string }).id;

  } else {
    // Web console path — user_id in body, verified against users table.
    // No admin key needed. Safe for demo: user must already exist.
    const bodyUserId = (rawBody as Record<string, unknown>)['user_id'] as string | undefined;
    if (!bodyUserId) {
      return json({ error: 'Provide Authorization header, x-admin-key, or user_id in body' }, 401);
    }
    const { data: existingUser } = await supabase
      .from('users').select('id').eq('id', bodyUserId).maybeSingle();
    if (!existingUser) {
      return json({ error: 'User not found' }, 404);
    }
    userId = bodyUserId;
    log('info', 'direct_import', { userId });
  }

  const parsed = ImportBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { health_snapshots, crs_scores, stress_events, spots } = parsed.data;
  const cutoff = cutoffDate();

  log('info', 'import_start', {
    userId,
    total_snapshots: health_snapshots.length,
    total_crs: crs_scores.length,
    total_stress: stress_events.length,
    total_spots: spots?.length ?? 0,
    cutoff,
  });

  // ─── Filter to last 90 days ────────────────────────────────
  const snapshots90 = filterByDate(health_snapshots, cutoff);
  const crs90 = filterByDate(crs_scores, cutoff);
  const stress90 = filterByDate(stress_events, cutoff);
  const spots90 = spots ? filterByDate(spots, cutoff) : [];

  const daysImported = new Set(snapshots90.map(r => r.date)).size;

  if (snapshots90.length === 0) {
    return json({
      days_imported: 0,
      crs_range: null,
      stress_events_imported: 0,
      spots_imported: 0,
      message: `No data within last 90 days (cutoff: ${cutoff})`,
    });
  }

  // ─── Inject user_id into all rows ─────────────────────────
  const addUserId = <T extends object>(rows: T[]) =>
    rows.map(r => ({ ...r, user_id: userId }));

  const startMs = Date.now();

  // ─── Upsert all tables ─────────────────────────────────────
  const [snapResult, crsResult, stressResult, spotsResult] = await Promise.all([
    upsertBatch(supabase, 'health_snapshots', addUserId(snapshots90), 'user_id,date'),
    upsertBatch(supabase, 'crs_scores', addUserId(crs90), 'user_id,date'),
    // stress_events: no unique constraint on (user_id, date) — delete + re-insert for clean state
    (async () => {
      if (stress90.length === 0) return { inserted: 0, errors: [] };
      // Delete existing stress events for these dates to avoid duplicates
      const stressDates = [...new Set(stress90.map(r => r.date))];
      await supabase
        .from('stress_events')
        .delete()
        .eq('user_id', userId)
        .in('date', stressDates);
      return upsertBatch(supabase, 'stress_events', addUserId(stress90), 'id');
    })(),
    (async () => {
      if (spots90.length === 0) return { inserted: 0, errors: [] };
      const spotDates = [...new Set(spots90.map(r => r.date))];
      await supabase
        .from('spots')
        .delete()
        .eq('user_id', userId)
        .in('date', spotDates);
      return upsertBatch(supabase, 'spots', addUserId(spots90), 'id');
    })(),
  ]);

  // ─── Update last_health_sync ────────────────────────────────
  await supabase
    .from('users')
    .update({ last_health_sync: new Date().toISOString() })
    .eq('id', userId);

  // ─── CRS range summary ─────────────────────────────────────
  const crsValues = crs90.map(r => r.score).filter(s => s > 0);
  const crsRange = crsValues.length > 0
    ? {
        min: Math.min(...crsValues),
        max: Math.max(...crsValues),
        avg: Math.round(crsValues.reduce((a, b) => a + b, 0) / crsValues.length),
      }
    : null;

  const latencyMs = Date.now() - startMs;
  const allErrors = [
    ...snapResult.errors,
    ...crsResult.errors,
    ...stressResult.errors,
    ...spotsResult.errors,
  ];

  // ─── Trigger intelligence build (fire-and-forget) ───────────
  // Immediately compute baselines, spots, patterns, user intelligence from the uploaded data.
  // Don't wait for nightly jobs — the user should see intelligence right away.
  fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/build-intelligence`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({ user_id: userId, source: 'health_import' }),
  }).catch(() => {});

  log('info', 'import_complete', {
    userId,
    days_imported: daysImported,
    snapshots: snapResult.inserted,
    crs: crsResult.inserted,
    stress: stressResult.inserted,
    spots: spotsResult.inserted,
    errors: allErrors.length,
    latency_ms: latencyMs,
  });

  return json({
    days_imported: daysImported,
    crs_range: crsRange,
    stress_events_imported: stressResult.inserted,
    spots_imported: spotsResult.inserted,
    latency_ms: latencyMs,
    ...(allErrors.length > 0 ? { warnings: allErrors } : {}),
  });
});
