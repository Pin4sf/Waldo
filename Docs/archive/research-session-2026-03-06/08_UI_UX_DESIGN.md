# OneSync — UI/UX Design

Last updated: March 6, 2026

---

## Component Library: Gluestack-UI v3

| Feature | Details |
|---------|---------|
| Based on | NativeBase successor, Tailwind CSS |
| Tree-shaking | Yes — only import what you use |
| Dark mode | Built-in, system-aware |
| Accessibility | ARIA labels, screen reader support |
| Platform | React Native + Web (universal) |
| Install | `npx gluestack-ui init` |

---

## Onboarding Flow (5 Steps + AI Interview)

### Step 1: Welcome & Value Prop
- Brief animation showing CRS concept
- "Your cognitive co-pilot" tagline
- Single CTA: "Get Started"

### Step 2: Connect Wearable
- Auto-detect connected wearable type
- Show device-specific instructions:
  - Samsung: Install companion watch app, enable Developer Mode
  - Garmin: Install Connect IQ app
  - Fitbit/Oura/WHOOP: OAuth sign-in
  - Other: Health Connect permissions
- Skip option (can connect later, but limited features)

### Step 3: Health Connect Permissions
- **Critical UX**: Permission denial is permanent after 2 declines
- Pre-permission screen explaining WHY each permission is needed
- Request one category at a time (not all at once)
- Order: Sleep → Heart Rate → Steps → Exercise → SpO2
- If denied: explain how to re-enable in Settings

### Step 4: Link Messaging Channel
- Telegram and/or WhatsApp
- Show QR code or deep link to bot
- Generate 6-digit linking code
- Verify linking succeeded before proceeding

### Step 5: AI Onboarding Interview (In Messaging Channel)
- Transitions user to Telegram/WhatsApp for a conversational interview
- 5-7 questions asked by Claude:

```
1. "What does a typical day look like for you? When do you usually wake up and wind down?"
   → Extracts: chronotype, work_schedule, sleep_pattern

2. "What kind of work do you do? Are there specific times when you need to be at your sharpest?"
   → Extracts: occupation, peak_demand_times

3. "How do you usually know when you're stressed? What does it feel like for you?"
   → Extracts: stress_awareness, stress_symptoms

4. "When you're stressed or overwhelmed, what helps you reset? A walk, music, breathing, talking to someone?"
   → Extracts: preferred_interventions, coping_strategies

5. "Is there anything about your health or lifestyle I should know about? Exercise routine, medications, conditions?"
   → Extracts: exercise_routine, medications, health_conditions

6. "How would you like me to communicate with you? Minimal check-ins or more detailed guidance?"
   → Extracts: communication_style, notification_preference

7. "What's one thing you'd like to improve about your daily energy or focus?"
   → Extracts: primary_goal
```

- Claude extracts structured data from natural conversation
- Stores in `core_memory` and `user_profiles` tables
- No forms to fill — it's a conversation

### Post-Onboarding
- Dashboard appears with "Learning Mode" badge (first 7 days)
- No proactive alerts during learning period (building baselines)
- Show progress: "Day 2 of 7 — Building your personal baseline"

---

## Dashboard Layout

### Main Screen (Single Scroll)

