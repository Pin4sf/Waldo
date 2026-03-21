# OneSync Coding Standards

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

## Testing
- Test edge cases first: null HRV, empty sleep, zero steps, watch disconnect
- Integration tests for health data pipeline (real data shapes, not mocks)
- Unit tests for CRS computation (known inputs → expected outputs)
