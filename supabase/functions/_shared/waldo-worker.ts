/**
 * Waldo Smart Router — 3-layer compute routing for the agent.
 *
 * L0: Template (zero cost) — pre-filter catches routine cases
 * L1: invoke-agent EF (single Haiku call) — simple chat, status queries
 * L2: CF Worker DO (ReAct + persistent memory) — proactive triggers, complex reasoning
 *
 * Routing rules:
 *   - Proactive triggers (morning_wag, fetch_alert, evening_review) → always L2 (DO)
 *     because they need persistent memory, diary context, and Telegram delivery
 *   - Simple chat ("what's my CRS?", "how did I sleep?") → L1 (invoke-agent EF)
 *     fast, stateless, cheap — no DO wake needed
 *   - Complex chat (pattern questions, memory-dependent, multi-source) → L2 (DO)
 *     needs persistent memory, conversation history, ReAct loop
 *   - Onboarding → L2 (DO) — interview state lives in DO SQLite
 *
 * When WALDO_WORKER_URL is not set → everything goes to L1 (invoke-agent EF).
 * The system works without the CF Worker deployed. It gets smarter with it.
 */

function getWorkerUrl(): string | null {
  return Deno.env.get('WALDO_WORKER_URL') ?? null;
}

function getWorkerSecret(): string {
  return Deno.env.get('WALDO_WORKER_SECRET') ?? '';
}

