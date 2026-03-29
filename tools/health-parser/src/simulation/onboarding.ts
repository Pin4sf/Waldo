/**
 * Waldo onboarding interview — builds a user profile through conversation.
 * Not a form. A dialogue. Waldo asks, user answers, profile grows.
 *
 * Profile is saved server-side and fed into every prompt.
 */
import Anthropic from '@anthropic-ai/sdk';

export interface UserProfile {
  name: string;
  age: number;
  role: string;
  workStyle: string;
  wakeTime: string;
  sleepGoal: string;
  stressors: string;
  goals: string;
  communicationStyle: string;
  completed: boolean;
  rawAnswers: Record<string, string>;
}

const ONBOARDING_SYSTEM = `You are Waldo. A dalmatian. You're meeting someone for the first time.

Your job: learn about them through a SHORT, natural conversation. Not an interrogation. Not a form.

Rules:
- Ask ONE question at a time. Never two.
- Keep questions short. 1-2 sentences max.
- React briefly to their answer before asking the next thing.
- Sound like a friend getting to know them, not a survey.
- After 6-8 exchanges, you have enough. Wrap up naturally.
- Never say "Great!" or "Awesome!" — just acknowledge and move on.

What you need to learn (in rough order):
1. Their name (if not already known)
2. What they do for work / study
3. When they usually wake up and go to bed
4. What makes their days hard (stressors)
5. What they want Waldo to help with
6. How they like to be communicated with (direct vs gentle, data vs vibes)

When you have enough, end with something like:
"Got it. I'll start watching your patterns and check in tomorrow morning."

Then output a JSON block with the profile:
\`\`\`json
{"name": "...", "role": "...", "workStyle": "...", "wakeTime": "...", "sleepGoal": "...", "stressors": "...", "goals": "...", "communicationStyle": "..."}
\`\`\``;

const MODEL = 'claude-haiku-4-5-20251001';

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export interface OnboardingMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Continue the onboarding conversation.
 * Returns Waldo's next message. If the profile JSON is in the response,
 * also returns the parsed profile.
 */
export async function continueOnboarding(
  history: OnboardingMessage[],
  userMessage?: string,
): Promise<{ reply: string; profile: UserProfile | null; tokensIn: number; tokensOut: number }> {
  const messages: Anthropic.MessageParam[] = history.map(m => ({
    role: m.role,
    content: m.content,
  }));

  if (userMessage) {
    messages.push({ role: 'user', content: userMessage });
  }

  // If no history yet, start the conversation
  if (messages.length === 0) {
    messages.push({ role: 'user', content: "Hi, I just set up Waldo." });
  }

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 300,
    system: ONBOARDING_SYSTEM,
    messages,
  });

  const reply = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('\n');

  // Check if profile JSON is in the reply
  let profile: UserProfile | null = null;
  const jsonMatch = reply.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch?.[1]) {
    try {
      const parsed = JSON.parse(jsonMatch[1]) as Record<string, string>;
      profile = {
        name: parsed['name'] ?? '',
        age: 0,
        role: parsed['role'] ?? '',
        workStyle: parsed['workStyle'] ?? '',
        wakeTime: parsed['wakeTime'] ?? '',
        sleepGoal: parsed['sleepGoal'] ?? '',
        stressors: parsed['stressors'] ?? '',
        goals: parsed['goals'] ?? '',
        communicationStyle: parsed['communicationStyle'] ?? '',
        completed: true,
        rawAnswers: parsed,
      };
    } catch {
      // JSON parse failed — conversation continues
    }
  }

  // Strip the JSON block from the visible reply
  const cleanReply = reply.replace(/```json[\s\S]*?```/, '').trim();

  return {
    reply: cleanReply,
    profile,
    tokensIn: response.usage.input_tokens,
    tokensOut: response.usage.output_tokens,
  };
}

/** Default profile when no onboarding has been done */
export function defaultProfile(name: string, age: number): UserProfile {
  return {
    name,
    age,
    role: 'unknown',
    workStyle: 'unknown',
    wakeTime: 'unknown',
    sleepGoal: '7-8 hours',
    stressors: 'unknown',
    goals: 'understand my body better',
    communicationStyle: 'direct',
    completed: false,
    rawAnswers: {},
  };
}
