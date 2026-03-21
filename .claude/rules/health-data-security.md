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

## Privacy
- "Not a medical device" disclaimer in onboarding and settings
- Data export capability (user can download all their data)
- Account deletion cascades to ALL health data (local + Supabase)
- No health data in analytics or telemetry
