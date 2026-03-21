# OneSync MVP — Lean Cost Estimate (₹92/USD)

> **Strategy:** Solo founder build, mixed model routing with Chinese AI models,
> aggressive caching, free tiers maximized. Designed for IIT Roorkee funding pitch.

---

## 1. Per-User Monthly API Cost (Mixed Model Routing)

| Model | % Calls | Calls/mo | Input $/MTok | Output $/MTok | Cached $/MTok | Monthly Cost |
|-------|---------|----------|-------------|--------------|--------------|-------------|
| DeepSeek V3 | 40% | 600 | $0.28 | $0.42 | $0.028 | $0.3864 |
| GPT-4o mini | 25% | 375 | $0.15 | $0.60 | $0.075 | $0.2644 |
| Qwen 2.5-72B | 20% | 300 | $0.12 | $0.39 | $0.060 | $0.1476 |
| Claude Haiku 4.5 | 12% | 180 | $1.00 | $5.00 | $0.100 | $0.9180 |
| Claude Opus 4.6 | 3% | 45 | $5.00 | $25.00 | $0.500 | $1.1475 |
| **TOTAL** | **100%** | **1500** | | | | **$2.86** |

**Per-user API cost: $2.86/month (₹263/month)**

> 💡 **49% reduction** from original estimate ($5.58 → $2.86) by routing 85% of calls to sub-$0.60/MTok models.

## 2. Monthly Infrastructure Costs

| Service | Tier | Monthly Cost (USD) | Monthly Cost (₹) | Notes |
|---------|------|-------------------|------------------|-------|
| Supabase | Free → Pro | Free | Free | Free tier for MVP (500MB DB, 50K MAU). Upgrade to $25/mo at ~100 users |
| Cloudflare Workers | Free | Free | Free | 100K requests/day free. Agent orchestration layer |
| Expo EAS | Free | Free | Free | Free for solo dev. 30 builds/month |
| Telegram Bot API | Free | Free | Free | Free forever. MVP communication channel |
| Health Connect SDK | Free | Free | Free | Android native, no API costs |
| Domain + SSL | Annual | $1.50 | ₹138 | ~$18/year via Cloudflare Registrar |
| Vercel (Landing) | Free | Free | Free | Free hobby tier for marketing site |
| **TOTAL** | | **$1.50** | **₹138** | |

> 🎯 **Infrastructure is essentially FREE** during MVP phase by leveraging free tiers.

## 3. Team & Development Costs (Lean Mode)

| Role | Count | Monthly Cost (₹) | Months | Total (₹) | Notes |
|------|-------|------------------|--------|-----------|-------|
| Solo Founder (You) | 1 | ₹0 | 3 | ₹0 | Full-stack + AI. No salary during MVP |
| UI/UX Freelancer | 1 | ₹15,000 | 1 | ₹15,000 | One-time Figma designs, ~$163 |
| Claude Code (AI Dev) | 1 | ₹1,840 | 3 | ₹5,520 | Claude Max $20/mo = ₹1,840. Your AI pair programmer |
| Testing (Friends/Beta) | 0 | ₹0 | 1 | ₹0 | Free beta testers from college network |
| **TOTAL** | | | | **₹20,520** | **$223 USD** |

> 💡 **98% reduction** from original ₹9,20,000 → ₹20,520 by going solo founder + AI-assisted development.

## 4. One-Time Setup Costs

| Item | Cost (₹) | Cost (USD) | Notes |
|------|----------|-----------|-------|
| Google Play Developer | ₹2,300 | $25 | One-time $25 fee |
| Apple Developer (Phase 2) | ₹9,200 | $100 | Annual $99, only when iOS launches |
| API Credits (Initial) | ₹920 | $10 | DeepSeek + Qwen initial testing |
| Miscellaneous | ₹2,000 | $22 | Hosting, domains, tools |
| **TOTAL** | **₹14,420** | **$157** | |

## 5. Total 3-Month MVP Build Cost

| Category | Cost (₹) | Cost (USD) |
|----------|----------|-----------|
| Team & Development | ₹20,520 | $223 |
| One-Time Setup | ₹14,420 | $157 |
| API Testing (3 months, ~10 users) | ₹7,904 | $86 |
| Infrastructure | Free | Free |
| **TOTAL MVP COST** | **₹42,844** | **$466** |

> 🔥 **MVP build cost: ₹0.4L ($466 USD)**
> Original estimate was ₹9.2L ($10,800). That's a **95% reduction.**

## 6. Post-Launch Monthly Operating Cost (per user tier)

| Users | API Cost/mo | Infra/mo | Total/mo (USD) | Total/mo (₹) |
|-------|------------|---------|---------------|-------------|
| 10 | $28.64 | $0 | $28.64 | ₹2,635 |
| 50 | $143.19 | $0 | $143.19 | ₹13,174 |
| 100 | $286.39 | $25 | $311.39 | ₹28,648 |
| 500 | $1,431.94 | $25 | $1,456.94 | ₹134,038 |
| 1,000 | $2,863.88 | $50 | $2,913.88 | ₹268,076 |
| 5,000 | $14,319.38 | $50 | $14,369.38 | ₹1,321,982 |

