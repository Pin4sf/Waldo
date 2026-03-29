# Personal Data Source Research — What An AI Agent Can Tap Into

> Last updated: 2026-03-28
> Purpose: Comprehensive research on every major data source a person generates, API availability, and what Waldo (or any personal AI agent) can derive from each.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| **API: YES (free)** | Free API available, no paid plan required for core data |
| **API: YES (paid)** | API exists but requires paid plan for meaningful access |
| **API: LIMITED** | Partial access, severe restrictions, or unofficial only |
| **API: NO** | No programmatic access available |
| **Difficulty: EASY** | Standard REST/GraphQL, good docs, OAuth, <1 day to integrate |
| **Difficulty: MEDIUM** | Requires approval process, complex auth, or platform-specific SDK |
| **Difficulty: HARD** | No official API, scraping required, native-only, or policy risk |

---

## 1. COMMUNICATION

### 1.1 WhatsApp
- **API:** YES (paid) — WhatsApp Business API via Meta. Free for service replies within 24h window; all other messages are per-message paid. Requires Business Solution Provider (BSP).
- **Key data:** Messages (text, media, reactions), timestamps, read receipts, contact info, group metadata.
- **What an agent derives:** Communication frequency, emotional tone of conversations, response latency (stress proxy), social graph activity patterns, late-night messaging (sleep disruption signal).
- **Difficulty:** HARD — Requires BSP partnership, Meta Business verification, per-message costs. No access to personal WhatsApp chat history via API. Chat export (manual .txt) is the only way to get historical data.
- **Alternative:** Manual chat export (.txt file) contains timestamps + messages. Parseable but not real-time.

### 1.2 Slack
- **API:** YES (free) — Bot API with generous free tier. OAuth2 scopes control access.
- **Key data:** Messages, channels, threads, reactions, user presence/status, file uploads, message timestamps, edit history.
- **What an agent derives:** Work communication load, after-hours messaging patterns, context-switching frequency (channel hopping), collaboration intensity, response time to teammates.
- **Difficulty:** EASY — Well-documented REST + Events API. Rate limits: Tier 3 for most endpoints. Free plan limits message history to 90 days. Conversations.history returns messages with reactions, threads, timestamps.
- **Caveat:** As of March 2026, non-Marketplace apps limited to 15 objects per conversations.history call.

### 1.3 Microsoft Teams
- **API:** YES (free for most, paid for export) — Via Microsoft Graph API. Calendar, presence, chat messages accessible. Teams Export API is monetized/premium.
- **Key data:** Chat messages, channel messages, meeting schedules, user presence/availability status, team membership, file sharing.
- **What an agent derives:** Meeting overload detection, presence patterns (available/busy/DND cycles), communication volume, cross-team collaboration frequency.
- **Difficulty:** MEDIUM — Graph API is well-documented but Teams-specific endpoints require specific permissions and admin consent. Export APIs require paid licensing.

### 1.4 Telegram
- **API:** YES (free) — Fully free Bot API, no rate limits for most operations, no payment required.
- **Key data:** Messages (text, media, stickers, reactions), chat metadata, user profiles, group/channel info, message timestamps, bot interactions.
- **What an agent derives:** Messaging patterns, social activity timing, content consumption from channels, group engagement levels.
- **Difficulty:** EASY — Best-in-class bot API. Fully free, excellent docs, webhook support. One limitation: bots cannot access message history from before they joined a chat. Real-time only going forward.
- **Note:** Telegram also has a Client API (TDLib/MTProto) for full account access including history — more powerful but harder to use.

### 1.5 Discord
- **API:** YES (free) — Bot API with full message access in servers where bot is added.
- **Key data:** Messages, voice channel activity, user presence/status, server membership, reactions, threads, activity status (what game/app user is running).
- **What an agent derives:** Social/gaming activity patterns, late-night voice chat (sleep signal), community engagement, gaming hours, real-time activity tracking (Spotify listening, game playing).
- **Difficulty:** EASY — Well-documented, free, WebSocket-based for real-time events. Message Content requires Privileged Intent for verified bots in 100+ member servers. Unverified bots have full access.

