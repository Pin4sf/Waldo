# Waldo — Complete Connector Ecosystem

**Date:** April 8, 2026
**Purpose:** Every app, tool, and service Waldo can connect to. For product planning + homepage showcase.
**Stats:** 200+ tools | 27 categories | 47 with MCP servers | A2A protocol live

---

## The Big Picture

```
YOUR LIFE                          WALDO                         WHAT IT ENABLES
─────────                          ─────                         ───────────────
Body (20+ wearables)          ──→                           ──→  Nap Score, stress detection
Schedule (9 calendar tools)   ──→                           ──→  Meeting triage, focus protection
Communication (12 messaging)  ──→   Biological Intelligence  ──→  Channel delivery, alerts
Email (6 providers)           ──→        Engine              ──→  Communication stress index
Tasks (14 tools)              ──→                           ──→  Energy-fit prioritization
Music (10 services)           ──→                           ──→  Mood inference
Finance (12 platforms)        ──→                           ──→  Impulse spending guard
Smart Home (11 platforms)     ──→                           ──→  Sleep environment control
```

**Every new source makes Waldo exponentially smarter.** 10 sources = 375 unique cross-correlations.

---

## 1. WEARABLES & HEALTH DEVICES (27 tools)

### On-Device SDKs (Free, Direct)

| Name | Signals | API | Cost | MCP? |
|------|---------|-----|------|------|
| **Apple HealthKit** | HR, HRV (beat-to-beat RMSSD), sleep stages, SpO2, steps, wrist temp, VO2Max, ECG, respiratory rate, menstrual | iOS SDK (Swift) | Free | Yes (Open Wearables) |
| **Google Health Connect** | HR, HRV, sleep, steps, SpO2, nutrition, body measurements | Android Jetpack SDK | Free | Yes (Open Wearables) |
| **Samsung Health SDK** | HR, HRV, BIA body composition, blood pressure, ECG, sleep, SpO2 | Sensor SDK (Wear OS) + Health Connect | Free | Yes (Open Wearables) |

### Wearable Brands (Cloud APIs)

| Name | Signals | API | Cost | MCP? |
|------|---------|-----|------|------|
| **Oura Ring** | Sleep stages, nightly HRV, readiness, HR, body temp, SpO2 | REST v2, OAuth 2.0 | Free (5K req/5 min) | No |
| **WHOOP** | Recovery, strain, daily RMSSD, sleep, respiratory rate | REST v2, OAuth 2.0 | Free with membership | No |
| **Garmin** | HR, steps, sleep, stress, pulse-ox, activities | REST (Health API), webhooks, OAuth | Free (approved devs) | No |
| **Fitbit** | HR, sleep RMSSD, sleep stages, SpO2, activity | REST (migrating to Google Health API by Sep 2026) | Free (being deprecated) | No |
| **Google Health API** | Unified: Fitbit, Pixel Watch, Health Connect data | REST, OAuth 2.0 | Free (replaces Fitbit API) | No |
| **Withings** | Weight, blood pressure, body comp, sleep, activity, ECG, temp | REST v2, OAuth 2.0, webhooks | Free | No |
| **Polar** | HR, HRV, sleep, training load, VO2Max | AccessLink REST, OAuth 2.0 | Free (approved devs) | No |
| **Suunto** | Workouts, sleep, training load, GPS | REST (Cloud API) | Free | No |
| **Dexcom (CGM)** | Real-time continuous glucose | REST, OAuth 2.0 | Partnership required | No |
| **Abbott FreeStyle Libre** | Flash glucose (via LibreView) | REST, OAuth 2.0 | Partnership required | No |
| **Eight Sleep** | Sleep, bed temp, HRV, respiratory | Via Terra aggregator | Paid (via aggregator) | No |
| **Coros** | Activity, HR, sleep, GPS | Via Health Connect | Free (indirect) | No |
| **Amazfit / Zepp** | HR, sleep, SpO2, stress, activity | Zepp OS SDK; data via Health Connect | Free (indirect) | No |
| **Xiaomi Mi Band** | HR, sleep, steps, SpO2 | Via Health Connect (no public API) | Free (indirect) | No |
| **Biostrap** | HRV, sleep, respiratory, SpO2 | REST | Paid (enterprise) | No |
| **Google Pixel Watch** | HR, HRV, sleep, SpO2, skin temp, ECG | Via Health Connect | Free | No |

### Health Data Aggregators

