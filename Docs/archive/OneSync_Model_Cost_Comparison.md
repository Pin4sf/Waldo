# OneSync — Single-Model Cost Comparison (March 2026)

> **What if you ran the entire OneSync Agent OS on just ONE model?**
> This table shows per-user and 100-user monthly costs for each model,
> assuming identical usage patterns (1,500 calls/user/month, 2K input + 800 output tokens, 50% cache hit).

> Exchange rate: **₹92/USD**

---

## 1. Per-User Monthly API Cost — All Models

| # | Model | Provider | Input $/MTok | Output $/MTok | Cache $/MTok | **Cost/User/Mo** | **₹/User/Mo** | **100 Users/Mo** | **₹ 100 Users** |
|---|-------|----------|-------------|--------------|-------------|-----------------|--------------|-----------------|----------------|
| 1 | **GPT-5.2** | OpenAI | $1.75 | $14.00 | $0.875 | **$20.74** | ₹1908 | $2,073.75 | ₹190,785 |
| 2 | **GPT-5** | OpenAI | $1.25 | $10.00 | $0.625 | **$14.81** | ₹1363 | $1,481.25 | ₹136,275 |
| 3 | **GPT-4o** | OpenAI | $2.50 | $10.00 | $1.250 | **$17.62** | ₹1622 | $1,762.50 | ₹162,150 |
| 4 | **GPT-4o mini** | OpenAI | $0.15 | $0.60 | $0.075 | **$1.06** | ₹97 | $105.75 | ₹9,729 |
| 5 | **Claude Opus 4.6** | Anthropic | $5.00 | $25.00 | $0.500 | **$38.25** | ₹3519 | $3,825.00 | ₹351,900 |
| 6 | **Claude Sonnet 4.5** | Anthropic | $3.00 | $15.00 | $0.300 | **$22.95** | ₹2111 | $2,295.00 | ₹211,140 |
| 7 | **Claude Haiku 4.5** | Anthropic | $1.00 | $5.00 | $0.100 | **$7.65** | ₹704 | $765.00 | ₹70,380 |
| 8 | **DeepSeek V3.2** | DeepSeek | $0.28 | $0.42 | $0.028 | **$0.97** | ₹89 | $96.60 | ₹8,887 |
| 9 | **DeepSeek R1** | DeepSeek | $0.12 | $0.20 | $0.012 | **$0.44** | ₹40 | $43.80 | ₹4,030 |
| 10 | **Qwen 2.5-72B** | Alibaba | $0.12 | $0.39 | $0.060 | **$0.74** | ₹68 | $73.80 | ₹6,790 |
| 11 | **Qwen 2.5-Max** | Alibaba | $2.00 | $6.00 | $1.000 | **$11.70** | ₹1076 | $1,170.00 | ₹107,640 |
| 12 | **GLM-5** | Zhipu AI | $1.00 | $3.20 | $0.500 | **$6.09** | ₹560 | $609.00 | ₹56,028 |
| 13 | **GLM-4.5** | Zhipu AI | $0.55 | $2.20 | $0.280 | **$3.89** | ₹357 | $388.50 | ₹35,742 |
| 14 | **Kimi K2.5** | Moonshot | $0.60 | $3.00 | $0.100 | **$4.65** | ₹428 | $465.00 | ₹42,780 |
| 15 | **Kimi K2** | Moonshot | $0.39 | $1.90 | $0.200 | **$3.17** | ₹291 | $316.50 | ₹29,118 |
| 16 | **MiniMax M2.5** | MiniMax | $0.30 | $1.20 | $0.150 | **$2.12** | ₹195 | $211.50 | ₹19,458 |
| 17 | **MiniMax M2** | MiniMax | $0.20 | $1.00 | $0.100 | **$1.65** | ₹152 | $165.00 | ₹15,180 |

### Cheapest to Most Expensive (per user/month)