### 1.6 iMessage
- **API:** NO (official) / LIMITED (unofficial)
- **Key data:** Messages, timestamps, attachments, read receipts, tapbacks/reactions, group chats.
- **What an agent derives:** Personal communication patterns, response times, social engagement, late-night messaging.
- **Difficulty:** HARD — No official Apple API. Unofficial tools exist (imsg CLI, iMessage-Kit) that read the local Messages SQLite database on macOS and send via AppleScript. Apple has signaled crackdown on unofficial access by June 2026. Privacy risk.
- **Alternative:** macOS Messages database at `~/Library/Messages/chat.db` is a SQLite file readable locally. Works for read-only analysis on Mac.

---

## 2. PRODUCTIVITY

### 2.1 Notion
- **API:** YES (free) — REST API, free for all Notion plans including free tier.
- **Key data:** Pages, databases, blocks (paragraphs, to-dos, headings), properties, comments, users, page history, database views (new in 2026).
- **What an agent derives:** Task completion velocity, knowledge base growth, writing patterns, project status, planning vs. execution ratio, content creation cadence.
- **Difficulty:** EASY — REST API with OAuth2 or internal integration tokens. Latest API version 2026-03-11. Well-documented, active development. Rate limit: 3 requests/second.

### 2.2 Linear
- **API:** YES (free) — GraphQL API, free on all plans including free tier.
- **Key data:** Issues (title, description, status, priority, assignee, labels, estimates), projects, cycles, milestones, comments, attachments, webhooks.
- **What an agent derives:** Sprint velocity, bug vs. feature ratio, task completion patterns, blocked item detection, workload distribution, project health.
- **Difficulty:** EASY — GraphQL API with personal API keys or OAuth2. Webhooks for real-time updates. Free tier supports up to 4 team members.

### 2.3 Jira
- **API:** YES (free) — REST API, free on Jira Cloud free tier (up to 10 users).
- **Key data:** Issues (all fields), projects, sprints, boards, workflows, comments, attachments, worklogs, JQL search, changelogs.
- **What an agent derives:** Sprint health, workload per person, issue cycle time, blocker patterns, estimation accuracy, overtime work patterns (from worklog timestamps).
- **Difficulty:** EASY — Comprehensive REST API. JQL for powerful querying. OAuth 2.0 or API tokens. Free tier: 10 users, 2GB storage.

### 2.4 Todoist
- **API:** YES (free) — REST API v2 + Sync API v9, free for all account types.
- **Key data:** Tasks (content, due dates, priority, labels, project), projects, sections, comments, activity log, completed tasks.
- **What an agent derives:** Task completion rate, overdue task patterns, priority distribution, procrastination detection (tasks repeatedly rescheduled), productivity time-of-day patterns.
- **Difficulty:** EASY — Clean REST API, personal API tokens, rate limit 1000 req/15min. Sync API enables incremental state sync. Some premium features restricted on free accounts.

### 2.5 Asana
- **API:** YES (free) — REST API, available on free tier.
- **Key data:** Tasks, projects, sections, tags, custom fields, stories (activity feed), attachments, workspaces, teams, goals.
- **What an agent derives:** Project progress velocity, task assignment patterns, collaboration graph, deadline adherence, workload balance.
- **Difficulty:** EASY — REST API with OAuth2 or Personal Access Tokens. 300+ native integrations. Free tier: 10 users, unlimited projects.

### 2.6 Trello
- **API:** YES (free) — REST API, available on free tier.
- **Key data:** Boards, lists, cards (title, description, due dates, checklists, attachments, labels, members), actions (activity log), custom fields.
- **What an agent derives:** Kanban flow velocity, bottleneck detection (cards stuck in columns), task completion patterns, collaboration activity.
- **Difficulty:** EASY — Simple REST API with API key + token auth. Free tier: 10 boards per workspace, 1 Power-Up per board, 250 automation runs/month.