| Name | Coverage | API | Cost | MCP? |
|------|----------|-----|------|------|
| **Open Wearables** | 7+ providers (Apple, Samsung, Garmin, Polar, Suunto, WHOOP, Oura) | REST, **MCP server**, React Native SDK | **Free (MIT, self-hosted)** | **Yes** |
| **Terra API** | 500+ sources (99% of wearables) | REST, webhooks, RN/Flutter SDK | $399/mo (100K credits) | No |
| **Junction (Vital)** | 300+ wearables + lab tests | REST, webhooks | $0.50/user/mo (min $300/mo) | No |
| **Sahha** | 300+ devices, AI health scores | REST, RN/Flutter SDK | Free sandbox + paid | No |
| **Spike API** | 500+ wearables & IoT sensors | REST, **MCP server** | Paid | **Yes** |
| **ROOK** | Apple Health, Health Connect | Mobile SDK | Free tier | No |

### Clinical / Medical

| Name | Data | API | Cost | MCP? |
|------|------|-----|------|------|
| **HL7 FHIR** | Standard health data exchange | RESTful (R4/R5) | Free (open standard) | No |
| **Epic (MyChart)** | Patient portal, clinical records | FHIR R4, SMART on FHIR | Partnership | No |
| **Cerner (Oracle Health)** | EHR data | FHIR R4, OAuth 2.0 | Partnership | No |
| **Apple Health Records** | Clinical data from hospitals (on iPhone) | HealthKit SDK (FHIR) | Free | No |
| **Google Cloud Healthcare** | FHIR, HL7v2, DICOM | REST, OAuth 2.0 | GCP pricing | No |
| **Nightscout** | Open-source CGM monitoring (diabetes) | REST (self-hosted) | Free (open source) | No |
| **Validic** | Clinical + consumer health aggregation | REST | Paid (enterprise) | No |

---

## 2. CALENDARS & SCHEDULING (9 tools)

| Name | Data | API | Cost | MCP? |
|------|------|-----|------|------|
| **Google Calendar** | Events, attendees, recurrence, availability | REST, OAuth 2.0, webhooks | Free (1M req/day) | **Yes** |
| **Microsoft Outlook Calendar** | Events, Teams integration | Graph REST, OAuth 2.0, webhooks | Free | **Yes** (via Microsoft MCP) |
| **Apple Calendar (EventKit)** | Native events, reminders | iOS/macOS SDK | Free (on-device) | No |
| **Calendly** | Scheduling events, availability | REST v2, OAuth 2.0, webhooks | Free tier + paid | No |
| **Cal.com** | Open-source scheduling | REST, webhooks, self-hostable | Free (open source) | **Yes** |
| **Reclaim.ai** | AI calendar management, habits | REST, OAuth | Free tier + paid | No |
| **Motion** | AI task + meeting scheduling | REST (limited) | Paid | No |
| **Clockwise** | *Shut down March 2026* | Discontinued | — | — |
| **Fantastical** | Calendar aggregation (Apple only) | No public API | — | No |

---

## 3. EMAIL (8 tools)

| Name | Data | API | Cost | MCP? |
|------|------|-----|------|------|
| **Gmail** | Messages, threads, labels, send | REST, OAuth 2.0 | Free (250 quota units/user/sec) | **Yes** |
| **Microsoft Outlook** | Email, calendar, contacts | Graph REST, OAuth 2.0 | Free | **Yes** |
| **Fastmail** | Email, contacts, calendars | JMAP, REST | Free with account | No |
| **Yahoo Mail** | Email access | IMAP/SMTP only | Free | No |
| **Nylas** | Unified email (Gmail, Outlook, Yahoo, IMAP) | REST, OAuth 2.0, webhooks | Free (5 accounts) + paid | No |
| **EmailEngine** | Self-hosted unified email API | REST, webhooks | Free (OSS) + paid | No |
| **Apple Mail** | No third-party API | — | — | No |
| **ProtonMail** | No third-party API | — | — | No |

---

## 4. MESSAGING & COMMUNICATION (13 tools)

