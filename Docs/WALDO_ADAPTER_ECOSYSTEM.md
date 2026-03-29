# Waldo adapter ecosystem — technical specification

## Overview

Waldo uses 10 adapter interfaces across 6 dimensions of a person's life. Every external integration goes through an adapter — agent logic never references a specific provider. Adding a new integration = implement the interface. No changes to CRS, prompt builder, or agent reasoning.

```
User's Life
  ├── Body         → HealthDataSource     → Apple Watch, Oura, Fitbit, WHOOP
  ├── Schedule     → CalendarProvider     → Google Calendar, Outlook, Apple Calendar
  ├── Communication→ EmailProvider        → Gmail, Outlook (metadata only)
  ├── Tasks        → TaskProvider         → Todoist, Notion, Linear, Google Tasks
  ├── Mood         → MusicProvider        → Spotify, YouTube Music, Apple Music
  ├── Screen       → ScreenTimeProvider   → RescueTime
  ├── Environment  → WeatherProvider      → Open-Meteo (weather + AQI)
  ├── Storage      → StorageAdapter       → op-sqlite + SQLCipher
  ├── AI           → LLMProvider          → Claude Haiku, multi-model
  └── Delivery     → ChannelAdapter       → Telegram, WhatsApp, Discord, Slack, In-App
```

---

## Dimension 1: Body (HealthDataSource)

### Providers
| Provider | API | Cost | Signals |
|----------|-----|------|---------|
| Apple Watch (HealthKit) | Native | Free | HR, HRV (beat-to-beat RMSSD), sleep stages, SpO2, steps, wrist temp, VO2Max |
| Health Connect (Android) | Native | Free | HR, HRV (no Samsung), sleep, steps, SpO2 |
| Oura | REST API | Free | Sleep, nightly HRV, readiness, HR, temp |
| Fitbit | Web API | Free | HR, sleep-only RMSSD, sleep stages, SpO2 |
| WHOOP | API | Free | Recovery, strain, daily RMSSD, sleep, respiratory |

### 10 Metrics

**CRS (Cognitive Readiness Score)** — 0-100
```
CRS = (Sleep × 0.35) + (HRV × 0.25) + (Circadian × 0.25) + (Activity × 0.15)
```

**Sleep Score** — 0-100
```
Start at 100. Subtract:
  <6h: -15/hour. 6-7h: -10/hour. >9.5h: -5
  Deep <8%: -20. <13%: -10. REM <20%: -8
  Efficiency <85%: proportional. Bedtime shift >60min: -10. >120min: -20
  Sleep debt (7d rolling): -5/hour deficit, max -30
```

**HRV Score** — 0-100
```
RMSSD computed from raw beats → time-of-day normalized (6-block ratios)
→ compared to 7-day EMA baseline (alpha=0.3)
  >+15% above baseline → 90. Within ±5% → 70. <-25% → 20
  Trend bonus: 7d vs 30d improving → +5
```

**Day Strain** — 0-21
```
TRIMP: time in each HR zone × weight [1.0, 1.5, 2.5, 4.0, 8.0]
Log-scaled: strain = min(21, log10(trimp + 1) × 7)
  0-4: rest. 4-10: low. 10-14: medium. 14-18: high. 18+: overreaching
```

**Sleep Debt** — 0-20h
```
14-day weighted rolling: debt += max(0, 7.5h - actual) × recency_weight
Repayment at 0.5x rate. Direction: accumulating / paying off / stable
```

**Stress Confidence** — 0.0-1.0
```
0.35 × HRV_drop + 0.25 × HR_elevation + 0.20 × duration + 0.20 × sedentary
  ≥0.60: Fetch Alert fires. ≥0.80: HIGH alert. <0.40: ignore
  2h cooldown. Max 3/day. Must sustain 10+ minutes.
```

Plus: Circadian Score, Activity Score, Resilience (14-day stability), Recovery-Load Balance.

---

## Dimension 2: Schedule (CalendarProvider)

### Providers
| Provider | API | Cost | Data format |
|----------|-----|------|------------|
| Google Calendar | REST API / Takeout .ics | Free (1M req/day) | Events with attendees, recurrence, duration |
| Microsoft Outlook | Graph API | Free | Same + Teams integration |
| Apple Calendar | EventKit (iOS) | Free | Native on-device |

### 5 Metrics

**Meeting Load Score (MLS)** — 0-15+
```
Per meeting: (duration/30min) × adjacency_factor × attendee_factor × time_factor
  adjacency: 1.0 (>15min gap), 1.4 (5-15min), 1.8 (back-to-back)
  attendees: 1.0 + 0.05 × max(count - 3, 0)
  time: 0.8 (morning peak), 1.0 (midday), 1.2 (post-lunch)
Daily MLS = sum of all meetings
  0-3: light. 3-6: moderate. 6-10: heavy. 10+: overloaded
```