### 2.7 Apple Reminders
- **API:** LIMITED (native only) — EventKit framework on iOS/macOS.
- **Key data:** Reminder lists, individual reminders (title, notes, due date, priority, completion status, location trigger, recurrence).
- **What an agent derives:** Personal task management patterns, reminder completion rates, location-based activity, daily routine structure.
- **Difficulty:** MEDIUM — Requires native iOS/macOS app using EventKit. No REST API. MCP servers now exist for macOS access. Permission prompt required.

### 2.8 Microsoft To Do
- **API:** YES (free) — Via Microsoft Graph API (To Do tasks endpoint).
- **Key data:** Task lists, tasks (title, body, due date, importance, status, recurrence, steps/subtasks, linked resources, categories).
- **What an agent derives:** Personal task patterns, completion velocity, priority management, recurring task adherence.
- **Difficulty:** EASY — Microsoft Graph API, well-documented. Free with any Microsoft account. OAuth2 with delegated permissions.

---

## 3. CALENDAR / SCHEDULING

### 3.1 Apple Calendar
- **API:** LIMITED (native only) — EventKit framework on iOS/macOS. Also CalDAV protocol for server-side.
- **Key data:** Events (title, location, start/end time, attendees, recurrence, alerts, notes, calendar/category), all-day events, travel time.
- **What an agent derives:** Meeting density, free time blocks, meeting-to-deep-work ratio, schedule regularity, travel patterns, over-scheduling detection.
- **Difficulty:** MEDIUM — Native EventKit for iOS/macOS apps. CalDAV for server-side sync (iCloud CalDAV). No REST API. MCP servers available for macOS.

### 3.2 Microsoft Outlook Calendar
- **API:** YES (free) — Microsoft Graph API. Calendar endpoints are fully free.
- **Key data:** Events (subject, body, start/end, attendees, location, recurrence, categories, importance, sensitivity), calendar groups, scheduling assistant (free/busy).
- **What an agent derives:** Meeting overload, double-booking, back-to-back meeting stress, meeting-free day frequency, scheduling patterns, attendee overlap analysis.
- **Difficulty:** EASY — Graph API is excellent for calendar. Free/busy lookup, delta queries for changes, webhook notifications. OAuth2.

### 3.3 Calendly
- **API:** YES (free for reads) — REST API, GET requests work on free plan.
- **Key data:** Scheduled events, event types, invitees, availability, cancellations, no-shows.
- **What an agent derives:** External meeting frequency, cancellation patterns, scheduling preferences, networking activity.
- **Difficulty:** EASY for reads, MEDIUM for writes — Webhooks and Scheduling API require paid plan ($10+/user/month). Basic GET requests work on free tier.

---

## 4. EMAIL

### 4.1 Microsoft Outlook
- **API:** YES (free) — Microsoft Graph API. Mail endpoints are fully free.
- **Key data:** Messages (subject, body, sender, recipients, timestamps, attachments, importance, categories), folders, rules, focused inbox.
- **What an agent derives:** Email volume/velocity, response time patterns, after-hours email (burnout signal), sender frequency analysis, unread pile-up (overwhelm indicator).
- **Difficulty:** EASY — Graph API with OAuth2. Delta queries for incremental sync. Webhooks for real-time. Well-documented.

### 4.2 Apple Mail
- **API:** NO (direct) / LIMITED (indirect)
- **Key data:** Emails stored locally in Mail.app database.
- **What an agent derives:** Same as any email — volume, patterns, response times.
- **Difficulty:** HARD — No API. Apple Mail uses standard IMAP/SMTP, so you can access the underlying email account via IMAP (not Apple Mail specifically). For iCloud Mail specifically, IMAP access is available with app-specific passwords.
- **Alternative:** Access the email provider directly (Gmail API, Graph API) rather than through Apple Mail.

---

## 5. SCREEN TIME / DIGITAL WELLBEING

