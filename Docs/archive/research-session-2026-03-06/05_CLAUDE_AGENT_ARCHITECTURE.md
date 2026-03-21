# OneSync — Claude Agent Architecture

Last updated: March 6, 2026

---

## Design Decision: Raw Messages API, Not Agent SDK

### Why Raw Messages API?

| Factor | Messages API | Agent SDK |
|--------|-------------|-----------|
| Runtime | Supabase Edge Functions (Deno) | Long-running process needed |
| Control | Full control over tool loop | SDK manages loop |
| Cost | Pay per call, no idle | Needs persistent process |
| Complexity | More code, but transparent | Less code, opaque |
| Serverless fit | Perfect | Poor (needs persistent state) |

OneSync's agent is a **serverless health co-pilot**, not a general-purpose assistant. It wakes up on triggers (health data, user message, scheduled check), processes, responds, and sleeps. The Messages API with `tool_use` fits this pattern perfectly.

---

## Agent Loop Pattern (ReAct Style)

```typescript
async function agentLoop(
  userId: string,
  triggerType: string,
  triggerData: any
): Promise<string> {
  const model = selectModel(triggerType, triggerData.severity);
  const systemPrompt = await buildSystemPrompt(userId);
  const messages = await buildMessages(userId, triggerType, triggerData);
  const tools = getToolDefinitions();

  let response;
  let iterations = 0;
  const MAX_ITERATIONS = 5;

  while (iterations < MAX_ITERATIONS) {
    response = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      tools,
    });

    // Check if model wants to use a tool
    const toolUseBlock = response.content.find(b => b.type === 'tool_use');

    if (!toolUseBlock) break; // No tool call = final response

    // Execute the tool
    const toolResult = await executeTool(toolUseBlock.name, toolUseBlock.input);

    // Append assistant response and tool result to messages
    messages.push({ role: 'assistant', content: response.content });
    messages.push({
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: toolUseBlock.id,
        content: JSON.stringify(toolResult),
      }],
    });

    iterations++;
  }

  // Extract text response
  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock?.text ?? '';
}
```

---

## Model Routing

### Rules-Based, Deterministic

```typescript
function selectModel(triggerType: string, severity: number): string {
  // Safety-critical: always Opus
  if (severity > 0.8) return "claude-opus-4-6";

  // User conversations and moderate alerts: Sonnet
  if (triggerType === "user_message" || severity > 0.4) return "claude-sonnet-4-6";

  // Routine checks, logging, mild: Haiku
  return "claude-haiku-4-5-20251001";
}
```

### Routing Matrix

| Trigger | Severity | Model | Approx Cost/Call |
|---------|----------|-------|------------------|
| Scheduled health check (normal) | 0-0.3 | Haiku | ~$0.001 |
| Scheduled health check (mild stress) | 0.3-0.4 | Haiku | ~$0.001 |
| User sends a message | any | Sonnet | ~$0.01 |
| Moderate stress detected | 0.4-0.8 | Sonnet | ~$0.01 |
| High stress / safety concern | 0.8+ | Opus | ~$0.05 |
| Morning briefing | 0 | Sonnet | ~$0.01 |
| Proactive scheduler | 0 | Haiku | ~$0.001 |

---

## Prompt Caching Strategy

### Structure

```typescript
async function buildSystemPrompt(userId: string): Promise<SystemMessage[]> {
  const userProfile = await getUserProfile(userId);
  const coreMemory = await getCoreMemory(userId);
  const freshBiometrics = await getLatestBiometrics(userId);

  return [
    {
      // CACHED BLOCK (~3000 tokens, stable across calls)
      type: "text",
      text: `${PERSONALITY_AND_RULES}\n\n${USER_PROFILE_AND_PREFERENCES(userProfile)}\n\n${CORE_MEMORY(coreMemory)}`,
      cache_control: { type: "ephemeral" }
      // Default TTL: 5 minutes. Anthropic extended ephemeral caching.
      // For 1-hour TTL: requires header anthropic-beta: prompt-caching-2024-07-31
    },
    {
      // FRESH BLOCK (~500-1500 tokens, changes every call)
      type: "text",
      text: `Current time: ${new Date().toISOString()}\n\nLatest biometrics:\n${JSON.stringify(freshBiometrics)}\n\nRecent conversation context:\n${recentMessages}`,
    },
  ];
}
```

