# Waldo Agent Workspace

This directory is Waldo's brain. It contains the personality, rules, heartbeat playbooks, skills, operators, and per-user memory that define how the agent thinks, learns, and acts.

---

## Directory Structure

```
agent/
├── README.md                    ← This file
│
├── identity/                    ← Ring 1: Immutable core
│   ├── IDENTITY.md              ← Who Waldo is. Never changes.
│   └── PRINCIPLES.md            ← 5 laws. Never evolves.
│
├── soul/                        ← Ring 1: Voice + personality (per-trigger variants)
│   ├── SOUL_BASE.md             ← Always loaded. Core voice rules.
│   ├── SOUL_MORNING.md          ← Morning Wag personality
│   ├── SOUL_STRESS.md           ← Fetch Alert personality
│   ├── SOUL_CHAT.md             ← Conversational mode
│   ├── SOUL_EVENING.md          ← Evening Review personality
│   ├── SOUL_DEPLETED.md         ← CRS < 50 rules
│   ├── SOUL_PEAK.md             ← CRS 80+ rules
│   └── SOUL_FIRST_WEEK.md       ← New user (days 1-7) rules
│
├── rules/                       ← Ring 1: Platform-level constraints
│   ├── SAFETY.md                ← Emergency bypass, medical safety, privacy
│   ├── TOOLS_PERMISSIONS.md     ← Per-trigger tool access table
│   ├── SECURITY.md              ← Prompt injection defense, audit trail
│   └── MEDICAL_DISCLAIMERS.md   ← Exact disclaimer text by context
│
├── heartbeat/                   ← Ring 1: Scheduled playbooks
│   ├── HEARTBEAT_MORNING.md     ← Morning Wag playbook (wake_time)
│   ├── HEARTBEAT_PATROL.md      ← Stress detection scan (15-min)
│   ├── HEARTBEAT_EVENING.md     ← Evening Review playbook (21:00)
│   ├── HEARTBEAT_BASELINE.md    ← Nightly compute at 04:00 (no LLM)
│   └── HEARTBEAT_WEEKLY.md      ← Sunday compaction + pattern promotion
│
├── operators/                   ← Ring 1: Vertical-specific configs
│   ├── OPERATOR_CONSUMER.md     ← Default consumer config
│   └── OPERATOR_NFL.md          ← NFL/sport performance vertical
│
├── onboarding/                  ← Ring 1: New user intake
│   ├── INTERVIEW_SCRIPT.md      ← Conversational flow + 6 questions
│   └── INTERVIEW_SCHEMA.md      ← Field map: question → memory write target
│
├── skills/                      ← Ring 2: What the agent can do
│   ├── SKILLS_BUILTIN.md        ← 8 built-in skills (all users)
│   └── SKILLS_MANIFEST.md       ← Index of all active skills + selection logic
│
│
├── users/                       ← Ring 2+3: Per-user state
│   └── {username}/
│       ├── identity.json              ← Name, timezone, device (set at onboarding)
│       ├── health-profile.json        ← Baselines (updated weekly)
│       ├── preferences.json           ← Communication prefs, goals, channels
│       ├── patterns.json              ← validated + emerging patterns (machine-readable)
│       ├── intelligence-summary.md    ← ~500 token prompt injection (weekly refresh)
│       ├── learning-log.md            ← Append-only discovery log
│       │
│       ├── memory/
│       │   ├── MEMORY_CORE.md         ← <200 tokens, always loaded
│       │   ├── MEMORY_PATTERNS.md     ← Natural language patterns (weekly refresh)
│       │   ├── MEMORY_GOALS.md        ← Active + inferred goals
│       │   └── MEMORY_FOLLOWUPS.md    ← Open follow-ups to close
│       │
│       ├── calibration/
│       │   ├── CALIBRATION_VERBOSITY.md  ← Message length setting + evolution log
│       │   ├── CALIBRATION_TIMING.md     ← Schedule, quiet hours, windows
│       │   └── CALIBRATION_TOPICS.md     ← Topic weights, what to emphasize/deprioritize
│       │
│       ├── skills/
│       │   └── SKILLS_USER.md         ← User-defined skills (overrides built-ins)
│       │
│       ├── evolution/
│       │   └── EVOLUTION_LOG.md       ← Behavioral parameter changes + signal log
│       │
│       └── heartbeat/
│           └── HEARTBEAT_USER.md      ← User-specific schedule + trigger overrides
│
│
└── [legacy flat files — see note below]
    ├── soul.md                  ← Superseded by soul/ directory
    ├── capabilities.md          ← Still used (23 capabilities index)
    ├── context-health.md        ← Still used (health interpretation rules)
    ├── context-schedule.md      ← Still used (calendar interpretation)
    ├── context-comms.md         ← Still used (email interpretation)
    ├── context-tasks.md         ← Still used (task interpretation)
    ├── metrics.md               ← Still used (32 metrics definitions)
    └── nudges.md                ← Still used (cross-source nudge templates)
```