🥇 **DeepSeek R1** (DeepSeek) — $0.44/user/mo (₹40) — Reasoning model, cheapest
🥈 **Qwen 2.5-72B** (Alibaba) — $0.74/user/mo (₹68) — Strong Chinese model
🥉 **DeepSeek V3.2** (DeepSeek) — $0.97/user/mo (₹89) — Ultra-cheap, strong at math
4. **GPT-4o mini** (OpenAI) — $1.06/user/mo (₹97) — Budget option
5. **MiniMax M2** (MiniMax) — $1.65/user/mo (₹152) — Budget MiniMax
6. **MiniMax M2.5** (MiniMax) — $2.12/user/mo (₹195) — Latest MiniMax, Feb 2026
7. **Kimi K2** (Moonshot) — $3.17/user/mo (₹291) — Previous gen
8. **GLM-4.5** (Zhipu AI) — $3.89/user/mo (₹357) — Previous gen, cheaper
9. **Kimi K2.5** (Moonshot) — $4.65/user/mo (₹428) — Latest Kimi, strong caching
10. **GLM-5** (Zhipu AI) — $6.09/user/mo (₹560) — Latest GLM, Feb 2026
11. **Claude Haiku 4.5** (Anthropic) — $7.65/user/mo (₹704) — Fast & affordable
12. **Qwen 2.5-Max** (Alibaba) — $11.70/user/mo (₹1076) — Flagship Qwen
13. **GPT-5** (OpenAI) — $14.81/user/mo (₹1363) — Previous flagship
14. **GPT-4o** (OpenAI) — $17.62/user/mo (₹1622) — Workhorse multimodal
15. **GPT-5.2** (OpenAI) — $20.74/user/mo (₹1908) — Latest flagship, Feb 2026
16. **Claude Sonnet 4.5** (Anthropic) — $22.95/user/mo (₹2111) — Balanced performance
17. **Claude Opus 4.6** (Anthropic) — $38.25/user/mo (₹3519) — Most capable, deep reasoning

---

## 2. Best Model Picks for OneSync MVP

| Priority | Model | Cost/User/Mo | 100 Users/Mo | Why |
|----------|-------|-------------|-------------|-----|
| 🏆 Best Value | DeepSeek V3.2 | $0.97 (₹89) | $96.60 (₹8,887) | Ultra-cheap, strong at math |
| 💰 Cheapest | DeepSeek R1 | $0.44 (₹40) | $43.80 (₹4,030) | Reasoning model, cheapest |
| 🇨🇳 Best Chinese | Qwen 2.5-72B | $0.74 (₹68) | $73.80 (₹6,790) | Strong Chinese model |
| ⚡ Best Balance | GLM-5 | $6.09 (₹560) | $609.00 (₹56,028) | Latest GLM, Feb 2026 |
| 🧠 Best Quality | Claude Sonnet 4.5 | $22.95 (₹2111) | $2,295.00 (₹211,140) | Balanced performance |
| 👑 Premium | Claude Opus 4.6 | $38.25 (₹3519) | $3,825.00 (₹351,900) | Most capable, deep reasoning |

> **Recommendation for MVP:** Start with **DeepSeek V3.2** for 90% of calls (health crunching,
> routine agent tasks, memory ops) and reserve **Claude Haiku 4.5** or **Opus 4.6** only for
> safety-critical health reasoning (crisis detection, medication warnings).

---

## 3. Monthly Cost for 100 Users — Visual Comparison

```
DeepSeek R1          | $     43.80 | 
Qwen 2.5-72B         | $     73.80 | █
DeepSeek V3.2        | $     96.60 | █
GPT-4o mini          | $    105.75 | ██
MiniMax M2           | $    165.00 | ███
MiniMax M2.5         | $    211.50 | ████
Kimi K2              | $    316.50 | ██████
GLM-4.5              | $    388.50 | ███████
Kimi K2.5            | $    465.00 | █████████
GLM-5                | $    609.00 | ████████████
Claude Haiku 4.5     | $    765.00 | ███████████████
Qwen 2.5-Max         | $  1,170.00 | ███████████████████████
GPT-5                | $  1,481.25 | █████████████████████████████
GPT-4o               | $  1,762.50 | ███████████████████████████████████
GPT-5.2              | $  2,073.75 | █████████████████████████████████████████
Claude Sonnet 4.5    | $  2,295.00 | █████████████████████████████████████████████
Claude Opus 4.6      | $  3,825.00 | ████████████████████████████████████████████████████████████
```

> Each █ ≈ $50/month

---

## 4. Health Data Connector / Wearable API Comparison

For OneSync MVP, you need wearable health data (heart rate, steps, sleep, HRV, SpO2).
Here's how the options compare:

| API | Monthly Cost | Free Tier | Devices Supported | India Wearables | Best For |
|-----|-------------|-----------|-------------------|----------------|----------|
| **Health Connect SDK** | **Free** | ✅ Unlimited | All Android wearables | ✅ All (native) | **MVP — use this first** |
| **ROOK** | From $249/mo | ✅ Free plan available | 100+ wearables | ✅ Good | Budget alternative to Terra |
| **Sahha.ai** | Custom | ✅ Free sandbox | 100+ wearables | ✅ Good | AI-powered health scores |
| **Terra API** | $399/mo | ❌ No free tier | 200+ wearables | ✅ Excellent | Premium, expensive |
| **Vital (Junction)** | Custom (sales) | ❌ Contact sales | 300+ wearables + labs | ⚠️ Limited | Clinical/lab use cases |
| **Vitalera** | Custom | ✅ Free trial | Wearables + medical | ⚠️ Unknown | Medical device focus |

### Top 10 Wearable Devices in India (2026)