### 5.1 iOS Screen Time
- **API:** LIMITED — Screen Time API (FamilyControls, ManagedSettings, DeviceActivity) exists but does NOT expose raw usage data.
- **Key data (if accessible):** App usage duration, pickups, notifications received, category breakdown, downtime schedules.
- **What an agent derives:** Digital addiction patterns, phone pickup frequency (anxiety signal), app category time allocation, pre-sleep phone usage, notification overload.
- **Difficulty:** HARD — Apple's Screen Time API is privacy-first by design. Developers get callbacks when thresholds are hit, but CANNOT read actual usage minutes, app names, or pickup counts. The raw data stays on-device and is invisible to third parties. No workaround exists.

### 5.2 Android Digital Wellbeing
- **API:** LIMITED — UsageStatsManager API available for Android apps.
- **Key data:** App usage time, notification count, unlock count, per-app foreground time.
- **What an agent derives:** Same as iOS Screen Time — digital habits, focus patterns, notification load.
- **Difficulty:** MEDIUM — UsageStatsManager requires PACKAGE_USAGE_STATS permission (user must manually grant in Settings). Returns per-app usage stats. More accessible than iOS but still requires explicit user action.

### 5.3 RescueTime
- **API:** YES (free) — REST API with personal API key.
- **Key data:** Time spent per application/website, productivity scores (1-5 scale), categories, daily summaries, goals, alerts, highlights.
- **What an agent derives:** Productive vs. distracted time ratio, focus session length, most productive hours, digital habit patterns, burnout detection (declining productivity scores).
- **Difficulty:** EASY — Simple API key auth. JSON/CSV output. Free plan: 30-min sync interval, 2 weeks history. Premium: 3-min sync, full history. Best available source for cross-platform screen time data.

### 5.4 macOS Screen Time
- **API:** NO — Same as iOS Screen Time. No programmatic access to usage data.
- **Key data:** App usage, website visits, notifications, pickups (if synced from iPhone).
- **What an agent derives:** Same as iOS.
- **Difficulty:** HARD — The Screen Time database exists at `~/Library/Application Support/Knowledge/knowledgeC.db` (SQLite) but is undocumented, changes between OS versions, and reading it is unsupported. RescueTime is the practical alternative for macOS.

---

## 6. FINANCE

### 6.1 Bank Transaction Data (Plaid)
- **API:** YES (free tier) — 200 free API calls, then paid. Sandbox unlimited.
- **Key data:** Transactions (merchant, amount, date, category, location), account balances, recurring transactions, income verification.
- **What an agent derives:** Spending stress signals (impulse purchases, late-night spending), financial health trends, subscription creep, income stability, spending category shifts.
- **Difficulty:** MEDIUM — Well-documented API, OAuth-based Link flow. Free tier is very limited (200 calls). Production access requires application review. Covers 12,000+ banks.

### 6.2 UPI / Google Pay (India)
- **API:** LIMITED — Google Pay India API is merchant-facing (for accepting payments), not for reading personal transaction history.
- **Key data (if accessible):** Transaction amount, merchant name, timestamp, UPI reference number.
- **What an agent derives:** Spending patterns, daily transaction frequency, merchant categories, financial stress.
- **Difficulty:** HARD — No API for reading personal UPI transaction history. Google Pay API is for merchants to accept payments. PhonePe, Paytm same situation. Only way: manual export from app or bank statement parsing.
- **Alternative:** Parse bank statements (PDF/CSV) for UPI transactions. Or use Plaid/similar for the underlying bank account.

---

## 7. LOCATION

### 7.1 Google Location History / Timeline
- **API:** NO — Google removed cloud-based Location History in 2025. Data now stored locally on device only.
- **Key data (from Takeout, if available):** GPS coordinates, timestamps, place visits, activity type (walking, driving, etc.), semantic locations.
- **What an agent derives:** Commute patterns, time at work vs. home, travel stress, routine disruption, location-based energy patterns.
- **Difficulty:** HARD — Since 2025, Timeline data is device-local. Google Takeout exports may be empty for new data. Historical data (pre-2025) available in JSON format via Takeout. No API exists.

