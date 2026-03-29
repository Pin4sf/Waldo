# Google Takeout Data Formats — Exact Field Reference

> Research for Waldo data ingestion layer. This documents the actual export structures from Google Takeout, not marketing descriptions.

---

## 1. Google Calendar (.ics / iCalendar)

### File Location in Takeout Archive
```
Takeout/Calendar/<calendar-name>.ics
```
One `.ics` file per calendar (e.g., `Personal.ics`, `Work.ics`).

### Format
iCalendar (RFC 5545). Plain text, line-delimited key-value pairs.

### Structure
```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Google Inc//Google Calendar 70.9054//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Work
X-WR-TIMEZONE:Asia/Kolkata

BEGIN:VEVENT
DTSTART;TZID=Asia/Kolkata:20250315T090000
DTEND;TZID=Asia/Kolkata:20250315T100000
DTSTAMP:20250320T120000Z
UID:abc123xyz@google.com
SUMMARY:Sprint Planning
DESCRIPTION:Weekly sprint planning with the team
LOCATION:Conference Room B / https://meet.google.com/abc-defg-hij
STATUS:CONFIRMED
TRANSP:OPAQUE
ORGANIZER;CN=Shivansh:mailto:shivansh@example.com
ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;
 CN=Person A;X-NUM-GUESTS=0:mailto:persona@example.com
ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=TENTATIVE;
 CN=Person B;X-NUM-GUESTS=0:mailto:personb@example.com
RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO
SEQUENCE:0
CREATED:20250101T080000Z
LAST-MODIFIED:20250310T140000Z
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Reminder
TRIGGER:-PT10M
END:VALARM
END:VEVENT

END:VCALENDAR
```

### Key Fields

| Field | Type | Example | Notes |
|---|---|---|---|
| `DTSTART` | datetime | `20250315T090000` | Start time. May include TZID param or end with Z (UTC) |
| `DTEND` | datetime | `20250315T100000` | End time. Mutually exclusive with DURATION |
| `SUMMARY` | string | `Sprint Planning` | Event title |
| `DESCRIPTION` | string | Free text | Event description/notes |
| `LOCATION` | string | `Conference Room B` | Physical or virtual location |
| `STATUS` | enum | `CONFIRMED` / `TENTATIVE` / `CANCELLED` | Event status |
| `TRANSP` | enum | `OPAQUE` / `TRANSPARENT` | OPAQUE = busy, TRANSPARENT = free |
| `RRULE` | string | `FREQ=WEEKLY;INTERVAL=1;BYDAY=MO` | Recurrence rule (RFC 5545) |
| `ATTENDEE` | URI | `mailto:person@example.com` | One per attendee. Has PARTSTAT, ROLE, CUTYPE params |
| `ORGANIZER` | URI | `mailto:organizer@example.com` | Event creator |
| `VALARM` | component | `TRIGGER:-PT10M` | Alarm/reminder. TRIGGER is relative duration before event |
| `UID` | string | `abc123xyz@google.com` | Globally unique event identifier |
| `DTSTAMP` | datetime | `20250320T120000Z` | When this iCal object was created |
| `CREATED` | datetime | `20250101T080000Z` | When event was first created |
| `LAST-MODIFIED` | datetime | `20250310T140000Z` | Last modification time |
| `SEQUENCE` | integer | `0` | Revision sequence number |

**ATTENDEE Sub-parameters:**
- `PARTSTAT`: `ACCEPTED`, `DECLINED`, `TENTATIVE`, `NEEDS-ACTION`
- `ROLE`: `REQ-PARTICIPANT`, `OPT-PARTICIPANT`, `CHAIR`
- `CUTYPE`: `INDIVIDUAL`, `GROUP`, `RESOURCE`, `ROOM`
- `X-NUM-GUESTS`: Google extension for additional guests

**RRULE Components:**
- `FREQ`: `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`
- `INTERVAL`: Integer (every N periods)
- `BYDAY`: `MO`, `TU`, `WE`, `TH`, `FR`, `SA`, `SU`
- `UNTIL`: End date for recurrence
- `COUNT`: Number of occurrences
- `BYMONTHDAY`, `BYMONTH`, `BYSETPOS`: Further refinements

### What Waldo Can Derive

