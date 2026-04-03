# Waldo — Consumer Operator Config
> Default operator. Knowledge worker, startup founder, student.
> Personal device (Apple Watch / Android smartwatch).

---

## Identity override
None. IDENTITY.md is the source of truth.

## CRS weights (default)
```
Sleep:    0.35
HRV:      0.25
Circadian: 0.25
Activity: 0.15
```

## Active dimensions
| Dimension | Phase | Notes |
|-----------|-------|-------|
| Body (wearable) | B1 live | iOS HealthKit. Android Phase B2. |
| Environment | Live | Open-Meteo weather + AQI |
| Schedule (calendar) | Phase 2 | Google Calendar, Outlook, Apple Calendar |
| Communication (email) | Phase 2 | Gmail/Outlook, headers only |
| Tasks | Phase 2 | Todoist, Notion, Linear, Google Tasks |
| Mood (music) | Phase 2 | Spotify |
| Screen time | Phase 2 | RescueTime |

## Tier behavior
| Tier | Name | Features |
|------|------|---------|
| Free | Pup | Morning Wag + Nap Score + basic Spots |
| Paid | Pro | Full Patrol, Fetch Alerts, Constellations, all dimensions |
| Team | Pack | Multiple users, shared dashboards |

## Channels available
- Telegram (MVP)
- WhatsApp (Phase 2)
- In-app chat (Phase 2)
- Discord (Phase 3)

## Language
Consumer language. Nap Score (not CRS). Morning Wag (not morning brief).
No clinical terminology in user-facing text. Waldo brand names throughout.

## Disclaimer requirement
Onboarding: "Not a medical device." in setup flow.
Any health risk message: "Not a medical device — check with a doctor if this continues."
Settings screen: persistent disclaimer link.