### 7.2 Apple Significant Locations
- **API:** NO — Completely locked down. On-device only, end-to-end encrypted.
- **Key data:** Frequently visited places, visit timestamps, duration.
- **What an agent derives:** Home/work patterns, routine changes, travel frequency.
- **Difficulty:** HARD — No API, no export, no programmatic access. Viewable only in Settings > Privacy > Location Services > System Services > Significant Locations. Apple encrypts this data.

### 7.3 Life360
- **API:** LIMITED — No official public API. Unofficial reverse-engineered APIs exist.
- **Key data:** Real-time location, location history, place arrivals/departures, driving events, crash detection.
- **What an agent derives:** Family member locations, commute patterns, driving behavior, routine adherence.
- **Difficulty:** HARD — No official API. Unofficial Python libraries exist but break frequently. ToS risk.

---

## 8. MUSIC / MEDIA

### 8.1 Spotify
- **API:** YES (free) — Web API, completely free, generous rate limits.
- **Key data:** Recently played tracks (last 50 with cursor pagination), currently playing, saved tracks/albums, playlists, audio features (energy, valence, tempo, danceability), top artists/tracks (short/medium/long term).
- **What an agent derives:** Mood inference from audio features (valence = happiness, energy = arousal), listening time patterns, genre shifts as mood proxy, late-night listening (sleep signal), workout music detection, sad music streaks.
- **Difficulty:** EASY — Excellent API, OAuth2, well-documented. Audio features endpoint gives energy/valence/tempo per track. Recently played limited to 50 items per request but cursor-paginated. ~100 req/30s soft rate limit. **Top pick for mood inference.**

### 8.2 Apple Music
- **API:** YES (free) — MusicKit / Apple Music API. Free with Apple Developer account ($99/year for the account itself).
- **Key data:** Recently played, listening history, library contents, playlists, catalog search, recommendations.
- **What an agent derives:** Same as Spotify — mood from listening patterns, music taste shifts, listening schedule.
- **Difficulty:** MEDIUM — Requires Apple Developer account, JWT-based developer tokens + user music tokens. Two-token auth system. No formal rate limits yet (subject to change). Less rich than Spotify (no audio features equivalent).

### 8.3 YouTube Music
- **API:** LIMITED — YouTube Data API v3 covers YouTube but YouTube Music has no dedicated API.
- **Key data (via YouTube API):** Watch/listen history (requires OAuth), liked videos, playlists, subscriptions.
- **What an agent derives:** Music/video consumption patterns, content preferences, binge watching detection.
- **Difficulty:** MEDIUM — YouTube Data API v3 is free (10,000 quota units/day). Watch history access requires user OAuth consent. YouTube Music blends with YouTube history.

### 8.4 Netflix
- **API:** NO — Netflix shut down public API in 2014.
- **Key data (via manual export):** Viewing history (title + date), profile data. GDPR/CCPA data export includes more detail.
- **What an agent derives:** Binge-watching patterns (stress/escapism signal), late-night viewing (sleep disruption), content genre preferences as mood proxy.
- **Difficulty:** HARD — No API. Manual CSV download from account page. GDPR data request for full history. Scraping violates ToS.

---

## 9. SOCIAL

### 9.1 Instagram
- **API:** LIMITED — Instagram Graph API for Business/Creator accounts only. No personal account API.
- **Key data (Business/Creator):** Post insights (reach, impressions, engagement), follower demographics, story metrics. NO screen time data.
- **What an agent derives:** Social media engagement patterns, posting frequency, audience interaction.
- **Difficulty:** MEDIUM — Requires Meta Business verification (2-8 weeks), Business/Creator account. No access to personal usage patterns, screen time, or DM data. Instagram data download (GDPR) gives more personal data but is manual.

### 9.2 Twitter / X
- **API:** YES (paid) — Free tier is essentially write-only. Read access requires Basic ($200/month).
- **Key data (paid):** Tweets, timelines, user profiles, followers, likes, bookmarks, spaces, DMs.
- **What an agent derives:** Social media engagement, posting patterns, content sentiment, information consumption habits.
- **Difficulty:** MEDIUM — Free tier: 500 posts + 100 reads per month (virtually useless for data access). Basic at $200/month is minimum for any meaningful read access. API is well-documented but expensive.

