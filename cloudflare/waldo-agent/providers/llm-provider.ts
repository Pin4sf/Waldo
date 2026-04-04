/**
 * Waldo LLMProvider Adapter — model-agnostic interface.
 *
 * Every model goes through this interface. The agent never imports
 * Anthropic SDK or OpenAI SDK directly — only through a provider implementation.
 *
 * Supported providers:
 *   AnthropicProvider    — Claude Haiku 4.5, Claude Sonnet (primary)
 *   OpenAICompatProvider — DeepSeek V3/R1, Kimi K2.5, Qwen, Gemini (via compatible API)
 *   OllamaProvider       — Local models (Qwen 7B, Llama 3, etc.) via localhost:11434
 *
 * Routing strategy (implemented in createProvider()):
 *   morning_wag, evening_review → DeepSeek V3 if configured, else Claude Haiku
 *   fetch_alert, conversational  → Claude Haiku (requires tool use)
 *   pattern_analysis             → Claude Sonnet or DeepSeek R1 (Phase G)
 *   pre_processing               → Ollama local (if running)
 *
 * Cost comparison per 1M tokens (input/output):
 *   Claude Haiku 4.5:  $0.80 / $4.00  (baseline)
 *   DeepSeek V3:       $0.14 / $0.28  (82% cheaper — no tool use)
 *   Kimi K2.5:         $0.60 / $2.50  (OpenAI-compatible, tool use)
 *   Gemini Flash 2.5:  $0.10 / $0.40  (health data privacy concern)
 *   Ollama local:      $0.00 / $0.00  (requires local GPU/CPU)
 */

// ─── Core types ──────────────────────────────────────────────────

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | LLMContentBlock[];
}

export interface LLMContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string;
  tool_use_id?: string;
}

export interface LLMTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface LLMCompletionOptions {
  model?: string;              // override default model for this provider
  maxTokens?: number;
  temperature?: number;
  tools?: LLMTool[];
  stopSequences?: string[];
  systemPrompt?: string;
  cacheSystemPrompt?: boolean; // Anthropic prompt caching
}

export interface LLMToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type LLMStopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';

export interface LLMCompletionResult {
  text: string;                // concatenated text from all text blocks
  toolCalls: LLMToolCall[];   // empty if stop_reason !== 'tool_use'
  stopReason: LLMStopReason;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  };
  model: string;               // actual model used
  provider: string;            // provider name for logging
}

// ─── Interface ───────────────────────────────────────────────────

export interface LLMProvider {
  readonly name: string;
  readonly defaultModel: string;
  readonly supportsToolUse: boolean;
  readonly supportsPromptCaching: boolean;

  complete(
    messages: LLMMessage[],
    options?: LLMCompletionOptions,
  ): Promise<LLMCompletionResult>;
}

// ─── Anthropic (Claude) ──────────────────────────────────────────

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  readonly defaultModel = 'claude-haiku-4-5-20251001';
  readonly supportsToolUse = true;
  readonly supportsPromptCaching = true;

  constructor(private apiKey: string) {}

  async complete(messages: LLMMessage[], options: LLMCompletionOptions = {}): Promise<LLMCompletionResult> {
    const model = options.model ?? this.defaultModel;
    const body: Record<string, unknown> = {
      model,
      max_tokens: options.maxTokens ?? 1024,
      messages: messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role,
        content: m.content,
      })),
    };

    if (options.systemPrompt) {
      body.system = options.cacheSystemPrompt
        ? [{ type: 'text', text: options.systemPrompt, cache_control: { type: 'ephemeral' } }]
        : options.systemPrompt;
    }
    if (options.tools?.length) body.tools = options.tools;
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.stopSequences?.length) body.stop_sequences = options.stopSequences;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json() as {
      content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
      stop_reason: string;
      usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
      model: string;
    };

    const text = data.content.filter(b => b.type === 'text').map(b => b.text ?? '').join('\n');
    const toolCalls: LLMToolCall[] = data.content
      .filter(b => b.type === 'tool_use')
      .map(b => ({ id: b.id!, name: b.name!, input: b.input ?? {} }));

    return {
      text,
      toolCalls,
      stopReason: data.stop_reason as LLMStopReason,
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
        cacheReadTokens: data.usage.cache_read_input_tokens,
        cacheWriteTokens: data.usage.cache_creation_input_tokens,
      },
      model: data.model,
      provider: this.name,
    };
  }
}

// ─── OpenAI-compatible (DeepSeek, Kimi, Gemini, etc.) ────────────

export interface OpenAICompatConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  supportsToolUse?: boolean;
}

export class OpenAICompatProvider implements LLMProvider {
  readonly name: string;
  readonly defaultModel: string;
  readonly supportsToolUse: boolean;
  readonly supportsPromptCaching = false;

  constructor(private config: OpenAICompatConfig) {
    this.name = config.name;
    this.defaultModel = config.defaultModel;
    this.supportsToolUse = config.supportsToolUse ?? false;
  }

