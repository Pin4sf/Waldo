# Waldo — Tool Permissions
> Per-trigger access control. Enforced by the invoke-agent Edge Function BEFORE tool execution.
> Claude receives only the tools it's allowed to call for this trigger type.

---

## Tool definitions (8 MVP tools)

| Tool | What it does | Write? |
|------|-------------|--------|
| `get_crs` | Load CRS score + components from health_snapshots | No |
| `get_sleep` | Load last night's sleep session detail | No |
| `get_stress_events` | Load recent stress events + confidence scores | No |
| `get_activity` | Load steps, strain, exercise, active energy | No |
| `get_user_profile` | Load user name, timezone, goals, preferences | No |
| `read_memory` | Load a slice of core_memory or patterns | No |
| `update_memory` | Write a fact to core_memory | **YES** |
| `send_message` | Deliver message via ChannelAdapter | **YES** |

---

## Per-trigger permissions

### morning_wag
```
allowed: get_crs, get_sleep, get_activity, get_user_profile, read_memory, send_message
forbidden: update_memory, get_stress_events
max_send_message: 1
max_iterations: 2
token_budget: 4000
```
Rationale: Morning is read-only. Don't write to memory from automated morning runs.

### fetch_alert
```
allowed: get_crs, get_stress_events, read_memory, send_message
forbidden: update_memory, get_sleep, get_activity, get_user_profile
max_send_message: 1
max_iterations: 1
token_budget: 2000
```
Rationale: Fetch Alerts should be fast. One tool call, one message. No writing.

### evening_review
```
allowed: get_crs, get_sleep, get_activity, get_user_profile, read_memory, send_message
forbidden: update_memory, get_stress_events
max_send_message: 1
max_iterations: 2
token_budget: 3000
```

### user_message (conversational)
```
allowed: ALL 8 tools
max_send_message: 3 (back-and-forth chat)
max_update_memory: 3
max_iterations: 3
token_budget: 7000
```
Rationale: User-initiated chat gets full tool access. User is present to course-correct.

### baseline_update (automated, no LLM)
```
allowed: NONE (this trigger never calls Claude — pure computation)
```

---

## Write tool safety rules

### update_memory guardrails
Before writing to core_memory, validate the value does NOT contain:
- URLs (http/https)
- Code blocks (```  or ``)
- Base64 strings
- Instruction-like phrases: "ignore previous", "you are now", "system:", "override"
- Prompt injection patterns: XML tags injected by user, JSON with "role": "system"

If validation fails: log attempt, return error to Claude, do NOT write.

### send_message rate limits
- Cooldown: 2h between any proactive messages (morning_wag + fetch_alert combined)
- Daily cap: 3 fetch_alerts max per user per day
- Idempotency: generate key = hash(user_id + trigger_type + floor(timestamp/15min))
  Check sent_messages before sending. Skip if key exists.