| Name | Data | API | Cost | MCP? |
|------|------|-----|------|------|
| **Telegram** | Bot messaging, groups, inline keyboards | Bot API (REST), webhooks | Free | **Yes** |
| **WhatsApp Business** | Templates, media, messaging | Cloud API (REST), webhooks | Free (per-conversation pricing) | No |
| **Slack** | Channels, DMs, threads, canvases | REST, Events API, OAuth 2.0 | Free | **Yes** (official) |
| **Discord** | Channels, DMs, voice, threads | REST, WebSocket, OAuth 2.0, webhooks | Free | **Yes** |
| **Microsoft Teams** | Channels, chats, meetings | Graph REST, Bot Framework, webhooks | Free with M365 | **Yes** |
| **Google Chat** | Spaces, threads | REST, OAuth 2.0, webhooks | Free with Workspace | No |
| **Facebook Messenger** | Messaging, bots, templates | Platform API, webhooks | Free | No |
| **Line** | Messaging, rich menus | Messaging API, webhooks | Free (limited) + paid | No |
| **Matrix (Element)** | Decentralized messaging | Client-Server REST | Free (open source) | **Yes** |
| **Mattermost** | Team messaging (self-hosted) | REST v4, webhooks, OAuth 2.0 | Free (OSS) | No |
| **Signal** | No official API | — | — | No |
| **iMessage** | No public API | — | — | No |
| **WeChat** | Messaging (China) | Official Account API | Partnership | No |

---

## 5. TASK MANAGEMENT (14 tools)

| Name | Data | API | Cost | MCP? |
|------|------|-----|------|------|
| **Todoist** | Tasks, projects, labels | REST v2, OAuth 2.0, webhooks | Free | **Yes** (official) |
| **Notion** | Pages, databases, blocks | REST, OAuth 2.0, webhooks | Free (3 req/sec) | **Yes** (official) |
| **Linear** | Issues, projects, cycles | GraphQL, OAuth 2.0, webhooks | Free (5K req/hr) | **Yes** (official) |
| **Asana** | Tasks, projects, portfolios | REST, OAuth 2.0, webhooks | Free tier + paid | **Yes** (via Atlassian) |
| **Jira** | Issues, sprints, boards | REST v3, OAuth 2.0, webhooks | Free tier + paid | **Yes** (Atlassian) |
| **Trello** | Boards, lists, cards | REST, OAuth 1.0a, webhooks | Free | No |
| **ClickUp** | Tasks, spaces, docs | REST v2, OAuth 2.0, webhooks | Free tier + paid | No |
| **Monday.com** | Items, boards, columns | GraphQL, OAuth 2.0, webhooks | Paid ($10/user/mo+) | No |
| **Google Tasks** | Task lists, tasks | REST, OAuth 2.0 | Free | No |
| **Microsoft To Do** | Tasks, lists, steps | Graph REST, OAuth 2.0 | Free | **Yes** |
| **Basecamp** | To-dos, messages, schedules | REST, OAuth 2.0, webhooks | Paid | No |
| **Things 3** | Apple only, no REST API | URL scheme + AppleScript | — | No |
| **OmniFocus** | Apple only | Omni Automation (JS) | — | No |
| **Taskade** | Collaborative notes + tasks | REST | Paid | No |

---

## 6. MUSIC & AUDIO (10 tools)

| Name | Data | API | Cost | MCP? |
|------|------|-----|------|------|
| **Spotify** | Audio features (valence, energy, tempo), playback, history | REST Web API, OAuth 2.0 | Free (Premium required for dev since Feb 2026) | **Yes** |
| **Apple Music** | Catalog, playlists, playback | MusicKit (iOS SDK + JS), REST | Free | No |
| **YouTube Music** | Via YouTube Data API v3 | REST, OAuth 2.0 | Free (10K units/day) | No |
| **Last.fm** | Scrobbling, listening history, stats | REST | Free (API key) | No |
| **Tidal** | Catalog, playlists | REST, OAuth 2.0 | Free | No |
| **Deezer** | Catalog, playlists, charts | REST | Free (unlimited) | No |
| **SoundCloud** | Tracks, playlists | REST, OAuth 2.0 | Free tier + paid | No |
| **Pandora** | No public API | — | — | No |
| **Amazon Music** | No public API | — | — | No |
| **MusicAPI.com** | Unified API for 10+ streaming services | REST | Paid | No |

---

## 7. SCREEN TIME & DIGITAL WELLNESS (7 tools)

| Name | Data | API | Cost | MCP? |
|------|------|-----|------|------|
| **RescueTime** | App usage, productivity scores, categories | REST, OAuth 2.0 | Free tier + $12/mo | No |
| **ActivityWatch** | Open-source time tracker | REST (self-hosted) | Free (OSS) | **Yes** |
| **Android Digital Wellbeing** | App timers, focus mode | UsageStatsManager (Android SDK) | Free | No |
| **iOS Screen Time** | No third-party API | — | — | No |
| **Opal** | No API | — | — | No |
| **Freedom** | No API | — | — | No |
| **Cold Turkey** | No API | — | — | No |

---

## 8. FINANCE & BANKING (12 tools)