  async complete(messages: LLMMessage[], options: LLMCompletionOptions = {}): Promise<LLMCompletionResult> {
    const model = options.model ?? this.defaultModel;

    // Convert to OpenAI message format
    const oaiMessages: Array<{ role: string; content: string }> = [];
    if (options.systemPrompt) {
      oaiMessages.push({ role: 'system', content: options.systemPrompt });
    }
    for (const m of messages) {
      if (m.role === 'system') continue; // handled above
      const content = typeof m.content === 'string' ? m.content
        : m.content.filter(b => b.type === 'text').map(b => b.content ?? '').join('\n');
      oaiMessages.push({ role: m.role, content });
    }

    const body: Record<string, unknown> = {
      model,
      messages: oaiMessages,
      max_tokens: options.maxTokens ?? 1024,
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.tools?.length && this.supportsToolUse) {
      // Convert Anthropic tool format to OpenAI format
      body.tools = options.tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.input_schema },
      }));
    }

    const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`${this.name} API error ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json() as {
      choices: Array<{
        message: { content?: string; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> };
        finish_reason: string;
      }>;
      usage: { prompt_tokens: number; completion_tokens: number };
      model: string;
    };

    const choice = data.choices[0]!;
    const text = choice.message.content ?? '';
    const toolCalls: LLMToolCall[] = (choice.message.tool_calls ?? []).map(tc => ({
      id: tc.id,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments) as Record<string, unknown>,
    }));

    const stopReason: LLMStopReason = choice.finish_reason === 'tool_calls' ? 'tool_use'
      : choice.finish_reason === 'length' ? 'max_tokens' : 'end_turn';

    return {
      text,
      toolCalls,
      stopReason,
      usage: { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens },
      model: data.model ?? model,
      provider: this.name,
    };
  }
}

// ─── Ollama (local) ───────────────────────────────────────────────

export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  readonly supportsToolUse = false;
  readonly supportsPromptCaching = false;

  constructor(
    readonly defaultModel = 'qwen2.5:7b-instruct-q4_K_M',
    private baseUrl = 'http://localhost:11434',
  ) {}

  async complete(messages: LLMMessage[], options: LLMCompletionOptions = {}): Promise<LLMCompletionResult> {
    const model = options.model ?? this.defaultModel;
    const prompt = messages.map(m => {
      const content = typeof m.content === 'string' ? m.content
        : m.content.filter(b => b.type === 'text').map(b => b.content ?? '').join('\n');
      return `${m.role === 'user' ? 'Human' : 'Assistant'}: ${content}`;
    }).join('\n') + '\nAssistant:';

    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false, options: { temperature: options.temperature ?? 0.7 } }),
    });

    if (!res.ok) throw new Error(`Ollama error ${res.status}`);
    const data = await res.json() as { response: string; eval_count: number; prompt_eval_count: number };

    return {
      text: data.response,
      toolCalls: [],
      stopReason: 'end_turn',
      usage: { inputTokens: data.prompt_eval_count ?? 0, outputTokens: data.eval_count ?? 0 },
      model,
      provider: 'ollama',
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch { return false; }
  }
}

// ─── Factory + routing ───────────────────────────────────────────

export type TriggerType = 'morning_wag' | 'fetch_alert' | 'evening_review' | 'conversational' | 'onboarding' | 'pattern_analysis';

export interface ProviderConfig {
  anthropicApiKey?: string;
  deepseekApiKey?: string;
  kimiApiKey?: string;
  ollamaUrl?: string;
  preferCheapProvider?: boolean;   // use DeepSeek for non-tool-use tasks
}

/**
 * createProvider — returns the appropriate LLMProvider for a given trigger type.
 *
 * Routing logic:
 *   - Tasks requiring tool_use (fetch_alert, conversational) → Anthropic always
 *   - Simple generation (morning_wag, evening_review) → DeepSeek V3 if available (82% cheaper)
 *   - Fallback chain: Anthropic → DeepSeek → Kimi → error
 */
export function createProvider(triggerType: TriggerType, config: ProviderConfig): LLMProvider {
  const needsTools = ['fetch_alert', 'conversational', 'onboarding'].includes(triggerType);

  // If the task requires tool use, always use Anthropic
  if (needsTools) {
    if (!config.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY required for tool-use tasks');
    return new AnthropicProvider(config.anthropicApiKey);
  }

  // Non-tool-use: prefer cheap provider if configured
  if (config.preferCheapProvider && config.deepseekApiKey) {
    return new OpenAICompatProvider({
      name: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: config.deepseekApiKey,
      defaultModel: 'deepseek-chat',   // DeepSeek V3 (fast, cheap, no reasoning overhead)
      supportsToolUse: false,
    });
  }

  // Default: Anthropic
  if (config.anthropicApiKey) return new AnthropicProvider(config.anthropicApiKey);

  // Last resort: Kimi
  if (config.kimiApiKey) {
    return new OpenAICompatProvider({
      name: 'kimi',
      baseUrl: 'https://api.moonshot.cn/v1',
      apiKey: config.kimiApiKey,
      defaultModel: 'kimi-k2-thinking',
      supportsToolUse: true,
    });
  }

  throw new Error('No LLM provider configured. Set at least ANTHROPIC_API_KEY.');
}

// Pre-built provider configs for common use cases:
export const PROVIDER_CONFIGS = {
  deepseek: (apiKey: string): OpenAICompatProvider => new OpenAICompatProvider({
    name: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey,
    defaultModel: 'deepseek-chat',
    supportsToolUse: false,
  }),
  deepseekReasoner: (apiKey: string): OpenAICompatProvider => new OpenAICompatProvider({
    name: 'deepseek-reasoner',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey,
    defaultModel: 'deepseek-reasoner',
    supportsToolUse: false,
  }),
  kimi: (apiKey: string): OpenAICompatProvider => new OpenAICompatProvider({
    name: 'kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    apiKey,
    defaultModel: 'kimi-k2-thinking',
    supportsToolUse: true,
  }),
  geminiFlash: (apiKey: string): OpenAICompatProvider => new OpenAICompatProvider({
    name: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKey,
    defaultModel: 'gemini-2.5-flash',
    supportsToolUse: true,
  }),
};
