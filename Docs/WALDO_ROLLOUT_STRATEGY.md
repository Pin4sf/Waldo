# Waldo — Rollout & Distribution Strategy
**Version 2.0 · April 2026**
**Confidential**

---

## Implementation Status Tracker

> Last updated: April 11, 2026
> Track this section as each item ships. Mark ✅ done, 🔄 in progress, ⬜ not started.

### Phase 0 — The Quiet (Weeks 1–6)

| Item | Status | Notes |
|---|---|---|
| heywaldo.in live — single page, waitlist, no product detail | ✅ | Deployed to Vercel, custom domain pending DNS |
| Waldo illustration (dalmatian) on page | ✅ | Three state SVGs: default, error, success |
| Brand tagline "Already on it." visible | ✅ | Success state headline + browser tab title |
| Acquisition tagline in metadata | ✅ | "Waldo knows how you're really doing." in meta description |
| Email waitlist collection | ✅ | Supabase `waitlist` table with RLS |
| 3-layer email validation (format + disposable + DNS MX) | ✅ | Blocks fake/throwaway emails |
| Duplicate handling (silent success on re-submit) | ✅ | Supabase unique constraint → 23505 → success |
| Navbar: all links disabled with Waldo-voice tooltips | ✅ | Page dims to 40% on nav hover |
| Waitlist confirmation email in Waldo's voice | 🔄 | Loops — integration in progress (see §Email Infrastructure) |
| "Where's Waldo?" social teasers on X/Instagram | ⬜ | 3 posts/week, cryptic, no product shown |
| Founder posts — 5–7/week, no product mentions (wks 1–2) | ⬜ | Social content, not code |
| 50 hand-picked early access invites sent | ⬜ | |

### Phase 1 — The Signal (Weeks 7–14)

| Item | Status | Notes |
|---|---|---|
| First Morning Wag screenshot posted publicly | ⬜ | |
| Early access expands to 500 (invite-only) | ⬜ | Requires invite system |
| 3–4 journalist background briefings | ⬜ | |
| First "Spots" blog post live | ⬜ | |
| 5–8 UGC creator pieces live | ⬜ | Tier 1–3 only (no full cash rate yet) |
| Waitlist hits 5,000 | ⬜ | |
| Press briefings completed | ⬜ | |

### Phase 2 — The Pattern (Weeks 15–24)

| Item | Status | Notes |
|---|---|---|
| Pup tier opens to waitlist first | ⬜ | |
| Pup tier opens publicly | ⬜ | |
| Pro upgrade path visible | ⬜ | |
| Connector showcase live on homepage | ⬜ | Full grid, 200+ tools, organized by life domain |
| First connector launch as marketing event | ⬜ | Wave 2: Google Calendar + Gmail + Tasks |
| Exclusive press piece (data story angle) | ⬜ | Not a product announcement — a data story |
| Constellation visual goes public | ⬜ | Anonymised aggregate pattern data |
| Referral mechanic: "Give someone a good Tuesday" | ⬜ | |
| Waitlist hits 10,000 | ⬜ | |

### Phase 3 — The Launch (Week 25)

| Item | Status | Notes |
|---|---|---|
| Pro tier live | ⬜ | |
| App Store listing live | ⬜ | |
| Launch email to full waitlist (6:00am) | ⬜ | Copy locked in §05 below |
| Coordinated press drop (3–5 pubs, same 4hr window) | ⬜ | |
| Founder posts own Daily Brief screenshot (8:00am) | ⬜ | |
| heywaldo.in switches from waitlist to open CTA | ⬜ | |
| Full connector grid live on homepage | ⬜ | "213 tools. 27 categories. One intelligence engine. One body." |
| Product Hunt listing live (10:00am) | ⬜ | Not primary channel |
| UGC creator pieces staggered across timezones | ⬜ | |

### Phase 4 — The Constellation (Months 7–12)

| Item | Status | Notes |
|---|---|---|
| The Waldo Report (quarterly data publication) | ⬜ | "The biological clock of the knowledge worker" |
| Pack tier (family/team plans) | ⬜ | |
| Second press wave (outcomes, not features) | ⬜ | |
| "A Good Week" UGC format | ⬜ | |
| Integration partnerships (Oura, WHOOP, Garmin) | ⬜ | |
| Profession-specific connector waves continue | ⬜ | |

---

## Email Infrastructure — Loops

