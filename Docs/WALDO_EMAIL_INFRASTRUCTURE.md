# Waldo — Email Infrastructure
**Version 1.0 · April 2026**

> The canonical reference for all email decisions, integrations, sequences, and the future Loops × Waldo agent integration. Read this before touching anything email-related.

---

## Platform Decision: Loops

**Chosen platform:** [Loops](https://loops.so) — single platform for transactional, automated sequences, and broadcast campaigns.

**Decision rationale:**
- One platform handles all three email types — no splitting transactional (Resend) from marketing (Mailchimp)
- Designer and non-technical team can send campaigns directly from the dashboard. Zero code required.
- Event-driven architecture matches Waldo's data model: fire an event from the app, Loops handles the rest
- Native Supabase integration — webhook sync or direct API
- Native Stripe integration — billing lifecycle emails with zero additional code
- Loops MCP server (via Composio) — Waldo AI agent can call Loops tools directly in Phase D+
- Free tier covers Phase 0 entirely (1,000 contacts, 4,000 sends/month)
- Scales with the product: $49/month for ~5k contacts, no per-seat pricing

**What was ruled out:**
- Resend — developer-only, no visual editor, team can't send without code
- Mailchimp / Brevo — SMB-focused, transactional is a paid add-on, wrong vibe for SaaS
- Building custom — unnecessary complexity when Loops handles everything

---

## Three Email Types

### 1. Transactional
One-to-one emails triggered by a specific user action via API. Instant, personalised.

**Current use:** Waitlist confirmation email
**Trigger:** Direct API call from `submit-email.ts` after successful Supabase insert
**Template:** Created in Loops dashboard, referenced by template ID in code

### 2. Loops (Event-Triggered Sequences)
Automated multi-step sequences triggered when an event fires. Built once in the Loop Builder, runs forever.

**Current use:** Phase 0 nurture sequence (triggered by `waitlist_signup` event)
**Future use:** Onboarding flow, re-engagement, milestone sequences

### 3. Campaigns (Broadcasts)
One-to-many sends to a segment. Sent from the Loops dashboard — no code.

**Current use:** Phase 1+ update emails, launch day email
**Who sends:** Anyone on the team — designer, founder, no developer needed

---

## Events Architecture

Events are the core abstraction. The app fires an event; Loops decides what to do with it.

```typescript
// Pattern: always send an event, never just a transactional email
// This gives us full flexibility to add/change sequences later in Loops UI

loops.sendEvent({
  email: "user@example.com",
  eventName: "waitlist_signup",
  eventProperties: {
    source: "heywaldo.in",
    phase: "phase_0",
  }
});
```

### Event Catalogue

**Phase 0 (live):**
| Event | Trigger | Current behaviour |
|---|---|---|
| `waitlist_signup` | User submits email on heywaldo.in | Confirmation email + Phase 0 nurture sequence |

**Phase 1 (planned):**
| Event | Trigger | Planned behaviour |
|---|---|---|
| `early_access_granted` | Founder grants early access | "You're in. Here's how to get started." |
| `wearable_connected` | User connects Apple Watch / Health Connect | Onboarding step 1 complete email |
| `first_morning_wag_sent` | First Morning Wag delivered | "That was your first one. Here's what just happened." |

**Phase 2 (Stripe connected):**
| Event | Trigger | Planned behaviour |
|---|---|---|
| `trial_started` | User starts Pro trial | Trial onboarding sequence |
| `trial_ending_soon` | 3 days before trial ends | Conversion nudge |
| `subscription_created` | User upgrades to Pro | Pro welcome + onboarding |
| `payment_failed` | Stripe payment fails | Dunning sequence (3 emails) |
| `subscription_cancelled` | User cancels | Win-back sequence |
| `milestone_good_week` | CRS > 70 all 7 days | Celebration email |

**Phase D+ (Waldo agent fires events):**
| Event | Trigger | Planned behaviour |
|---|---|---|
| `morning_wag_delivered` | Agent sends Morning Wag | Logged to Loops for engagement tracking |
| `fetch_alert_triggered` | Agent sends Fetch Alert | Logged + feeds personalization data |
| `stress_pattern_detected` | 3+ consecutive low-CRS days | "Waldo noticed something" insight email |
| `constellation_discovered` | New long-term pattern found | "Your first Constellation" email |
| `milestone_streak_7` | 7-day engagement streak | Encouragement email |

---

## Segments

All contacts tagged with properties on creation. Loops segments filter on these.

| Segment | Property | Who's in it |
|---|---|---|
| `waitlist` | `status: "waitlist"` | Everyone who signed up on heywaldo.in |
| `early_access` | `status: "early_access"` | First 50 hand-picked users |
| `onboarding` | `status: "onboarding"` | Connected wearable, completing setup |
| `active_pup` | `status: "active_pup"` | Free tier, active last 14 days |
| `pro` | `status: "pro"` | Paying Pro subscribers |
| `churned` | `status: "churned"` | Cancelled — in win-back sequence |

---

## Phase 0 Email Sequence (Built in Loop Builder)

Triggered by `waitlist_signup` event. Runs automatically for every future signup.

```
Day 0  │ Confirmation — "you're in."
       │ Subject: you're in.
       │ Body: Something's off out there. You noticed too — otherwise you
       │ wouldn't be here. Waldo's keeping your spot. When it's ready,
       │ you'll be the first to know. Already on it. — Waldo
       │
Day 3  │ Teaser — "something's coming."
       │ Subject: waldo's been watching.
       │ Body: [cryptic. one data observation. no product mention.]
       │
Day 14 │ Signal — "first people are in."
       │ Subject: first ones just got access.
       │ Body: [one Morning Wag screenshot. no explanation. just the card.]
       │
Day 28 │ Phase 1 bridge
       │ Subject: what waldo found in the first week.
       │ Body: [one genuine Spot or pattern from early access. anonymised.]
```

**Voice rules (apply to every email in this sequence):**
- Never more than 5 sentences
- No "we're thrilled", "excited to share", "journey"
- Always signed "— Waldo" or "Already on it."
- Lowercase subject lines
- No feature lists, no screenshots except Morning Wag card

---

## Stripe Integration (Phase 2)

Connect Stripe to Loops in Loops dashboard → Settings → Integrations → Stripe.

After connecting, Stripe billing events flow into Loops automatically with zero code:
- `customer.subscription.created` → `subscription_created` event
- `invoice.payment_failed` → `payment_failed` event
- `customer.subscription.deleted` → `subscription_cancelled` event

**Dunning sequence (payment failed):**
```
Day 0  │ "your card didn't go through" — direct, no shame
Day 3  │ "still having trouble?" — softer, offer help
Day 7  │ "waldo's going quiet" — final notice before downgrade
Day 8  │ Auto-downgrade to Pup tier (handled by Stripe webhook in app)
```

**Win-back sequence (cancelled):**
```
Day 1  │ Acknowledge the cancel, no guilt
Day 14 │ One Constellation insight they generated — what they'd be missing
Day 30 │ "things have changed" — if new features shipped
```

---

## The MCP Angle — Waldo Agent × Loops (Phase D+)

**This is the most important future capability and must not be forgotten.**

Composio has built an official Loops MCP server: `composio.dev/toolkits/loops_so`

This means Waldo's AI agent (Claude Haiku running inside a Cloudflare Durable Object in Phase D+) can call Loops tools **directly as part of an agent loop** — no intermediate API, no custom code needed per email type.

### What the agent can do via Loops MCP

```typescript
// Inside Waldo's agent loop (Phase D+):

// 1. Fire a personalised event based on biological data
await loops_mcp.sendEvent({
  email: user.email,
  eventName: "stress_pattern_detected",
  properties: {
    crs_average_3d: 38,
    primary_stressor: "back_to_back_meetings",
    recommended_action: "buffer_afternoons"
  }
});

// 2. Query contact status before sending
const contact = await loops_mcp.findContact({ email: user.email });
// → Check: has this user already received a stress pattern email this week?
// → If yes, suppress. Loop guard applies to emails too.

// 3. Update contact properties with biological insights
await loops_mcp.updateContact({
  email: user.email,
  properties: {
    crs_current: 67,
    chronotype: "moderate_morning",
    peak_window: "09:00-11:00",
    top_stressor: "meeting_density"
  }
});
// → These properties are now available for email personalisation in Loops
// → "Your peak window is {{peak_window}}" in email templates
```

### Why this matters

Without the MCP angle, Waldo fires an event → Loops sends a generic email. With the MCP angle, Waldo:
1. **Decides** whether to send the email (suppression logic in the agent, not just Loops)
2. **Enriches** the contact with real-time biological context before the email fires
3. **Personalises** based on the user's actual CRS, chronotype, stress patterns
4. **Tracks** what it sent as part of the agent's audit trail

This turns Loops from "email platform" into a **channel adapter** inside the Waldo agent — the same adapter pattern we use for Telegram, WhatsApp, and Slack. Email becomes just another delivery channel the agent routes through.

### Architectural fit

```
Waldo Agent (Phase D+)
  ├── ChannelAdapter → Telegram (grammY)
  ├── ChannelAdapter → WhatsApp
  ├── ChannelAdapter → Slack
  └── ChannelAdapter → Email (Loops MCP via Composio)  ← new channel
                              ↓
                    loops.sendEvent(personalised_data)
                              ↓
                    Loop Builder sequences in Loops dashboard
                              ↓
                    Email delivered with biological context
```

**Implementation note for Phase D:** When building the `ChannelAdapter` interface for email, implement it as a Loops MCP adapter. This means email joins the same adapter pattern as all other channels. Swapping email providers later (if needed) means only changing the adapter implementation.

### Contact Properties as Biological Context Layer

Every Waldo user's Loops contact record becomes a rich biological profile used for personalisation:

```
Contact properties (updated by agent):
  crs_today: 67
  crs_7d_avg: 71
  chronotype: "moderate_morning"
  peak_cognitive_window: "09:00-11:00"
  top_stressor: "meeting_density"
  sleep_debt_hours: 1.2
  waldo_tier: "pro"
  days_active: 47
  last_morning_wag: "2026-04-11"
  constellation_count: 3
  best_day_of_week: "wednesday"
```

Email templates can use any of these: "Your Wednesdays are 15% sharper than your Mondays. Here's why that matters."

---

## Implementation Checklist

### Phase 0 (now — waldo-landing)
- [ ] Sign up for Loops (free tier)
- [ ] Create `Waitlist Confirmation` transactional email template in Loops dashboard
- [ ] Create `waitlist_signup` event + connect to Phase 0 nurture Loop
- [ ] Add Loops JS SDK to waldo-landing: `npm install @loops-so/node`
- [ ] Update `actions/submit-email.ts` — fire `waitlist_signup` event after Supabase insert
- [ ] Add `LOOPS_API_KEY` to `.env.local` + Vercel env vars
- [ ] Import existing Supabase waitlist → CSV → Loops bulk import
- [ ] Verify confirmation email sends on test signup

### Phase 1
- [ ] Create `early_access_granted` event + email template
- [ ] Build first Campaign in Loops dashboard (Phase 1 signal email)
- [ ] Verify designer can send a campaign without developer involvement

### Phase 2 (Stripe)
- [ ] Connect Stripe to Loops in dashboard
- [ ] Build dunning sequence (3-email, payment failed)
- [ ] Build win-back sequence (3-email, cancelled)
- [ ] Build Pro onboarding sequence

### Phase D+ (Agent MCP)
- [ ] Evaluate Composio Loops MCP server for stability
- [ ] Implement `EmailChannelAdapter` using Loops MCP
- [ ] Add contact enrichment step to agent loop (update biological properties)
- [ ] Add email suppression logic to Loop Guard (prevent email spam like message cooldown)
- [ ] Build `stress_pattern_detected` → email sequence
- [ ] Build `constellation_discovered` → email sequence

---

## Files Reference

| File | What's there |
|---|---|
| `waldo-landing/actions/submit-email.ts` | Where the Loops API call lives (Phase 0) |
| `waldo-landing/.env.local` | `LOOPS_API_KEY` goes here |
| `Docs/WALDO_ROLLOUT_STRATEGY.md` | Phase-by-phase email content plan |
| `Docs/WALDO_ADAPTER_ECOSYSTEM.md` | Channel adapter pattern (email fits here in Phase D+) |
| `Docs/WALDO_AGENT_INTELLIGENCE.md` | Agent loop design — email delivery hooks go here |

---

*Waldo Email Infrastructure · Version 1.0 · April 2026*
*For rollout content and sequences: `Docs/WALDO_ROLLOUT_STRATEGY.md`*
*For agent channel architecture: `Docs/WALDO_ADAPTER_ECOSYSTEM.md`*
*Already on it.*