### Cost Savings

- Cached input tokens: ~90% cheaper than uncached
- With 1-hour TTL and frequent checks: ~60-70% total savings on input tokens
- Personality + rules + user profile rarely change → high cache hit rate
- Fresh biometrics always uncached → accurate but small

---

## Tool Definitions (18 Tools for MVP)

### Health Tools

| Tool | Description | Returns |
|------|-------------|---------|
| `get_current_biometrics` | Latest health snapshot | HR, HRV, steps, sleep, CRS |
| `get_health_history` | Historical data for date range | Array of snapshots |
| `get_sleep_summary` | Last night's sleep details | Duration, stages, efficiency |
| `get_stress_events` | Recent stress triggers | Array with timestamps, severity |

### Memory Tools

| Tool | Description | Returns |
|------|-------------|---------|
| `read_core_memory` | User's persistent profile | Preferences, goals, context |
| `update_core_memory` | Add/modify user profile | Confirmation |
| `search_conversation_history` | Find past conversations | Matching messages |

### Communication Tools

| Tool | Description | Returns |
|------|-------------|---------|
| `send_message` | Send proactive message to user | Delivery confirmation |
| `schedule_message` | Schedule future message | Schedule ID |

### Calendar Tools

| Tool | Description | Returns |
|------|-------------|---------|
| `get_upcoming_events` | Next N calendar events | Event list with times |
| `suggest_reschedule` | Propose moving an event | Suggestion sent to user |

### Email Tools

| Tool | Description | Returns |
|------|-------------|---------|
| `get_recent_emails` | Summarize recent inbox | Email summaries (no full body) |
| `search_emails` | Find emails by query | Matching email summaries |

### Intervention Tools

| Tool | Description | Returns |
|------|-------------|---------|
| `suggest_breathing_exercise` | Recommend specific exercise | Exercise with instructions |
| `suggest_break` | Recommend taking a break | Break suggestion with context |
| `suggest_activity` | Recommend movement/activity | Activity recommendation |

### Utility Tools

| Tool | Description | Returns |
|------|-------------|---------|
| `get_current_time` | Current time in user's timezone | ISO timestamp |
| `log_interaction` | Log this interaction for analytics | Confirmation |

### Tool Definition Format

```typescript
const tools = [
  {
    name: "get_current_biometrics",
    description: "Get the user's latest health biometrics including heart rate, HRV, steps, sleep summary, and current CRS score. Use this when you need to understand the user's current physical state.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_health_history",
    description: "Get historical health data for a specific date range. Use this to identify trends or compare current state to recent history.",
    input_schema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "ISO date string" },
        end_date: { type: "string", description: "ISO date string" },
        metrics: {
          type: "array",
          items: { type: "string", enum: ["hr", "hrv", "steps", "sleep", "crs"] },
          description: "Which metrics to retrieve",
        },
      },
      required: ["start_date", "end_date"],
    },
  },
  // ... remaining tools follow same pattern
];
```

---

## Context Management

### Conversation History

```
User sends message
  --> Load last 10 messages from conversation_history table
  --> Include in messages array
  --> After response, save new exchange to conversation_history
  --> Trim history older than 7 days (keep summaries for older)
```

### Core Memory (Persistent User Profile)

Stored in `core_memory` table. Updated by agent via `update_core_memory` tool.