| Derived Signal | Method | Health Correlation |
|---|---|---|
| **Meeting load per day/week** | Count VEVENT where TRANSP=OPAQUE | High meeting density -> cognitive load, stress predictor |
| **Back-to-back meetings** | DTEND[n] == DTSTART[n+1] or gap < 15min | Zero-recovery windows -> stress spikes, HRV suppression |
| **Meeting-free blocks** | Gaps > 60min between OPAQUE events | Recovery windows -> correlate with better afternoon CRS |
| **Recurring commitment weight** | Count events with RRULE | High recurring load = structural stress |
| **Social event ratio** | Events with 3+ ATTENDEEs vs solo blocks | Social energy expenditure tracking |
| **Evening/weekend meetings** | DTSTART outside 9-18 on weekdays | Work-life boundary violations -> sleep onset impact |
| **Meeting cancellation rate** | STATUS=CANCELLED frequency | Chaos indicator, planning instability |
| **Preparation pressure** | Events with VALARM at -30min or more | User flags important events needing prep time |

**Agent Intelligence (New Spots/Patterns):**
- **Spot: "Calendar Crunch"** — "You have 6 back-to-back meetings tomorrow with zero recovery gaps. Your CRS is already at 52. I've flagged 10:30-11:00 as a suggested break."
- **Spot: "Evening Creep"** — "3 meetings after 7pm this week vs 0 last week. Your sleep onset shifted 40min later on those days."
- **Constellation: "Meeting Load vs CRS"** — Multi-week correlation between meeting density and next-day CRS scores.

---

## 2. Google Tasks (JSON)

### File Location in Takeout Archive
```
Takeout/Tasks/Tasks.json
```
Single JSON file containing all task lists and their tasks.

### Format
JSON. Mirrors the Google Tasks API v1 schema.

### Structure
```json
{
  "kind": "tasks#taskLists",
  "items": [
    {
      "kind": "tasks#taskList",
      "id": "MTUyNDY0...",
      "title": "My Tasks",
      "updated": "2025-03-15T10:30:00.000Z",
      "items": [
        {
          "kind": "tasks#task",
          "id": "dGFzazox...",
          "etag": "\"LTE3NjQ2...\"",
          "title": "Review Waldo PRD",
          "updated": "2025-03-14T08:00:00.000Z",
          "selfLink": "https://www.googleapis.com/tasks/v1/lists/.../tasks/...",
          "position": "00000000000000000001",
          "notes": "Focus on Phase B health data pipeline. Check Samsung HRV gap handling.",
          "status": "needsAction",
          "due": "2025-03-16T00:00:00.000Z",
          "links": []
        },
        {
          "kind": "tasks#task",
          "id": "dGFzazoy...",
          "etag": "\"MjE0NTY3...\"",
          "title": "Ship adapter pattern docs",
          "updated": "2025-03-13T14:00:00.000Z",
          "selfLink": "https://www.googleapis.com/tasks/v1/lists/.../tasks/...",
          "parent": "dGFzazox...",
          "position": "00000000000000000001",
          "status": "completed",
          "completed": "2025-03-13T16:30:00.000Z"
        }
      ]
    }
  ]
}
```

### Key Fields

| Field | Type | Example | Notes |
|---|---|---|---|
| `kind` | string | `"tasks#task"` | Always this value for individual tasks |
| `id` | string | Base64-encoded ID | Unique task identifier |
| `title` | string | `"Review Waldo PRD"` | Task title (max 1024 chars) |
| `notes` | string | Free text | Task description (max 8192 chars). Optional |
| `status` | enum | `"needsAction"` / `"completed"` | Only two possible values |
| `due` | RFC 3339 | `"2025-03-16T00:00:00.000Z"` | Due date. Time portion is always midnight (date-only semantic) |
| `completed` | RFC 3339 | `"2025-03-13T16:30:00.000Z"` | Completion timestamp. Omitted if not completed |
| `updated` | RFC 3339 | `"2025-03-14T08:00:00.000Z"` | Last modification time |
| `parent` | string | Task ID | Parent task ID for subtasks. Omitted for top-level tasks |
| `position` | string | `"00000000000000000001"` | Ordering within list. Zero-padded string |
| `selfLink` | string | URL | API resource link |
| `etag` | string | Quoted hash | Version identifier |
| `links` | array | `[]` | Associated links. Usually empty in Takeout |

