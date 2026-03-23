# Phase Orchestration — Which Agents, When

Each build phase has a specific agent workflow. Follow this to maintain quality gates between phases.

## The Dev-QA Loop (Use for EVERY Feature)

```
1. planner → breaks feature into tasks
2. [you build the feature]
3. qa-breaker → tries to break it (default: NEEDS WORK)
   IF PASS → advance
   IF FAIL (attempt < 3) → fix issues, re-run qa-breaker
   IF FAIL (attempt >= 3) → escalate: decompose, defer, or accept with known issues
```

This loop is non-negotiable. No feature ships without qa-breaker approval.

## Phase-Specific Agent Workflows

### Phase A: Pre-Code Setup
- **planner** → break down WoO test, tech spikes, account setup
- No code review agents needed yet

### Phase B1: HealthKit Connector (iOS)
- **workflow-mapper** → map every HealthKit data flow path BEFORE writing code
- **planner** → task breakdown for Swift native module
- [build] → Dev-QA loop for each task
- **native-module-reviewer** → Swift/HealthKit correctness
- **health-data-reviewer** → null handling, data freshness, unit consistency
- **security-reviewer** → SQLCipher encryption, no health data in logs
- **qa-breaker** → break it (watch disconnect, permission denied, no sleep data, DST)

### Phase B2: Health Connect Connector (Android)
- Same as B1 but with Kotlin focus
- **native-module-reviewer** → Health Connect, WorkManager, Samsung quirks
- Extra focus: Samsung HRV gap, OEM battery kills, doze mode

### Phase C: Dashboard
- **workflow-mapper** → map CRS display flow, refresh cycles, offline state
- [build] → Dev-QA loop
- **crs-validator** → validate algorithm implementation against spec
- **health-data-reviewer** → verify dashboard reads fresh data, handles nulls
- **qa-breaker** → break it (all null data, stale snapshots, rapid CRS changes)

### Phase D: Agent Core + Messaging
- **workflow-mapper** → map agent trigger → LLM Provider → Channel Adapter flow with ALL failure modes
- **soul-file-reviewer** → review soul files BEFORE deploying
- [build] → Dev-QA loop
- **security-reviewer** → JWT validation, prompt injection, tool abuse
- **soul-file-reviewer** → conversation quality, medical claims, emergency detection
- **e2e-pipeline-tester** → full pipeline validation
- **qa-breaker** → break it (API timeout, 3 alerts in 10 min, adversarial prompts)

### Phase E: Proactive Delivery
- **workflow-mapper** → map pg_cron → pre-filter → LLM Provider → Channel Adapter with timing edge cases
- [build] → Dev-QA loop
- **e2e-pipeline-tester** → full pipeline with scheduled triggers
- **qa-breaker** → break it (cooldown bypass, max messages/day, stale triggers)

### Phase F: Onboarding + Polish
- [build] → Dev-QA loop
- **security-reviewer** → permission flows, channel linking security
- **qa-breaker** → break it (partial onboarding, permission revocation, re-onboarding)

### Phase G: Self-Test + Tuning
- **crs-validator** → re-validate after threshold tuning
- **soul-file-reviewer** → review A/B test soul file variants
- **qa-breaker** → 14 days of daily use findings
- **e2e-pipeline-tester** → full pipeline after tuning changes

### Phase H: Beta
- **e2e-pipeline-tester** → pre-beta full pipeline check
- **security-reviewer** → pre-beta security audit
- **qa-breaker** → final adversarial pass

## Phase Handoff Template

At the end of each phase, produce a handoff document:

```markdown
## Phase [X] → Phase [Y] Handoff

### What Was Built
- [List of features/modules completed]

### What Works (with evidence)
- [Feature]: tested via [method], result: [PASS/FAIL]

### What Doesn't Work Yet (known issues)
- [Issue]: severity [CRITICAL/HIGH/MEDIUM], deferred to Phase [Z]

### Architecture Decisions Made During This Phase
- [Decision]: [why] — UPDATE THE MASTER REFERENCE IF THIS CHANGES THE SPEC

### Hard-Won Lessons
- [What we learned that wasn't in the spec]

### Prerequisites for Next Phase
- [What Phase Y needs from Phase X to start]

### Files Changed
- [List of new/modified files for easy context loading]
```

## Rules
- Never skip the Dev-QA loop. "It looks fine" is not QA.
- workflow-mapper runs BEFORE building, not after.
- soul-file-reviewer runs BEFORE deploying any agent personality change.
- Phase handoffs are mandatory. Don't start Phase Y without Phase X's handoff doc.
- Update the Master Reference immediately if any decision changes during a phase.
