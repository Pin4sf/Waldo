/**
 * Waldo LLMProvider Adapter — Deno/Edge Function version.
 *
 * Same interface as cloudflare/waldo-agent/providers/llm-provider.ts
 * but uses fetch() directly (no SDK imports) for Deno compatibility.
 *
 * Provider routing:
 *   - Tool-use tasks (fetch_alert, conversational) → Anthropic (only provider with reliable tool use)
 *   - Generation tasks (morning_wag, evening_review) → DeepSeek V3 if DEEPSEEK_API_KEY set, else Anthropic
 *
 * To enable DeepSeek: add DEEPSEEK_API_KEY to Supabase Edge Function secrets.
 * To enable Kimi:     add KIMI_API_KEY to Supabase Edge Function secrets.
 */

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown; content?: string; tool_use_id?: string }>;
}

export interface LLMTool {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
}

export interface LLMToolCall { id: string; name: string; input: Record<string, unknown> }
export type LLMStopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';

export interface LLMResult {
  text: string;
  toolCalls: LLMToolCall[];
  stopReason: LLMStopReason;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number };
  model: string;
  provider: string;
}

export interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  tools?: LLMTool[];
  systemPrompt?: string;
  cacheSystemPrompt?: boolean;
  model?: string;
}

// ─── Anthropic ────────────────────────────────────────────────────

async function callAnthropic(messages: LLMMessage[], options: LLMOptions): Promise<LLMResult> {
  const model = options.model ?? 'claude-haiku-4-5-20251001';
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')!;

  const body: Record<string, unknown> = {
    model,
    max_tokens: options.maxTokens ?? 1024,
    messages: messages.filter(m => m.role !== 'system'),
  };
  if (options.systemPrompt) {
    body.system = options.cacheSystemPrompt
      ? [{ type: 'text', text: options.systemPrompt, cache_control: { type: 'ephemeral' } }]
      : options.systemPrompt;
  }
  if (options.tools?.length) body.tools = options.tools;
  if (options.temperature !== undefined) body.temperature = options.temperature;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json() as {
    content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
    stop_reason: string;
    usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number };
    model: string;
  };

  return {
    text: data.content.filter(b => b.type === 'text').map(b => b.text ?? '').join('\n'),
    toolCalls: data.content.filter(b => b.type === 'tool_use').map(b => ({ id: b.id!, name: b.name!, input: b.input ?? {} })),
    stopReason: data.stop_reason as LLMStopReason,
    usage: { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens, cacheReadTokens: data.usage.cache_read_input_tokens },
    model: data.model,
    provider: 'anthropic',
  };
}

// ─── OpenAI-compatible (DeepSeek, Kimi, Gemini) ───────────────────

async function callOpenAICompat(
  messages: LLMMessage[],
  options: LLMOptions,
  baseUrl: string,
  apiKey: string,
  providerName: string,
  defaultModel: string,
): Promise<LLMResult> {
  const model = options.model ?? defaultModel;
  const oaiMessages: Array<{ role: string; content: string }> = [];
  if (options.systemPrompt) oaiMessages.push({ role: 'system', content: options.systemPrompt });
  for (const m of messages) {
    if (m.role === 'system') continue;
    const content = typeof m.content === 'string' ? m.content
      : (m.content as Array<{ type: string; text?: string; content?: string }>)
        .filter(b => b.type === 'text').map(b => b.text ?? b.content ?? '').join('\n');
    oaiMessages.push({ role: m.role, content });
  }

  const body: Record<string, unknown> = {
    model,
    messages: oaiMessages,
    max_tokens: options.maxTokens ?? 1024,
  };
  if (options.temperature !== undefined) body.temperature = options.temperature;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`${providerName} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json() as {
    choices: Array<{ message: { content?: string }; finish_reason: string }>;
    usage: { prompt_tokens: number; completion_tokens: number };
    model: string;
  };

  return {
    text: data.choices[0]?.message?.content ?? '',
    toolCalls: [],   // non-tool-use providers only
    stopReason: 'end_turn',
    usage: { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens },
    model: data.model ?? model,
    provider: providerName,
  };
}

// ─── Main routing function ────────────────────────────────────────

type TriggerType = 'morning_wag' | 'fetch_alert' | 'conversational' | 'evening_review' | 'onboarding' | 'baseline_update';

/**
 * completeLLM — call the right provider for the task.
 *
 * Uses tool-use capable provider (Anthropic) for tool-using tasks.
 * Optionally routes generation-only tasks to cheaper providers.
 */
export async function completeLLM(
  messages: LLMMessage[],
  triggerType: TriggerType,
  options: LLMOptions = {},
): Promise<LLMResult> {
  const needsTools = ['fetch_alert', 'conversational', 'onboarding'].includes(triggerType);
  const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY');
  const kimiKey = Deno.env.get('KIMI_API_KEY');

  // Tool-use tasks always go to Anthropic
  if (needsTools || !deepseekKey) {
    return callAnthropic(messages, options);
  }

  // Generation tasks: prefer cheap provider
  // DeepSeek V3: $0.14/$0.28 per M tokens vs Claude Haiku $0.80/$4.00
  try {
    return await callOpenAICompat(
      messages, options,
      'https://api.deepseek.com/v1',
      deepseekKey,
      'deepseek',
      'deepseek-chat',
    );
  } catch (err) {
    console.warn('[LLM] DeepSeek failed, falling back to Anthropic:', (err as Error).message);
    return callAnthropic(messages, options);
  }
}

/** Estimated cost in USD for a result. */
export function estimateCost(result: LLMResult): number {
  const rates: Record<string, [number, number]> = {
    'anthropic':  [0.80, 4.00],
    'deepseek':   [0.14, 0.28],
    'kimi':       [0.60, 2.50],
    'gemini':     [0.10, 0.40],
    'ollama':     [0.00, 0.00],
  };
  const [inRate, outRate] = rates[result.provider] ?? [0.80, 4.00];
  return (result.usage.inputTokens * inRate + result.usage.outputTokens * outRate) / 1_000_000;
}