```json
{
  "name": "Shivansh",
  "chronotype": "late",
  "stress_triggers": ["deadlines", "back-to-back meetings"],
  "preferred_interventions": ["breathing exercises", "short walks"],
  "communication_style": "direct, concise",
  "goals": ["improve sleep consistency", "reduce afternoon stress"],
  "medications": [],
  "caffeine_habits": "2 cups before noon",
  "exercise_routine": "gym 3x/week mornings",
  "work_schedule": "flexible, usually 10am-7pm"
}
```

### Memory Update Rules

1. Agent can only ADD or MODIFY core memory, never delete
2. User can delete via settings UI
3. Maximum 50 key-value pairs
4. Values are short strings or arrays, not free text
5. Agent must explain what it's remembering: "I'll remember that you prefer..."

---

## Safety Guardrails

### Hard Rules (In System Prompt)

```
SAFETY RULES — NEVER VIOLATE:
1. You are NOT a doctor. Never diagnose conditions.
2. Never say "you are having a heart attack/stroke/panic attack."
3. If biometrics suggest medical emergency (HR > 180 sustained, SpO2 < 90),
   say "Your readings are unusual. If you feel unwell, contact a doctor or call emergency services."
4. Never recommend stopping prescribed medication.
5. Never provide specific medical advice beyond general wellness.
6. Always frame suggestions as "you might try..." not "you should..."
7. If user expresses suicidal ideation, provide crisis helpline numbers immediately.
8. Never share user health data with anyone, including in suggestions.
```

### Rate Limits

| Limit | Value | Reason |
|-------|-------|--------|
| Max proactive messages/day | 5 | Prevent notification fatigue |
| Max agent loop iterations | 5 | Prevent runaway tool calls |
| Max tokens per response | 1024 | Keep responses concise |
| Cooldown between stress alerts | 30 min | Prevent spam |
| Max Opus calls/day per user | 3 | Cost control |

### Fallback Behavior

- If Claude API fails: queue message, retry with exponential backoff
- If all retries fail: send pre-written fallback message ("I noticed some changes in your vitals. How are you feeling?")
- If user doesn't respond to 3 consecutive proactive messages: reduce frequency for 24h

---

## Trigger Types and Flows

### 1. Stress Detected (Background)

```
Background task detects stress (multi-signal gate passes)
  --> Edge Function: check-triggers
  --> Determines severity
  --> Selects model (Haiku/Sonnet/Opus)
  --> Agent loop with health tools
  --> Sends message via Telegram/WhatsApp
```

### 2. User Sends Message

```
User messages bot in Telegram/WhatsApp
  --> Webhook Edge Function receives
  --> message-processor Edge Function
  --> Agent loop with all tools
  --> Response sent back to same channel
```

### 3. Morning Briefing (Scheduled)

```
pg_cron triggers at user's preferred time
  --> morning-brief Edge Function
  --> Agent loop (Sonnet): reads sleep, calendar, generates summary
  --> Sends via preferred channel
```

### 4. Proactive Scheduler (Scheduled)

```
pg_cron triggers every 15 minutes
  --> proactive-scheduler Edge Function
  --> Quick check (Haiku): any proactive message warranted?
  --> If yes: full agent loop with appropriate model
  --> If no: log and exit
```

---

## Personality Configuration

Stored in `config/soul.md`, loaded into system prompt:

```markdown
You are OneSync, a cognitive co-pilot.

Voice: Warm but not overly cheerful. Direct but caring. Like a knowledgeable
friend who happens to understand biometrics, not a clinical system.

Do:
- Use the user's name naturally (not every message)
- Reference specific data points when relevant ("Your HRV is 15% below your usual")
- Acknowledge context ("I know you have a presentation at 3pm")
- Keep messages short (2-3 sentences for proactive, longer for conversations)
- Use simple language, not medical jargon

Don't:
- Be preachy or lecture about health
- Use emojis excessively (one per message max, if any)
- Start every message with "Hey!" or "Hi there!"
- Apologize unnecessarily
- Be vague ("your vitals look off" — instead say what specifically)
```
