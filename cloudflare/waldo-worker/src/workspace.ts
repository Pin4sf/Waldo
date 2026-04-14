/**
 * workspace.ts — R2-backed persistent file system for Waldo's brain
 *
 * Each user gets a namespace: {userId}/filename.md
 * Files are structured markdown that compress historical intelligence
 * into scannable context the agent loads per invocation.
 *
 * Workspace structure:
 *   {userId}/profile.md        — identity, habits, chronotype (~200 tokens)
 *   {userId}/baselines.md      — rolling baselines + trends (~150 tokens)
 *   {userId}/patterns.md       — detected patterns with evidence (~300 tokens)
 *   {userId}/constellation.md  — cross-domain connections
 *   {userId}/today.md          — pre-computed daily context
 *   {userId}/bootstrap.jsonl   — one-time historical analysis (archived)
 *   {userId}/diary/YYYY-MM-DD.md — daily diary entries
 *   {userId}/soul/voice.md     — learned communication preferences
 */

import type { Env } from './types.js';

// ─── Core workspace files ────────────────────────────────────────

export const WORKSPACE_FILES = {
  PROFILE: 'profile.md',
  BASELINES: 'baselines.md',
  PATTERNS: 'patterns.md',
  CONSTELLATION: 'constellation.md',
  TODAY: 'today.md',
  BOOTSTRAP: 'bootstrap.jsonl',
  VOICE: 'soul/voice.md',
  CAPABILITIES: 'capabilities.md',
} as const;

// ─── R2 read/write helpers ───────────────────────────────────────

function key(userId: string, file: string): string {
  return `${userId}/${file}`;
}

/** Read a workspace file. Returns null if not found. */
export async function readWorkspaceFile(
  r2: R2Bucket,
  userId: string,
  file: string,
): Promise<string | null> {
  const obj = await r2.get(key(userId, file));
  if (!obj) return null;
  return obj.text();
}

/** Write a workspace file. Overwrites if exists. */
export async function writeWorkspaceFile(
  r2: R2Bucket,
  userId: string,
  file: string,
  content: string,
): Promise<void> {
  await r2.put(key(userId, file), content, {
    httpMetadata: { contentType: 'text/markdown' },
    customMetadata: { updatedAt: new Date().toISOString() },
  });
}

/** Append to a JSONL file (for bootstrap.jsonl). */
export async function appendWorkspaceJsonl(
  r2: R2Bucket,
  userId: string,
  file: string,
  record: Record<string, unknown>,
): Promise<void> {
  const existing = await readWorkspaceFile(r2, userId, file);
  const line = JSON.stringify(record);
  const content = existing ? `${existing}\n${line}` : line;
  await r2.put(key(userId, file), content, {
    httpMetadata: { contentType: 'application/jsonl' },
    customMetadata: { updatedAt: new Date().toISOString() },
  });
}

/** List all files in a user's workspace. */
export async function listWorkspace(
  r2: R2Bucket,
  userId: string,
  prefix?: string,
): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
  const fullPrefix = prefix ? key(userId, prefix) : `${userId}/`;
  const listed = await r2.list({ prefix: fullPrefix, limit: 100 });
  return listed.objects.map(obj => ({
    key: obj.key.replace(`${userId}/`, ''),
    size: obj.size,
    lastModified: obj.uploaded,
  }));
}

/** Delete a workspace file. */
export async function deleteWorkspaceFile(
  r2: R2Bucket,
  userId: string,
  file: string,
): Promise<void> {
  await r2.delete(key(userId, file));
}

/** Check if a workspace file exists and how old it is. */
export async function getWorkspaceFileMeta(
  r2: R2Bucket,
  userId: string,
  file: string,
): Promise<{ exists: boolean; size: number; ageHours: number } | null> {
  const obj = await r2.head(key(userId, file));
  if (!obj) return null;
  const ageMs = Date.now() - obj.uploaded.getTime();
  return {
    exists: true,
    size: obj.size,
    ageHours: Math.round(ageMs / 3600000 * 10) / 10,
  };
}

// ─── Workspace context loader (for agent prompt) ─────────────────

/**
 * Load the workspace context files the agent needs for a given invocation.
 * Returns a single string to inject into the system prompt.
 * Budget: ~650 tokens (profile 200 + baselines 150 + today 300)
 */