**Platform:** [Loops](https://loops.so) — single platform for all email: transactional, sequences, and broadcasts.

**Why Loops over Resend / Mailchimp / Brevo:**
- Handles transactional (confirmation) + marketing (campaigns) + automation (sequences) in one place
- Designer and non-technical team members can send campaigns directly — no code required
- Native Supabase integration (webhook sync or direct API)
- Event-driven: fire `waitlist_signup` → Loop sequence runs automatically forever
- Native Stripe integration for Phase 2 lifecycle emails (upgrade, payment failed, churn)
- Future: Loops MCP via Composio → Waldo agent can send emails as part of agent loops
- Free tier: 1,000 contacts, 4,000 sends/month (covers Phase 0 entirely)

**Three email types in use:**

| Type | How triggered | Who manages |
|---|---|---|
| Transactional | API call from `submit-email.ts` after Supabase insert | Developer (set up once) |
| Loop (sequence) | `waitlist_signup` event → Loop Builder | Developer sets up, runs automatically |
| Campaign (broadcast) | Loops dashboard → send to segment | Anyone on the team |

**Phase 0 sequence (built once in Loop Builder, runs for every signup):**
- Day 0: Confirmation — "you're in." (Waldo voice, warm, brief)
- Day 3: Teaser — "something's coming. waldo's already watching."
- Week 2: Signal — "first people just got access. here's what happened."

**Segments used:**
- `waitlist` — everyone who signed up on heywaldo.in
- `early_access` — first 50 hand-picked users (Phase 0)
- `pro` — paying users (Phase 3+)

**Supabase export:** All existing waitlist emails → CSV export → bulk import to Loops once account is set up.

---

## Read This First

This is not a marketing plan. It is the operating document for how Waldo enters the world.

The product works. The architecture is built. The question is no longer whether Waldo does what it says — it is how to make people understand what Waldo is before they try it, so that when they do try it, the first Morning Wag lands as confirmation, not confusion.

The core challenge: Waldo sits at an intersection that has no existing language. People hear "AI agent" and think calendar bot. People hear "health data" and think WHOOP dashboard. Neither frame captures what is actually happening. This document builds the language, the channels, the sequencing, and the creative formats that make Waldo legible to anyone — a student, a CEO, a construction worker, a parent, a grandmother, an investor.

One principle runs through everything: **show the moment, not the product.** When Waldo moves a meeting because your nervous system is depleted, that is the content. When Waldo tells you something true about your body you hadn't noticed, that is the ad. When a user says "Waldo did a thing" because something happened they didn't expect — that is the entire brand compressed into a single social action.

Protect that moment. Everything else follows.

---

## 01 · The Premise

Every AI agent in existence operates on the same assumption: that you are a constant. Lindy reads your calendar. ChatGPT reads your documents. Notion AI reads your tasks. They all treat you as a fixed resource — the same person at 7am and 3pm, the same person after four hours of sleep and after eight, the same person before a board call and after one.

You are not a constant. You are the most volatile variable in your own day.

Waldo is the first AI that treats you as a variable. It reads the biological signal your wearable generates — HRV, sleep architecture, circadian position, autonomic state — and uses that as the operating context for everything it does on your behalf. Not as a dashboard. Not as a score you check. As the intelligence layer beneath a full personal AI agent that drafts your emails, manages your calendar, sequences your tasks, pulls your documents, and handles your day.

**Waldo is your personal AI — except it also knows how you slept last night.**

That single sentence is the product. Everything in this document exists to make it understood.

> *The data your watch collected last night already knows what your day needs. Waldo just acts on it.*

---

## 02 · The Explanation Architecture

Before distribution channels, before content calendars, before UGC strategy — we need a shared language for what Waldo is. This section defines the four layers of explanation, from a three-second hook to a fifteen-minute investor conversation. Every piece of content, every creator brief, every website section maps to one of these layers.

### Layer 1 — The Hook
*3 seconds. Anyone, anywhere. The gym, a party, the first line of the website.*

> "Waldo is your personal AI — except it also knows how you slept last night."

This sentence does two things simultaneously. It tells you Waldo is a personal AI (it does things for you). And it tells you Waldo has something no other personal AI has (your biology). The word "except" does all the work — it signals that the body-reading is the differentiator, not the category.

**Variants for different contexts:**
- For the website hero: "Your AI knows what you need to do. Waldo knows if you can actually do it."
- For emotional resonance: "Waldo knows how you're really doing."
- For casual conversation: "It's like ChatGPT, but it also reads your Apple Watch. So it knows when you're too tired for that 4pm call."
- For tech-literate audiences: "It's an LLM with ten MCPs — one of them is your body."

**Audience-specific hooks:**

| Audience | Hook |
|---|---|
| Student | "You know how some mornings you can study for 4 hours and others you can't focus for 10 minutes? Waldo knows which morning it is before you do." |
| Founder | "Every agent knows your calendar. None know when you're cognitively depleted. Waldo makes sure you never sign a term sheet on a bad brain day." |
| Parent | "Waldo tells you when you're running on empty so you don't take it out on your kids." |
| Athlete | "Your coach sees your training data. Waldo sees your nervous system recovery. One shows what you did. The other shows what you can do." |
| CEO | "Your EA manages your time. Waldo manages your cognitive capacity. Time is fixed. Energy isn't." |
| Doctor/nurse | "After a 16-hour shift, decision quality drops 50%. Waldo catches that before you do." |
| Construction worker | "It tells you when to rest so you don't get hurt. No boss does that. Waldo does." |
| Grandmother | "It lets your family know you're okay without you having to call them every day." |
| Investor | "The biological intelligence layer for the agentic economy. Every AI agent needs to know the user's body. Waldo is that layer." |
| Developer | "An MCP server that exposes getCRS(), getStressLevel(), getCognitiveWindow() to any AI agent. Your body as an API." |

---

### Layer 2 — The Five Things
*30 seconds to 2 minutes. When someone says "wait, what does it actually do?"*

These map to Waldo's five named features, explained as actions first. The product names come after — once the person already understands what each one is.

**1. It briefs you every morning.** Not a notification. A biological briefing. What your body says about today, what your calendar looks like relative to your capacity, and what Waldo has already moved. You read it like a text from someone who stayed up all night studying your data and distilled it into four sentences. *This is The Morning Wag.*

**2. It watches you all day.** Continuous background analysis of your heart rate variability, stress patterns, and energy curve. When something crosses a threshold, Waldo doesn't send an alert — it intervenes. "Your HR spiked 18 beats over 12 minutes. Take two minutes. I've already pushed your next call by 15." *This is The Patrol. When it acts, that's a Fetch Alert.*

**3. It rearranges things on your behalf.** Your sleep was short? Your 9am is now a 10:30. Your cognitive readiness is peaking between 11 and 1? Your hardest task just got moved there. Your afternoon is stacked and your body says you're running low? Waldo has inserted a buffer and deferred the least urgent meeting. *This is The Adjustment.*

**4. It notices things you'd never notice.** Individual observations from your biology and behaviour. "Your resting HR has been trending up for five days." "Your stress events cluster on days with more than three back-to-back meetings." Each one is A Spot — a single observation, like a dalmatian's spot. On its own, interesting. Together, they start forming something bigger.

**5. It learns your patterns over months.** After 30 days, the Spots start connecting. Waldo discovers that your Wednesdays are consistently 15% sharper than Mondays. That your cognitive crashes correlate with after-hours email. That your best work happens the morning after your sleep debt drops below one hour. These are personal discoveries mapped across months of your data. *This is The Constellation — your personal pattern map.*

---

### Layer 3 — The Compound Effect
*2–5 minutes. For investors, deep conversations, the "where is this going" question.*

Waldo's architecture is 10 plug-and-play data adapters feeding one intelligence engine — but the full connector ecosystem spans 200+ tools across 27 categories. Your watch gives Waldo your body. Your calendar gives it your schedule. Your email gives it your communication pressure. Your task manager gives it your workload. Your music gives it your mood. Your CRM gives it your pipeline. Your design tools give it your creative workflow.

Each adapter adds a dimension of intelligence. With all sources connected, Waldo is computing hundreds of cross-source correlations — the most complete model of how you actually function that has ever existed outside of a clinical study.

And it doesn't stop at monitoring. You say "draft a mail to Rohan about the Q1 review" and it's done. "Pull the deck from last week's strategy meeting" and it's done. "What's on my plate today" and it tells you — not just what's scheduled, but which meetings you're in good shape for and which ones it's already considering moving. Waldo is your LLM. It collaborates with LLMs and acts as your personal AI — one that happens to know your body before it knows your task list.

**The connector grid is the comprehension device.** When a prospect sees the homepage and recognizes their own tools — Apple Watch, Google Calendar, Figma, Clay, Spotify, Slack, Linear — they don't need the product explained. They see their life mapped. Their brain fills in the possibilities. The logos do the explaining for us.

---

### Layer 4 — The Platform Vision
*For the "how big is this" question. Investors, enterprise conversations, press.*

The same engine works for an NFL team monitoring player cognitive readiness before kickoff. For a clinical wearable company detecting early disease markers. For a remote workforce where a manager needs to see collective burnout forming before it arrives. For a logistics fleet managing driver fatigue.

The endgame is Waldo as a body API — a protocol layer that any AI agent queries before making decisions on behalf of a human. Before Cursor writes your code, it checks: are you in a deep work window? Before your calendar agent accepts a meeting, it asks: can this person sustain a 4pm strategy session? Waldo becomes the biological substrate of the entire agentic economy.

```
Every other AI:                    Waldo:

  Calendar ─┐                        Body ────────┐
  Email ─────┤── AI ── "Do this"      Calendar ───┤
  Tasks ─────┤                        Email ───────┤── AI ── "Do this NOW,
  Slack ─────┘                        Tasks ───────┤         this way,
                                      Music ───────┤         because your body
                                      Screen ──────┘         can handle it"
```

Every other AI knows WHAT you need to do.
Waldo knows WHETHER you can do it.

---

## 03 · The Three Emotional Jobs

Research (JTBD analysis, SDT framework, competitive landscape review across 50+ sources) reveals that the emotional and social jobs are more powerful than the functional one. The rollout must speak to all three.

| Job type | What the user wants | How Waldo delivers |
|---|---|---|
| **Functional** | "Help me make better decisions without analyzing data" | The Nap Score, the Morning Wag, The Adjustment |
| **Emotional** | "Make me feel like someone has my back" | The Patrol, Waldo Moods, "Already on it" |
| **Social** | "Give me a credible reason to set boundaries" | "Waldo says I need to take it easy today" — biological data has social legitimacy that subjective feelings don't |

**The social job is Waldo's hidden superpower.** People can't say "I'm too tired for this meeting" at work. But they CAN say "My readiness score says I should reschedule." Waldo gives biological data the social legitimacy that subjective feelings don't have.

This is bigger than we've been talking about. The "permission slip" — using Waldo's score as a socially acceptable excuse to set boundaries — is potentially the most viral mechanic in the product. The rollout must create the conditions for this to happen naturally.

---

## 04 · Distribution Philosophy

Seven principles. Every channel decision, every content format, every creator partnership is evaluated against these.

**Principle 1: Show the moment, not the product.** The most powerful piece of Waldo content is not a product tour. It is a screenshot of a Morning Wag that made someone's jaw drop. The moment Waldo does something the user didn't expect — that is the content.

**Principle 2: The product earns the marketing.** Every phase is sequenced so the brand only says what the product has already proven. We do not announce capabilities before they ship.

**Principle 3: Restraint scales.** A single Morning Wag screenshot works on a founder's personal feed and on the brand account. The discipline is built into the assets.

**Principle 4: Genuine word of mouth is worth ten campaigns.** The "Waldo did a thing" moment is the entire brand compressed into a single user action. Every distribution decision is evaluated: does this make that moment more or less likely to happen naturally?

**Principle 5: UGC is a tool, not a strategy.** Paying creators to say "this app changed my life" is how products that don't work get initial traction. Products that work create the conditions for genuine content. UGC at Waldo's stage is surgical: the right creators, the right format, the right moment.

**Principle 6: The connector grid is the explanation.** Don't explain what Waldo does with Figma. Show the Figma logo on the homepage. The user connects the dots. 200+ connector logos do more explaining than 2,000 words of copy.

**Principle 7: The social permission job is the viral mechanic.** Create the conditions for people to use their Nap Score as a socially acceptable reason to set boundaries. "Waldo says I should reschedule" is the sentence that spreads the product without any marketing spend.

---

## 05 · The Four Phases

### Phase 0 — The Quiet
*Weeks 1–6 · Say almost nothing. Make it mean something.*

The brand exists before the product is public. heywaldo.in goes live with one screen, one line, one waitlist. The dalmatian. "Already on it." An email field. No feature explanation. No screenshots. The restraint is the statement.

**What happens:**
- heywaldo.in launches — single page, Waldo illustration, tagline, waitlist. Zero product detail.
- "Where's Waldo?" teaser campaign begins on X and Instagram. Three campaign lines per week. No product shown. No explanation given.
- Founder begins posting daily observations about health data, wearables, and the gap nobody talks about. No product mentions for the first two weeks. Format: short, data-literate, observational. Not thought leadership. Pattern recognition shared publicly.
- 50 hand-picked early access invites go out. Not announced. Recipients chosen for: network effect potential, genuine wearable usage, likelihood of authentic reaction.
- Product screenshots shown publicly: zero.

**Content formats:**
- Founder thought leadership on X and LinkedIn — 5–7 posts per week
- "Where's Waldo?" visual teasers — cryptic, brand-only, unexplained
- Waitlist confirmation email in full Waldo voice — warm, brief, confident

**Targets:**

| Metric | Target |
|---|---|
| Waitlist signups | 1,000 |
| Early access seats | 50 |
| Product screenshots shown | 0 |
| Founder posts per week | 5–7 |

**The rule for this phase:** If it feels like you're giving too little away, you're probably doing it right.

---

### Phase 1 — The Signal
*Weeks 7–14 · Let the first users talk. Show, don't explain.*

The 50 early access users have had 2–4 weeks with the product. Some of them will say something. The brand's job is to not over-amplify it. The product starts being shown, but only in the Morning Wag format: one screenshot, one Waldo briefing, no UI tour.

**What happens:**
- First organic "Waldo did a thing" posts from early users. Encouraged, not scripted. Retweeted without commentary from the Waldo account.
- First Morning Wag screenshot goes live on social — just the card, just the copy, no annotation.
- Early access expands to 500 — still invite-only, no public announcement.
- Background briefings with 3–4 journalists covering health tech, productivity, and AI. Not a press release. A conversation. The angle: the wearable data problem nobody talks about.
- First "Spots" blog post goes live — not a product post. A genuine data observation about what wearable data reveals.
- First UGC creator partnerships activated.
- First "permission slip" moments surface — users posting that they rescheduled something because Waldo told them to rest. Do not amplify these with branded commentary. Just retweet. The authenticity is the value.

**The UGC play — Phase 1 specific:**

The goal is not "awareness." The goal is to create 3–5 pieces of content so specific and genuine that they get shared organically by people who have never heard of Waldo.

Format: The "morning disrupted" video. A creator shows their actual morning — waking up, checking phone, seeing the chaos of notifications. Then one message from Waldo. The contrast is the content. Not a review. Not an explainer. A moment.

Creator selection: Not follower count. Credibility. Micro-creators (10k–50k) in productivity, health tech, and founder spaces. Their recommendation carries personal endorsement weight, not sponsorship weight.

**Targets:**

| Metric | Target |
|---|---|
| Early access users | 500 |
| Waitlist | 5,000 |
| Press briefings | 3–4 |
| UGC pieces live | 5–8 |

---

### Phase 2 — The Pattern
*Weeks 15–24 · Build the evidence before the argument.*

Three months of real user data. Real patterns. Real Constellations forming. This phase makes the evidence visible — not as marketing, but as proof. The Pup tier opens publicly. The aggregate data from The Patrol becomes editorial content nobody else can create.

**This is the phase where connectors become the marketing.**

**What happens:**
- Pup tier (free) opens to waitlist first, then publicly. Upgrade path to Pro visible from day one.
- First feature press — the angle is the data story, not the product. "What 500 wearable users' sleep data actually reveals about modern work." Pitched as an exclusive to one publication.
- The Constellation visual goes public — anonymised, aggregated pattern data from early access. A visual statement of what Waldo has learned.
- **Connector launches become marketing events.** Each new MCP integration gets its own announcement moment — not as a feature update, but as a profession-specific entry point:
  - Google Calendar + Gmail + Tasks → "Waldo now speaks your workday"
  - Clay + HubSpot → "Waldo now speaks sales" — the sales profession wave
  - Figma → "Waldo now speaks design" — the designer wave
  - Linear + GitHub → "Waldo now speaks engineering" — the developer wave
- **The connector showcase goes live on the homepage.** A grid of every tool Waldo connects to, organised by life domain.
- First referral mechanic: Pup users get one Pro trial week to give to someone. Framing: "Give someone a good Tuesday."
- UGC scales to profession-specific content.
- The "permission slip" format emerges as a distinct content type.

**The connector launch playbook:**

Each connector launch follows the same pattern:
1. **Teaser (1 week before):** Ghost tile on the homepage — greyed-out logo with "Coming soon." Creator partners get early access.
2. **Launch day:** Logo goes live on homepage. One social post: "[Tool] + Waldo. Your [profession] just got a body." Creator content drops the same day.
3. **Proof content (week after):** Creator or early user shows the integration in action. Not a walkthrough. A moment.

**Targets:**

| Metric | Target |
|---|---|
| Pup tier | Open to public |
| Waitlist | 10,000+ |
| Exclusive press pieces | 1–2 |
| Connector integrations live | 5+ |
| Connector launches as marketing events | 3+ |

---

### Phase 3 — The Launch
*Week 25 · One day. One idea. Already done.*

Launch day is not a feature announcement. It is the public statement of something that has already been running for six months. Pro goes live. The App Store listing goes live. The press that was briefed in Phase 1 publishes simultaneously. The campaign line is the only campaign line: **Already on it.**

**The launch email — locked copy:**

**Subject:** It's ready.

Morning.

Six months ago you signed up to find out what Waldo was.

Here's what it is: an agent that reads your wearable data every night and quietly sorts your day before you open your eyes. It's been running for 500 people since October. It's moved about 3,000 meetings. It's found patterns nobody asked it to find.

Today it's yours.

Free to start. Works with the watch you already own. Takes less than a minute.

[Get started →]

Waldo has been waiting.

*Already on it.*

---

**Launch day sequence:**
1. **6:00am** — Launch email hits the full waitlist. They get access first.
2. **7:00am** — Coordinated press drop. 3–5 publications, all briefed in advance, all publishing within the same four-hour window.
3. **8:00am** — Founder posts one thing: their own Daily Brief screenshot. Their actual score. Their actual Adjustment. No commentary.
4. **9:00am** — heywaldo.in hero switches from waitlist to open CTA. The full connector grid is live.
5. **10:00am** — Product Hunt listing goes live. Not the primary channel — the primary channel is the 10,000 people who've been waiting.
6. **All day** — UGC creators post their pieces. Coordinated but not simultaneous. Staggered across timezones.

**The tone of launch:**

Not: "Introducing Waldo — the AI agent that manages your health."
Yes: "It's been running for six months. Now it's yours."

---

## 06 · Post-Launch — The Constellation
*Months 7–12*

**What happens:**
- **The Waldo Report** — quarterly public data story. Anonymised aggregate findings from The Patrol across thousands of users. Not a marketing asset. A genuine data publication. First edition angle: "The biological clock of the knowledge worker: what 10,000 days of wearable data reveal about when we actually work, when we think we work, and the gap between the two."
- **Pack tier launches** — family and team plans.
- **Second press wave** — the angle is outcomes, not features. "Here's what happened to people who used Waldo for six months."
- **"A Good Week"** — user-generated content format. Users post their Good Week Daily Brief.
- **Integration partnerships** — co-marketed moments with wearable companies (Oura, WHOOP, Garmin) and workspace tools (Linear, Notion, Figma).
- **Profession-specific connector waves continue.**

---

## 07 · UGC Strategy

UGC is expensive. Creators know their value. The response is not to avoid UGC — it is to be surgical. Every creator partnership should produce content that works harder than a paid ad because it doesn't look or feel like one.

### The Negotiation Framework

Waldo has leverage that most pre-launch products don't: the product creates content by itself. A Morning Wag screenshot is inherently shareable. A Fetch Alert that moved a meeting is inherently surprising. A Nap Score used as a "permission slip" is inherently relatable. The creator's job is not to manufacture a reaction — it is to document a genuine one.

### Four Compensation Tiers

**Tier 1: Equity in the narrative**
For 3–5 creators with genuine audience trust in productivity or health-tech. Early access + direct founder line + "founding creator" designation. 30–50% of standard rate + product credit.

**Tier 2: Revenue share on conversions**
Unique referral link, 20% rev-share for 12 months. At ₹399/month Pro → ₹80/month per conversion. 200 Pro users = ₹16,000/month passive.

**Tier 3: Product integration**
Profession-specific creators get their MCP integration first. Sales creator using Clay → first to show Waldo + CRM. Content writes itself because they're genuinely first.

**Tier 4: Standard paid — controlled**
Full cash rate. Launch day and major connector drops only. Brief is extremely tight: one format, one moment. Never a product tour.

### The Seven UGC Formats

| Format | Description | Platform |
|---|---|---|
| "The morning disrupted" | Wake up, chaos, then one Waldo card that handled everything | Reels, Shorts, TikTok |
| "Waldo did a thing" | Screenshot of unexpected Waldo action, no explanation | X, LinkedIn, Stories |
| "The permission slip" | Using Nap Score as socially legitimate boundary | TikTok, Reels, X, LinkedIn |
| "The Constellation reveal" | 30+ days in, patterns Waldo discovered | YouTube, LinkedIn, X threads |
| "The profession-specific demo" | Waldo + specific connector (Clay, Figma, Linear) | YouTube, LinkedIn, TikTok |
| "The data story" | 60–90 day personal data discoveries | YouTube, blog, LinkedIn |
| "The day in the life" | Full-day documentation of 60+ micro-automations | YouTube, TikTok |

### Creator Selection Matrix

| Criteria | Weight | Ideal |
|---|---|---|
| Audience trust | 40% | High engagement, genuine comments |
| Category fit | 30% | Productivity, health tech, founder life |
| Content quality | 20% | Cinematic, distinctive style |
| Follower count | 10% | 10k–50k (micro) preferred |

---

## 08 · Channel Strategy

### Primary Channels

**X / Twitter** — Build category awareness and founder credibility.
**LinkedIn** — Reach ICP directly (founders, PMs, CTOs). 1–2 considered posts/week.
**Instagram** — Visual brand building and UGC distribution.
**YouTube** — Long-form proof and creator partnerships (Phase 1+).
**TikTok** — Viral potential via creator partnerships only.

### Secondary Channels

**Product Hunt** — Launch day signal to tech community.
**Hacker News / Reddit** — Data story angle, not product announcement.
**Email / Newsletter** — The waitlist is a relationship. Every email is in Waldo's voice.
**Podcasts** — Founder appears as guest with the thesis, not the product. 3–5 appearances Phase 1–3.

---

## 09 · The Connector-First Profession Rollout

| Wave | Connectors | Content angle |
|---|---|---|
| Wave 1 — Founders/engineers (launch) | Apple Watch, Google Calendar, Gmail, GitHub, Vercel | "The AI agent that knows when you're too depleted for your investor call." |
| Wave 2 — Sales (Phase 2) | Clay, HubSpot, Apollo, Attio | "Waldo moved your biggest prospect call to 11am because your readiness score was 82. You closed it." |
| Wave 3 — Designers (Phase 2–3) | Figma, Adobe Creative Cloud | "Waldo sequences your design reviews to your peak creative window." |
| Wave 4 — Product managers (Phase 3) | Linear, Notion, Jira, Asana, ClickUp | "Waldo knows the difference between a roadmap review day and a bug triage day." |
| Wave 5 — Students (Phase 3) | Anki, Google Calendar, Spotify | "It told me to stop studying and sleep at 11pm. Got my best exam score." |
| Wave 6 — Healthcare workers (Phase 3–4) | Watch + Calendar | "After a 16-hour shift, Waldo told me my readiness was at 29. Don't make clinical decisions you can defer." |
| Wave 7 — Enterprise (Phase 4+) | Full ecosystem + custom | NFL, clinical wearables, remote workforce, logistics fleet |

---

## 10 · The Homepage — Connector Grid as Comprehension Device

The homepage must be redesigned around the insight that the connector ecosystem does the explaining for us.

**Structure:**
1. Hero: notification stack resolved by one Waldo card
2. "Waldo connects to everything in your life" — full connector grid by life domain
3. The five things (Layer 2 visualised)
4. The Nap Score (animated 4-zone gauge)
5. Social proof / data story
6. Pricing (Pup / Pro / Pack)
7. Vision ("Today: your Apple Watch. Tomorrow: every sensor in any industry.")
8. Closing CTA: "Waldo knows how you're really doing. Get your first Morning Wag."

**Connector grid by domain (total: "213 tools. 27 categories. One intelligence engine."):**

| Domain | Example tools |
|---|---|
| Your body | Apple Watch, Oura, WHOOP, Fitbit, Garmin, Samsung |
| Your schedule | Google Calendar, Outlook, Cal.com |
| Your communication | Gmail, Slack, Teams, Telegram, WhatsApp |
| Your work | Linear, Notion, Jira, Todoist, Asana, GitHub |
| Your creativity | Figma, Adobe |
| Your pipeline | Clay, HubSpot, Attio |
| Your music | Spotify, Apple Music |
| Your home | Home Assistant, Philips Hue |
| Your money | Plaid, YNAB |
| Your movement | Strava, Peloton |

---

## 11 · The Waldo Report

Quarterly public data report. Anonymised, aggregated findings from The Patrol.

**First edition angle:** "The biological clock of the knowledge worker: what 10,000 days of wearable data reveal about when we actually work, when we think we work, and the gap between the two."

Simultaneously: editorial content for press, investor proof of data moat, product marketing asset, enterprise recruitment tool.

---

## 12 · Budget Framework

| Category | Phase 0–1 | Phase 2 | Phase 3 | Notes |
|---|---|---|---|---|
| UGC creators | Low | Medium | High | Tier 1–3 early, Tier 4 at launch only |
| Founder content | Time only | Time only | Time only | Zero cash cost. Most valuable asset. |
| Press | Zero | Zero | Zero | Earned only. Never paid. |
| Paid social | Zero | Low | Medium | Boost top-performing organic only |
| Podcast | Zero | Time only | Time only | Guest appearances, not sponsorship |

---

## 13 · The Aha Moment — Protecting the Activation Window

**Waldo's aha moment:** The first Morning Wag that tells you something true about your body that you hadn't consciously noticed.

**Design imperative:** Get users to this moment within 24 hours of connecting a wearable. Apple Health upload → overnight data → Morning Wag at 7am the next day.

### The Three-Layer Onramp

| Layer | Timing | Hook | Effect |
|---|---|---|---|
| **Layer 1** (free) | Day 1 | "Waldo reads your watch and tells you how sharp you are today." | The aha moment |
| **Layer 2** | Week 2 | "Waldo connects to your calendar and times your hardest work to your best brain." | The upgrade trigger |
| **Layer 3** | Month 3 | "Waldo has learned your patterns and acts before you ask. Already on it." | The lock-in |

**Layer 1 is free. Layer 2 makes you pay. Layer 3 makes you stay forever.**

---

## 14 · What is Never Done

- Paying for coverage before launch
- Announcing features before they ship
- Manufactured urgency ("Only 48 hours left!")
- Comparison ads naming competitors
- Influencer partnerships where the copy is not in Waldo's voice
- Announcing metrics that are not genuinely impressive
- A launch that apologises for what the product isn't yet
- Scripted creator testimonials
- Feature-list posts on social media
- Any content that says "AI-powered" or "wellness"
- Paid ads before organic content has proven what resonates
- UGC that requires the creator to explain how the product works
- Explaining what Waldo does with a connector instead of showing the logo and letting the user connect the dots
- Using the word "optimize" in any context
- Any content that positions Waldo as a health tracker, wellness app, or productivity tool

---

## 15 · The One Thing to Protect

> **The "Waldo did a thing" moment.**

When a user posts those four words because Waldo did something they didn't expect — that is the entire brand compressed into a single user action. It is worth more than any campaign. It is the product promise made social.

Every rollout decision is evaluated against this question: **does this make "Waldo did a thing" more or less likely to happen naturally?**

If it makes it more likely — do it.
If it requires incentivising, scripting, or manufacturing — don't.

---

## Appendix: The Two Taglines

**Brand tagline** *(identity, browser tab, loading states, everywhere Waldo is working):*
> Already on it.

**Acquisition tagline** *(homepage, ads, first-contact moments, meta description):*
> Waldo knows how you're really doing.

Both are true. "Already on it." is what Waldo does. "Waldo knows how you're really doing." is what the user feels.

---

*Waldo Rollout & Distribution Strategy · Version 2.0 · April 2026*

*For brand application: `Docs/WALDO_BRAND_STANDARDS_V2.md`*
*For connector ecosystem: `Docs/WALDO_CONNECTOR_ECOSYSTEM.md`*
*For full vision: `Docs/WALDO_FULL_VISION_BRAINSTORM.md`*
*For product build: `Docs/WALDO_DESIGNER_BRIEF.md`*

*Already on it.*
