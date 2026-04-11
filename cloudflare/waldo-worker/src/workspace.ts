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
  const [profile, baselines, today] = await Promise.all([
    readWorkspaceFile(r2, userId, WORKSPACE_FILES.PROFILE),
    readWorkspaceFile(r2, userId, WORKSPACE_FILES.BASELINES),
    readWorkspaceFile(r2, userId, WORKSPACE_FILES.TODAY),
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