### 9.3 LinkedIn
- **API:** LIMITED — Partner program required. Profile API for authenticated user only.
- **Key data (via API):** Own profile data (with user consent). No access to others' profiles, search, or feed.
- **What an agent derives:** Professional network activity, job search signals, content engagement.
- **Difficulty:** HARD — Must join LinkedIn Partner Program (approval required). API severely restricted. Data export (GDPR) gives connections, messages, search history, ad data — more useful than API for personal analysis.
- **Alternative:** LinkedIn data export (Settings > Get a copy of your data) provides CSV files of connections, messages, profile views, searches.

---

## 10. FITNESS / HEALTH (Beyond Apple Health / Health Connect)

### 10.1 Strava
- **API:** YES (free) — REST API, free for personal use.
- **Key data:** Activities (type, distance, duration, elevation, heart rate avg/max, pace, calories), athlete profile, segments, routes, clubs.
- **What an agent derives:** Exercise consistency, training load, heart rate trends, outdoor activity patterns, social fitness engagement, rest day frequency.
- **Difficulty:** EASY — OAuth2, REST API, webhooks for activity uploads. Rate limit: 100 req/15min, 1000/day. Heart rate data available in activity details (separate call per activity). Free.

### 10.2 MyFitnessPal
- **API:** NO (public) — Private API, not accepting new access requests.
- **Key data (if accessible):** Food diary (meals, calories, macros, micronutrients), exercise log, weight log, water intake, goals.
- **What an agent derives:** Nutritional patterns, calorie adherence, meal timing, macro balance, emotional eating patterns.
- **Difficulty:** HARD — Official API is private/closed. Third-party Python libraries (python-myfitnesspal) scrape the web interface but are fragile. No sanctioned developer access.
- **Alternative:** Nutritionix API or Open Food Facts API for food data. Manual diary export.

### 10.3 Headspace / Calm
- **API:** NO (public) — No public developer API for either platform.
- **Key data (if accessible):** Meditation sessions (duration, type, completion), streaks, sleep stories listened, focus sessions.
- **What an agent derives:** Meditation consistency, mindfulness patterns, sleep aid usage, stress management habits.
- **Difficulty:** HARD — No API, no data export. Both apps keep data locked in their ecosystems. Apple Health integration exists for some meditation data (mindful minutes).
- **Alternative:** Apple Health / Health Connect receives mindful minutes from these apps.

### 10.4 Flo / Clue (Menstrual Cycle Tracking)
- **API:** NO — Neither offers a public API.
- **Key data (if accessible):** Cycle dates, symptoms, mood, flow intensity, ovulation predictions, PMS tracking, temperature.
- **What an agent derives:** Cycle-aware energy predictions, PMS/PMDD pattern detection, symptom correlation with productivity, hormonal impact on sleep/mood.
- **Difficulty:** HARD — No API for either. Both sync to Apple Health (cycle data, symptoms). Clue emphasizes on-device privacy. Flo has had privacy controversies. Apple Health is the bridge.
- **Alternative:** Read cycle data from Apple Health / Health Connect where these apps sync.

---

## 11. SMART HOME / ENVIRONMENT

### 11.1 HomeKit / Google Home
- **API:** LIMITED
  - **HomeKit:** EventKit-style local API via HomeKit framework (iOS/macOS only). No REST API.
  - **Google Home:** Home APIs launched for developers (Matter-based). Cloud-to-cloud integration available.
- **Key data:** Device states (lights on/off, thermostat temperature, door locks, motion sensors), automation triggers, scenes.
- **What an agent derives:** Sleep/wake patterns from light usage, home temperature comfort, routine detection from automation triggers, presence detection.
- **Difficulty:** MEDIUM — HomeKit requires native iOS app. Google Home APIs are newer and evolving. Matter protocol enables cross-platform device access. Home Assistant is the best aggregator.
- **Best approach:** Home Assistant REST API — aggregates all smart home platforms into one free, self-hosted API.