| # | Device | Health Connect Support | Direct SDK | Notes |
|---|--------|----------------------|-----------|-------|
| 1 | **Noise ColorFit** series | ✅ Yes | Noise app → HC | #1 in India by volume |
| 2 | **boAt Wave** series | ✅ Yes | boAt app → HC | #2 in India |
| 3 | **Fire-Boltt** series | ✅ Yes | Fire-Boltt app → HC | #3 in India |
| 4 | **Samsung Galaxy Watch** | ✅ Yes (native) | Samsung Health → HC | Best HC integration |
| 5 | **Xiaomi Mi Band/Watch** | ✅ Yes | Mi Fitness → HC | Popular budget option |
| 6 | **OnePlus Watch** | ✅ Yes | O Health → HC | Growing in India |
| 7 | **Titan Smart** | ✅ Yes | Titan Smart app → HC | Indian brand |
| 8 | **Amazfit GTR/GTS** | ✅ Yes | Zepp → HC | Good HC support |
| 9 | **Garmin Venu** | ✅ Yes | Garmin Connect → HC | Sports/fitness focus |
| 10 | **Apple Watch** | ❌ (HealthKit) | HealthKit only | iOS Phase 2 |

### Recommended Strategy for MVP

```
Phase 1 (MVP):     Health Connect SDK (FREE)
                    → Covers ALL top 9 Android wearables in India
                    → Zero API cost, direct on-device data access
                    → You read data locally, no cloud middleman

Phase 1.5 (If needed): ROOK free plan
                    → For any devices Health Connect misses
                    → Free plan covers up to 750 users

Phase 2 (iOS):      HealthKit SDK (FREE)
                    → Apple Watch support
                    → Native iOS, zero cost

Phase 3 (Scale):    Build your own connectors
                    → Remove all third-party dependencies
                    → Direct BLE/SDK integrations
```

> 💡 **You do NOT need Terra API for MVP.** Health Connect SDK is free and covers
> every major Indian wearable brand. Terra's $399/mo is only justified at 1000+ users
> when you need cloud-side processing or international device coverage.

---

## 5. Total Monthly Operating Cost Scenarios (100 Users)

| Scenario | AI Model | Model Cost | Health API | Infra | **Total/Mo** | **₹/Mo** |
|----------|----------|-----------|-----------|-------|------------|---------|
| Ultra-Lean | DeepSeek V3.2 | $96.60 | Free (HC SDK) | Free | **$96.60** | **₹8,887** |
| Budget Chinese | Qwen 2.5-72B | $73.80 | Free (HC SDK) | Free | **$73.80** | **₹6,790** |
| Budget + Safety | DeepSeek V3.2 | $96.60 | Free (HC SDK) | $25 | **$121.60** | **₹11,187** |
| Mid-Range | GLM-5 | $609.00 | Free (HC SDK) | $25 | **$634.00** | **₹58,328** |
| Quality | Claude Haiku 4.5 | $765.00 | Free (HC SDK) | $25 | **$790.00** | **₹72,680** |
| Premium | Claude Opus 4.6 | $3,825.00 | Free (HC SDK) | $25 | **$3,850.00** | **₹354,200** |

> All scenarios use **Health Connect SDK (free)** for wearable data.
> Supabase Pro ($25/mo) added for scenarios expecting 100+ users.

---

## 6. Bottom Line Summary

| Metric | Cheapest (DeepSeek V3.2) | Premium (Claude Opus 4.6) |
|--------|-------------------------|--------------------------|
| Per user/month | $0.97 (₹89) | $38.25 (₹3519) |
| 100 users/month | $96.60 (₹8,887) | $3,825.00 (₹351,900) |
| Health Data API | Free (Health Connect) | Free (Health Connect) |
| Infrastructure | Free (free tiers) | $25/mo (Supabase Pro) |
| **Total 100 users/mo** | **$96.60 (₹8,887)** | **$3,850.00 (₹354,200)** |

> **Key Insight:** DeepSeek V3.2 is **40x cheaper** than Claude Opus 4.6.
> For MVP, use DeepSeek/Qwen for bulk work and reserve Claude only for safety-critical health decisions.
> **Health Connect SDK eliminates the need for Terra API ($399/mo) entirely for Indian wearables.**

---

*Generated March 2026 | ₹92/USD | Pricing from official API documentation*

Sources: [OpenAI Pricing](https://openai.com/api/pricing/), [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing), [DeepSeek Pricing](https://api-docs.deepseek.com/quick_start/pricing), [Zhipu GLM Pricing](https://docs.z.ai/guides/overview/pricing), [Moonshot Kimi Pricing](https://platform.moonshot.ai/docs/pricing/chat), [MiniMax Pricing](https://platform.minimax.io/docs/guides/pricing), [ROOK Pricing](https://www.tryrook.io/pricing), [Terra Pricing](https://tryterra.co)