| Name | Data | API | Cost | MCP? |
|------|------|-----|------|------|
| **Plaid** | Bank accounts, transactions, balances, investments | REST, OAuth 2.0 | Free (200 calls) + paid | No |
| **YNAB** | Budgets, accounts, transactions | REST v1, OAuth 2.0 | Free (for subscribers) | No |
| **Splitwise** | Shared expenses, groups, debts | REST (OpenAPI), OAuth 2.0 | Free | No |
| **Teller** | Bank aggregation (US) | REST, OAuth 2.0 | Free tier + paid | No |
| **Yodlee** | 17K+ global institutions | REST, OAuth 2.0 | Paid (enterprise) | No |
| **Zerodha (Kite Connect)** | Stock trading, market data (India) | REST, webhooks | Paid | No |
| **Alpaca** | Stock trading, market data (US) | REST, WebSocket, OAuth 2.0 | Free (paper) + paid | No |
| **Stripe** | Payments, subscriptions | REST, webhooks, OAuth | Free (per transaction) | No |
| **Razorpay** | Payments (India) | REST, webhooks | Free (per transaction) | No |
| **Open Banking APIs** | Standardized bank data (PSD2/EU) | REST, OAuth 2.0 | Varies | No |
| **Robinhood** | Crypto trading only (official) | REST | Free (crypto only) | No |
| **SnapTrade** | Brokerage aggregation | REST, OAuth 2.0 | Paid | No |

---

## 9. FOOD & NUTRITION (15 tools)

| Name | Data | API | Cost | MCP? |
|------|------|-----|------|------|
| **FatSecret** | Food database, nutrition | REST, OAuth 1.0 | Free | No |
| **Nutritionix** | Natural language food API, restaurant data | REST | Free (1K calls/day) + paid | No |
| **Edamam** | Food database, recipe search, nutrition analysis | REST | Free tier + paid | No |
| **USDA FoodData Central** | Official US food composition | REST | Free (API key) | No |
| **Open Food Facts** | Crowdsourced (3M+ products) | REST | Free (OSS) | No |
| **MyFitnessPal** | 20M+ food database | REST (invite-only, not accepting new devs) | Invite-only | No |
| **Cronometer** | 84-nutrient tracking | No API | — | No |
| **Noom** | No API | — | — | No |
| **Yazio** | No API | — | — | No |
| **Uber Eats** | Order placement, tracking | REST | Partnership required | No |
| **DoorDash** | Delivery tracking | REST (DoorDash Drive) | Partnership | No |
| **Swiggy** | No public API | — | — | No |
| **Zomato** | Restaurant search, reviews | REST (via RapidAPI) | Free tier + paid | No |
| **KitchenHub** | Unified delivery API | REST | Paid | No |
| **Lose It!** | Via Health Connect sync | — | — | No |

---

## 10. TRANSPORTATION & LOCATION (11 tools)

| Name | Data | API | Cost | MCP? |
|------|------|-----|------|------|
| **Google Maps** | Directions, places, traffic, geocoding | REST, JS SDK | $200 free/mo + paid | No |
| **Apple Maps (MapKit)** | Directions, geocoding, Look Around | SDK + REST (Server API) | Free (500K calls/mo) | No |
| **Uber** | Rides, price estimates, trip status | REST, OAuth 2.0 | Free | No |
| **Lyft** | Rides, cost estimates | REST (Concierge), OAuth 2.0 | Free | No |
| **Ola** | Ride booking (India) | REST | Partnership | No |
| **Strava** | Activities, segments, routes, athlete stats | REST v3, OAuth 2.0, webhooks | Free (2K req/day) | **Yes** |
| **Komoot** | Route planning, tours | REST | Free (limited) | No |
| **Mapbox** | Maps, directions, geocoding | REST, SDKs | Free tier + paid | No |
| **HERE** | Routing, traffic, fleet | REST | Free tier + paid | No |
| **OpenStreetMap** | Geocoding, mapping | REST | Free (OSS) | No |
| **Transit APIs (GTFS)** | Public transit, real-time arrivals | GTFS standard | Free (open data) | No |

---

## 11. SMART HOME & IoT (11 tools)

