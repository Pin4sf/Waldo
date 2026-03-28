# Waldo Coding Standards

## TypeScript (App + Edge Functions)
- Strict mode always (`"strict": true` in tsconfig)
- No `any` types — use `unknown` + type guards instead
- Immutability preferred — `const`, `readonly`, spread over mutation
- Prefer early returns over nested if/else
- Files under 400 lines ideal, 800 max — split if larger
- Named exports over default exports
- Use Zod for runtime validation at system boundaries (API responses, user input, webhook payloads)

## React Native
- Functional components only, no class components
- NativeWind v4 for styling — no inline `StyleSheet.create` unless NativeWind can't express it
- Zustand for client state, TanStack Query for server state, MMKV for KV
- No `useEffect` for data fetching — use TanStack Query
- Platform-specific code via `.ios.ts` / `.android.ts` file extensions, not `Platform.select` (unless trivial)

## Native Modules (Kotlin / Swift)
- Use Expo Modules API — not bare React Native bridge
- All health queries are async — never block the main thread
- Handle permission denied, no data, API unavailable gracefully
- Return structured errors to JS layer (not raw exceptions)

## Edge Functions (Supabase / Deno)
- Stateless — no in-memory state between invocations
- Validate JWT on every request
- Agent loop: max 3 iterations, 50s hard timeout
- Use `@anthropic-ai/sdk` directly — no middleware, no Agent SDK
- Always log: tool calls, token usage, response time (fire-and-forget to agent_logs)

## Git
- Conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`
- Subject line ~70 chars
- Never commit .env, API keys, health data samples
- Never use `--no-verify`

## Adapter Pattern
- All external integrations MUST go through adapter interfaces (ChannelAdapter, LLMProvider, HealthDataSource, StorageAdapter)
- Agent logic, CRS computation, and delivery orchestration NEVER reference a specific provider directly
- Each adapter defines a standard interface; implementations are swappable without changing calling code
- MVP implementations: Telegram (channel), Claude Haiku (LLM), HealthKit/Health Connect (health), op-sqlite (storage)
- When adding a new integration, implement the existing adapter interface — do not add provider-specific code to agent logic

## Folder Structure
```
src/
  adapters/
    channels/         # ChannelAdapter implementations (telegram.ts, whatsapp.ts, etc.)
    llm/              # LLMProvider implementations (anthropic.ts, deepseek.ts, etc.)
    health/           # HealthDataSource implementations (healthkit.ts, health-connect.ts)
    storage/          # StorageAdapter implementations (opsqlite.ts)
  crs/                # CRS computation engine (platform-agnostic TypeScript)
  modules/
    health-connect/   # Kotlin native module (Android)
    healthkit/        # Swift native module (iOS)
    workmanager/      # Kotlin background sync (Android)
  screens/            # React Native screens (NativeWind)
  components/         # Reusable UI components
  hooks/              # React hooks (useCRS, useHealthData, etc.)
  store/              # Zustand stores
  utils/              # Shared utilities
  types/              # TypeScript type definitions
  __tests__/          # Test files mirror src/ structure

supabase/
  functions/
    _shared/          # Shared code across Edge Functions (config.ts, soul files, types)
    channel-webhook/  # Incoming messages from any channel
    check-triggers/   # pg_cron handler (Fetch Alerts + Morning Wags)
    invoke-agent/     # Agent loop (Claude Haiku + tools)
  migrations/         # SQL migration files

Docs/                 # Source-of-truth documentation
  handoffs/           # Phase handoff documents
```

## Naming Conventions
- **Files**: kebab-case (`channel-adapter.ts`, `health-connect.ts`)
- **Components**: PascalCase files and exports (`CrsGauge.tsx`, `SleepCard.tsx`)
- **Types/Interfaces**: PascalCase with descriptive names (`HealthSnapshot`, `ChannelAdapter`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_AGENT_ITERATIONS`, `CRS_WEIGHTS`)
- **Functions**: camelCase (`computeCrs`, `sendViaChannel`)
- **Zustand stores**: camelCase with `use` prefix (`useHealthStore`, `useCrsStore`)
- **Edge Functions**: kebab-case directory names (`check-triggers/`, `channel-webhook/`)
- **Test files**: same name as source with `.test.ts` suffix (`crs-engine.test.ts`)
- **Native modules**: PascalCase for module name (`HealthConnectModule`, `HealthKitModule`)

## Import Ordering
1. React / React Native imports
2. External library imports
3. Internal absolute imports (adapters, modules, utils)
4. Relative imports (same directory)
5. Type-only imports last

## Error Handling
- Use early returns for guard clauses
- At system boundaries (API, user input, webhooks): validate with Zod, return structured errors
- Internal code: throw typed errors, catch at the boundary
- Never swallow errors silently — at minimum log error code + context
- Health data functions: return `null` or `undefined` for missing data, never throw for absence

## Testing
- Test edge cases first: null HRV, empty sleep, zero steps, watch disconnect
- Integration tests for health data pipeline (real data shapes, not mocks)
- Unit tests for CRS computation (known inputs → expected outputs)
- Test files live in `src/__tests__/` mirroring the source structure
- Name test files `[source-name].test.ts`
