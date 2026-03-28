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
