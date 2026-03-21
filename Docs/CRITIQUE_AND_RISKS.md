# OneSync -- Critique & Risk Assessment

Last updated: March 15, 2026

> Honest assessment of what can go wrong and how to handle it. This document should be revisited weekly during MVP development.

---

## Viability Assessment: YES, with caveats

OneSync is technically feasible and addresses a real gap. No existing product combines real-time wearable biometrics + AI agent + proactive messaging in this way. The key question isn't "can it be built?" but "can the experience be good enough to retain users?"

---

## Strengths

### 1. Data Advantage Over Aggregators
- On-watch apps (Samsung Sensor SDK, Garmin Connect IQ) give raw IBI data that aggregators like Terra and ROOK don't have
- Real-time streaming vs delayed summaries
- Free vs $399/month aggregator fees

### 2. Right Time, Right Stack
- Health Connect maturing on Android 14/15
- Expo SDK 53 with proper background task support
- Claude's tool_use makes sophisticated agent loops practical
- WhatsApp Cloud API pricing dropped (service replies free)
- Supabase free tier covers 100+ users

### 3. Low Capital Requirement
- $35-60/month to run for 100 users
- No paid SDKs or API subscriptions needed
- Solo developer can build MVP

### 4. Defensible Moat (If Executed)
- Personal baselines + core memory create switching cost
- Each week of data makes the agent smarter for that user
- On-watch companion apps are hard to replicate (Kotlin + Monkey C expertise)

---

## Key Risks

### Risk 1: HRV-Based Stress Detection Accuracy

**Severity: HIGH**

HRV is influenced by many factors beyond psychological stress:
- Caffeine, alcohol, medication
- Dehydration
- Posture changes
- Ambient temperature
- Menstrual cycle
- Illness / inflammation

**False positives destroy trust.** If the app sends 3 wrong stress alerts, users uninstall.

**Mitigation:**
- Multi-signal gating (HRV + HR + duration + activity context)
- Conservative thresholds (miss some true stress rather than cry wolf)
- 7-day learning period before any proactive alerts
- "Was this helpful?" feedback loop continuously tunes thresholds
- Transparency: show users exactly what triggered the alert
- Allow users to adjust sensitivity (less/more proactive)

### Risk 2: OEM Battery Optimization Killing Background Sync

**Severity: HIGH (on Samsung/Xiaomi/Huawei)**

OEMs aggressively kill background processes. dontkillmyapp.com rates:
- Xiaomi MIUI: 4/5 severity
- Samsung One UI: 3/5
- Huawei EMUI: 4/5

If background sync doesn't run, CRS can't update, stress can't be detected.

**Mitigation:**
- expo-background-task uses WorkManager (best-in-class for Android)
- In-app OEM detection + step-by-step instructions to whitelist the app
- react-native-autostarter for programmatic guidance
- Fallback: if no sync for 1+ hour, send push notification asking user to open app
- Test on real Samsung and Xiaomi devices during development

### Risk 3: Health Connect Permission UX

**Severity: MEDIUM-HIGH**

- Permission denial is **permanent** after 2 declines on Android
- Users who rush through and deny can never re-grant without app reinstall
- Google Play Health Connect declaration takes 2+ weeks

**Mitigation:**
- Pre-permission education screen explaining WHY before asking
- Request permissions one-by-one, not all at once
- If denied: clear instructions to re-enable via Settings
- Test onboarding with non-technical users before launch

### Risk 4: Samsung Health Sensor SDK Distribution

**Severity: MEDIUM**

- Developer Mode works immediately (no approval needed for testing)
- But distributing the watch app to other users may require Samsung partner approval
- The Sensor SDK partner program is separate from the frozen Data SDK program
- Status unclear -- may need to apply

**Mitigation:**
- Build and test in dev mode first (covers solo developer and beta testers)
- Side-load APK for early beta users
- Apply for Sensor SDK partnership in parallel
- Health Connect fallback works for Samsung watches (basic data)
- If Sensor SDK distribution is blocked: pivot to Garmin-first strategy (fully open)