```
┌─────────────────────────────┐
│  OneSync          ⚙️ [gear] │
├─────────────────────────────┤
│                             │
│     ┌───────────────┐       │
│     │               │       │
│     │   CRS GAUGE   │       │
│     │     72/100    │       │
│     │   "Moderate"  │       │
│     └───────────────┘       │
│     Last updated: 2 min ago │
│                             │
├─────────────────────────────┤
│  ┌─────┐ ┌─────┐ ┌─────┐   │
│  │Sleep│ │ HRV │ │Steps│   │
│  │ 78  │ │ 65  │ │8.2k │   │
│  └─────┘ └─────┘ └─────┘   │
│  ┌─────┐ ┌─────┐ ┌─────┐   │
│  │ HR  │ │SpO2 │ │Circ.│   │
│  │ 72  │ │ 97% │ │ 70  │   │
│  └─────┘ └─────┘ └─────┘   │
├─────────────────────────────┤
│  Today's Insight            │
│  ┌─────────────────────────┐│
│  │ "Your HRV recovered    ││
│  │  well from yesterday.  ││
│  │  Good time for deep    ││
│  │  work this morning."   ││
│  │            [💬 Reply]  ││
│  └─────────────────────────┘│
├─────────────────────────────┤
│  Sleep Summary              │
│  ┌─────────────────────────┐│
│  │ ████████░░ 7h 12m      ││
│  │ Deep: 1h22m  REM: 1h45m││
│  └─────────────────────────┘│
├─────────────────────────────┤
│  Weekly Trend               │
│  ┌─────────────────────────┐│
│  │  📈 CRS Line Chart     ││
│  │  (7 days)               ││
│  └─────────────────────────┘│
├─────────────────────────────┤
│  [🏠]  [📊]  [⚙️]          │
│  Home  History Settings     │
└─────────────────────────────┘
```

---

## CRS Gauge Component

### Design: Circular Arc