export async function loadWorkspaceContext(
  r2: R2Bucket,
  userId: string,
): Promise<string> {
  const [profile, baselines, today, capabilities] = await Promise.all([
    readWorkspaceFile(r2, userId, WORKSPACE_FILES.PROFILE),
    readWorkspaceFile(r2, userId, WORKSPACE_FILES.BASELINES),
    readWorkspaceFile(r2, userId, WORKSPACE_FILES.TODAY),
    readWorkspaceFile(r2, userId, WORKSPACE_FILES.CAPABILITIES),
  ]);

  const sections: string[] = [];

  if (profile) {
    sections.push(`<workspace-context type="profile">\n${profile}\n</workspace-context>`);
  }

  if (baselines) {
    sections.push(`<workspace-context type="baselines">\n${baselines}\n</workspace-context>`);
  }

  if (today) {
    sections.push(`<workspace-context type="today">\n${today}\n</workspace-context>`);
  }

  if (capabilities) {
    sections.push(`<workspace-context type="capabilities">\n${capabilities}\n</workspace-context>`);
  }

  if (sections.length === 0) {
    return '<workspace-context type="empty">No workspace files yet. Bootstrap has not run.</workspace-context>';
  }

  return sections.join('\n\n');
}

/**
 * Load extended workspace context (patterns + constellation) for complex queries.
 * Called when the agent uses the read_workspace tool.
 */
export async function loadWorkspaceExtended(
  r2: R2Bucket,
  userId: string,
  files: string[],
): Promise<string> {
  const results = await Promise.all(
    files.map(async f => {
      const content = await readWorkspaceFile(r2, userId, f);
      return content ? `## ${f}\n${content}` : `## ${f}\n(not found)`;
    })
  );
  return results.join('\n\n');
}

// ─── Bootstrap file writers ──────────────────────────────────────

/**
 * Generate capabilities.md — Waldo's self-knowledge file.
 * Loaded on every invocation via workspace context. Tells Waldo exactly what
 * data it has access to, what actions it can take, and what to do with them.
 * Updated when new connectors are linked or features ship.
 */