**List-level fields:** `kind` ("tasks#taskList"), `id`, `title` (list name), `updated`.

### What Waldo Can Derive

| Derived Signal | Method | Health Correlation |
|---|---|---|
| **Task completion rate** | completed count / total count per week | Low completion rate -> overwhelm indicator |
| **Overdue task count** | `due` < now AND `status` = "needsAction" | Overdue pile-up -> cognitive load, decision fatigue |
| **Task velocity** | Tasks completed per day/week trend | Declining velocity may correlate with dropping CRS |
| **Time-to-completion** | `completed` - `due` (positive = late, negative = early) | Chronic lateness = capacity exceeded |
| **Subtask depth** | Tasks with `parent` field | Deep nesting = complex projects = sustained cognitive load |
| **Evening task creation** | `updated` timestamps between 22:00-06:00 | Late-night planning = rumination, sleep anxiety |

**Agent Intelligence:**
- **Spot: "Task Pile-Up"** — "You have 12 overdue tasks, up from 4 last week. Your CRS has dropped 15 points over the same period. Want me to suggest which 3 to tackle first?"
- **Spot: "Midnight Planner"** — "You created 5 tasks between midnight and 2am last night. That pattern usually precedes a rough sleep night for you."

---

## 3. Gmail (.mbox)

### File Location in Takeout Archive
```
Takeout/Mail/All mail Including Spam and Trash.mbox
```
Single `.mbox` file containing ALL emails. Can be multiple GB.
Label-specific exports also available if selected in Takeout (e.g., `Inbox.mbox`, `Sent.mbox`).

### Format
mbox (RFC 4155). Plain text. Each message starts with a `From ` line (note the space). Standard RFC 2822 email headers followed by body.

### Structure (Headers Only — We Do NOT Read Bodies)
```
From 1234567890abcdef@xxx Wed Mar 15 08:30:00 +0000 2025
X-GM-THRID: 1795234567890123456
X-Gmail-Labels: Inbox,Important,Work
Delivered-To: shivansh@example.com
Received: by 2002:a17:906:abc1:0:0:0:0 with SMTP id xyz;
        Sat, 15 Mar 2025 01:30:00 -0700 (PDT)
Date: Sat, 15 Mar 2025 14:00:00 +0530
From: Alice <alice@company.com>
To: shivansh@example.com
Cc: bob@company.com, carol@company.com
Subject: Re: Sprint Review Notes
Message-ID: <CABx+abc123@mail.gmail.com>
In-Reply-To: <CABx+def456@mail.gmail.com>
References: <CABx+ghi789@mail.gmail.com> <CABx+def456@mail.gmail.com>
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="0000000000abc123"
```

### Key Metadata Fields (Privacy-Safe — No Body Reading)

| Field | Type | Example | Notes |
|---|---|---|---|
| `X-GM-THRID` | string | `1795234567890123456` | Gmail thread ID. Groups messages in same conversation |
| `X-Gmail-Labels` | comma-sep | `Inbox,Important,Work` | Gmail labels. Google Takeout-specific header |
| `Date` | RFC 2822 | `Sat, 15 Mar 2025 14:00:00 +0530` | When message was sent |
| `From` | email | `Alice <alice@company.com>` | Sender display name + address |
| `To` | email(s) | Comma-separated addresses | Primary recipients |
| `Cc` | email(s) | Comma-separated addresses | CC recipients |
| `Subject` | string | `Re: Sprint Review Notes` | Subject line. `Re:` prefix indicates reply |
| `Message-ID` | string | `<CABx+abc123@mail.gmail.com>` | Globally unique message identifier |
| `In-Reply-To` | string | Message-ID of parent | Links to the message this is replying to |
| `References` | string(s) | Space-separated Message-IDs | Full thread chain of Message-IDs |
| `Content-Type` | MIME | `multipart/alternative` | Message structure (text/html/attachments) |

**Google-Specific Extensions:**
- `X-Gmail-Labels`: Only in Takeout mbox (not in Vault exports). Labels like `Inbox`, `Sent`, `Important`, `Starred`, `Category_Updates`, `Category_Promotions`, custom labels.
- `X-GM-THRID`: Thread ID matching Gmail's conversation view.

### What Waldo Can Derive (Metadata Only, Never Body Content)

