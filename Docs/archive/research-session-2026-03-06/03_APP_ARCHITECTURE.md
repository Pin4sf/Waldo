# OneSync — App Architecture (Finalized)

Last updated: March 6, 2026

---

## Technology Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | React Native + Expo SDK 53+ | Health Connect needs native modules — must use custom dev client, not Expo Go |
| Background sync | `expo-background-task` (WorkManager) | New SDK 53, replaces deprecated expo-background-fetch. 15-min minimum interval |
| Health data | `react-native-health-connect` + `expo-health-connect` config plugin | Android 15: `READ_HEALTH_DATA_IN_BACKGROUND` permission |
| Watch comms | `react-native-wear-connectivity` | Wearable Data Layer API (MessageClient) for Samsung/Garmin companion apps |
| State mgmt | Zustand (client) + TanStack Query (server) + MMKV (KV) | Minimal boilerplate, MMKV is 30x faster than AsyncStorage |
| Local DB | PowerSync (SQLite) | Offline-first with automatic Supabase sync, upload queue |
| UI components | Gluestack-UI v3 | NativeBase successor, tree-shakeable, dark mode, Tailwind-based |
| Charts | react-native-gifted-charts | Line/area charts for health trends. Custom SVG for CRS gauge |
| OEM battery | `react-native-autostarter` | Detects Samsung/Xiaomi/OnePlus, guides user through battery optimization |

---

## Background Processing

### expo-background-task (Recommended)

- Uses WorkManager on Android, BGTaskScheduler on iOS
- Minimum interval: 15 minutes (WorkManager floor)
- Survives app exits and device reboots
- Android 15 `READ_HEALTH_DATA_IN_BACKGROUND` aligns perfectly with 15-min interval

### OEM Battery Kill Rates (from dontkillmyapp.com)

| OEM | Severity | Workaround |
|-----|----------|------------|
| Xiaomi MIUI | Extreme | Enable "Background autostart" + lock in recents |
| Samsung One UI | High | Add to "Apps that won't be put to sleep" |
| Huawei EMUI | Extreme | Multiple power management screens |
| OnePlus OxygenOS | High | ChainLaunchAppListActivity |
| Stock Android/Pixel | Low | Standard Doze only |

**In-app setup guide needed:** Detect OEM, show step-by-step instructions to disable battery optimization. Libraries: `react-native-autostarter`, `@brighthustle/react-native-auto-start`.

---

## Health Connect Integration

### Key Gotchas

1. **Cannot use Expo Go** — requires custom dev client (`expo-dev-client`)
2. **Permission denial is permanent** after 2 declines — UX must be right on first ask
3. **minSdkVersion 26 required** — configure via `expo-build-properties`
4. **Google Play HC declaration** — review takes ~7 days + 5-7 days whitelist propagation (plan 2+ weeks)
5. **Android < 14:** User must install Health Connect app separately
6. **Test on real devices** — emulator support limited

### Expo Config

```json
{
  "expo": {
    "plugins": [
      ["expo-health-connect", {
        "requestPermissionsRationale": "OneSync reads your health data to compute your Cognitive Readiness Score"
      }],
      ["expo-build-properties", {
        "android": {
          "compileSdkVersion": 35,
          "targetSdkVersion": 35,
          "minSdkVersion": 26
        }
      }]
    ]
  }
}
```

---

## Watch-to-Phone Communication

### Primary: Wearable Data Layer API

Library: `react-native-wear-connectivity`
- Wraps MessageClient and DataClient
- Both apps must share same applicationId + signing key
- Bidirectional: `sendMessage()` / `watchEvents.on('message', callback)`

### Fallback: Shared Supabase Backend

- Watch writes directly to Supabase over WiFi/LTE
- Higher latency but works when phone isn't nearby

### For Garmin: Connect IQ Mobile SDK

- Android SDK on Maven Central: `connectiq-android-sdk`
- Watch sends via `Communications.transmit()`, phone receives via listener
- Need to build a native bridge module for React Native

---

## Offline-First Architecture (PowerSync)

```
Background Task (every 15 min)
  --> Read Health Connect
  --> Receive Wear OS MessageClient data
  --> Write to local PowerSync SQLite
  --> PowerSync upload queue syncs to Supabase
  --> If stress trigger → call Edge Function immediately
```

PowerSync handles:
- Automatic bidirectional sync with Supabase Postgres
- Upload queue for offline writes
- Conflict resolution (last-write-wins by timestamp)

### Alternative options evaluated:
- WatermelonDB: Good but must implement sync yourself
- Legend-State: Built-in Supabase sync but less mature
- PowerSync chosen for: automatic sync + Expo support + production-ready

---

## State Management

| Layer | Tool | Purpose |
|-------|------|---------|
| Client state | Zustand | UI state, preferences, current view |
| Server state | TanStack Query | API calls, caching, background refetch. Persist cache to MMKV |
| Persistent KV | MMKV | Settings, tokens, small cached values. 30x faster than AsyncStorage |
| Local database | PowerSync (SQLite) | Health snapshots, offline queue, historical data |

---

## EAS Build Workflow

```bash
# Install dev client
npx expo install expo-dev-client

# Configure EAS
eas build:configure

# Build development APK
eas build --profile development --platform android

# Install on device and run
npx expo start --dev-client
```

### eas.json

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "preview": { "distribution": "internal" },
    "production": {}
  }
}
```

### Including Native Bridges

For Samsung Sensor SDK data receiving and Garmin CIQ SDK, create Expo config plugins or Expo Modules that wrap native code. Gets compiled into dev client during `eas build`.

---

## File Structure (Updated)

```
onesync/
  app.json
  eas.json
  package.json
  src/
    app/                          # Expo Router screens
      _layout.tsx
      index.tsx                   # Dashboard
      onboarding.tsx
      history.tsx
      settings.tsx
    hooks/
      useHealthConnect.ts
      useWearOS.ts
      useAuth.ts
      useTelegram.ts
    lib/
      supabase.ts
      healthConnect.ts
      powerSync.ts
      algorithms/
        crs.ts
        sleep-score.ts
        stress.ts
        hrv.ts                    # RMSSD from raw IBI
      connectors/
        samsung.ts                # Samsung Sensor SDK bridge
        garmin.ts                 # Garmin CIQ bridge
        healthConnect.ts          # Universal HC reader
      messaging/
        router.ts                 # Unified message router
        telegram.ts
        whatsapp.ts
      sync.ts                     # Background sync logic
      notifications.ts
    components/
      CRSGauge.tsx
      StressIndicator.tsx
      SleepSummary.tsx
      MetricCard.tsx
      InsightCard.tsx
      FeedbackButton.tsx
  supabase/
    migrations/
      001_initial.sql
    functions/
      telegram-webhook/
      whatsapp-webhook/
      message-processor/
      message-sender/
      proactive-scheduler/
      process-health-data/
      check-triggers/
      morning-brief/
      compute-baselines/
      adjust-crs-weights/
  watch-apps/
    samsung/                      # Kotlin Wear OS companion
      app/src/main/
    garmin/                       # Monkey C Connect IQ app
      source/
  config/
    soul.md
    agents.md
```
