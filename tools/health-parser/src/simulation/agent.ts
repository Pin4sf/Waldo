/**
 * Agent simulation — calls Claude Haiku with Waldo's personality.
 *
 * Uses @anthropic-ai/sdk Messages API (not Agent SDK).
 * Assembles soul file + biometric context → sends to Claude → returns response.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { AgentContext, AgentResponse } from '../types/agent.js';
import { getPersonalityZone } from '../types/agent.js';
import { assembleSoulPrompt } from './soul-file.js';
import { buildUserMessage } from './prompt-builder.js';

const MODEL = 'claude-haiku-4-5-20251001';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

/**
 * Generate a Waldo response for a given context.
 * Returns the agent's message + metadata.
 */
export async function generateWaldoResponse(ctx: AgentContext): Promise<AgentResponse> {
  const zone = getPersonalityZone(ctx.crs);
  const systemPrompt = assembleSoulPrompt(zone, ctx.mode);
  const userMessage = buildUserMessage(ctx);

  const startTime = Date.now();

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 300,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const responseTimeMs = Date.now() - startTime;

  const message = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('\n');

  return {
    message,
    zone,
    mode: ctx.mode,
    tokensIn: response.usage.input_tokens,
    tokensOut: response.usage.output_tokens,
    responseTimeMs,
  };
}

/**
 * Generate all three message types for a given day.
 * Returns Morning Wag, Fetch Alert (if stress detected), and a sample conversational response.
 */
export async function generateFullDayDemo(
  ctx: Omit<AgentContext, 'mode' | 'userQuestion'>,
  hasStress: boolean,
): Promise<{
  morningWag: AgentResponse;
  fetchAlert: AgentResponse | null;
  conversational: AgentResponse;
}> {
  // Morning Wag — always
  const morningWag = await generateWaldoResponse({ ...ctx, mode: 'morning_wag' });

  // Fetch Alert — only if stress detected
  let fetchAlert: AgentResponse | null = null;
  if (hasStress) {
    fetchAlert = await generateWaldoResponse({ ...ctx, mode: 'fetch_alert' });
  }

  // Conversational — sample question
  const conversational = await generateWaldoResponse({
    ...ctx,
    mode: 'conversational',
    userQuestion: 'How am I doing today? Give me the real picture.',
  });

  return { morningWag, fetchAlert, conversational };
}