| Derived Signal | Method | Health Correlation |
|---|---|---|
| **Email volume per day** | Count messages by `Date` field | Volume spikes -> workload surges |
| **Response time patterns** | `Date` of reply - `Date` of original (via `In-Reply-To`) | Increasing response lag = capacity exceeded |
| **After-hours email activity** | `Date` timestamps between 22:00-06:00 | Late-night email -> delayed sleep onset |
| **Thread depth** | Count `References` per thread | Deep threads = complex/unresolved issues |
| **Sender concentration** | Top senders by `From` field | High concentration = dependency on few people |
| **Label distribution** | Parse `X-Gmail-Labels` | Ratio of Work/Personal/Promotions indicates mental load sources |
| **Unread accumulation** | Messages with `Unread` in `X-Gmail-Labels` | Growing unread count = avoidance or overwhelm |
| **CC load** | Messages where user is in `Cc` not `To` | High CC ratio = noise, low-agency communication |

**Agent Intelligence:**
- **Spot: "Inbox Avalanche"** — "You received 89 emails yesterday vs your 30-day average of 42. Your Nap Score dropped to 45 this morning. Maybe batch your email checks today instead of live monitoring."
- **Spot: "Night Owl Emailing"** — "You sent 7 emails between 11pm and 1am last night. On nights you email after 11pm, your sleep duration averages 5.2hrs vs 7.1hrs."
- **Constellation: "Email Load vs Recovery"** — Track weeks where email volume exceeds 2x baseline against weekend CRS recovery.

**Privacy Note:** Waldo NEVER reads email body content. Only metadata headers (From, To, Date, Subject line, Labels, thread structure). This must be explicit in onboarding consent.

---

## 4. Google Chrome History (JSON)

### File Location in Takeout Archive
```
Takeout/Chrome/BrowserHistory.json
```
Single JSON file. Can be large (50MB+ for heavy users).

### Format
JSON. Array of visit objects grouped by browser profile.

### Structure
```json
{
  "Browser History": [
    {
      "favicon_url": "https://www.example.com/favicon.ico",
      "page_transition": "LINK",
      "title": "Waldo - GitHub",
      "url": "https://github.com/user/waldo",
      "client_id": "abcDEF123/xYz456==",
      "time_usec": 1710500000000000
    },
    {
      "favicon_url": "https://www.reddit.com/favicon.ico",
      "page_transition": "TYPED",
      "title": "r/programming - Reddit",
      "url": "https://www.reddit.com/r/programming/",
      "client_id": "abcDEF123/xYz456==",
      "time_usec": 1710503600000000
    }
  ]
}
```

### Key Fields

| Field | Type | Example | Notes |
|---|---|---|---|
| `url` | string | Full URL | The page visited |
| `title` | string | `"Waldo - GitHub"` | Page title at time of visit |
| `time_usec` | integer | `1710500000000000` | Visit timestamp in **microseconds** since Unix epoch. Divide by 1,000,000 for seconds |
| `page_transition` | enum | `"LINK"` / `"TYPED"` / `"AUTO_BOOKMARK"` / `"RELOAD"` / `"GENERATED"` | How the user navigated to the page |
| `client_id` | string | Opaque ID | Identifies the Chrome profile/device. Useful for separating phone vs desktop |
| `favicon_url` | string | URL to favicon | Icon URL. Can be empty |

**page_transition values:**
- `LINK` — User clicked a link on another page
- `TYPED` — User typed the URL or selected from omnibox
- `AUTO_BOOKMARK` — Navigated via bookmark
- `RELOAD` — Page reload
- `GENERATED` — URL generated by Chrome (e.g., new tab page suggestions)
- `FORM_SUBMIT` — Form submission navigation

**Note:** Unlike Chrome's internal SQLite `History` DB, Takeout does NOT include `visit_count` or `visit_duration`. Each entry is a single visit event. You must aggregate visit counts yourself by grouping on URL.

### What Waldo Can Derive

