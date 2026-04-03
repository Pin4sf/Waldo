---
name: Session 6 — Team Demo Build
description: Google OAuth stack built and deployed. 13 Edge Functions running. 5-person demo path clear.
type: project
---

Google Workspace integration stack is live (Calendar, Gmail, Tasks OAuth + sync). 13 Edge Functions deployed. oauth_tokens + sync_log tables added.

**Why:** Building toward 5-person internal team demo where each person gets their own Waldo with real integrations.

**How to apply:** Remaining work is: HealthKit live wiring (iOS), Health Connect (Android), Telegram onboarding bot, optional Microsoft Graph for Outlook users. The Google OAuth connect URL is the onboarding trigger for now — users visit it to connect their workspace.

**Anon key in git:** `20260331000002_pg_cron_triggers.sql:11` has real anon key. User will rotate and update.

**To get 5 users running right now (manual path):**
1. Create user row in Supabase users table manually
2. Run seed-supabase.ts with Apple Health export
3. Share connect URL: `/functions/v1/oauth-google/connect?user_id=<id>&scopes=calendar,gmail,tasks`
4. Share Telegram linking code (generate via user-profile function)
