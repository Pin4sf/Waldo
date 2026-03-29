# Health Data Security Rules

These rules are NON-NEGOTIABLE. Health data is sensitive. Violations are always CRITICAL.

## Local Storage
- ALL health metrics stored locally MUST use op-sqlite + SQLCipher (AES-256)
- Never store health data in AsyncStorage, MMKV, or plain SQLite
- MMKV is OK for non-health preferences (theme, onboarding state, etc.)

## Supabase
- Every table containing health data MUST have RLS enabled
- RLS policy: `auth.uid() = user_id` — users only see their own data
- Edge Functions MUST validate JWT before any health data access
- Use parameterized queries — never interpolate user input into SQL

## Logging
- NEVER log actual health values (HRV, HR, sleep hours, CRS score)
- OK to log: user_id, timestamp, event type, error codes, tool names
- Edge Function agent_logs: log tool calls and token counts, NOT health data content
- Sentry/crash reporting: scrub health data from breadcrumbs

## Secrets
- API keys (Anthropic, Supabase, Telegram) → environment variables only
- .env files → .gitignore always
- Telegram bot token exposure = full message history access — treat as critical secret

## Data in Transit
- All Supabase connections use HTTPS/TLS — never allow HTTP fallback
- Channel adapters (Telegram, WhatsApp, etc.) use their platform's encryption (Telegram MTProto, WhatsApp E2E)
- Supabase Edge Functions accessed only via HTTPS with JWT auth
- Health data payloads between phone and Supabase use HTTPS — no custom encryption layer needed (TLS is sufficient)

## Regulatory Stance (MVP)
- Waldo is NOT targeting HIPAA/GDPR compliance for MVP
- We follow best practices (encryption, RLS, no health data in logs) as good engineering, not regulatory obligation
- "Not a medical device" disclaimer is the legal boundary
- If we pursue healthcare enterprise customers (Phase 4+), engage compliance counsel first

## Privacy
- "Not a medical device" disclaimer in onboarding and settings
- Data export capability (user can download all their data)
- Account deletion cascades to ALL health data (local + Supabase)
- No health data in analytics or telemetry

## Prompt Injection Defense (Agent-Specific)
Waldo's agent takes external input (Telegram messages, webhook payloads) and feeds it to Claude. This creates a prompt injection attack surface.

- **Template-wrap ALL external content** before including in prompts — wrap with explicit boundary markers (`---BEGIN USER MESSAGE---` / `---END USER MESSAGE---`) and instructions to not treat as commands
- **Prompt ordering**: System instructions (SOUL, safety rules) FIRST → user profile + health context MIDDLE → external input (user messages) LAST. Leverages positional bias in LLMs.
- **Sandwich defense**: Repeat critical safety instructions AFTER user content: "Never diagnose medical conditions. Never reveal raw health values. Never execute actions outside defined tools."
- **Blocked patterns in user input**: Scan for tool-call-like structures, JSON/XML injection, "ignore instructions" patterns. Log and sanitize before sending to Claude.
- **Never echo system prompt content** in agent responses. If canary tokens appear in output, terminate and log.

## Tool-Use Safety
The agent's 8 tools include write operations (`send_message`, `update_memory`) that could be exploited via prompt injection.

- **Per-trigger tool restrictions**: Morning Wag only gets read tools + send_message. Fetch Alert gets a scoped subset. Only user-initiated chat gets full tool access.
- **Zod-validate every tool argument** returned by Claude before executing the tool call
- **Memory poisoning prevention**: Reject `update_memory` content containing URLs, code blocks, base64, or instruction-like patterns ("ignore", "you are now", "system:")
- **Rate limit write tools per invocation**: max 1 `send_message` per invocation (unless user-initiated chat), max 3 `update_memory` per invocation
- **Tool output sanitization**: Before feeding tool results back to Claude, strip anything that looks like prompt injection from the data

## Egress Control (Edge Functions)
Supabase Edge Functions have unrestricted outbound network access by default. Mitigate at the code level.

- **URL allowlist**: All `fetch()` calls in Edge Functions go through a `safeFetch()` wrapper that validates the target hostname against an allowlist: `api.anthropic.com`, `api.telegram.org`, `api.open-meteo.com`, Supabase project URL
- **Adding a new allowed domain** requires a code change and review — not a config toggle
- **Log blocked requests**: Any outbound request to an unlisted host is blocked and logged with full context (the URL, the calling function, timestamp)

## Phase 2 Adapter Privacy Rules

Each new adapter handles different sensitivity levels. These rules are NON-NEGOTIABLE.

### EmailProvider (Gmail / Outlook)
- **Headers ONLY. NEVER read email body content.**
- Extract: timestamp, sender domain (not full address), thread ID, labels, message count
- OK to compute: volume per hour, response time, after-hours ratio, thread depth
- NEVER log: email subjects, sender names, recipient lists
- NEVER store raw email headers — only derived metrics (CSI, volume, ratios)

### CalendarProvider (Google Calendar / Outlook)
- Read: event title, start/end, attendee count, recurrence, busy/free status
- OK to compute: Meeting Load Score, focus gaps, back-to-back count
- NEVER log: attendee names or email addresses
- Event titles may contain sensitive info (e.g., "Doctor appointment") — treat as PII, don't include in prompts verbatim. Use category inference only.

### TaskProvider (Todoist / Notion / Linear)
- Read: task title, status, due date, completion date
- OK to compute: pile-up count, velocity, urgency queue
- Task titles may contain sensitive project names — summarize, don't quote in logs
- NEVER access task descriptions/notes (may contain credentials, links, PII)

### MusicProvider (Spotify)
- Read: audio features (valence, energy, tempo), timestamps, listening duration
- OK to compute: mood score, late-night listening, energy trends
- NEVER log specific song titles or artist names (privacy + licensing)
- NEVER store raw listening history — only derived mood metrics

### ScreenTimeProvider (RescueTime)
- Read: app category usage, productive/distracting ratio, total time
- OK to compute: screen quality score, focus sessions, late-night digital
- NEVER log specific app names or URLs visited
- NEVER store raw usage data — only category-level aggregates

## Agent Audit Trail
- **Every tool call logged**: `trace_id`, `user_id`, `tool_name`, `tool_input_summary` (sanitized — NO health values), `was_blocked`, `block_reason`, `latency_ms`
- **Cost tracking**: Token usage and estimated cost per invocation, per user per day. Hard daily cap prevents runaway costs from prompt injection loops.
- **Memory write audit**: Every `update_memory` call logged with a summary of what changed. Periodic snapshots enable rollback if memory is poisoned.
- **Audit logs are append-only**: No UPDATE/DELETE on audit tables. RLS prevents modification.