| Name | Data | API | Cost | MCP? |
|------|------|-----|------|------|
| **Home Assistant** | 2,000+ integrations, full smart home control | REST, WebSocket, webhooks | Free (OSS) | **Yes** (official) |
| **Apple HomeKit** | Lights, locks, sensors, cameras | HomeKit SDK, Siri Shortcuts | Free | No |
| **Google Home** | Device control, 600M+ devices | Home APIs (SDK), REST, Matter | Free | No |
| **Amazon Alexa** | Skills, device control, routines | Alexa Skills Kit, Smart Home API | Free | No |
| **Samsung SmartThings** | Devices, automations, scenes | REST, OAuth 2.0, webhooks | Free | No |
| **Philips Hue** | Lights, scenes, rooms | REST (local + cloud), OAuth 2.0 | Free (local) | No |
| **IFTTT** | 800+ service automations | REST, webhooks | Free (2 applets) + $3.49/mo | No |
| **Matter Protocol** | Universal smart home standard | Local IP (Thread/Wi-Fi) | Free (standard) | No |
| **Nest (Google)** | Thermostat, cameras | Google Home APIs | Free | No |
| **Ring** | No official public API | Unofficial only | — | No |
| **Tuya** | White-label IoT devices | REST, Cloud Platform | Free tier + paid | No |

---

## 12. WEATHER & ENVIRONMENT (8 tools)

| Name | Data | API | Cost | MCP? |
|------|------|-----|------|------|
| **Open-Meteo** | Forecasts, historical, 1-11km resolution | REST | **Free (no API key, OSS)** | **Yes** |
| **OpenWeatherMap** | Weather, air pollution, solar | REST (One Call 3.0) | Free (1K calls/day) + paid | No |
| **Apple WeatherKit** | Forecasts, conditions, severe weather | REST + Swift SDK | Free (500K calls/mo) | No |
| **IQAir (AirVisual)** | AQI, pollutants, forecasts | REST | Free (5K calls/mo) + paid | No |
| **Tomorrow.io** | Hyperlocal weather | REST | Free (25 calls/hr) + paid | No |
| **Visual Crossing** | Historical + forecast | REST | Free (1K records/day) + paid | No |
| **OpenUV** | UV index, safe exposure times | REST | Free tier + paid | No |
| **BreezoMeter** | AQI, pollen, fires (now Google) | REST | Paid | No |

---

## 13. FITNESS & TRAINING (11 tools)

| Name | Data | API | Cost | MCP? |
|------|------|-----|------|------|
| **Strava** | Activities, segments, routes, clubs | REST v3, OAuth 2.0, webhooks | Free (2K req/day) | **Yes** |
| **Peloton** | Workouts, instructor data | Unofficial REST (community) | Unofficial | No |
| **TrainingPeaks** | Structured training, power/HR analytics | REST (approved devs) | Invite-only | No |
| **Wahoo** | Cycling sensors, HR | Cloud API, webhooks | Free (partnership) | No |
| **Nike Run Club** | Via Strava/Apple Health sync | No direct API | — | No |
| **Apple Fitness+** | Via HealthKit | iOS SDK | Free | No |
| **Hevy** | No API | — | — | No |
| **Strong** | No API | — | — | No |
| **JEFIT** | Exercise database | REST (limited) | Free tier | No |
| **Fitbod** | Via Apple Health sync | — | — | No |
| **Zwift** | No official API | — | — | No |

---

## 14. NOTES & KNOWLEDGE (11 tools)

| Name | Data | API | Cost | MCP? |
|------|------|-----|------|------|
| **Notion** | Pages, databases, blocks | REST, OAuth 2.0, webhooks | Free | **Yes** (official) |
| **Obsidian** | Markdown vault, links | Local REST plugin, file system | Free (OSS) | **Yes** |
| **Logseq** | Knowledge graph | Plugin API, file system | Free (OSS) | **Yes** |
| **Readwise** | Book highlights, Reader feed | REST, OAuth 2.0 | Free (for subscribers) | **Yes** |
| **Evernote** | Notes, notebooks, tags | REST, OAuth | Free tier + paid | No |
| **Google Keep** | No public API | — | — | No |
| **Apple Notes** | No public API | — | — | No |
| **Roam Research** | Backend API (limited) | Community wrappers | — | No |
| **Bear** | Apple only, no REST API | x-callback-url | — | No |
| **Mem AI** | AI-native notes | REST | Paid | No |
| **Taskade** | Collaborative notes | REST | Paid | No |

---

## 15. DEVELOPER & WORK TOOLS (9 tools)

