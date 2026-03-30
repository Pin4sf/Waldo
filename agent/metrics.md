# Waldo metrics — all 32 computed scores

## Body (10)
| Metric | Range | Formula summary | When to reference |
|--------|-------|----------------|-------------------|
| CRS (Nap Score) | 0-100 | S×0.35 + H×0.25 + C×0.25 + A×0.15 | Always — it's the hero number |
| Sleep Score | 0-100 | 100 minus penalties (duration, deep, REM, efficiency, consistency, debt) | Morning Wag, sleep discussions |
| HRV Score | 0-100 | RMSSD deviation from time-adjusted 7d baseline | When explaining CRS drivers |
| Circadian Score | 0-100 | Wake alignment with chronotype + bedtime regularity | When schedule is misaligned |
| Activity Score | 0-100 | Steps + exercise + sedentary | When activity is notably high/low |
| Day Strain | 0-21 | TRIMP (HR zones × exponential weights, log-scaled) | Evening review, recovery advice |
| Sleep Debt | 0-20h | 14-day weighted rolling deficit vs 7.5h need | When debt >2h or accumulating |
| Stress Confidence | 0-1.0 | HRV drop×0.35 + HR elev×0.25 + duration×0.20 + sedentary×0.20 | Fetch Alerts only |
| Resilience | 0-100 | CRS stability×0.40 + HRV trend×0.35 + stress recovery×0.25 | Weekly reviews, burnout context |
| Recovery-Load Balance | 0-2.0 | (Sleep + HRV recovery) / (Strain + stress) | When sustained imbalance |

## Schedule (5)
| Metric | Range | When to reference |
|--------|-------|-------------------|
| Meeting Load Score (MLS) | 0-15 | Morning Wag, schedule warnings |
| Focus Time | 0-8h | When suggesting deep work |
| Back-to-Back Count | 0-10 | When ≥2 consecutive |
| Boundary Violations | 0-5 | When meetings intrude on personal time |
| Schedule Density | 0-100% | When >60% consumed by meetings |

## Communication (5)
| Metric | Range | When to reference |
|--------|-------|-------------------|
| Communication Stress Index | 0-100 | When overwhelm detected |
| Response Pressure | 0-1.0 | When many unanswered threads |
| After-Hours Ratio | 0-1.0 | When >30% |
| Volume Spike | 0.5-3x | When >1.5x normal |
| Thread Depth | 1-20 | High = context switching |

## Tasks (5)
| Metric | Range | When to reference |
|--------|-------|-------------------|
| Task Pile-Up | 0-50 | When >10 overdue |
| Completion Velocity | 0-2.0 | When falling behind |
| Procrastination Index | 0-30d | When avg completion time growing |
| Urgency Queue | 0-10 | When due-today count is high |
| Task-Energy Match | 0-100% | When hard tasks at wrong time |

## Mood & Screen (4)
| Metric | Range | When to reference |
|--------|-------|-------------------|
| Mood Score | 0-100 | When Spotify data available |
| Screen Time Quality | 0-100% | When RescueTime connected |
| Late-Night Digital | 0-3h | When screen time disrupts sleep |
| Focus Sessions | 0-10 | When tracking deep work execution |

## Combined (3)
| Metric | Range | Formula | When to reference |
|--------|-------|---------|-------------------|
| Daily Cognitive Load | 0-100 | MLS×0.25 + CSI×0.25 + Tasks×0.20 + Debt×0.30 | Daily overview |
| Burnout Trajectory | -1 to +1 | HRV slope×0.35 + sleep trend×0.25 + email×0.20 + MLS×0.20 | When >0.3 (warning) |
| Intelligence Score | 0-100 | Sources×30 + days×30 + patterns×20 + cross-source×20 | Constellation page |
