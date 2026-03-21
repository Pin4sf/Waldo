# OneSync Research Session — March 6-7, 2026

## Session Summary

Comprehensive deep-dive research session covering everything needed to build the OneSync MVP. Started with reviewing existing docs, then systematically researched every layer of the stack. On March 7, added deep-dive analysis of the tech stack (framework comparison, offline-first, backend, AI, algorithms) and Agent OS architecture (from analyzing 6 open-source agent projects).

## Documents in This Folder

| # | File | Contents |
|---|------|----------|
| 01 | `01_WEARABLE_DATA_PIPELINE.md` | Raw sensor access for every major wearable. Samsung Sensor SDK, Garmin Connect IQ, Fitbit/WHOOP/Oura APIs, Health Connect limitations. The complete data matrix. |
| 02 | `02_DEVELOPER_REGISTRATIONS.md` | Every form, SDK, and API registration needed. Links, approval times, costs, documents required. Action checklist. |
| 03 | `03_APP_ARCHITECTURE.md` | React Native + Expo stack decisions. Background processing, offline-first, state management, Wear OS communication, OEM battery issues. |
| 04 | `04_ALGORITHMS_AND_CRS.md` | CRS formula, stress detection, HRV computation from raw IBI, false positive reduction, weight rationale. |
| 05 | `05_CLAUDE_AGENT_ARCHITECTURE.md` | Claude API tool_use pattern, prompt caching, context management, model routing, safety guardrails. |
| 06 | `06_MESSAGING_ARCHITECTURE.md` | Telegram + WhatsApp bot design. Unified abstraction, proactive messaging, webhook security, message queuing. |
| 07 | `07_SUPABASE_BACKEND.md` | Edge Functions, pg_cron, RLS performance, schema optimization, auth linking, cost capacity planning. |
| 08 | `08_UI_UX_DESIGN.md` | Score visualization, dashboard layout, onboarding flow, charting libraries, notification UX, dark mode, component library. |
| 09 | `09_FINAL_MVP_PLAN.md` | The complete finalized MVP plan — architecture, tools, build sequence, week-by-week timeline. Everything synthesized. |
| 10 | `10_CRITIQUE_AND_RISKS.md` | Honest critique of the project, viability assessment, key risks, and mitigation strategies. |
| 11 | `11_TECH_STACK_DEEP_DIVE.md` | **[March 7]** Framework comparison (RN vs Kotlin vs Flutter), offline-first (PowerSync vs custom sync), backend architecture, AI agent framework evaluation, health algorithm corrections (CRS weights, artifact rejection, time-of-day normalization). 7 critical changes from March 6 plan. |
| 12 | `12_AGENT_OS_DEEP_DIVE.md` | **[March 7]** Agent OS architecture from analyzing 6 open-source projects (Pi Mono, OpenClaw, PicoClaw, OpenFang, CoPaw, HumanLayer context engineering). Layered architecture, context assembly pipeline, hook system, skills system, autonomous Hands pattern, triple-layer memory, security patterns. 10 critical patterns to adopt. |
| 13 | `13_PHASE_ROADMAP.md` | **[March 7]** Complete phase-by-phase roadmap (MVP -> Phase 4). Channel expansion plan (push, in-app chat, voice, email, watch, widget). Agent-app sync architecture. Agent evolution per phase. Metrics to track. Monetization model. |
| 14 | `14_HARDWARE_STRATEGY_NOTE.md` | **[March 7]** Parallel hardware track (Ansh + Mayur). OneBand wristband + ear/temple module for NFL cognitive performance. Biosensing location research (periauricular EEG, temporal EMG, tympanic temp, ear PPG). Complete sensor spec. NFL feasibility. Software requirements for hardware readiness. |

## Key Decisions Made This Session

1. **Samsung Health SDK Data SDK partnership is FROZEN** — use Samsung Health Sensor SDK (on-watch, separate program) instead
2. **Build on-watch companion apps** for Samsung (Kotlin/Sensor SDK) and Garmin (Monkey C/Connect IQ) for raw IBI/HRV data
3. **Cloud APIs** for Oura, WHOOP, Fitbit — same data aggregators get, but free
4. **Health Connect as universal fallback** — basic data from all Android devices
5. **WhatsApp in MVP** alongside Telegram — Meta Business verification takes 3-14 days
6. **AI onboarding interview** in messaging channel — personalize agent from day one
7. **Google Calendar read + Gmail read** in MVP — context for smarter interventions
8. **Raw Messages API** for Claude, not Agent SDK — better fit for serverless health co-pilot
9. **Prompt caching with 1-hour TTL** — ~60-70% savings on input tokens
10. **PowerSync + SQLite** for offline-first architecture
11. **expo-background-task** (SDK 53+, WorkManager) for reliable 15-min background sync
12. **Gluestack-UI v3** for component library
13. **react-native-gifted-charts** for health data visualization
14. **grammY** for Telegram bot (Deno/Edge Function native)
15. **Supabase Queues (pgmq)** for message reliability

## Existing Docs (in parent Docs/ folder)

These were reviewed at the start of the session:
- `01_OneSync_Complete_Vision_and_Feasibility.md`
- `02_OneSync_Strategic_Blueprint_PRD_and_Market.md`
- `OneSync_MVP_Engineering_PRD.md`
- `OneSync_Vision_Product_Plan.md`
- `OneSync_Lean_Cost_Estimate.md`
- `OneSync_Model_Cost_Comparison.md`
- `OneSync_Health_Connector_Strategy.md`
- `OneSync_MVP_Cost_Estimate_v2.xlsx`
- `Master Plan of OneSync.pdf`