- 270-degree arc (not full circle — leaves gap at bottom)
- Three color zones:
  - 0-49: Coral (#F87171) — Low
  - 50-79: Amber (#F59E0B) — Moderate
  - 80-100: Teal (#2DD4BF) — Peak
- Large number in center (e.g., "72")
- Zone label below number ("Moderate")
- Subtle animation on score change
- Accessible: colors chosen to be distinguishable for colorblind users

### Implementation: Custom SVG

```tsx
// components/CRSGauge.tsx
import Svg, { Path, Text as SvgText } from 'react-native-svg';

interface CRSGaugeProps {
  score: number; // 0-100
  size?: number;
}

function CRSGauge({ score, size = 200 }: CRSGaugeProps) {
  const getColor = (s: number) => {
    if (s >= 80) return '#2DD4BF'; // Teal
    if (s >= 50) return '#F59E0B'; // Amber
    return '#F87171';              // Coral
  };

  const getLabel = (s: number) => {
    if (s >= 80) return 'Peak';
    if (s >= 50) return 'Moderate';
    return 'Low';
  };

  // Arc calculation for 270 degrees
  const startAngle = 135; // degrees
  const endAngle = 405;   // 135 + 270
  const scoreAngle = startAngle + (score / 100) * 270;

  // ... SVG path calculations

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      {/* Background arc (gray) */}
      <Path d={backgroundArcPath} stroke="#E5E7EB" strokeWidth={12} fill="none" />
      {/* Score arc (colored) */}
      <Path d={scoreArcPath} stroke={getColor(score)} strokeWidth={12} fill="none" strokeLinecap="round" />
      {/* Score number */}
      <SvgText x="100" y="95" textAnchor="middle" fontSize={48} fontWeight="bold" fill={getColor(score)}>
        {score}
      </SvgText>
      {/* Label */}
      <SvgText x="100" y="125" textAnchor="middle" fontSize={16} fill="#6B7280">
        {getLabel(score)}
      </SvgText>
    </Svg>
  );
}
```

---

## Metric Cards

### Design

- Rounded rectangle, subtle shadow
- Icon + label at top
- Large value in center
- Trend arrow (up/down/neutral) with percentage vs yesterday
- Tap to expand into detail view

### Color Coding

Don't color-code individual metrics red/green. Use:
- **Neutral background** for all cards
- **Trend arrow** colored: teal (improving), amber (flat), coral (declining)
- This reduces visual noise and alarm fatigue

---

## Charts (react-native-gifted-charts)

### Weekly CRS Trend
- Line chart with area fill
- 7 data points (daily average CRS)
- Color zones as background bands (coral/amber/teal)
- Tap point for details

### Sleep History
- Stacked bar chart
- Segments: Deep (dark blue), REM (purple), Light (light blue), Awake (gray)
- 7-14 day view

### HRV Trend
- Line chart
- Show personal baseline as dashed line
- Highlight drops >20% with coral dot

### Why react-native-gifted-charts?
- Pure React Native (no web view)
- Supports line, bar, area, pie
- Animated transitions
- Customizable tooltips
- Active maintenance

---

## Notification UX

### Principles

1. **Never cry wolf** — False positives destroy trust faster than missed alerts
2. **Context-rich** — "Your HRV dropped 25% and you have a meeting in 30 min" not "Check your vitals"
3. **Actionable** — Every notification suggests something specific to do
4. **Respect DND** — Honor system Do Not Disturb settings
5. **Cooldown** — Minimum 30 min between proactive messages

### Notification Types

| Type | Channel | Frequency | Example |
|------|---------|-----------|---------|
| Stress alert | Telegram/WhatsApp | Max 3/day | "Your body is showing signs of stress. Try 3 deep breaths?" |
| Morning brief | Telegram/WhatsApp | 1/day | "Good morning! Sleep: 78/100. You have 3 meetings today." |
| Inactivity nudge | Push notification | Max 2/day | "You've been sitting for 2 hours. Quick stretch?" |
| Weekly summary | Telegram/WhatsApp | 1/week | "Weekly report ready. Your CRS averaged 71 this week." |
| Achievement | Push notification | Rare | "3-day streak of 80+ CRS!" |

---

## Dark Mode

- System-aware (follows device setting)
- Manual toggle in settings
- Gluestack-UI handles theme switching via `colorMode`
- Chart colors adjust for dark backgrounds
- CRS gauge: slightly muted colors on dark mode for readability

### Color Tokens

```typescript
const colors = {
  light: {
    background: '#FFFFFF',
    surface: '#F9FAFB',
    text: '#111827',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
    crsPeak: '#2DD4BF',
    crsModerate: '#F59E0B',
    crsLow: '#F87171',
  },
  dark: {
    background: '#111827',
    surface: '#1F2937',
    text: '#F9FAFB',
    textSecondary: '#9CA3AF',
    border: '#374151',
    crsPeak: '#5EEAD4',
    crsModerate: '#FBBF24',
    crsLow: '#FCA5A5',
  },
};
```

---

## Screens

### 1. Dashboard (Home)
- CRS gauge + metric cards + insight + sleep summary + weekly trend
- Pull-to-refresh triggers immediate health data sync
- "Last synced: X min ago" indicator

### 2. History
- Calendar view (select date)
- Daily detail: CRS timeline, sleep, activity, stress events
- Weekly/monthly trends as charts
- Export data (CSV) option

### 3. Settings
- Profile (name, chronotype, goals)
- Connected devices (manage wearable connections)
- Messaging channels (link/unlink Telegram/WhatsApp)
- Notifications (frequency, quiet hours)
- CRS weights (advanced: show current weights, allow reset)
- Data & privacy (export, delete account)
- Dark mode toggle
- About

### 4. Onboarding
- 5-step flow as described above

---

## Typography

Using system fonts (no custom font loading needed):

| Element | Size | Weight |
|---------|------|--------|
| CRS Score | 48px | Bold |
| Section Header | 20px | SemiBold |
| Metric Value | 24px | Bold |
| Metric Label | 12px | Regular |
| Body Text | 16px | Regular |
| Caption | 12px | Regular |
| Insight Text | 15px | Regular, Italic |

---

## Interaction Patterns

### Feedback Loop
- After every proactive message: "Was this helpful?" inline button
- Two options: thumbs up / thumbs down
- Feeds into CRS weight adjustment and stress threshold tuning
- No friction: single tap, no modal

### Chat from App
- "Reply" button on insight card opens Telegram/WhatsApp to bot chat
- Deep link: `tg://resolve?domain=onesync_bot` or `https://wa.me/<number>`
- No in-app chat for MVP (keep it simple, use existing messaging platforms)

### Pull-to-Refresh
- Dashboard: triggers immediate Health Connect read + CRS recomputation
- Shows brief loading animation on gauge
- Updates "Last synced" timestamp