### 11.2 Nest Thermostat
- **API:** YES (free) — Google Device Access API. One-time $5 fee for developer account.
- **Key data:** Ambient temperature, humidity, thermostat mode, target temperature, eco mode, HVAC status.
- **What an agent derives:** Room temperature comfort, heating/cooling patterns, home occupancy signals, sleep environment quality.
- **Difficulty:** MEDIUM — Google Device Access program requires $5 one-time fee. OAuth2 + Smart Device Management API. Nest Temperature Sensors do NOT expose to Matter (Google Home app only).

### 11.3 Smart Lights (Philips Hue, LIFX, etc.)
- **API:** YES (free) — Philips Hue has free local REST API. LIFX has free cloud API.
- **Key data:** Light state (on/off, brightness, color temperature, color), schedules, scenes, motion sensor data.
- **What an agent derives:** Sleep/wake timing from light patterns, circadian rhythm alignment (color temperature), room occupancy, evening wind-down patterns.
- **Difficulty:** EASY — Philips Hue local API requires bridge on same network. LIFX cloud API with API key. Both well-documented and free.

---

## 12. TRANSPORT

### 12.1 Uber / Lyft
- **API:** LIMITED — Both have APIs but ride history access is restricted.
- **Key data (if accessible):** Ride history (pickup/dropoff locations, timestamps, duration, fare, route), trip receipts.
- **What an agent derives:** Commute patterns, travel stress, late-night ride frequency, spending on transport.
- **Difficulty:** HARD — Uber API requires developer approval, ride history endpoints need privileged scopes. Lyft API requires business contact. Neither has easy personal data access via API.
- **Alternative:** Both offer data download/export through account settings. Uber: privacy.uber.com. Lyft: account settings.

### 12.2 Google Maps Timeline
- **API:** NO — Same as Google Location History (section 7.1). Device-local since 2025.
- **Key data:** Commute routes, travel time, mode of transport, visited places.
- **What an agent derives:** Commute duration/stress, route changes, transportation mode shifts.
- **Difficulty:** HARD — No API. Device-local storage since 2025.

---

## 13. WORK / DEVELOPER

### 13.1 GitHub
- **API:** YES (free) — REST API + GraphQL API. Generous free tier.
- **Key data:** Commits (timestamps, message, diff stats), pull requests (reviews, comments, merge time), issues, repositories, contribution graph, notifications, code review activity.
- **What an agent derives:** Coding patterns (time-of-day, day-of-week), commit velocity, PR review turnaround, late-night coding (burnout signal), project focus distribution, collaboration patterns.
- **Difficulty:** EASY — 5,000 req/hour authenticated. GraphQL API for complex queries. Free for all public + private repos. OAuth or Personal Access Tokens. **Top pick for developer productivity signal.**

### 13.2 VS Code / IDE Usage (WakaTime)
- **API:** YES (free) — WakaTime API with personal API key. Free tier available.
- **Key data:** Time per project, time per language, time per file, time per branch, editor used, OS, daily/weekly summaries, goals.
- **What an agent derives:** Deep work duration, coding focus sessions, language/project switching (context-switch cost), productive hours identification, coding time vs. meeting time.
- **Difficulty:** EASY — Install WakaTime extension, get API key, query dashboard API. Free tier: 2 weeks history. Paid ($12/month): full history, goals, teams. Works across 60+ IDEs. **Best source for coding time data.**

### 13.3 Zoom
- **API:** YES (free) — REST API available on all Zoom plans including free.
- **Key data:** Meeting list (topic, start/end time, duration, participants), recordings, registrants, meeting quality metrics, user settings.
- **What an agent derives:** Meeting load per day/week, meeting duration patterns, back-to-back meeting detection, meeting-free time calculation, video fatigue.
- **Difficulty:** EASY — REST API with OAuth2 or Server-to-Server OAuth. Well-documented. Meeting reports endpoint gives participant counts and durations. Free plan has some endpoint restrictions.

---

## PRIORITY RANKING: Best Sources for a Personal AI Agent

### Tier 1 — High Value, Easy Integration (Start Here)

