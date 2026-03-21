# OneSync — Developer Registrations & API Access Checklist

Last updated: March 6, 2026

---

## Priority Order (longest approval first)

| # | Platform | Link | Approval Time | Cost | Status |
|---|----------|------|---------------|------|--------|
| 1 | **Google Play Console** | [play.google.com/console/signup](https://play.google.com/console/signup) | 48h - 2 weeks (ID verification) | $25 one-time | |
| 2 | **Meta Business (WhatsApp)** | [developers.facebook.com/apps](https://developers.facebook.com/apps) | Sandbox: instant. Business verification: 3-14 days | Free | |
| 3 | **Garmin Health API** | [developerportal.garmin.com](https://developerportal.garmin.com/developer-programs/connect-developer-api) | ~2 business days + integration call | Free | |
| 4 | **Samsung Developer Account** | [developer.samsung.com](https://developer.samsung.com) | Instant | Free | |
| 5 | **Samsung Health Sensor SDK** | [developer.samsung.com/health/sensor](https://developer.samsung.com/health/sensor/overview.html) | Instant (dev mode) | Free | |
| 6 | **Garmin Connect IQ SDK** | [developer.garmin.com/connect-iq/sdk](https://developer.garmin.com/connect-iq/sdk/) | Instant | Free | |
| 7 | **Fitbit Web API** | [dev.fitbit.com/apps](https://dev.fitbit.com/apps) | Instant (personal app) | Free | |
| 8 | **Oura Developer Portal** | [cloud.ouraring.com](https://cloud.ouraring.com) | Instant (personal token) | Free (needs Oura Ring) | |
| 9 | **WHOOP Developer Dashboard** | [developer-dashboard.whoop.com](https://developer-dashboard.whoop.com) | Instant (dev mode, 10 users) | Free (needs WHOOP device) | |
| 10 | **Anthropic API** | [console.anthropic.com](https://console.anthropic.com) | Instant | Pay-per-use (~$5 free credits) | |
| 11 | **Supabase** | [supabase.com/dashboard](https://supabase.com/dashboard) | Instant | Free tier | |
| 12 | **Expo** | [expo.dev/signup](https://expo.dev/signup) | Instant | Free (15 builds/mo) | |
| 13 | **Telegram Bot** | [t.me/botfather](https://t.me/botfather) | Instant | Free forever | |
| 14 | **Sahha.ai** (optional) | [app.sahha.ai/auth/register](https://app.sahha.ai/auth/register) | Instant (sandbox) | Free sandbox | |
| 15 | **Google Calendar API** | [console.cloud.google.com](https://console.cloud.google.com) | Instant (OAuth consent screen review: 1-3 weeks for production) | Free | |
| 16 | **Gmail API** | Same Google Cloud project | Same as above | Free | |

---

## Documents Needed

### Google Play Console (ID Verification)
- Government-issued photo ID (Aadhaar/Passport/DL)
- Physical address
- Register as **personal** account (not organization — avoids D-U-N-S requirement)

### Meta Business Verification (WhatsApp Production)
One of:
- GST certificate (best for India)
- Business registration / incorporation certificate
- Utility bill in business name
- Bank statement in business name

**Important:** Legal name on document must EXACTLY match Business Manager entry. Website must be live.

**Without business docs:** Sandbox works immediately (test with 5 phone numbers). Handle verification later.

### Google OAuth Consent Screen (Calendar/Gmail)
- For "testing" mode: up to 100 test users, no review needed
- For production: Google reviews the consent screen (1-3 weeks)
- Start in testing mode, add beta users manually

---

## Samsung Health SDK — Important Notes

### Data SDK (Phone-side): PARTNERSHIP FROZEN
- Partner Apps Program has been closed 2+ years
- No announced reopening date
- developer.samsung.com/health/data/process.html
- **Can still develop with Developer Mode** on your own device

### Sensor SDK (Watch-side): SEPARATE PROGRAM
- Appears to still accept applications
- Developer Mode available immediately (no approval for testing)
- Download SDK v1.4.1 from developer.samsung.com/health/sensor
- Enable on watch: Settings > Apps > Health Platform > tap title 10x

---

## NOT Needed for MVP

| Platform | Why Not | When |
|----------|---------|------|
| ROOK SDK | No free tier, $399/mo min | When >750 users |
| Terra API | $399/mo, no free tier | Not needed |
| Apple Developer | $99/yr, iOS is Phase 2 | When starting iOS |
| WHOOP API | Need WHOOP device + membership | When supporting WHOOP users |
| Oura API | Need Oura Ring + membership | When supporting Oura users |