### Risk 5: WhatsApp Business Verification

**Severity: MEDIUM**

- Sandbox works immediately (5 test phone numbers)
- Production requires Meta Business verification: 3-14 business days
- Needs business documentation (GST, incorporation cert, etc.)
- Name on docs must exactly match Business Manager entry

**Mitigation:**
- Start with Telegram (no approval needed, instant)
- Begin WhatsApp verification in Week 1 (runs in parallel)
- Personal/individual developer accounts may work for small scale
- WhatsApp is a "nice to have" for MVP -- Telegram alone is functional

### Risk 6: User Engagement & Retention

**Severity: HIGH**

The hardest problem. Users download health apps, use them for 2 weeks, forget.

**Mitigation:**
- Proactive messaging is the core retention mechanism (app comes to you)
- Morning briefing creates daily touchpoint
- AI interview creates personal connection from day one
- Feedback loop makes agent smarter over time (increasing value)
- Keep proactive messages high-quality and rare (not spammy)
- Calendar + email context makes interventions more relevant

### Risk 7: Claude API Cost at Scale

**Severity: LOW (for MVP), MEDIUM (at 1000+ users)**

Estimate per user per day:
- 4 Haiku calls (routine checks): ~$0.004
- 1 Sonnet call (morning brief): ~$0.01
- 0.5 Sonnet calls (conversations): ~$0.005
- 0.1 Opus calls (rare high severity): ~$0.005
- Daily per user: ~$0.024
- Monthly per user: ~$0.72
- 100 users: ~$72/month
- 1000 users: ~$720/month

**Mitigation:**
- Prompt caching reduces input costs 60-70%
- Haiku for routine checks (10x cheaper than Sonnet)
- Rules-based pre-filtering before calling Claude at all
- At scale: batch processing, caching common responses
- Revenue (subscription) should exceed AI costs by 3-5x

### Risk 8: Data Privacy & Liability

**Severity: MEDIUM**

Health data is sensitive. Even for a wellness app (not medical device):
- Must comply with local data protection laws
- Users may confuse wellness insights with medical advice
- If someone ignores a "you're fine" assessment and has a health event...

**Mitigation:**
- Clear disclaimers: "OneSync is not a medical device"
- System prompt guardrails: never diagnose, always recommend seeing a doctor for concerning symptoms
- Data encryption at rest and in transit (Supabase default)
- RLS ensures users only access their own data
- Data export and deletion available in settings
- No data sharing with third parties
- Privacy policy and terms of service (draft before launch)

---

## Competitive Landscape (Quick Reference)

### Direct Competitors (AI + Biometrics)

| Product | Differentiator | OneSync Advantage |
|---------|---------------|-------------------|
| Sahha.ai | SDK for developers, not end-user app | We're the end-user product |
| Welltory | HRV analysis + recommendations | We have proactive messaging + AI agent |
| Biostrap | Research-grade sensors | We work with existing consumer wearables |
| Whoop Coach (AI) | WHOOP-only, $30/month membership | Device-agnostic, free |

### Adjacent Competitors (AI Assistants)

| Product | What They Do | Gap |
|---------|-------------|-----|
| Pi (by Inflection) | Conversational AI companion | No biometric integration |
| OpenClaw | AI personal agent | No health data |
| Apple Health Summaries | AI-generated health insights | No proactive outreach, Apple only |
| Google Fitbit Premium | AI-powered health coaching | Fitbit-only, no real-time intervention |

### OneSync's Unique Position

No product currently:
1. Reads raw biometrics from multiple wearable brands
2. Computes a real-time cognitive readiness score
3. Proactively reaches out via messaging when stress is detected
4. Uses a personal AI agent that learns and adapts over time
5. Integrates calendar/email for contextual intelligence

---

## What Could Kill This Project

