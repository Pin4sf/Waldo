/**
 * LLM calls inside the Durable Object.
 * Implements the same model-agnostic routing as _shared/llm-provider.ts
 * but adapted for the Worker/DO environment (no Deno.env — uses env binding).
 */
import type { Env, TriggerType } from './types';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown; tool_use_id?: string; content?: string }>;
}

export interface Tool {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
}

export interface LLMResult {
  text: string;
  toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens';
  tokensIn: number;
  tokensOut: number;
  cacheReadTokens: number;
  provider: string;
  costUsd: number;
}

const COST_RATES: Record<string, [number, number]> = {
  anthropic:  [0.80, 4.00],
  deepseek:   [0.14, 0.28],
};

/** Call the appropriate LLM for a trigger type. */
export async function callLLM(
  messages: Message[],
  options: {
    system: string;
    maxTokens?: number;
    tools?: Tool[];
    triggerType: TriggerType;
    cacheSystem?: boolean;
  },
  env: Env,
): Promise<LLMResult> {
  const needsTools = ['fetch_alert', 'conversational', 'onboarding'].includes(options.triggerType);
  const useDeepSeek = !needsTools && env.DEEPSEEK_API_KEY;

  if (useDeepSeek) {
    return callDeepSeek(messages, options, env);
  }
  return callAnthropic(messages, options, env);
}

async function callAnthropic(
  messages: Message[],
  options: { system: string; maxTokens?: number; tools?: Tool[]; cacheSystem?: boolean },
  env: Env,
): Promise<LLMResult> {
  const body: Record<string, unknown> = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: options.maxTokens ?? 600,
    messages: messages.filter(m => m.role !== 'system'),
    system: options.cacheSystem
      ? [{ type: 'text', text: options.system, cache_control: { type: 'ephemeral' } }]
      : options.system,
  };
  if (options.tools?.length) body.tools = options.tools;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json() as {
    content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
    stop_reason: string;
    usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number };
  };

  const text = data.content.filter(b => b.type === 'text').map(b => b.text ?? '').join('\n');
  const toolCalls = data.content.filter(b => b.type === 'tool_use').map(b => ({ id: b.id!, name: b.name!, input: (b.input ?? {}) as Record<string, unknown> }));
  const tokensIn = data.usage.input_tokens;
  const tokensOut = data.usage.output_tokens;
  const cacheRead = data.usage.cache_read_input_tokens ?? 0;

  return {
    text,
    toolCalls,
    stopReason: data.stop_reason as LLMResult['stopReason'],
    tokensIn,
    tokensOut,
    cacheReadTokens: cacheRead,
    provider: 'anthropic',
    costUsd: (tokensIn * 0.80 + tokensOut * 4.00) / 1_000_000,
  };
}

async function callDeepSeek(
  messages: Message[],
  options: { system: string; maxTokens?: number },
  env: Env,
): Promise<LLMResult> {
  const oaiMessages = [
    { role: 'system', content: options.system },
    ...messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content
        : (m.content as Array<{ type: string; text?: string }>).filter(b => b.type === 'text').map(b => b.text ?? '').join('\n'),
    })),
  ];

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'deepseek-chat', messages: oaiMessages, max_tokens: options.maxTokens ?? 400 }),
  });

  if (!res.ok) {
    const err = await res.text();
    // Fallback to Anthropic
    console.error(`DeepSeek failed (${res.status}): ${err.slice(0, 100)}. Falling back to Anthropic.`);
    return callAnthropic(messages, options, env);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content?: string }; finish_reason: string }>;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  const tokensIn = data.usage.prompt_tokens;
  const tokensOut = data.usage.completion_tokens;

  return {
    text: data.choices[0]?.message?.content ?? '',
    toolCalls: [],
    stopReason: 'end_turn',
    tokensIn,
    tokensOut,
    cacheReadTokens: 0,
    provider: 'deepseek',
    costUsd: (tokensIn * 0.14 + tokensOut * 0.28) / 1_000_000,
  };
}