| # | Source | Why |
|---|--------|-----|
| 1 | **Spotify** | Free API, audio features for mood inference, listening patterns |
| 2 | **GitHub** | Free API, commit timestamps = work pattern gold |
| 3 | **Notion** | Free API, task/knowledge patterns |
| 4 | **Todoist** | Free API, task completion = productivity signal |
| 5 | **Slack** | Free API, work communication load |
| 6 | **Telegram** | Free API, best messaging platform for bot integration |
| 7 | **Microsoft Graph** (Calendar + Email + To Do) | Free API, one integration = calendar + email + tasks |
| 8 | **Linear** | Free API, sprint/project health |
| 9 | **Discord** | Free API, social + gaming activity |
| 10 | **RescueTime** | Free API, screen time across all platforms |

### Tier 2 — High Value, Medium Effort

| # | Source | Why |
|---|--------|-----|
| 11 | **WakaTime** | Free API, coding time tracking |
| 12 | **Strava** | Free API, exercise + heart rate |
| 13 | **Jira** | Free API, work patterns |
| 14 | **Zoom** | Free API, meeting load |
| 15 | **Outlook Calendar** | Free via Graph API |
| 16 | **Calendly** | Free reads, external meeting patterns |
| 17 | **Apple Calendar** (EventKit) | Native SDK, requires iOS/macOS app |
| 18 | **Trello / Asana** | Free APIs, project tracking |
| 19 | **Nest Thermostat** | $5 one-time, room temperature |
| 20 | **Philips Hue / LIFX** | Free API, light = sleep patterns |

### Tier 3 — Valuable But Hard to Access

| # | Source | Why |
|---|--------|-----|
| 21 | **WhatsApp** | Paid API, no personal history access |
| 22 | **Apple Music** | Requires $99/yr developer account |
| 23 | **iOS Screen Time** | No data export, privacy-locked |
| 24 | **iMessage** | Unofficial only, Apple crackdown risk |
| 25 | **Bank data (Plaid)** | 200 free calls then paid |
| 26 | **YouTube Music** | Via YouTube Data API, quota limited |
| 27 | **Android Digital Wellbeing** | Requires special permission grant |
| 28 | **Google Home** | APIs still evolving |

### Tier 4 — Locked Down / No API

| # | Source | Why |
|---|--------|-----|
| 29 | **Netflix** | No API since 2014 |
| 30 | **Instagram** | Business accounts only |
| 31 | **Twitter/X** | $200/month minimum for reads |
| 32 | **LinkedIn** | Partner program required |
| 33 | **MyFitnessPal** | Private API, not accepting requests |
| 34 | **Headspace/Calm** | No API, no export |
| 35 | **Flo/Clue** | No API (use Apple Health bridge) |
| 36 | **Google Location History** | Device-local since 2025 |
| 37 | **Apple Significant Locations** | Encrypted, no access |
| 38 | **Uber/Lyft** | Restricted API, manual export only |
| 39 | **UPI/Google Pay** | No personal history API |
| 40 | **Life360** | No official API |
| 41 | **macOS Screen Time** | No API |

---

## KEY INSIGHT FOR WALDO

The richest free data sources for a personal AI agent cluster around:

1. **Work patterns** — GitHub, Linear/Jira, Slack, Zoom, WakaTime (all free APIs)
2. **Mood/energy proxies** — Spotify audio features, messaging patterns, screen time (RescueTime)
3. **Schedule/load** — Microsoft Graph (calendar + email + tasks in one API), Calendly
4. **Physical activity** — Strava (free), Apple Health/Health Connect (native SDK)
5. **Environment** — Smart home APIs (Hue, Nest) for sleep/ambient signals

The biggest gaps are: personal messaging history (WhatsApp, iMessage locked), screen time on Apple devices (privacy-locked), financial data (paid APIs), and location history (Google killed cloud access).

**Strategy for Waldo:** Start with Tier 1 adapters. Build the adapter interface once, implement Spotify + GitHub + Slack + Telegram + Microsoft Graph. These five give you mood, work patterns, communication load, schedule, and email volume — enough to compute a meaningful CRS without any health hardware.