**Focus Time Score** — 0-8h
```
Scan for gaps ≥90 minutes. Score each:
  duration_base × circadian_alignment × preceding_gap_quality
  circadian: 1.3 (peak), 1.0 (neutral), 0.7 (trough)
  gap_quality: 1.0 (>15min transition), 0.7 (<5min after meeting)
```

Plus: Back-to-Back Count, Boundary Violations, Schedule Density.

---

## Dimension 3: Communication (EmailProvider)

### Providers
| Provider | API | Cost | Privacy |
|----------|-----|------|---------|
| Gmail | REST API / Takeout .mbox | Free | Headers only, never body content |
| Microsoft Outlook | Graph API | Free | Headers only |

### 5 Metrics

**Communication Stress Index (CSI)** — 0-100
```
volume_deviation × 0.3 + response_pressure × 0.3
  + after_hours_ratio × 0.2 + thread_fragmentation × 0.2
```

**Response Pressure** — 0-1.0: unanswered >2h / total inbox
**After-Hours Ratio** — 0-1.0: messages outside 8am-7pm / total
**Volume Spike** — 0.5-3x: today / 30-day average
**Thread Depth** — 1-20: avg replies per conversation

---

## Dimension 4: Tasks (TaskProvider)

### Providers
| Provider | API | Cost |
|----------|-----|------|
| Google Tasks | REST API / Takeout JSON | Free |
| Todoist | REST + Sync API | Free |
| Notion | REST API | Free |
| Linear | GraphQL API | Free |
| Microsoft To Do | Graph API | Free |

### 5 Metrics

**Task Pile-Up** — overdue count (0-50)
**Completion Velocity** — completed / created per day (0-2.0)
**Procrastination Index** — avg days creation → completion (0-30)
**Urgency Queue** — due within 24h count (0-10)
**Task-Energy Match** — hard tasks during CRS peak / total hard tasks (0-100%)

---

## Dimension 5: Mood & Screen (MusicProvider + ScreenTimeProvider)

### Providers
| Provider | API | Cost |
|----------|-----|------|
| Spotify | Web API (OAuth) | Free |
| YouTube Music | Takeout JSON | Free |
| RescueTime | REST API | Free |

### 4 Metrics

**Mood Score** — 0-100: Spotify audio valence × energy weighted
**Screen Time Quality** — 0-100%: productive / total screen hours
**Late-Night Digital** — 0-3h: screen/music after 10pm
**Focus Session Count** — 0-10: uninterrupted 25min+ blocks

---

## Dimension 6: Combined (Master Metrics)

**Daily Cognitive Load** — 0-100
```
normalize(MLS) × 0.25 + normalize(CSI) × 0.25
  + normalize(Task Pile-Up) × 0.20 + normalize(Sleep Debt impact) × 0.30
The single "how overloaded is this person" number.
```

**Burnout Trajectory Score** — -1 to +1
```
30-day rolling slopes:
  HRV_baseline_slope × 0.35 + sleep_debt_trend × 0.25
  + after_hours_trend × 0.20 + MLS_trend × 0.20
  > 0.6 = burnout trajectory. < -0.3 = recovering.
```

**Waldo Intelligence Score** — 0-100
```
(connected_sources / 10) × (metric_coverage) × (pattern_confidence)
More sources = exponentially more cross-correlations.
C(10,2)=45 pairs, C(10,3)=120 triples. Total: 375 unique correlations.
```

---

## 23 Agent capabilities

### Proactive (Waldo speaks first) — 11
1. Enhanced Morning Wag (health + schedule + tasks)
2. Pre-meeting energy prep
3. Back-to-back circuit breaker
4. Focus block protection
5. Sleep debt alarm
6. Communication overwhelm alert
7. Weekly pattern breaker (e.g., Monday syndrome)
8. Burnout trajectory warning (30-day)
9. Post-exercise cognitive boost window
10. Evening review (all dimensions)
11. Weekend recovery forecast

### Automation (Waldo acts) — 6
12. Task scheduling by CRS-optimal timing
13. Meeting rescheduling suggestions
14. Auto-DND on Slack during focus/low-CRS
15. Recovery day enforcement
16. Communication batching
17. Sleep optimization (screen time nudge)

### Learning (Waldo gets smarter) — 6
18. Meeting → stress correlation
19. Music → mood → CRS link
20. Coding time vs cognitive state
21. Email → sleep causation
22. Screen time → recovery correlation
23. Task completion timing patterns

---

## Cross-source correlation math

10 data sources. 375 unique 2/3/4-way combinations. Each produces Spots, Patterns, Nudges, or Automations.

Theoretical capability space: **1,500 unique agent behaviors.**
Practical meaningful behaviors: **~80-100.**

Every new data source multiplies intelligence exponentially, not linearly.