---

## The 3 Rings

| Ring | Files | Who writes | Can evolve? |
|------|-------|-----------|-------------|
| Ring 1 | identity/, soul/, rules/, heartbeat/, operators/, onboarding/ | Humans only | Never (platform deploys) |
| Ring 2 | users/{user}/memory/, skills/, patterns.json, intelligence-summary.md | Agent writes via tools | Yes — weekly compaction |
| Ring 3 | users/{user}/calibration/, evolution/ | Agent writes via signals | Yes — feedback loop |

---

## Runtime: How Files Load

### System prompt assembly
1. IDENTITY.md + PRINCIPLES.md (cached, every invocation)
2. SOUL_BASE.md (cached 1h TTL)
3. Zone modifier soul file (SOUL_MORNING / SOUL_STRESS / etc.)
4. Operator config (OPERATOR_CONSUMER.md by default)
5. Relevant TOOLS_PERMISSIONS.md entry for this trigger
6. SECURITY.md sandwich defense (static, cached)

### User message assembly
1. MEMORY_CORE.md (always — <200 tokens)
2. intelligence-summary.md (always — ~500 tokens)
3. Today's biometric data (health adapter)
4. Calibration files (CALIBRATION_VERBOSITY + CALIBRATION_TOPICS)
5. Pending evolutions from EVOLUTION_LOG.md (merged into behavior)
6. On-demand: MEMORY_PATTERNS.md (pattern_reveal, data_explain)
7. On-demand: MEMORY_GOALS.md (planning contexts)
8. On-demand: MEMORY_FOLLOWUPS.md (follow-up close loops)

### Total prompt budget (approximate)
- Static cached block: ~800 tokens (soul + identity + rules) → cached, ~1/4 cost
- User context block: ~600 tokens (MEMORY_CORE + intelligence-summary + today's data)
- Dynamic block: ~400 tokens (patterns, goals, tool results)
- Agent output budget: ~200 tokens (BRIEF mode)
- **Total: ~2,000 tokens/invocation at BRIEF setting**

---

## Memory Update Cycle

| Frequency | What updates | Tool used |
|-----------|-------------|----------|
| Per invocation | MEMORY_CORE (if significant new fact) | update_memory |
| Per invocation | MEMORY_FOLLOWUPS (new follow-up added) | update_memory |
| Per week (Sunday) | MEMORY_PATTERNS (pattern promotion) | update_memory |
| Per week (Sunday) | intelligence-summary.md (full refresh) | update_memory |
| Per week (Sunday) | patterns.json (confidence + decay) | update_memory |
| Per week (Sunday) | learning-log.md (milestones) | update_memory |
| Per signal (3+) | EVOLUTION_LOG.md (pending evolutions) | update_memory |
| Per month | Decay check → archive stale patterns | update_memory |

---

## Adding a New User

1. Create `agent/users/{username}/` directory
2. Run `onboarding_interview` skill → populates identity.json, preferences.json, MEMORY_CORE.md, MEMORY_GOALS.md
3. Connect health adapter → health-profile.json populates from data
4. **Day 1-7**: SOUL_FIRST_WEEK active. Calibration files set to defaults.
5. **Day 14**: Chronotype identified. intelligence-summary.md first version generated.
6. **Day 30**: Long-term baselines stable. Pattern confidence increasing.
7. **Ongoing**: Weekly compaction keeps everything current. Evolution engine tunes behavior.

---

## Legacy Files Note

The flat `.md` files in the root `agent/` directory (`soul.md`, `capabilities.md`, `context-*.md`, `metrics.md`, `nudges.md`) predate the current directory structure. They are still valid and referenced by the agent. The new `soul/` directory ADDS to and OVERRIDES `soul.md` where there's a conflict — don't delete the legacy files until Phase D migration is complete.