| Derived Signal | Method | Health Correlation |
|---|---|---|
| **Screen time by category** | Classify URLs into categories (social, work, entertainment, news) | Entertainment spikes may correlate with procrastination/stress |
| **Browsing by hour-of-day** | Bucket `time_usec` into hourly bins | Late-night browsing (00:00-04:00) -> sleep disruption |
| **Work vs personal ratio** | Domain classification (github, jira, docs vs reddit, youtube, twitter) | Shift toward personal browsing during work hours = disengagement |
| **Context switching frequency** | Rapid domain changes within short time windows | High switching = fragmented attention, cognitive fatigue |
| **Doomscrolling detection** | Repeated visits to news/social domains within 30min window | Strong stress/anxiety indicator |
| **Device patterns** | Separate `client_id` for phone vs desktop | Phone browsing in bed = pre-sleep screen exposure |
| **Search patterns** | URLs containing google.com/search?q= | Topic analysis (health anxiety searches, etc.) |

**Agent Intelligence:**
- **Spot: "Screen Wind-Down"** — "You were browsing Reddit until 1:47am last night. Your sleep onset was 2:10am, 90 minutes later than your baseline. Want me to suggest a wind-down reminder at 11pm?"
- **Spot: "Focus Fragmentation"** — "Between 2pm-4pm today you switched between 14 different domains. That window usually has your lowest CRS readings."
- **Constellation: "Late Screens vs Morning CRS"** — Correlate browsing-end-time with next-morning Nap Score over weeks.

---

## 5. Google Fit (JSON / TCX / CSV)

### File Location in Takeout Archive
```
Takeout/Fit/
  Daily activity metrics/
    Daily activity metrics.csv
    YYYY-MM-DD.csv (one per day)
  Activities/
    2025-03-15T08_30_00+05_30_Running.tcx
    ... (one .tcx per recorded activity)
  All Sessions/
    All Sessions.csv
  Raw Data/
    com.google.active_minutes.json
    com.google.activity.segment.json
    com.google.calories.expended.json
    com.google.distance.delta.json
    com.google.heart_rate.bpm.json
    com.google.height.json
    com.google.sleep.segment.json
    com.google.step_count.delta.json
    com.google.weight.json
```

### Format
Mixed: CSV for daily summaries, TCX (XML) for activities, JSON for raw data streams.

### Raw Data JSON Structure (e.g., step_count.delta)
```json
{
  "Data Points": [
    {
      "startTimeNanos": "1710500000000000000",
      "endTimeNanos": "1710503600000000000",
      "originDataSourceId": "derived:com.google.step_count.delta:com.google.android.gms:merge_step_deltas",
      "fitValue": [
        {
          "value": {
            "intVal": 1247
          }
        }
      ],
      "dataTypeName": "com.google.step_count.delta"
    }
  ]
}
```

### Heart Rate JSON Structure (heart_rate.bpm)
```json
{
  "Data Points": [
    {
      "startTimeNanos": "1710500000000000000",
      "endTimeNanos": "1710500000000000000",
      "originDataSourceId": "raw:com.google.heart_rate.bpm:com.samsung.health:...",
      "fitValue": [
        {
          "value": {
            "fpVal": 72.0
          }
        }
      ],
      "dataTypeName": "com.google.heart_rate.bpm"
    }
  ]
}
```

### Sleep Segment JSON Structure (sleep.segment)
```json
{
  "Data Points": [
    {
      "startTimeNanos": "1710450000000000000",
      "endTimeNanos": "1710478800000000000",
      "fitValue": [
        {
          "value": {
            "intVal": 2
          }
        }
      ],
      "dataTypeName": "com.google.sleep.segment"
    }
  ]
}
```

**Sleep segment intVal mapping:**
- `0` — Awake (during sleep session)
- `1` — Sleep (generic/unspecified)
- `2` — Out of bed
- `3` — Light sleep
- `4` — Deep sleep
- `5` — REM sleep

### Key Fields (Raw Data JSON)

| Field | Type | Example | Notes |
|---|---|---|---|
| `startTimeNanos` | string | `"1710500000000000000"` | Start time in **nanoseconds** since Unix epoch |
| `endTimeNanos` | string | `"1710503600000000000"` | End time in nanoseconds |
| `dataTypeName` | string | `"com.google.step_count.delta"` | Data type identifier |
| `originDataSourceId` | string | `"derived:com.google.step_count.delta:..."` | Source app/device chain |
| `fitValue[].value.intVal` | integer | `1247` | Integer value (steps, sleep stage) |
| `fitValue[].value.fpVal` | float | `72.0` | Float value (heart rate BPM, weight kg) |