## 7. Pricing Strategy & Margins

| Plan | Price (₹/mo) | Price ($/mo) | API Cost/user | Gross Margin |
|------|-------------|-------------|--------------|-------------|
| Freemium (limited) | ₹0 | $0.00 | $0.29 | N/A (free) |
| Basic | ₹299 | $3.25 | $2.86 | 12% |
| Pro | ₹599 | $6.51 | $2.86 | 56% |
| Premium | ₹999 | $10.86 | $2.86 | 74% |

> At ₹299/mo (~$3.25), gross margin is **12%** — viable even at the cheapest paid tier.

## 8. 6-Month Runway (MVP → Early Traction)

| Month | Phase | Users | API Cost | Infra | Team | Monthly Burn | Cumulative |
|-------|-------|-------|---------|-------|------|-------------|-----------|
| 1 | Build | 0 | ₹0 | ₹0 | ₹6,840 | ₹21,260 +setup | ₹21,260 |
| 2 | Build | 0 | ₹0 | ₹0 | ₹6,840 | ₹6,840 | ₹28,100 |
| 3 | Build | 5 | ₹1,317 | ₹0 | ₹6,840 | ₹8,157 | ₹36,257 |
| 4 | Beta | 20 | ₹5,270 | ₹0 | ₹1,840 | ₹7,110 | ₹43,367 |
| 5 | Launch | 50 | ₹13,174 | ₹0 | ₹1,840 | ₹15,014 | ₹58,381 |
| 6 | Growth | 100 | ₹26,348 | ₹2,300 | ₹1,840 | ₹30,488 | ₹88,868 |

> **Total 6-month runway needed: ₹88,868 ($966 USD)**
> Original estimate was ₹18.5L ($21,724). That's **95% less.**

## 9. Model Pricing Comparison (March 2026)

| Model | Input $/MTok | Output $/MTok | Cached $/MTok | Use Case in OneSync |
|-------|-------------|--------------|--------------|-------------------|
| DeepSeek V3 | $0.28 | $0.42 | $0.028 | Health math, CRS calculation, data processing |
| Qwen 2.5-72B | $0.12 | $0.39 | $0.06 | Core agent reasoning, SOUL.md processing |
| GPT-4o mini | $0.15 | $0.60 | $0.075 | Routine tasks, scheduling, memory operations |
| Claude Haiku 4.5 | $1.00 | $5.00 | $0.10 | Health insights, personalized coaching |
| Claude Opus 4.6 | $5.00 | $25.00 | $0.50 | Deep analysis, crisis detection, weekly reports |

> DeepSeek V3 is **18x cheaper** than Claude Haiku on input and **12x cheaper** on output.
> By routing 85% of calls to DeepSeek/Qwen/GPT-4o-mini, we slash API costs dramatically.

## 10. Original vs. Lean Estimate Comparison

| Metric | Original Estimate | Lean Estimate | Savings |
|--------|------------------|--------------|---------|
| Exchange Rate | ₹85/USD | ₹92/USD | — |
| Per-User API Cost | $5.58/mo | $2.86/mo | 49% |
| Team (3-mo MVP) | ₹9,20,000 | ₹20,520 | 98% |
| MVP Total Cost | ₹9,20,000 (~$10,800) | ₹42,844 (~$466) | 95% |
| 6-Month Runway | ₹18,50,000 (~$21,724) | ₹88,868 (~$966) | 95% |
| Primary AI Models | Claude only | DeepSeek + Qwen + GPT-4o-mini + Claude | — |
| Team Size | 5-6 people | Solo founder + AI tools | — |

## 11. Key Assumptions & Risks

### Assumptions
- Solo founder handles all development using Claude Code / AI-assisted coding
- 50% prompt cache hit rate (SOUL.md, BODY.md, MEMORY.md are highly cacheable)
- DeepSeek V3 and Qwen 2.5 quality is sufficient for health data processing
- Free tiers (Supabase, Cloudflare, Expo) cover MVP needs up to ~100 users
- Beta testers recruited from IIT network (free)
- No founder salary during 3-month MVP build

### Risks to Monitor
- **Chinese model reliability:** DeepSeek/Qwen may have downtime or rate limits; keep Claude Haiku as fallback
- **Quality gap:** Health-critical reasoning (crisis detection, medication interactions) MUST use Claude Opus 4.6 — don't cut corners on safety
- **Solo founder bottleneck:** If you get sick or burnt out, development stops. Consider a co-founder or part-time intern
- **Free tier limits:** Supabase pauses inactive free projects after 7 days. Set up a keep-alive cron job
- **Scaling costs:** Once past 100 users, Supabase Pro ($25/mo) and higher API costs kick in

---

*Generated March 2026 | Exchange rate: ₹92/USD | All prices from official API documentation*