| Name | Data | API | Cost | MCP? |
|------|------|-----|------|------|
| **GitHub** | Repos, PRs, issues, Actions | REST v3 + GraphQL v4, OAuth 2.0, webhooks | Free (5K req/hr) | **Yes** (official) |
| **GitLab** | Repos, MRs, CI/CD | REST v4, GraphQL, OAuth 2.0, webhooks | Free | No |
| **Vercel** | Deployments, projects, logs, env vars | REST, webhooks | Free tier + paid | **Yes** (official) |
| **Figma** | Design files, components, variables | REST, webhooks, OAuth 2.0 | Free + paid | **Yes** (official) |
| **Sentry** | Error tracking, performance | REST, webhooks, SDK | Free tier + paid | No |
| **PagerDuty** | Incidents, on-call | REST v2, webhooks | Paid | No |
| **Datadog** | Monitoring, metrics, logs | REST, webhooks | Paid | No |
| **Netlify** | Deployments, forms | REST, webhooks | Free tier + paid | No |
| **VS Code** | Extension API | TypeScript | Free | No |

---

## 16. SOCIAL MEDIA (14 tools)

| Name | Data | API | Cost | MCP? |
|------|------|-----|------|------|
| **YouTube** | Videos, playlists, channels | Data API v3, OAuth 2.0 | Free (10K units/day) | No |
| **Reddit** | Posts, comments, subreddits | REST, OAuth 2.0 | Free (100 queries/min) | **Yes** |
| **Twitter/X** | Tweets, DMs, timeline | REST v2, OAuth 2.0 | Free (15K reads/mo) + paid ($100-5K/mo) | **Yes** |
| **Bluesky** | Posts, feeds, social graph | AT Protocol (REST) | Free (open protocol) | **Yes** |
| **Instagram** | Media, insights, stories | Graph API, OAuth 2.0 | Free (requires Meta review) | No |
| **LinkedIn** | Profile, posts, connections | REST, OAuth 2.0 | Partnership (3-6 mo wait) | No |
| **TikTok** | Video, user data, analytics | REST, OAuth 2.0 | Free (approved devs) | No |
| **Facebook** | Pages, posts, insights | Graph API, OAuth 2.0 | Free (requires review) | No |
| **Threads** | Posts, replies | Threads API | Free | No |
| **Pinterest** | Pins, boards, analytics | REST v5, OAuth 2.0 | Free | No |

---

## 17. VIDEO CONFERENCING (5 tools)

| Name | Data | API | Cost | MCP? |
|------|------|-----|------|------|
| **Zoom** | Meetings, recordings, participants | REST, OAuth 2.0, webhooks, WebSocket | Free (rate-limited) | No |
| **Google Meet** | Meetings, media, recordings | REST + Media API (preview), OAuth 2.0 | Free with Workspace | No |
| **Microsoft Teams** | Meetings, chats, calling | Graph REST, Bot Framework, webhooks | Free with M365 | **Yes** |
| **Webex** | Meetings, messaging | REST, OAuth 2.0, webhooks | Free tier + paid | No |
| **Recall.ai** | Unified meeting bot (Zoom/Meet/Teams) | REST, webhooks | Paid | No |

---

## 18. CRM & NETWORKING (8 tools)

| Name | Data | API | Cost | MCP? |
|------|------|-----|------|------|
| **HubSpot** | Contacts, deals, tickets | REST v4, OAuth 2.0, webhooks | Free CRM + paid | **Yes** (official) |
| **Attio** | Contacts, companies, deals | GraphQL, OAuth 2.0, webhooks | Free tier + paid | **Yes** (official) |
| **Clay** | People enrichment | REST | Paid | **Yes** (official) |
| **Salesforce** | CRM, leads, opportunities | REST + SOAP + Bulk APIs, OAuth 2.0 | Paid | No |
| **Pipedrive** | Deals, contacts | REST, OAuth 2.0, webhooks | Paid | No |
| **Copper** | CRM for Google Workspace | REST, OAuth 2.0 | Paid | No |
| **Folk** | Lightweight CRM | REST | Paid | No |
| **LinkedIn Sales Nav** | No public API | — | — | No |

---

## 19. EDUCATION & LEARNING (7 tools)

| Name | Data | API | Cost | MCP? |
|------|------|-----|------|------|
| **Anki** | Spaced repetition, review stats | AnkiConnect plugin (local REST) | Free (OSS) | **Yes** |
| **Readwise** | Book highlights, articles | REST, OAuth 2.0 | Free (for subscribers) | **Yes** |
| **Duolingo** | Learning progress, streaks | Unofficial API only (fragile) | — | No |
| **Coursera** | Partner API only | — | — | No |
| **Khan Academy** | Deprecated | — | — | No |
| **Brilliant** | No API | — | — | No |
| **Quizlet** | REST (deprecated for new apps) | — | — | No |

---

## 20. ENTERTAINMENT & MEDIA (11 tools)