### Daily Activity Metrics CSV Fields
```
Date,Move Minutes count,Calories (kcal),Distance (m),Heart Points,Heart Minutes,
Average heart rate (bpm),Max heart rate (bpm),Min heart rate (bpm),
Step count,Average speed (m/s),Max speed (m/s),Min speed (m/s),
Average weight (kg),Max weight (kg),Min weight (kg),
Biking duration (ms),Inactive duration (ms),Running duration (ms),
Sleeping duration (ms),Walking duration (ms)
```

### What Waldo Can Derive

| Derived Signal | Method | Health Correlation |
|---|---|---|
| **Step count trends** | `com.google.step_count.delta` aggregated daily | Directly feeds CRS activity component |
| **Resting heart rate trends** | `com.google.heart_rate.bpm` during sleep/rest periods | RHR elevation = stress, illness, overtraining |
| **Sleep staging quality** | `com.google.sleep.segment` stage distribution | Deep + REM ratio directly impacts CRS |
| **Activity patterns** | `com.google.activity.segment` by time of day | Morning exercise vs sedentary correlations |
| **Heart Points earned** | Daily activity metrics CSV | WHO-recommended activity metric |
| **Inactive duration** | Daily CSV `Inactive duration (ms)` | Sedentary time correlated with afternoon energy dips |

**Note on Samsung HRV gap:** Google Fit via Health Connect does NOT receive HRV data from Samsung. `com.google.heart_rate.bpm` is available as an HR BPM proxy. This is the same limitation noted in Waldo's Master Reference.

**Agent Intelligence:**
- Google Fit data supplements (or partially replaces) direct HealthKit/Health Connect reads for users who prefer Takeout import over live wearable connection.
- **Spot: "Sedentary Saturday"** — "You logged 800 steps today vs your 8,000 average. Your resting HR is also 8bpm above baseline. Even a 15-minute walk could help."

---

## 6. YouTube Watch History (JSON)

### File Location in Takeout Archive
```
Takeout/YouTube and YouTube Music/history/watch-history.json
```
Single JSON file. Can also be exported as HTML (default is HTML; JSON must be selected in Takeout settings).

### Format
JSON array of watch event objects.

### Structure
```json
[
  {
    "header": "YouTube",
    "title": "Watched Why We Sleep - Matthew Walker | Full Podcast",
    "titleUrl": "https://www.youtube.com/watch?v=pwaWilO_Pig",
    "subtitles": [
      {
        "name": "Andrew Huberman",
        "url": "https://www.youtube.com/channel/UC2D2CMWXMOVWx7giW1n3LIg"
      }
    ],
    "time": "2025-03-15T23:45:12.000Z",
    "products": ["YouTube"],
    "activityControls": ["YouTube watch history"]
  },
  {
    "header": "YouTube",
    "title": "Watched Lofi Hip Hop Radio - Beats to Relax/Study To",
    "titleUrl": "https://www.youtube.com/watch?v=jfKfPfyJRdk",
    "subtitles": [
      {
        "name": "Lofi Girl",
        "url": "https://www.youtube.com/channel/UCSJ4gkVC6NrvII8umztf0A"
      }
    ],
    "time": "2025-03-15T02:15:30.000Z",
    "products": ["YouTube"],
    "activityControls": ["YouTube watch history"]
  },
  {
    "header": "YouTube Music",
    "title": "Watched Some Song Title",
    "titleUrl": "https://music.youtube.com/watch?v=xxxxx",
    "subtitles": [
      {
        "name": "Artist Name",
        "url": "https://www.youtube.com/channel/UCxxxxxx"
      }
    ],
    "time": "2025-03-14T20:00:00.000Z",
    "products": ["YouTube"],
    "activityControls": ["YouTube watch history"]
  }
]
```

### Key Fields

| Field | Type | Example | Notes |
|---|---|---|---|
| `header` | string | `"YouTube"` / `"YouTube Music"` | Distinguishes YouTube vs YouTube Music watches |
| `title` | string | `"Watched [Video Title]"` | Always prefixed with "Watched ". Title at time of viewing |
| `titleUrl` | string | `"https://www.youtube.com/watch?v=..."` | Direct link to video. Video ID extractable from `v=` param |
| `subtitles` | array | `[{"name": "Channel", "url": "..."}]` | Channel info. Usually single element. `url` contains channel ID |
| `subtitles[].name` | string | `"Andrew Huberman"` | Channel/creator name |
| `subtitles[].url` | string | `"https://www.youtube.com/channel/UC..."` | Channel URL with channel ID |
| `time` | ISO 8601 | `"2025-03-15T23:45:12.000Z"` | When the video was watched. Always UTC |
| `products` | array | `["YouTube"]` | Product identifier |
| `activityControls` | array | `["YouTube watch history"]` | Which activity control captured this |