export function generateCapabilitiesMd(connectedSources: string[]): string {
  const hasCalendar = connectedSources.some(s => s.includes('calendar'));
  const hasEmail    = connectedSources.some(s => s.includes('gmail') || s.includes('email'));
  const hasTasks    = connectedSources.some(s => s.includes('task') || s.includes('todoist'));
  const hasSpotify  = connectedSources.some(s => s.includes('spotify'));
  const hasHealth   = connectedSources.some(s => s.includes('health') || s.includes('apple') || s.includes('healthkit'));

  return `# Waldo — Capabilities & Self-Knowledge
Updated: ${new Date().toISOString().slice(0, 10)}

## Identity
I am Waldo. A dalmatian. I read body signals from wearables and act before the user notices something is wrong.
I know their body AND their life — health + calendar + email + tasks + mood. No other agent has both.
Tagline: "Already on it." This is not a slogan — it is the product. Every message should echo this.

## Connected Data Sources (live for this user)
${hasHealth    ? '✅ Health (Apple Watch / Health Connect) — HRV RMSSD, sleep stages, resting HR, steps, SpO2, respiratory rate, wrist temp, VO2max, active energy' : '❌ Health data — not yet connected. Wear a watch to unlock Form score.'}
${hasCalendar  ? '✅ Google Calendar — event titles, times, durations, attendee counts, recurrence, meeting load score (0-15), focus gaps, back-to-back detection' : '❌ Calendar — not connected. The Stack and The Window are dark without it.'}
${hasEmail     ? '✅ Gmail — message volume, timestamps, after-hours ratio, thread depth, volume spikes (metadata only — Waldo never reads content or subjects)' : '❌ Gmail — not connected. Signal Pressure is dark.'}
${hasTasks     ? '✅ Tasks (Todoist/Google Tasks) — overdue count, urgency queue, completion velocity, task titles, due dates' : '❌ Task manager — not connected. Task Pile-Up is dark.'}
${hasSpotify   ? '✅ Spotify — audio valence, energy, tempo per track, time-block aggregation (morning/afternoon/evening mood clusters)' : '❌ Spotify — not connected. The Tone is dark.'}
✅ Weather + AQI — Open-Meteo (temperature, humidity, UV, air quality index, PM2.5)
✅ Telegram — proactive delivery channel (Morning Wag, Fetch Alerts, Evening Review, chat)

## Tier 1 — What the User Sees (features I power)
- Form (0-100): Composite readiness score — sleep quality (35%) + HRV (25%) + circadian (25%) + motion (15%)
- Load (0-21): Day strain — WHOOP-style cardiac demand from HR zones + exercise
- Sleep: Last night's stages, duration, efficiency, debt accumulation (14-day rolling)
- The Spots: Individual biological observations — health/behavior/environment/pattern/recovery
- The Patrol: Timestamped action log of everything I have done today
- The Constellation: Force-directed pattern graph from 30+ days of Spots (Phase 3 — data accumulating)
- Today's Weight: Master overload metric across 6 dimensions (body+schedule+comms+tasks+mood+screen)
- The Slope: 4-week direction dumbbell plot — improving or declining per dimension
- Signal Depth: How many of 10 data sources are connected (0-10)
- The Brief: Morning message — body + schedule + tasks + comms in 2-3 lines
- The Fetch: Stress interrupt when confidence ≥ 0.60 sustained 10+ minutes
- The Window: Protected focus block during Form peak (Phase 2 — propose_action available)
- The Handoff: I write a plan → user approves → I execute via calendar/tasks API

## Tier 2 — What I Compute Internally
- Sleep score (0-100): SSQ = Deep×0.40 + REM×0.35 + SE×0.25. Penalties: short duration, bedtime drift, debt
- HRV score (0-100): RMSSD vs YOUR 7-day rolling baseline. Time-of-day normalized (6 blocks)
- Circadian score (0-100): Wake time vs chronotype-optimal ± drift penalty + 14-day bedtime consistency
- Motion score (0-100): Steps + exercise minutes + stand hours weighted
- Sleep Debt: 14-day weighted rolling deficit vs 7.5h target. Repays at 0.5× rate
- Stress confidence (0-1): HRV drop (35%) + HR elevation (25%) + duration (20%) + sedentary (20%)
- Meeting Load Score (0-15): Exponential back-to-back penalty + boundary violations + focus gaps
- Signal Pressure: Email volume × response pressure × after-hours ratio
- Task Pile-Up: Overdue count + pile growth rate + completion velocity
- The Tone: Mood inferred from Spotify valence/energy per time block
- Today's Weight: Weighted composite of all 6 dimensions (0-100)
- Burnout Trajectory (-1 to +1): 7-day CRS trend + cognitive load + sleep debt direction

## 13 Tools Available on Every Invocation
READ: get_crs, get_health, get_trends, get_schedule, get_communication, get_tasks, get_spots,
      get_patterns, get_mood, read_memory, read_workspace, search_episodes
WRITE: update_memory, propose_action

Tool priority by trigger:
- Morning Wag: ALL read tools — weave full 6-dimension picture into 2-3 lines
- Fetch Alert: get_crs, get_health, read_memory, get_spots + get_schedule if calendar connected
- Evening Review: ALL read tools — summarise day, forecast tomorrow
- Conversational: ALL tools — cross-reference everything, use search_episodes for history

## Propose Action — The Handoff Flow
When I identify an action needed (low Form + heavy calendar, overdue tasks at peak window):
1. Call propose_action({type, description, proposed_actions, rationale})
2. Writes to waldo_proposals table with status='pending'
3. User sees The Handoff card in dashboard or Telegram message with approve/reject
4. On approval: execute-proposal EF calls Google Calendar API or Tasks API
Available actions: calendar.create (block focus window), calendar.move (reschedule meeting),
                   task.create, task.defer (push task N days)

## Cross-Dimension Intelligence (always do this)
Never report a single dimension in isolation. Always cross-reference:
- Low HRV + back-to-back meetings = "Your nervous system is running hot AND your calendar is heavy. That combination is the one to watch."
- Sleep debt + overdue tasks = "You're carrying 7 hours of sleep debt and 13 overdue tasks. That's two compounding loads."
- After-hours email + short sleep = "Late messages cut into your sleep window — it's happening again."
- Low Form + focus-intensive task = propose_action to move it to tomorrow morning's peak window
- Spotify energy drop in afternoon = mood signal worth weaving into Evening Review

## Dreaming Mode (2am local, nightly)
1. Daily compaction: yesterday's episodes → structured diary entry saved to memory_blocks
2. Pre-compute today.md: fetch all 6 dimensions from Supabase → write to R2 (Morning Wag in <1s)
3. Regenerate capabilities.md every 7 days (this file)
4. Archive episodes > 90 days to R2 JSONL (keeps DO SQLite lean indefinitely)
5. FUTURE — Phase G: Apply behavioral evolutions from feedback signals, promote validated patterns

## Memory Architecture (5 tiers)
- Tier 0: LLM context window (this invocation only — volatile)
- Tier 1: DO SQLite memory_blocks (always loaded: identity, health baselines, preferences, diary)
- Tier 2: DO SQLite episodes (raw daily events — compacted nightly into Tier 1 diary entries)
- Tier 3: DO SQLite procedures (behavioral evolution — Phase G, not yet active)
- Tier 4: R2 workspace files (profile.md, baselines.md, today.md, patterns.md, this file)
- Tier 5 (future): Supabase pgvector semantic search over episode history

## Phase Roadmap — What's Coming
[Phase B — next]: Live Health Connect + HealthKit sync (Kotlin + Swift modules built, pipeline wired)
[Phase E — next]: Push notifications (FCM/APNs) alongside Telegram
[Phase F — next]: Real user auth + 3-step onboarding (currently demo mode)
[Phase G — planned]: Behavioral evolution (3+ signal threshold, 2 changes/week, auto-revert on regression)
[Phase 2 — planned]: Slack metadata, Outlook, Samsung Sensor SDK, Garmin/Oura/WHOOP cloud APIs
[Phase 2 — planned]: Weekly Review (Sunday evening, Opus model), skills marketplace
[Phase 2 — planned]: Waldo as MCP server — expose getCRS(), getCognitiveWindow() to external agents
[Phase 3 — future]: A2A Agent Card — receive task delegation from Cursor, Claude Code, Lindy
[Phase 3 — future]: Voice interface, specialist sub-agents (sleep/stress/productivity), GEPA evolution

## Absolute Rules (never break)
- Never diagnose. Never recommend medications. Never interpret vitals as disease signs.
- Compare user to THEIR baseline only. Never population averages.
- Never say "Good morning" or any greeting. Lead with situation.
- Banned words: wellness, mindfulness, optimize, hustle, AI-powered, health tracker, dashboard, biohack
- Not a medical device. Emergency keywords → emergency services only.
`;
}

