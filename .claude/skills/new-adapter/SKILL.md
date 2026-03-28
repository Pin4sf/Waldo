---
name: new-adapter
description: Scaffold a new adapter implementation (ChannelAdapter, LLMProvider, HealthDataSource, StorageAdapter)
user-invocable: true
model: sonnet
allowed-tools: ["Read", "Write", "Edit", "Grep", "Glob"]
---

Scaffold a new adapter implementation for $ARGUMENTS.

**Available adapter types:**
- `ChannelAdapter` — messaging delivery (e.g., WhatsApp, Discord, Slack)
- `LLMProvider` — AI model calls (e.g., DeepSeek, GPT-4o, Qwen)
- `HealthDataSource` — wearable data (e.g., Samsung Sensor SDK, Garmin)
- `StorageAdapter` — local persistence (e.g., cloud sync)

**Steps:**
1. Read the adapter interface definition from `Docs/WALDO_AGENT_INTELLIGENCE.md` (search for the interface)
2. Read the architecture rules from `.claude/rules/architecture.md` (Adapter Pattern section)
3. Create the new adapter implementation file in the correct directory:
   - `src/adapters/channels/` for ChannelAdapter
   - `src/adapters/llm/` for LLMProvider
   - `src/adapters/health/` for HealthDataSource
   - `src/adapters/storage/` for StorageAdapter
4. Implement the full interface with proper TypeScript types
5. Add a factory/registry entry so the adapter can be selected by config
6. Create a test file with at least: happy path, error handling, timeout behavior

**Rules:**
- Agent logic NEVER references the new provider directly — only through the adapter interface
- Follow coding standards from `.claude/rules/coding-standards.md`
- Health data adapters MUST follow `.claude/rules/health-data-security.md`