**Notes:**
- Ads viewed are also included but have no `titleUrl` (the `title` will say "Watched" followed by an ad description).
- Entries where the video has been deleted may have `title` but no `titleUrl`.
- No watch duration is included. You only know WHEN viewing started, not how long.

### What Waldo Can Derive

| Derived Signal | Method | Health Correlation |
|---|---|---|
| **Late-night viewing** | `time` between 23:00-05:00 | Screen time before bed -> delayed melatonin, poor sleep |
| **Daily watch volume** | Count entries per day | High volume = potential procrastination or stress escape |
| **Content category patterns** | Channel name / video title classification | Stress-escape content vs educational vs background music |
| **Binge sessions** | Cluster entries within short time windows (< 5min gaps) | Binge watching correlates with reduced next-day energy |
| **YouTube Music usage times** | Filter `header` = "YouTube Music" | Music listening patterns (calming vs energizing, time of day) |
| **Weekend vs weekday patterns** | Aggregate by day-of-week | Weekend binge → Monday CRS impact |

**Agent Intelligence:**
- **Spot: "Late Night Screen"** — "You watched 4 YouTube videos between midnight and 2am. Your sleep onset was 2:20am and your Nap Score is 38 this morning."
- **Spot: "Binge Alert"** — "You've watched 12 videos in the last 2 hours. This pattern has preceded a CRS drop of 20+ points the next day in 3 out of 4 recent instances."
- **Constellation: "Screen Cutoff vs Sleep Quality"** — Weeks where last YouTube watch is before 10pm vs after midnight, correlated with average CRS.

---

## Summary: Takeout Archive Structure

```
Takeout/
  Calendar/
    <calendar-name>.ics          # One per calendar
  Tasks/
    Tasks.json                    # All task lists + tasks
  Mail/
    All mail Including Spam and Trash.mbox   # All emails
    <Label>.mbox                  # Per-label if selected
  Chrome/
    BrowserHistory.json           # All browsing history
  Fit/
    Daily activity metrics/       # CSV daily summaries
    Activities/                   # TCX per activity
    Raw Data/                     # JSON per data type
    All Sessions/                 # CSV session list
  YouTube and YouTube Music/
    history/
      watch-history.json          # All watch events (if JSON selected)
      watch-history.html          # Default format
      search-history.json         # Search queries
```

## Implementation Priority for Waldo

| Priority | Service | Effort | Value for CRS/Health | Notes |
|---|---|---|---|---|
| **P0** | Google Fit | Medium | Highest | Directly feeds CRS. Overlaps with HealthKit/Health Connect but useful as import path |
| **P1** | Google Calendar | Low | High | Meeting load is top stress predictor. ICS parsing is well-supported |
| **P1** | YouTube History | Low | High | Screen time before bed is strongest sleep disruptor signal |
| **P2** | Chrome History | Medium | Medium | Broader screen time picture. URL classification needed |
| **P2** | Google Tasks | Low | Medium | Cognitive load signal. Simple JSON parsing |
| **P3** | Gmail | High | Medium | mbox parsing is complex. Metadata-only constraint limits value. Privacy review needed |

## Adapter Pattern Mapping

Each Takeout service maps to a `DataImportAdapter` interface:

```typescript
interface TakeoutImportAdapter {
  readonly service: 'calendar' | 'tasks' | 'gmail' | 'chrome' | 'fit' | 'youtube';
  readonly filePattern: string;      // glob for finding files in extracted archive
  readonly format: 'ics' | 'json' | 'mbox' | 'csv' | 'tcx';

  parse(filePath: string): AsyncIterable<TakeoutRecord>;
  deriveSignals(records: TakeoutRecord[]): DerivedSignal[];
}
```

This keeps Takeout import as a pluggable data source — consistent with Waldo's adapter-first architecture.