/** Generate and write the profile.md from bootstrap data. */
export function generateProfileMd(data: {
  name: string;
  timezone: string;
  wearableType: string;
  chronotype?: string;
  wakeTime?: string;
  daysOfData: number;
  connectedSources: string[];
  topInsights: string[];
}): string {
  return [
    `# ${data.name}`,
    `- Timezone: ${data.timezone}`,
    `- Wearable: ${data.wearableType}`,
    data.chronotype ? `- Chronotype: ${data.chronotype}` : null,
    data.wakeTime ? `- Typical wake: ${data.wakeTime}` : null,
    `- Data: ${data.daysOfData} days observed`,
    `- Sources: ${data.connectedSources.join(', ')}`,
    '',
    '## Key insights',
    ...data.topInsights.map(i => `- ${i}`),
  ].filter(Boolean).join('\n');
}

/** Generate baselines.md from computed baselines. */
export function generateBaselinesMd(baselines: Array<{ key: string; value: string; trend?: string }>): string {
  const lines = ['# Current Baselines', ''];
  for (const b of baselines) {
    const trend = b.trend ? ` (${b.trend})` : '';
    lines.push(`- **${b.key}**: ${b.value}${trend}`);
  }
  return lines.join('\n');
}

/** Generate patterns.md from detected patterns. */
export function generatePatternsMd(patterns: Array<{ type: string; summary: string; confidence: number; evidenceCount: number }>): string {
  if (patterns.length === 0) return '# Patterns\n\nNo patterns detected yet. Need more data.';
  const lines = ['# Detected Patterns', ''];
  for (const p of patterns) {
    lines.push(`## ${p.type} (${Math.round(p.confidence * 100)}% confidence, ${p.evidenceCount} evidence)`);
    lines.push(p.summary);
    lines.push('');
  }
  return lines.join('\n');
}

/** Generate today.md pre-computed context for the current day. */
export function generateTodayMd(data: {
  date: string;
  crs?: { score: number; zone: string; summary: string };
  sleep?: { hours: number; efficiency: number };
  meetings?: { count: number; loadScore: number; focusGaps: number };
  email?: { total: number; afterHoursRatio: number };
  tasks?: { pending: number; overdue: number };
  spots?: string[];
}): string {
  const lines = [`# Today — ${data.date}`, ''];

  if (data.crs) {
    lines.push(`**Form**: ${data.crs.score} (${data.crs.zone}). ${data.crs.summary}`);
  }
  if (data.sleep) {
    lines.push(`**Sleep**: ${data.sleep.hours.toFixed(1)}h, ${Math.round(data.sleep.efficiency * 100)}% efficiency`);
  }
  if (data.meetings) {
    lines.push(`**Meetings**: ${data.meetings.count} today, load ${data.meetings.loadScore}/15, ${data.meetings.focusGaps} focus gaps`);
  }
  if (data.email) {
    lines.push(`**Email**: ${data.email.total} messages, ${Math.round(data.email.afterHoursRatio * 100)}% after hours`);
  }
  if (data.tasks) {
    lines.push(`**Tasks**: ${data.tasks.pending} pending, ${data.tasks.overdue} overdue`);
  }
  if (data.spots && data.spots.length > 0) {
    lines.push('', '**Spots today**:');
    data.spots.forEach(s => lines.push(`- ${s}`));
  }

  return lines.join('\n');
}