| Name | Data | API | Cost | MCP? |
|------|------|-----|------|------|
| **YouTube** | (Listed under Social) | — | — | No |
| **Pocket** | Saved articles, tags | REST, OAuth 2.0 | Free | No |
| **Trakt** | TV/movie watch tracking | REST, OAuth 2.0, webhooks | Free | No |
| **TMDB** | Movie/TV metadata | REST | Free (API key) | No |
| **Hardcover** | Book reviews (Goodreads alt) | GraphQL | Free | No |
| **Watchmode** | Streaming availability (200+ services) | REST | Free tier + paid | No |
| **Netflix** | No public API | — | — | No |
| **Kindle** | No API | — | — | No |
| **Audible** | No API | — | — | No |
| **Goodreads** | Deprecated (Dec 2020) | — | — | No |
| **Prime Video** | Content partners only | — | — | No |

---

## 21. CLOUD STORAGE (9 tools)

| Name | Data | API | Cost | MCP? |
|------|------|-----|------|------|
| **Google Drive** | Files, folders, sharing, revisions | REST v3, OAuth 2.0 | Free | **Yes** |
| **Dropbox** | Files, folders, Paper docs | REST v2, OAuth 2.0, webhooks | Free | No |
| **OneDrive** | Files, folders, sharing | Graph REST, OAuth 2.0 | Free with M365 | No |
| **Box** | Files, metadata, workflows | REST, OAuth 2.0, webhooks | Free (dev) + paid | No |
| **iCloud (CloudKit)** | Files | CloudKit JS + native SDK | Free | No |
| **AWS S3** | Object storage | REST, SDKs | Pay-per-use | No |
| **Cloudflare R2** | Object storage (free egress) | S3-compatible REST | Free (10GB) + paid | No |

---

## 22. SHOPPING (5 tools)

| Name | Data | API | Cost | MCP? |
|------|------|-----|------|------|
| **Amazon (SP-API)** | Products, orders (seller) | REST, OAuth 2.0 | Free (for sellers) | No |
| **Amazon (PA-API)** | Product search, pricing (affiliate) | REST | Free (with affiliate) | No |
| **Flipkart** | Orders, products (seller) | REST v3, OAuth 2.0 | Free (for sellers) | No |
| **Shopify** | Orders, products, customers | REST + GraphQL, OAuth 2.0 | Free (for stores) | No |
| **API2Cart** | Unified e-commerce (60+ platforms) | REST | Paid | No |

---

## 23. AI AGENTS & MODELS (11 tools)

| Name | Role | API | Cost | MCP? |
|------|------|-----|------|------|
| **Anthropic (Claude)** | Primary LLM — Haiku 4.5 for MVP | REST, TS/Python SDK, Agent SDK | Paid (token) | Created MCP |
| **OpenAI (GPT-4o)** | Fallback / multi-model | REST, TS/Python SDK | Paid (token) | **Yes** |
| **Google Gemini** | Fallback / multi-model | REST, Vertex AI SDK | Free tier + paid | **Yes** |
| **DeepSeek** | Cheap reasoning | REST (OpenAI-compatible) | Paid (very cheap) | No |
| **Groq** | Ultra-fast inference | REST (OpenAI-compatible) | Free tier + paid | No |
| **Ollama** | Local LLM inference | REST (local), CLI | Free (OSS) | **Yes** |
| **Mistral** | European LLM option | REST | Paid (token) | No |
| **Cohere** | Enterprise LLMs, RAG, reranking | REST, SDK | Free tier + paid | No |
| **Perplexity** | Web search + LLM | REST (OpenAI-compatible) | Paid (token) | No |
| **Lindy** | No-code AI agent builder | Web platform | Paid | No |
| **Manus** | Autonomous agent (acquired by Meta) | Waitlist | — | No |

---

## 24. MEDITATION & MINDFULNESS (6 tools)

| Name | Data | API | Cost | MCP? |
|------|------|-----|------|------|
| **Apple Mindfulness** | Mindful minutes from Apple Watch | Via HealthKit | Free | No |
| **Headspace** | Invite-only API + Apple Health sync | — | — | No |
| **Calm** | Invite-only API + Apple Health sync | — | — | No |
| **Insight Timer** | No API | — | — | No |
| **Waking Up** | No API | — | — | No |
| **Balance** | No API | — | — | No |

---

## 25. PROTOCOLS & AUTOMATION (9 tools)