function getInvokeAgentUrl(): string {
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/invoke-agent`;
}

interface WorkerResponse {
  reply: string;
  zone?: string;
  mode?: string;
  crs_score?: number;
  iterations?: number;
  tools_called?: string[];
  latencyMs?: number;
  provider?: string;
  error?: string;
  provisioned?: boolean;
  usedFallback?: boolean;
  layer?: 'L0' | 'L1' | 'L2';
}

// ─── Complexity detection ────────────────────────────────────────

/** Keywords that indicate the query needs the full DO agent (L2). */
const COMPLEX_PATTERNS = [
  /pattern|constellation|trend|over time|this week|last week|compare/i,
  /remember|you told me|last time|previously|you said/i,
  /why.*(score|crs|nap|sleep|stress|hrv)/i,
  /what should|suggest|recommend|plan|schedule/i,
  /correlation|connect|relationship between/i,
  /morning wag|evening review|fetch alert/i,
  /update.*memory|learn|note that|remember this/i,
];

function needsFullAgent(message: string, triggerType: string): boolean {
  // Proactive triggers always need the DO (persistent memory + delivery)
  if (['morning_wag', 'fetch_alert', 'evening_review'].includes(triggerType)) return true;

  // Onboarding needs DO (interview state in SQLite)
  if (triggerType === 'onboarding') return true;

  // Check for complex patterns in user message
  if (COMPLEX_PATTERNS.some(p => p.test(message))) return true;

  // Long messages likely need more reasoning
  if (message.length > 200) return true;

  return false;
}

// ─── L2: CF Worker DO ────────────────────────────────────────────

async function callWorkerDO(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<WorkerResponse | null> {
  const workerUrl = getWorkerUrl();
  if (!workerUrl) return null;

  try {
    const res = await fetch(`${workerUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-waldo-secret': getWorkerSecret(),
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json() as Record<string, unknown>;
      return {
        reply: (data['reply'] as string) ?? '',
        zone: data['zone'] as string,
        mode: data['mode'] as string,
        crs_score: data['crs_score'] as number,
        iterations: data['iterations'] as number,
        tools_called: data['tools_called'] as string[],
        latencyMs: data['latencyMs'] as number,
        provider: data['provider'] as string,
        layer: 'L2',
      };
    }

    // Auto-provision if DO not initialized
    if (res.status === 400) {
      const err = await res.json().catch(() => ({})) as Record<string, unknown>;
      if ((err['error'] as string)?.includes('not provisioned')) {
        const userId = endpoint.split('/').pop() ?? '';
        await provisionUser(userId);
        // Retry once
        const retry = await fetch(`${workerUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-waldo-secret': getWorkerSecret(),
          },
          body: JSON.stringify(body),
        });
        if (retry.ok) {
          const data = await retry.json() as Record<string, unknown>;
          return { reply: (data['reply'] as string) ?? '', layer: 'L2', zone: data['zone'] as string };
        }
      }
    }

    return null; // Fall through to L1
  } catch (err) {
    console.error('[Router] L2 error:', err);
    return null;
  }
}

// ─── L1: invoke-agent Edge Function ──────────────────────────────

async function callInvokeAgent(
  userId: string,
  triggerType: string,
  question?: string,
  channel = 'api',
): Promise<WorkerResponse> {
  try {
    const res = await fetch(getInvokeAgentUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        user_id: userId,
        trigger_type: triggerType,
        question,
        channel,
      }),
    });

    if (!res.ok) {
      return { reply: "I'm having trouble connecting right now. Try again in a moment.", layer: 'L1', usedFallback: true };
    }

    const data = await res.json() as Record<string, unknown>;
    return {
      reply: (data['message'] as string) ?? "I couldn't form a response.",
      zone: data['zone'] as string,
      mode: data['mode'] as string,
      crs_score: data['crs_score'] as number,
      iterations: data['iterations'] as number,
      tools_called: data['tools_called'] as string[],
      layer: 'L1',
      usedFallback: false,
    };
  } catch {
    return { reply: "I'm having trouble connecting right now.", layer: 'L1', usedFallback: true };
  }
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Send a chat message to the user's Waldo agent.
 * Smart-routes: simple queries → L1 (EF), complex → L2 (DO).
 */
export async function agentChat(
  userId: string,
  message: string,
  channel = 'web',
): Promise<WorkerResponse> {
  const isComplex = needsFullAgent(message, 'conversational');

  // Try L2 (DO) for complex queries
  if (isComplex) {
    const l2 = await callWorkerDO(`/chat/${userId}`, { message, channel });
    if (l2) return l2;
    // Fall through to L1 if DO unavailable
  }

  // L1 (invoke-agent EF) for simple queries or DO fallback
  return callInvokeAgent(userId, 'conversational', message, channel);
}

/**
 * Send a proactive trigger. Always routes to L2 (DO) first.
 * Proactive triggers NEED persistent memory and self-delivery.
 */
export async function agentTrigger(
  userId: string,
  triggerType: string,
): Promise<WorkerResponse> {
  // Always try L2 first for triggers (they need persistent memory + Telegram delivery)
  const l2 = await callWorkerDO(`/trigger/${userId}`, { trigger_type: triggerType });
  if (l2) return l2;

  // Fallback to L1
  return callInvokeAgent(userId, triggerType, undefined, 'api');
}

/**
 * Provision a user's Durable Object.
 */
export async function provisionUser(userId: string): Promise<boolean> {
  const workerUrl = getWorkerUrl();
  if (!workerUrl) return false;

  try {
    const res = await fetch(`${workerUrl}/provision/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-waldo-secret': getWorkerSecret(),
      },
      body: JSON.stringify({ user_id: userId }),
    });
    if (res.ok) {
      console.log(`[Router] Provisioned DO for ${userId.slice(0, 8)}`);
      return true;
    }
    console.error(`[Router] Provision failed: ${res.status}`);
    return false;
  } catch (err) {
    console.error(`[Router] Provision error:`, err);
    return false;
  }
}

/**
 * Check if a user's DO is alive.
 */
export async function agentStatus(userId: string): Promise<Record<string, unknown> | null> {
  const workerUrl = getWorkerUrl();
  if (!workerUrl) return null;
  try {
    const res = await fetch(`${workerUrl}/status/${userId}`, {
      headers: { 'x-waldo-secret': getWorkerSecret() },
    });
    return res.ok ? await res.json() as Record<string, unknown> : null;
  } catch { return null; }
}

/**
 * Check if the CF Worker is configured.
 */
export function isWorkerConfigured(): boolean {
  return !!getWorkerUrl();
}
