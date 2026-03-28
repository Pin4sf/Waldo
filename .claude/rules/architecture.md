# Architecture Rules

These decisions are locked. Do NOT change without explicit discussion.

## Locked Decisions
1. **Messages API with tool_use** — not Agent SDK (Edge Functions are stateless)
2. **Claude Haiku 4.5 only** for MVP — no Sonnet/Opus in production paths
3. **Cross-platform from MVP** — Android + iOS simultaneously
4. **Channel adapter pattern from Day 1** — Telegram is the first implementation. Agent logic never references a specific channel directly.
5. **NativeWind v4** — not Gluestack-UI, not StyleSheet
6. **8 tools for MVP** — get_crs, get_sleep, get_stress_events, get_activity, send_message, read_memory, update_memory, get_user_profile
7. **3-step onboarding** — wearable permissions, messaging channel link, basic profile
8. **On-phone CRS** — TypeScript, offline-capable, no server round-trip for CRS
9. **Rules-based pre-filter** — skip Claude when CRS > 60 and stress confidence < 0.3
10. **op-sqlite + SQLCipher** for local DB — not WatermelonDB, not Realm

## Data Flow (Do Not Deviate)
```
Wearable → HealthKit/Health Connect → Native Module → op-sqlite (encrypted)
  → CRS computation (on-phone, TypeScript) → Supabase sync (health_snapshots)
  → pg_cron trigger check → rules pre-filter → LLM Provider [Claude Haiku] (if needed)
  → Channel Adapter → user feedback → agent learns
```

## Build Order
Data connectors FIRST (Phase B), dashboard SECOND (Phase C), agent THIRD (Phase D).
Never build agent features before the data pipeline is solid.

## Cost Constraints
- Rules pre-filter eliminates ~60-80% of Claude calls
- Max 3 agent iterations per invocation
- 50s hard timeout on Edge Functions
- Dynamic tool loading: 3-4 tools per call, not all 8
- Prompt caching: 1h TTL for soul files, 5min for profiles

## Adapter Pattern (All External Integrations)
All external boundaries use adapter interfaces. Agent logic calls the adapter, never the provider directly:
- `ChannelAdapter` — messaging delivery (Telegram first, then WhatsApp/Discord/Slack/in-app)
- `LLMProvider` — AI model calls (Claude Haiku first, then multi-model routing)
- `HealthDataSource` — wearable data (HealthKit + Health Connect first, then cloud APIs)
- `StorageAdapter` — local persistence (op-sqlite + SQLCipher first)

This ensures any component can be swapped without rewriting agent logic. "Plug and play, not rip and replace."

## Source of Truth
When in doubt, read these docs (in priority order):
1. `Docs/WALDO_MASTER_REFERENCE.md`
2. `Docs/WALDO_NORTHSTAR.md`
3. `Docs/WALDO_ONEPAGER.md`
4. `Docs/WALDO_RESEARCH_AND_ALGORITHMS.md`

Anything in `Docs/archive/` is superseded by these four.

> **Note:** File paths still use the `WALDO_` prefix for historical reasons. The product is now called **Waldo**.