| Name | What | API | Cost | MCP? |
|------|------|-----|------|------|
| **MCP** | Universal tool protocol (97M+ SDK downloads/mo, 12K+ servers) | JSON-RPC, TS/Python SDK | Free (OSS, Linux Foundation) | **IS the protocol** |
| **A2A** | Agent-to-agent protocol (150+ orgs, v1.0 stable) | JSON-RPC 2.0 over HTTP(S) | Free (OSS, Linux Foundation) | Complementary |
| **Zapier** | 8,000+ app automations | REST, webhooks | Free (100 tasks/mo) + $20/mo | **Yes** (official) |
| **n8n** | Self-hosted automation, AI agents | REST, webhooks, code nodes | Free (OSS) + cloud paid | **Yes** (official) |
| **Pipedream** | Developer-first automation | REST, webhooks | Free tier + paid | No |
| **Make.com** | Visual automation (1,800+ apps) | REST, webhooks | Free (1K ops/mo) + $9/mo | No |
| **IFTTT** | 800+ services | REST, webhooks | Free (2 applets) + $3.49/mo | No |
| **Trigger.dev** | Durable TypeScript background jobs | REST | Free tier + paid | **Yes** (official) |
| **APIAgent (Agoda)** | Convert any REST/GraphQL API → MCP server (zero code) | MCP generator | Free (OSS) | **Yes** (generates MCPs) |

---

## Summary

| Category | Tools | With API | With MCP |
|----------|-------|----------|----------|
| Wearables & Health | 27 | 15 | 2 |
| Health Aggregators | 6 | 6 | 2 |
| Clinical / Medical | 7 | 5 | 0 |
| Calendars | 9 | 7 | 3 |
| Email | 8 | 6 | 2 |
| Messaging | 13 | 11 | 5 |
| Task Management | 14 | 12 | 6 |
| Music & Audio | 10 | 7 | 1 |
| Screen Time | 7 | 2 | 1 |
| Finance & Banking | 12 | 10 | 0 |
| Food & Nutrition | 15 | 6 | 0 |
| Transportation | 11 | 9 | 1 |
| Smart Home & IoT | 11 | 9 | 1 |
| Weather | 8 | 8 | 1 |
| Meditation | 6 | 1 | 0 |
| Fitness & Training | 11 | 4 | 1 |
| Notes & Knowledge | 11 | 5 | 4 |
| Developer Tools | 9 | 9 | 3 |
| Social Media | 14 | 11 | 3 |
| Travel | 9 | 4 | 0 |
| Video Conferencing | 5 | 5 | 1 |
| CRM | 8 | 7 | 3 |
| Education | 7 | 2 | 2 |
| Entertainment | 11 | 6 | 0 |
| Cloud Storage | 9 | 8 | 1 |
| Shopping | 5 | 5 | 0 |
| AI Agents & Models | 11 | 11 | 4 |
| Protocols & Automation | 9 | 9 | 5 |
| **TOTAL** | **213+** | **~196** | **47** |

---

## Homepage Showcase Priority (Recommended)

### Tier 1 — Show on homepage NOW (built or building)
Apple Watch, Google Health Connect, Samsung Galaxy Watch, Oura, WHOOP, Fitbit, Garmin, Withings, Polar — Google Calendar, Outlook — Gmail — Telegram, WhatsApp, Slack, Discord — Todoist, Notion, Linear — Spotify — Open-Meteo

### Tier 2 — Show as "Coming Soon" (high value, APIs ready)
Dexcom (CGM), Eight Sleep — Cal.com, Reclaim.ai — Microsoft Teams — Asana, Jira, ClickUp — Apple Music, YouTube Music — RescueTime — Plaid, YNAB — Strava — Home Assistant, Philips Hue — Zoom, Google Meet

### Tier 3 — Show as "Future" (aspirational, builds excitement)
MCP body API, A2A protocol — Uber, Google Maps — Nutritionix, Open Food Facts — Smart home ecosystem — Anki (study timing) — Pack tier (family/team dashboards)

---

## Key Strategic Notes

1. **Open Wearables SDK** (MIT, React Native, $0) could replace custom native modules. Evaluate if it exposes raw IBI data for RMSSD computation.
2. **A2A protocol is LIVE** (v1.0, March 2026, 150+ orgs). Waldo as A2A agent = other agents delegate biological queries to us.
3. **Spotify locked dev mode** (Feb 2026) — requires Premium + approval for extended quota. Plan for this.
4. **Google Fit is dead.** All Android data now via Health Connect. Fitbit Web API dies Sep 2026.
5. **Clockwise shut down** (Mar 2026, acquired by Salesforce). Remove from any references.
6. **APIAgent** (Agoda, OSS) can convert ANY REST API to MCP server with zero code. Useful for rapid connector expansion.
7. **Zapier MCP server** gives access to 8,000+ apps through a single integration point. Evaludate for long-tail connectors.
