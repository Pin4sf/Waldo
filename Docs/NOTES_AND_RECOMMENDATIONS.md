# OneSync -- Consolidated Notes & Recommendations

Last updated: March 15, 2026

> This document consolidates all strategic insights, product recommendations, research findings, and action items discovered during the documentation consolidation process. It pulls together the "Notes & Recommendations" sections from all 9 working docs plus deep research on CRS validation, product strategy, and competitive positioning.

> **MVP Start Here:** See [MVP_SCOPE.md](MVP_SCOPE.md) for what we're building, [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md) for pre-code setup, and [NEXT_STEPS.md](NEXT_STEPS.md) for exact actions.

---

## TABLE OF CONTENTS

1. [Top 10 Immediate Actions](#1-top-10-immediate-actions)
2. [CRS Validation Plan with IIT Ropar](#2-crs-validation-plan-with-iit-ropar)
3. [Product Strategy Gaps](#3-product-strategy-gaps)
4. [Technical Risks & Alternatives](#4-technical-risks--alternatives)
5. [Innovation Angles](#5-innovation-angles)
6. [Competitive Moat Analysis](#6-competitive-moat-analysis)
7. [Founder-Relevant Observations](#7-founder-relevant-observations)
8. [Per-Document Insights](#8-per-document-insights)

---

## 1. TOP 10 IMMEDIATE ACTIONS

These are the highest-leverage actions, ordered by urgency:

1. **Validate before building.** Run a 2-week "Wizard of Oz" test -- manually compute CRS from your Samsung Galaxy Watch data + manually send Telegram messages as if you were the agent. If the hero moment doesn't feel right manually, the algorithm needs work before any code is written.

2. **Cut MVP scope to 8 weeks.** Drop WhatsApp, Google Calendar, Gmail, Garmin companion from MVP. Keep: Samsung watch companion + Telegram + CRS + stress detection + dashboard. This is the minimum that proves the thesis.

3. **File provisional patents.** Before any public disclosure (including IIT Ropar study, blog posts, or ProductHunt launch), file Indian provisional patents on: (a) the CRS multi-signal algorithm with adaptive personalization, (b) proactive biometric intervention delivery via messaging platforms. Cost: INR 8,000-15,000 per provisional.

4. **Begin IIT Ropar study planning immediately.** Identify a faculty partner in Biomedical Engineering or CS. The validated paper is worth more than 10,000 lines of code for fundraising and credibility.

5. **Implement on-phone stress detection with local notification.** Don't wait for the Claude pipeline for the first stress alert. Compute stress confidence locally, show a local push notification immediately, then deliver Claude's personalized message 2-5 minutes later via Telegram. Speed matters for the "magic moment."

6. **Use a foreground service notification on Samsung/Xiaomi by default.** Background processing reliability is existential for the product. Without it, CRS can't update, stress can't be detected.

7. **Solve the 7-day "dead zone."** During the learning period, send daily "here's what I'm learning about you" messages. "Day 3: Your resting HR is 62 BPM, lower than average. That's good." This keeps users engaged before the full agent activates.

8. **Build the free tier with a sharp upgrade boundary.** Free: daily CRS + morning brief + 3 messages/day via Telegram. Pro (INR 399/mo): stress alerts + unlimited messages + WhatsApp + weekly deep analysis + multi-wearable support.

9. **Plan for Garmin-first if Samsung SDK distribution is blocked.** Garmin Connect IQ is fully open. Apply for Samsung Sensor SDK partnership in parallel, but don't depend on it.

10. **Start building in public.** Post 3-5 Reddit/Twitter posts explaining the CRS concept with a waitlist link. If 500+ people sign up in 2 weeks, you have demand signal before writing code.

---

## 2. CRS VALIDATION PLAN WITH IIT ROPAR

### 2.1 Study Overview

**Title:** "Validation of a Wearable-Derived Cognitive Readiness Score Against Objective Cognitive Performance Measures: A Prospective Cohort Study"

**Type:** Prospective observational cohort, within-subject repeated-measures design.

**Why this matters:** A published, peer-reviewed validation is the single strongest credibility signal for investors, users, and potential partners. It transforms "we claim 85% accuracy" into "IIT Ropar validated our accuracy against clinical gold standards."

### 2.2 Study Design

**Participants:** N = 50 (accounting for 15-20% dropout)
- 25 "high-variability" (students with irregular schedules)
- 25 "regular" (students/staff with consistent routines)
- Age 18-35, own/willing to wear Samsung Galaxy Watch 6/7 or Garmin Venu 3
- No diagnosed sleep/cardiovascular/psychiatric conditions
- No beta-blockers or HR/HRV-affecting medications

**Duration:** 30 days continuous monitoring + cognitive testing

### 2.3 Ground Truth Measurements

| Measure | Gold Standard | Frequency | Purpose |
|---------|--------------|-----------|---------|
| Sleep architecture | PSG (polysomnography) | 2 nights/participant (start + end) | Validate wearable sleep staging |
| HRV accuracy | ECG Holter monitor (24h) | 2 sessions/participant | Validate wearable RMSSD vs clinical ECG-derived RMSSD |
| Stress/cortisol | Salivary cortisol (4 samples/day) | 3 non-consecutive days/participant | Correlate CRS stress component with biochemical marker |
| Cognitive performance | PVT (Psychomotor Vigilance Task) | Daily, 3x/day (morning, afternoon, evening) | **Primary outcome** |
| Working memory | N-back task (2-back) | Daily, 2x/day | Secondary outcome |
| Subjective alertness | Karolinska Sleepiness Scale (KSS) | 5x/day | Subjective validation |
| Subjective stress | Perceived Stress Scale (PSS-4) | Daily evening | Correlate with CRS stress component |

### 2.4 What "85% Accuracy" Actually Means

The claim needs precise definition. Recommended definition:

**"The proportion of CRS zone predictions (Peak/Moderate/Low) that correctly match the participant's objective cognitive performance zone as measured by PVT reaction time."**

This is a 3-class classification accuracy. 85% on 3-class with balanced classes would be impressive and publishable.

**Statistical methods:**
- Linear mixed-effects models (lme4 in R) for repeated measures
- Primary: within-subject correlation between CRS and PVT reaction time
- Target: r >= 0.35 (statistically significant, clinically meaningful)
- Bland-Altman plots for HRV and sleep validation
- ROC curves for stress detection (CRS stress component vs cortisol threshold)
- Bootstrap confidence intervals for personalization improvement (week 1 vs week 4 accuracy)

### 2.5 IIT Ropar Collaboration Structure

| Role | Who | Responsibility |
|------|-----|---------------|
| Software/Algorithm | Shivansh | OneSync app, CRS algorithm, data pipeline, co-author |
| Faculty PI | IIT Ropar professor (Biomedical Eng / CS) | IRB oversight, lab access, statistical guidance, senior author |
| Research assistants | 1-2 M.Tech/Ph.D. students | Daily cognitive testing, participant scheduling, saliva collection |
| Lab equipment | IIT Ropar or partner sleep clinic | PSG for 2 nights/participant, ECG Holter monitors |

### 2.6 Budget

| Item | Cost (INR) |
|------|-----------|
| PSG sessions (2 x 50 participants) | 3-5 lakh |
| ECG Holter monitors (rental) | 1 lakh |
| Salivary cortisol assays (600 samples) | 3 lakh |
| Participant compensation (INR 1,000 x 50) | 50,000 |
| Wearable device loaners (20 units) | 3 lakh |
| Research assistant stipend (2 x 4 months) | 1.2 lakh |
| **Total** | **12-15 lakh (~$13,000-16,000 USD)** |

**Funding sources:** IIT Ropar SEED grants (INR 5-10 lakh), DST grants for digital health, or self-funded from startup budget.

### 2.7 Timeline

| Month | Activity |
|-------|----------|
| 1 | Identify faculty, draft protocol, submit IEC (ethics) application |
| 2 | IEC review. Recruit participants. Procure equipment. |
| 3 | IEC approval. Onboarding. Baseline PSG + ECG sessions. |
| 3-4 | 30-day monitoring. Daily PVT/N-back. 3 cortisol collection days. |
| 4 | End-of-study PSG + ECG. Data collection complete. |
| 5 | Data analysis, statistical modeling. |
| 6 | Paper writing and submission. |

**Target journals:** JMIR, Sensors (MDPI), Sleep Health, Frontiers in Digital Health.

**Paper title:** "OneSync CRS: Validation of a Consumer Wearable-Derived Cognitive Readiness Score Against Psychomotor Vigilance and Salivary Cortisol in Young Adults"

---

## 3. PRODUCT STRATEGY GAPS

### 3.1 User Acquisition Is Absent

The current docs have no concrete acquisition plan. Needed:
- **Distribution channels:** Reddit (r/Biohackers 500K+, r/QuantifiedSelf 150K+), Twitter/X health-tech, YouTube biohacking audience (Huberman overlap), ProductHunt launch
- **Content-led acquisition:** "What's your Cognitive Readiness Score?" quiz on landing page -- input sleep hours, wake time, energy level; output estimated CRS. Generates email leads before app launches. Cost: $0.
- **Referral in MVP:** "Invite a friend, compare CRS trends" -- natural viral hook for quantified-self users. Don't wait until Phase 3.
- **Watch store distribution:** List Samsung companion on Galaxy Store, Garmin companion on Connect IQ Store. Lower competition than Play Store.
- **CAC funnel estimates** needed for funding pitch.

### 3.2 Retention Gaps

- **No social features.** Health apps with social components (Strava, Peloton) retain 3-5x better. Even simple "share weekly CRS trend to Instagram Stories" would help.
- **No streaks/gamification.** A "7-day streak of 70+ CRS" badge costs nothing and drives daily opens.
- **No longitudinal value visualization.** Users need to SEE accuracy improving: "Your CRS accuracy was 65% in week 1 and is now 82% in week 4."
- **Quiet day problem.** On 60% of days, nothing biometrically interesting happens. The app goes silent. Solution: add a daily "insight" message surfacing a non-obvious pattern from historical data.

### 3.3 Onboarding Friction

- **Health Connect permissions:** 30-40% of users abandon during permission flows. Allow a "minimal permissions" path (sleep + steps only) that still delivers a useful CRS.
- **Messaging channel linking is cold-start friction.** Downloading an app, then opening Telegram, then typing a code -- each app switch loses 15-20% of users. Start with push notifications only, promote Telegram after user sees value.
- **The 7-day dead zone.** No proactive alerts during learning period = users forget the app exists. Send daily "learning" messages.

### 3.4 Competition Response Timeline

The docs estimate 12-18 months before Oura/WHOOP/Apple add AI agents. **This is optimistic. Realistic: 6-12 months.**
- Oura already has "Oura Advisor" (launched late 2025)
- WHOOP Coach (AI) exists in-app
- Apple Health Summaries + Apple Intelligence is one iOS update away

**OneSync's only durable advantage is device-agnosticism.** The multi-device story needs to be real (not just planned) before competitors close the gap.

### 3.5 Privacy/Compliance Gaps

| Regulation | Status | Action Needed |
|-----------|--------|--------------|
| India DPDPA 2023 | Not addressed | Draft privacy policy, consent flows, data localization check |
| GDPR (EU users) | Mentioned briefly | DPA with Supabase, data portability, right to erasure implementation |
| HIPAA (NFL track) | Mentioned in hardware doc | Supabase Enterprise needed for BAA. Plan from day one. |
| Anthropic data policy | Not addressed | Confirm Claude API doesn't retain health data (it doesn't by default -- document this) |

### 3.6 What If Samsung/Garmin Deny SDK Access?

| Tier | Scenario | Impact | Probability |
|------|----------|--------|-------------|
| 1 (best) | Samsung approves Sensor SDK distribution | Full raw IBI data | 40% |
| 2 (likely) | Samsung denies, Garmin open | Garmin-first for premium data, Samsung via HC fallback | 40% |
| 3 (bad) | Both restrict | HC + cloud APIs only. CRS quality degrades significantly. | 15% |
| 4 (nuclear) | Build own hardware (OneBand) | 12+ months out | 5% |

**Plan for Tier 2 as the base case.**

---

## 4. TECHNICAL RISKS & ALTERNATIVES

### 4.1 Health Connect Data Quality
For budget wearables (Noise, boAt, Fire-Boltt -- top 3 in India), CRS will be HR + sleep + steps only. No HRV = no real-time stress detection (the hero feature). Mitigations:
- Accept "Basic CRS" vs "Full CRS" tiers
- HR-based stress estimation fallback (elevated resting HR for sustained periods)
- Phone-based signals (accelerometer for fidgeting, microphone for speech patterns -- research-grade)
- Encourage wearable upgrades (potential affiliate revenue)

### 4.2 Background Processing
Even with Kotlin WorkManager module, failure rates on Xiaomi are 30-50%. Additional mitigations not in current plan:
- **Foreground service with persistent notification** -- make it DEFAULT on Samsung/Xiaomi/Huawei
- **Health Connect background read permission** (Android 15+) -- OS manages the read schedule
- **FCM high-priority silent push** as wake-up mechanism when server sees no data for 30+ minutes
- **Mandatory device-specific setup guide** for Samsung/Xiaomi users (not optional)

### 4.3 Claude API Latency
Stress intervention pipeline: worst-case 17 minutes, typical 2-5 minutes. This is near-real-time, not real-time.
- **On-phone stress detection + local push notification** immediately (pre-composed message, no AI needed)
- **Claude personalized message follows** 2-5 minutes later via Telegram
- **Reduce background task interval** via foreground service (5-min checks instead of 15-min)
- **pg_notify instead of pg_cron** for stress detection -- critical, not optional

### 4.4 Supabase Scaling

| Bottleneck | Hits at | Solution |
|-----------|---------|----------|
| Edge Function invocations (500K/mo) | ~200 users | Supabase Pro ($25/mo) |
| Edge Function concurrency (10 free) | 50+ simultaneous alerts | Pro tier (100 concurrent) |
| Database connections (60 free) | With PowerSync/Edge Functions | Connection pooling, Pro tier (200) |
| Database size (500MB free) | ~500 users at 90 days | Pro tier (8GB) |

At 500+ users: move agent loop to dedicated worker (Railway $5/mo). At 5000+: likely need to move off Supabase.

### 4.5 Prompt Caching Reality Check
Docs estimate 60-70% savings. Reality:
- With 5-min TTL (standard): cache hit rate ~30-40% (15-min check intervals miss the cache)
- With 1-hour TTL (if available): cache hit rate ~80-90%
- **If 1-hour TTL unavailable:** per-user API cost roughly doubles from ~$0.72 to ~$1.00-1.20/month. Still viable, but margins drop from 78% to ~65%.

### 4.6 Missing Risks Not in Current Docs
- **Claude API reliability.** What happens during Anthropic outage? Need local fallback messages for common stress scenarios.
- **Solo founder burnout.** 12 weeks of full-stack + AI + wearable SDK + messaging bot is a LOT. Cut scope ruthlessly.
- **Regulatory creep.** If OneSync gains traction, health regulators may take interest. Build data export/deletion from day one.
- **The "first 100 users" problem.** Finding 100 people who wear a Samsung Galaxy Watch AND use Telegram is very specific. Target: IIT community, Reddit, Indie Hackers, build-in-public on Twitter.

---

## 5. INNOVATION ANGLES

### Near-Term (Phase 2-3)

| Innovation | Effort | Impact | Timeline |
|-----------|--------|--------|----------|
| **Predictive illness detection** | 1 week (algorithm) | High -- proactive "you might be getting sick" alert 1-3 days early | Phase 2, needs 30+ days baseline |
| **CGM integration** (Dexcom, Libre) | 1 week per vendor | High -- glucose directly affects cognitive performance | Phase 2-3 |
| **Circadian lighting control** (Philips Hue, Google Home) | 1 week per platform | Medium -- auto-adjust lights based on circadian phase | Phase 3 |
| **Mental health early warning** | 2 weeks + safety review | Very High -- flag concerning sleep/activity/HRV trends over 2+ weeks | Phase 2-3, significant safety review |

### Medium-Term (Phase 3-4)

| Innovation | Effort | Impact | Timeline |
|-----------|--------|--------|----------|
| **Team cognitive readiness** | 4 weeks | High -- startup teams, sports teams | Phase 3-4 |
| **Federated learning** | 6 weeks | Very High -- privacy-preserving population model, genuine data moat | Phase 3-4, needs 1000+ users |
| **EEG headband integration** (Muse, Neurable) | 3 weeks | High -- direct brain measurement, aligns with hardware strategy | Phase 3 |
| **Home screen widget** | 1 week | Medium -- highest-engagement surface, CRS at a glance | Phase 2 (quick win) |

### Long-Term (Phase 4+)

| Innovation | Effort | Impact | Timeline |
|-----------|--------|--------|----------|
| **Voice biomarkers** from phone calls | 8 weeks + privacy review | Medium -- passive stress detection from speech patterns | Phase 4, sensitive |
| **Skills marketplace** | 12 weeks | High -- third-party extensions (jet-lag-recovery, meditation-coach) | Phase 4 |
| **Health MCP Server** (open-source) | 4 weeks | Strategic -- if it becomes standard, OneSync is infrastructure | Phase 3-4 |

---

## 6. COMPETITIVE MOAT ANALYSIS

### How Defensible Is the Data Moat?

**Moderately defensible, deepening over time.**

| Aspect | Strength | Timeline |
|--------|----------|----------|
| Personal baselines (switching cost) | Strong after 30 days | Immediate |
| Core memory (agent learns preferences) | Strong, non-exportable | Builds over months |
| Feedback dataset (CRS + thumbs up/down) | Unique -- no competitor has this labeled data | Builds over months |
| Population model (federated learning) | Very strong after 1000+ users | 12+ months |
| Raw biometric data | Weak -- any HC app reads the same data | N/A |
| CRS algorithm | Moderate -- publishable but replicable | N/A |

**Verdict:** Execution speed is the only moat in year 1. After year 2 with 10,000+ users, the data moat becomes significant.

### What Stops Apple/Google?

| Company | Biggest Threat | What Stops Them |
|---------|---------------|-----------------|
| Apple | Health + Apple Intelligence + Watch | Conservatism (FDA concerns), iPhone-only, no messaging bots, privacy limits personalization |
| Google | Fitbit + Gemini + Wear OS | Scattered focus, history of abandoning health products, no proactive messaging |
| Oura | Best sleep data + Oura Advisor | Single-device, no messaging bot, coaching not agency |
| WHOOP | WHOOP Coach AI | Single-device ($30/mo), no external messaging |

**Neither Apple nor Google will build THIS specific product** (AI agent + proactive messaging + device-agnostic). They may build components. OneSync's advantage is the integrated experience.

### Patent Opportunities

File BEFORE any public disclosure:

1. **"Method for computing cognitive readiness from multi-signal wearable data with adaptive personalization"** -- the specific combination + feedback-driven weight adjustment
2. **"System for proactive health intervention delivery based on real-time biometric triggers via messaging platforms"** -- biometric triggers + AI messages + external messaging delivery
3. **"Time-of-day normalized HRV baseline for stress detection"** -- circadian-block adjusted HRV baselines
4. **"Accelerometer-gated EEG acquisition for athletic cognitive performance"** -- between-plays neural measurement (from hardware strategy)

**Cost:** Indian provisional: INR 8,000-15,000 each. US provisional: $3,000-5,000 each.

### Network Effects

- **Data network effect (strongest):** More users -> better population model -> better cold-start
- **Content/skills network effect (moderate):** More users -> more skill creators -> more skills
- **Team network effect (moderate):** Each new team member adds value for the whole team
- **Integration network effect (weak):** If Health MCP Server becomes standard

**OneSync competes on product quality, not network lock-in.** The data network effect is the strongest play.

---

## 7. FOUNDER-RELEVANT OBSERVATIONS

### Pricing Recommendation

| Tier | Price | What You Get | API Cost | Margin |
|------|-------|-------------|----------|--------|
| Free | INR 0 | Daily CRS, morning brief, Telegram, 3 msgs/day | $0.15/user | N/A (acquisition) |
| Pro | INR 399/mo ($4.34) | Full CRS, stress alerts, WhatsApp + Telegram, unlimited msgs, weekly analysis | $0.95/user | 78% |
| Team | INR 999/mo/seat | Team dashboard, API access, priority support | $0.95/user | 90%+ |

Compare: Oura INR 599/mo, WHOOP INR 2,500/mo, Lindy $50/mo.

### Fundraising Timeline

| Month | Milestone |
|-------|-----------|
| 1-2 | Wizard of Oz validation + cut/confirm scope |
| 3-4 | Build focused MVP (8 weeks) |
| 4-5 | Self-test daily for 2+ weeks |
| 5-6 | Beta with 50 users (IIT network) |
| 6-7 | Iterate on false positive rate, collect metrics |
| 7 | Begin IIT Ropar study (runs 6 months) |
| 8 | **Pitch pre-seed with beta metrics + study-in-progress** |
| 12 | Paper submitted, results available for Series A narrative |

**Pre-seed target:** INR 50 lakh - 1 crore ($55K-$110K USD)
**Use of funds:** 6 months runway + IIT Ropar study + first hire (part-time ML engineer)

### Metrics That Prove Product-Market Fit

| Metric | Target | What It Proves |
|--------|--------|---------------|
| CRS thumbs-up rate | >70% | Algorithm accuracy |
| Stress intervention positive response | >50% | Core value prop |
| DAU/MAU ratio | >40% | Daily engagement |
| Week-4 retention | >30% | Stickiness (industry avg: 15% for health apps) |
| Organic referral | >10% of users refer someone | Word-of-mouth potential |
| "I missed it" signal | Users ask "why no alert?" | Dependency = product-market fit |

### Alternative Markets for Hardware (Beyond NFL)

- **Cricket/IPL:** Indian teams have budgets, accessible for Indian startup, long sustained concentration required. BCCI more accessible than NFL.
- **College football:** Less regulation than NFL, more open to innovation.
- **NFL Combine/scouting:** Teams eager for any edge in draft evaluation.
- **Esports:** Pure cognitive performance, no physical safety concerns, shorter sales cycle.

---

## 8. PER-DOCUMENT INSIGHTS

### From VISION_AND_STRATEGY
- Three source docs had contradictions: 10-file vs 11-file Agent OS system, 10-15 day vs 12-week MVP timeline. Standardized to 11-file and 12-week.
- The "empty quadrant" positioning (high body awareness + high agent autonomy) is strong but needs constant validation -- the quadrant may not stay empty for long.

### From MVP_ENGINEERING_PRD
- The 7 critical changes from March 7 deep dive are the most important updates -- especially custom SQLite sync (saving $49+/mo) and on-phone CRS computation.
- Build order risks: Health Connect integration should be validated in week 1, not week 3-4. If HC doesn't work reliably, everything downstream fails.

### From WEARABLE_DATA_PIPELINE
- Samsung Sensor SDK distribution is the single biggest unknown. Apply for partnership in week 1.
- Garmin Connect IQ is the safety net -- fully open, raw IBI data, no approval needed.
- The data gap for budget wearables (no HRV) means the hero feature simply doesn't work for 60%+ of Indian Android users.

### From ALGORITHMS_AND_HEALTH
- CRS weight corrections from March 7 (time-of-day normalization, interpolation instead of deletion, weighted confidence scoring) are essential -- the original algorithm would have had systematic afternoon false alarms.
- The feedback loop is both the personalization mechanism AND the data moat. Every thumbs-up/down is labeled training data no competitor has.

### From AGENT_AND_BACKEND
- The 10 critical patterns from open-source agent analysis (doc 12) are the architectural blueprint. Most important: context assembly pipeline, triple-layer memory, hook system.
- Messaging channel priority: Telegram first (zero friction), push notifications second (zero setup), WhatsApp third (requires Meta verification).

### From COSTS_AND_ROADMAP
- The 12-week MVP timeline is ambitious but doable with the scope cuts recommended above.
- Model pricing is trending downward. DeepSeek R1 at $0.44/user/month makes mixed routing worth the complexity only above 500 users.
- Monetization should target INR 399/mo (Pro) -- positions between Oura (INR 599) and free health apps.

### From DESIGN_AND_UX
- Onboarding needs empty states and error states designed -- many users will see these first.
- Home screen widget could be the highest-engagement surface. Quick Phase 2 win.
- Design system (spacing, tokens, shadows) should be defined before building screens.

### From CRITIQUE_AND_RISKS
- The three P0 risks (retention, accuracy, background sync) should be the FIRST things validated. Not features -- risk validation.
- Cost contradictions between docs: $0.72/user/month vs $2.86/user/month depending on usage assumptions. Standardize the model.
- "10-15 day" MVP timeline in early docs was unrealistic. 12 weeks (with cuts) is honest.

### From HARDWARE_STRATEGY
- Two very different markets (consumer wellness vs NFL) -- strength (two revenue streams) and risk (split focus).
- Cricket/IPL is a more accessible alternative to NFL for an India-based startup.
- Provisional patent on sensor fusion algorithm + accelerometer-gated EEG is timely and worth the INR 15K investment.
- Missing: BOM estimates and battery life analysis for hardware. Ansh + Mayur should prepare these.

---

*This document is the strategic compass. Review it before every major decision. Update it as new insights emerge.*