1. **Google locks down Health Connect further** -- Unlikely, they're investing in it
2. **Samsung closes Sensor SDK entirely** -- Possible but Garmin is fully open as backup
3. **Claude API pricing increases dramatically** -- Trend is downward, not upward
4. **User apathy** -- The biggest real risk. Mitigation: proactive messaging = the product comes to you
5. **A big player (Apple/Google/Samsung) builds this natively** -- Possible in 2-3 years, but MVP window is now

---

## Honest Assessment

**What's realistic in 12 weeks as a solo developer:**
- React Native app with Health Connect integration
- Background sync working on Pixel/stock Android (Samsung may be flaky)
- CRS computation from available data
- Telegram bot with Claude agent (conversational + morning brief)
- Basic stress detection (conservative, may miss some events)
- Samsung watch companion (in dev mode, your device only)
- Dashboard with CRS gauge and basic charts

**What will probably slip:**
- WhatsApp integration (verification timeline)
- Garmin watch app (Monkey C learning curve)
- Calendar/email integration (OAuth consent screen review)
- Polish and edge cases

**What matters most:**
- Get the core loop working: sensor -> score -> AI -> message -> feedback
- Test with yourself daily for 2+ weeks
- Iterate on false positive rate until it's tolerable
- The technology is proven; the challenge is tuning the experience

---

## NOTES & RECOMMENDATIONS

### 1. Risk Prioritization Matrix

Rank risks by (Probability x Impact) to focus mitigation efforts:

| Risk | Probability | Impact | Score | Priority |
|------|-----------|--------|-------|----------|
| User engagement/retention | High | Critical | 9 | **P0** |
| HRV stress detection accuracy | High | High | 8 | **P0** |
| OEM battery killing sync | High | High | 8 | **P0** |
| HC permission UX | Medium | High | 6 | **P1** |
| Samsung SDK distribution | Medium | Medium | 4 | **P1** |
| WhatsApp verification | Medium | Low | 3 | **P2** |
| API cost at scale | Low | Medium | 2 | **P2** |
| Privacy/liability | Low | High | 3 | **P1** |

The three P0 risks (retention, accuracy, background sync) should be the FIRST things validated in MVP. Not features -- risk validation.

### 2. Missing Risk: Solo Founder Burnout
12 weeks of solo full-stack + AI + wearable SDK + messaging bot development is a LOT. This isn't called out but it's one of the biggest risks. Mitigation:
- Ruthlessly cut scope to the core loop
- Use Claude Code as a force multiplier
- Set weekly milestones and celebrate progress
- Don't optimize prematurely -- get ugly working code first

### 3. Missing Risk: Regulatory Creep
If OneSync gains traction, health regulators may take interest. India's Digital Personal Data Protection Act (DPDPA) 2023 covers health data. If expanding to US/EU, HIPAA and GDPR become real concerns. Plan for this from day one by:
- Minimizing data collection to what's needed
- Building data export/deletion into MVP
- Never storing raw biometric data longer than needed
- Having a privacy policy reviewed by someone knowledgeable

### 4. Missing Risk: Claude API Reliability
What happens when Anthropic has an outage? The stress intervention -- the hero feature -- fails silently. Consider:
- Local fallback messages for common stress scenarios (no AI needed)
- Queue interventions and deliver when API is back (with a "delayed" flag)
- Monitor API uptime and have alerting

### 5. The "First 100 Users" Problem
The risk doc assumes building the product is the hard part. Finding 100 engaged beta testers who wear a Samsung Galaxy Watch AND use Telegram is actually very hard. Consider:
- IIT Roorkee community as initial base (known network)
- Reddit communities (r/QuantifiedSelf, r/Biohackers)
- Indie Hackers / Product Hunt launch
- Personal LinkedIn / Twitter (build in public)
- The target user is very specific -- need to go where they are

### 6. Contradictions Found
- Cost doc says ~$0.72/user/month for Claude, while Lean Cost doc says $2.86/user/month with mixed routing. The discrepancy comes from different assumptions about calls/day. Standardize the usage model.
- "10-15 days" MVP timeline in early docs vs "12 weeks" in later docs. The 12-week timeline is more realistic.
