# Apple HealthKit Data Types — Technical Report for Third-Party iOS Apps

**Date:** 2026-03-20
**Purpose:** Comprehensive reference for what health data Apple Watch exposes to third-party apps via HealthKit, limitations, and comparison with Android Health Connect.

---

## 1. Heart-Related Data

### 1.1 Heart Rate
- **Type:** `HKQuantityTypeIdentifier.heartRate`
- **Unit:** count/min (BPM)
- **Availability:** Full access for third-party apps with user authorization
- **Sampling:** During workouts: ~1 sample/sec. Background: periodic (roughly every 5-15 minutes when worn). Each sample includes start/end timestamps and device metadata.

### 1.2 Resting Heart Rate
- **Type:** `HKQuantityTypeIdentifier.restingHeartRate`
- **Unit:** count/min
- **Availability:** Computed by Apple Watch over the day. Written as a single daily value. Third-party apps can read.

### 1.3 Walking Heart Rate Average
- **Type:** `HKQuantityTypeIdentifier.walkingHeartRateAverage`
- **Unit:** count/min
- **Availability:** Computed by Apple Watch. Written as a daily summary value. Third-party readable.

### 1.4 Heart Rate Recovery (1-minute)
- **Type:** `HKQuantityTypeIdentifier.heartRateRecoveryOneMinute`
- **Unit:** count/min
- **Availability:** Records the reduction in heart rate from peak exercise rate to the rate one minute after exercising ends. Third-party readable. Introduced iOS 16.

### 1.5 Heart Rate Variability — SDNN
- **Type:** `HKQuantityTypeIdentifier.heartRateVariabilitySDNN`
- **Unit:** milliseconds (ms)
- **Format:** SDNN only. Apple computes the Standard Deviation of Normal-to-Normal (NN) intervals from PPG-derived pulse rate variability (PRV). The raw RR intervals used to compute SDNN are discarded; only the final SDNN value is stored.
- **RMSSD:** HealthKit does NOT provide RMSSD as a native data type. However, RMSSD can be derived from HKHeartbeatSeriesQuery data (see below).
- **Measurement window:** Apple Watch measures HRV periodically throughout the day (typically ~every 3 hours when conditions allow). Each measurement uses approximately a 60-second window of inter-beat intervals.
- **Limitation:** These are PRV estimates (from optical PPG), not true ECG-derived RR intervals. Accuracy degrades with motion, poor skin contact, or tattoos.

### 1.6 Heartbeat Series — Beat-to-Beat / IBI Data (CRITICAL)
- **Type:** `HKSeriesType.heartbeat()` / `HKHeartbeatSeriesSample`
- **Query:** `HKHeartbeatSeriesQuery`
- **What it provides:** Individual heartbeat timestamps as `timeSinceSeriesStart` (TimeInterval in seconds from the series start date). You get a sequence of timestamps for each detected beat.
- **IBI derivation:** Compute IBI by subtracting consecutive `timeSinceSeriesStart` values: `IBI[i] = timestamp[i+1] - timestamp[i]`
- **`precededByGap` flag:** Boolean per-beat indicating whether a gap in sensor data occurred before this beat (sensor went down, poor contact, etc.). Essential for filtering artifacts before computing HRV.
- **RMSSD computation:** Yes, third-party apps CAN compute RMSSD from these IBI values. Multiple apps on the App Store do this (e.g., Sleep HRV). This is the workaround for Apple not providing native RMSSD.
- **Availability:** Recorded during Apple's periodic HRV measurements (background, several times per day) and during workouts. NOT real-time streaming — data is available only after it has been written to the HealthKit store.
- **Introduced:** iOS 13 / watchOS 6 (WWDC 2019, Session 218)
- **Two-step query pattern:** (1) Run `HKSampleQuery` to fetch `HKHeartbeatSeriesSample` objects, (2) Initialize `HKHeartbeatSeriesQuery` with each sample to enumerate individual beat timestamps.

### 1.7 Heart Rate Events (Category Types)
- `HKCategoryTypeIdentifier.highHeartRateEvent` — Triggered when heart rate exceeds user-configured threshold while inactive
- `HKCategoryTypeIdentifier.lowHeartRateEvent` — Triggered when heart rate drops below threshold
- `HKCategoryTypeIdentifier.irregularHeartRhythmEvent` — Possible atrial fibrillation detected

### 1.8 Atrial Fibrillation Burden
- **Type:** `HKQuantityTypeIdentifier.atrialFibrillationBurden`
- **Unit:** Percentage (%)
- **Availability:** Introduced iOS 16. Estimates the percentage of time the heart shows signs of AFib. Third-party readable.

---

## 2. Sleep Data

### 2.1 Sleep Analysis
- **Type:** `HKCategoryTypeIdentifier.sleepAnalysis`
- **Values (HKCategoryValueSleepAnalysis):**
  - `.inBed` — User is in bed (can be written by iPhone or third-party apps)
  - `.awake` — User is awake during a sleep session (synonym: `.asleepUnspecified` in older APIs)
  - `.asleepCore` — Light/intermediate sleep (watchOS 9+ / iOS 16+)
  - `.asleepDeep` — Deep sleep (watchOS 9+ / iOS 16+)
  - `.asleepREM` — REM sleep (watchOS 9+ / iOS 16+)

### 2.2 Granularity
- Each sleep stage is stored as a separate `HKCategorySample` with start and end timestamps.
- Typical resolution: Apple Watch records stage transitions roughly every ~30 seconds to several minutes (not second-level, but minute-level transitions).
- A full night's sleep produces multiple sequential samples, each tagged with the stage.

### 2.3 Requirements
- Sleep stages require Apple Watch Series 3 or later with watchOS 9+, and Sleep Focus must be enabled.
- iPhone alone (without Apple Watch) only records `.inBed` based on device usage patterns.
- Third-party sleep trackers can write their own sleep stage data to HealthKit.

### 2.4 Sleep-Related Vitals
- `HKQuantityTypeIdentifier.appleSleepingWristTemperature` — Wrist temperature deviation during sleep (see Section 4)
- `HKQuantityTypeIdentifier.appleSleepingBreathingDisturbances` — Breathing disturbance events during sleep (introduced later, related to sleep apnea detection)
- `HKCategoryTypeIdentifier.sleepApneaEvent` — Sleep apnea event detection

---

## 3. Raw Sensor Data & ECG

### 3.1 Raw PPG (Photoplethysmography)
- **NOT available** via HealthKit. Apple does not expose raw PPG waveform data to third-party apps.
- Raw PPG is available ONLY through **SensorKit**, which requires:
  - Apple approval (entitlement request)
  - IRB-approved research study
  - Data available only after 24-hour delay
- SensorKit sensor type: `SRSensor.photoplethysmogram`
- For non-research apps: you get the derived metrics (heart rate, HRV, SpO2) but never the raw optical signal.

### 3.2 Raw Accelerometer
- **NOT available** via HealthKit directly.
- **CMSensorRecorder** (CoreMotion framework): Can record up to 12 hours of accelerometer data in the background on Apple Watch. This is NOT HealthKit — it's a separate CoreMotion API.
- **CoreMotion** on Watch: Can access real-time accelerometer/gyroscope during an active workout session (requires your WatchKit app to be in foreground or have an active workout session).
- **SensorKit**: 24/7 accelerometer access for research apps (with entitlement + 24-hour delay).

### 3.3 ECG Data (HKElectrocardiogram)
- **Type:** `HKElectrocardiogram` (special sample type, not a quantity type)
- **Query for voltage:** `HKElectrocardiogramQuery`
- **What third-party apps get:**
  - **Raw voltage measurements:** Yes. Each ECG recording provides a series of voltage values (in microvolts) with timestamps.
  - **Sampling rate:** 512 Hz (confirmed from Apple's ECG specifications)
  - **Duration:** ~30 seconds per recording
  - **Number of measurements:** ~15,360 voltage samples per recording (512 Hz x 30s)
  - **Lead:** Single-lead (Lead I) ECG
- **Classification property** (`HKElectrocardiogram.Classification`):
  - `.sinusRhythm` — Normal sinus rhythm
  - `.atrialFibrillation` — AFib detected
  - `.inconclusiveLowHeartRate` — HR too low for classification
  - `.inconclusiveHighHeartRate` — HR too high for classification
  - `.inconclusivePoorReading` — Poor signal quality
  - `.inconclusiveOther` — Other inconclusive
  - `.unrecognized` — Unrecognized classification
  - `.notSet` — Not yet classified
- **Average heart rate:** Available as a property on the sample
- **Availability:** iOS 14+ / watchOS 7+. Third-party apps CAN read ECG recordings and their raw voltage data with user permission. They CANNOT initiate an ECG recording — users must use the Apple ECG app.
- **Important:** This is the richest raw-ish data Apple provides. 512 Hz voltage series is genuinely useful for research.

---

## 4. Other Vitals

### 4.1 Blood Oxygen / SpO2
- **Type:** `HKQuantityTypeIdentifier.oxygenSaturation`
- **Unit:** Percentage (%)
- **Availability:** Third-party apps can read every SpO2 reading — daytime, overnight, and during workouts.
- **Sampling:** Apple Watch measures periodically in background (especially during sleep) and on-demand when user opens Blood Oxygen app.
- **Devices:** Apple Watch Series 6+

### 4.2 Respiratory Rate
- **Type:** `HKQuantityTypeIdentifier.respiratoryRate`
- **Unit:** count/min (breaths per minute)
- **Availability:** Measured during sleep by Apple Watch. Third-party readable.
- **Note:** Apple Watch computes respiratory rate from accelerometer and PPG data during sleep. Not a continuous daytime metric.

### 4.3 Sleeping Wrist Temperature
- **Type:** `HKQuantityTypeIdentifier.appleSleepingWristTemperature`
- **Unit:** Celsius (relative deviation from personal baseline, not absolute temperature)
- **Availability:** Recorded during sleep only, on Apple Watch Series 8, Ultra, and later. Sleep Focus must be enabled. Third-party readable.
- **Introduced:** iOS 16 / watchOS 9
- **Note:** Values are relative deviations (e.g., +0.3 degrees C above baseline), not absolute wrist temperature. Takes ~5 nights to establish a baseline.

### 4.4 Body Temperature
- **Type:** `HKQuantityTypeIdentifier.bodyTemperature`
- **Unit:** Celsius or Fahrenheit
- **Note:** This is a general-purpose type for manually entered or third-party thermometer readings. NOT automatically measured by Apple Watch.

### 4.5 Basal Body Temperature
- **Type:** `HKQuantityTypeIdentifier.basalBodyTemperature`
- **Unit:** Celsius or Fahrenheit
- **Note:** For reproductive health / cycle tracking. Can be written by third-party devices (e.g., Oura, Tempdrop).

### 4.6 Blood Pressure
- **Types:** `HKQuantityTypeIdentifier.bloodPressureSystolic` and `HKQuantityTypeIdentifier.bloodPressureDiastolic`
- **Correlation:** `HKCorrelationTypeIdentifier.bloodPressure` (groups systolic + diastolic together)
- **Availability:** Apple Watch does NOT measure blood pressure (as of watchOS 11). These types exist for data from external Bluetooth BP cuffs or manual entry. Third-party apps can read/write.
- **Category event:** `HKCategoryTypeIdentifier.hypertensionEvent` (newer addition)

### 4.7 Blood Glucose
- **Type:** `HKQuantityTypeIdentifier.bloodGlucose`
- **Unit:** mg/dL or mmol/L
- **Availability:** Apple Watch does NOT measure blood glucose. This type exists for data from CGMs (e.g., Dexcom, Libre) or manual entry. Third-party readable/writable.

### 4.8 Peripheral Perfusion Index
- **Type:** `HKQuantityTypeIdentifier.peripheralPerfusionIndex`
- **Unit:** Percentage (%)

### 4.9 Electrodermal Activity
- **Type:** `HKQuantityTypeIdentifier.electrodermalActivity`
- **Unit:** Siemens
- **Note:** Apple Watch does NOT measure EDA. This exists for third-party devices.

### 4.10 Breathing Disturbances
- **Type:** `HKQuantityTypeIdentifier.appleSleepingBreathingDisturbances`
- **Availability:** Sleep apnea detection feature. Introduced in watchOS 11 / iOS 18. Third-party readable.

---

## 5. Activity & Fitness Data

### 5.1 Core Activity Metrics
| Type Identifier | Unit | Notes |
|---|---|---|
| `stepCount` | count | Cumulative, from Watch + iPhone |
| `distanceWalkingRunning` | meters | |
| `distanceCycling` | meters | |
| `distanceSwimming` | meters | |
| `distanceWheelchair` | meters | |
| `distanceDownhillSnowSports` | meters | |
| `distanceCrossCountrySkiing` | meters | |
| `distancePaddleSports` | meters | |
| `distanceRowing` | meters | |
| `distanceSkatingSports` | meters | |
| `flightsClimbed` | count | ~3 meters elevation = 1 flight |
| `activeEnergyBurned` | kilocalories | |
| `basalEnergyBurned` | kilocalories | |
| `appleExerciseTime` | minutes | Green ring minutes |
| `appleMoveTime` | minutes | |
| `appleStandTime` | minutes | |
| `appleStandHour` (category) | boolean/hour | Blue ring |
| `pushCount` | count | Wheelchair users |
| `swimmingStrokeCount` | count | |

### 5.2 Running Metrics (Advanced)
| Type Identifier | Unit | Notes |
|---|---|---|
| `runningSpeed` | m/s | |
| `runningStrideLength` | meters | |
| `runningVerticalOscillation` | centimeters | |
| `runningGroundContactTime` | milliseconds | |
| `runningPower` | watts | |

### 5.3 Cycling Metrics
| Type Identifier | Unit | Notes |
|---|---|---|
| `cyclingSpeed` | m/s | |
| `cyclingCadence` | RPM | |
| `cyclingPower` | watts | |
| `cyclingFunctionalThresholdPower` | watts | |

### 5.4 Other Sports
| Type Identifier | Unit |
|---|---|
| `crossCountrySkiingSpeed` | m/s |
| `paddleSportsSpeed` | m/s |
| `rowingSpeed` | m/s |

### 5.5 Mobility & Gait Metrics
| Type Identifier | Unit | Notes |
|---|---|---|
| `walkingSpeed` | m/s | Background-measured |
| `walkingStepLength` | meters | |
| `walkingAsymmetryPercentage` | % | Gait asymmetry |
| `walkingDoubleSupportPercentage` | % | |
| `appleWalkingSteadiness` | Score (0-1) | Fall risk indicator |
| `stairAscentSpeed` | m/s | |
| `stairDescentSpeed` | m/s | |
| `sixMinuteWalkTestDistance` | meters | Cardio fitness proxy |

### 5.6 Cardio Fitness
- **Type:** `HKQuantityTypeIdentifier.vo2Max`
- **Unit:** mL/kg/min
- **Availability:** Estimated by Apple Watch during outdoor walks/runs/hikes. Third-party readable.
- **Category event:** `HKCategoryTypeIdentifier.lowCardioFitnessEvent`

### 5.7 Workout Sessions
- **Type:** `HKWorkoutType` / `HKWorkout`
- **Contains:** Workout type, duration, energy burned, distance, associated route (GPS), heart rate samples during workout.
- Third-party apps can both read and write workouts.

### 5.8 Physical Effort & Workout Effort
- `HKQuantityTypeIdentifier.physicalEffort`
- `HKQuantityTypeIdentifier.workoutEffortScore`
- `HKQuantityTypeIdentifier.estimatedWorkoutEffortScore`

### 5.9 Other Activity Types
| Type Identifier | Unit | Notes |
|---|---|---|
| `underwaterDepth` | meters | Dive depth (Ultra) |
| `waterTemperature` | Celsius | During water activities |
| `timeInDaylight` | minutes | Outdoor light exposure |

---

## 6. Background Delivery

### 6.1 HKObserverQuery
- A long-running query that monitors the HealthKit store for new/deleted samples matching a predicate.
- When a matching change occurs, iOS wakes your app (even if terminated) and calls the update handler.
- **The update handler does NOT tell you WHAT changed** — only that something changed for that data type. You must run a separate query (e.g., `HKAnchoredObjectQuery`) inside the handler to fetch the actual new data.

### 6.2 enableBackgroundDelivery
- **Method:** `HKHealthStore.enableBackgroundDelivery(for:frequency:withCompletion:)`
- **Entitlement required:** `com.apple.developer.healthkit.background-delivery`
- **Frequency options:**
  - `.immediate` — System will attempt to wake your app as soon as new data is written. In practice, NOT truly instant — subject to system throttling, battery optimization, and iOS scheduling. May be delayed by minutes.
  - `.hourly` — At most once per hour.
  - `.daily` — At most once per day.
- **Key constraint:** "Your app is called at most once per time period defined by the frequency." Even with `.immediate`, iOS coalesces multiple rapid writes into a single callback.

### 6.3 Practical Limitations
1. **App gets brief execution time:** When woken in background, your app gets a few seconds (on iOS) to fetch data and process it. Must call the completion handler promptly.
2. **Failure handling:** If you don't call the completion handler, HealthKit retries with exponential backoff up to 3 times, then stops delivering updates entirely.
3. **Reliability issues:** Multiple developers report `HKObserverQuery` callbacks becoming inconsistent over time, especially when the Health app stops notifying the parent app. Killing the Health app or restarting the device sometimes helps.
4. **watchOS limitations:** On watchOS, apps can receive at most 4 background updates per hour, and only if the app has a complication on the active watch face.
5. **Not a live stream:** HealthKit background delivery is event-driven, not continuous. You get notified when new data appears in the store, not in real-time as the sensor measures.

### 6.4 Data Flow Timeline
```
Apple Watch sensor → watchOS processes data → Writes to local HealthKit store →
iPhone HealthKit store syncs (can take minutes to hours) →
HKObserverQuery fires on iPhone → Your app wakes briefly → You query for new data
```

---

## 7. Data Apple Watch Collects but Does NOT Expose to Third-Party Apps

### 7.1 Confirmed NOT Available via HealthKit
| Data | Status | Notes |
|---|---|---|
| **Raw PPG waveform** | NOT exposed | Only derived metrics (HR, HRV, SpO2). Available via SensorKit (research only). |
| **Raw accelerometer stream** | NOT exposed via HealthKit | Available via CoreMotion (CMSensorRecorder for up to 12h; real-time during workout sessions). SensorKit for 24/7 research. |
| **Raw gyroscope stream** | NOT exposed via HealthKit | Same as accelerometer — CoreMotion or SensorKit only. |
| **Real-time sensor streaming** | NOT possible | All HealthKit data is post-hoc. No real-time data streaming from sensors to third-party apps. |
| **Continuous heart rate streaming** | NOT possible via HealthKit | During active workout sessions on watchOS, you can get near-real-time HR via `HKLiveWorkoutBuilder`, but this requires the watch app to be active. |
| **HRV computation method internals** | NOT exposed | Apple's exact algorithm for SDNN computation is opaque. |
| **Double Tap gesture data** | NOT exposed | Hardware gesture recognition, not a health metric. |
| **Wrist detection events** | NOT exposed as health data | Internal to watchOS. |
| **Fall detection raw data** | Partially exposed | `numberOfTimesFallen` quantity type exists, and fall events are logged. But the raw accelerometer/gyroscope data that triggered the detection is not available. |
| **Crash detection data** | NOT in HealthKit | Separate system; can be shared via a different API pathway. |
| **Cardio Fitness Notifications internal model** | NOT exposed | Only the `lowCardioFitnessEvent` category and VO2 Max values are exposed, not Apple's internal classification model. |

### 7.2 Restricted Access Tiers
| Tier | Access | Examples |
|---|---|---|
| **HealthKit (standard)** | Any App Store app with user consent | All types listed in this document |
| **HealthKit + Clinical Records** | Apps with `com.apple.developer.healthkit.access` entitlement (specific capability values) | FHIR clinical data from hospitals |
| **SensorKit** | IRB-approved research apps only, Apple entitlement required | Raw PPG, 24/7 accelerometer, ambient light, keyboard metrics |
| **CoreMotion** | Any app (for limited use cases) | Accelerometer/gyroscope during active sessions, pedometer |

---

## 8. HealthKit vs. Android Health Connect — Comparison

### 8.1 Data Type Coverage

| Data Category | Apple HealthKit | Android Health Connect |
|---|---|---|
| **HRV format** | SDNN only (+ raw beats via HeartbeatSeries) | RMSSD only (`HeartRateVariabilityRmssdRecord`) |
| **Beat-to-beat / IBI** | Yes (`HKHeartbeatSeriesQuery`) | No native equivalent |
| **ECG raw voltage** | Yes (512 Hz, ~30s, Lead I) | No |
| **Sleep stages** | Wake, REM, Core, Deep (4 stages) | Awake, Light, Deep, REM, Sleeping (unspecified) |
| **SpO2** | Yes (`oxygenSaturation`) | Yes (`OxygenSaturationRecord`) |
| **Respiratory rate** | Yes | Yes (`RespiratoryRateRecord`) |
| **Wrist/skin temperature** | Yes (sleep-only, relative deviation) | Yes (`SkinTemperatureRecord`) |
| **Blood pressure** | Yes (manual/device entry) | Yes (`BloodPressureRecord`) |
| **Blood glucose** | Yes (manual/CGM entry) | Yes (`BloodGlucoseRecord`) |
| **VO2 Max** | Yes | Yes (`Vo2MaxRecord`) |
| **AFib burden** | Yes (`atrialFibrillationBurden`) | No |
| **Walking steadiness** | Yes (fall risk) | No |
| **Running biomechanics** | Yes (5 metrics: speed, stride, ground contact, vertical oscillation, power) | Speed and cadence only |
| **Symptom tracking** | Yes (39+ symptoms as category types) | No |
| **Audiogram** | Yes (`HKAudiogramSample`) | No |
| **Underwater depth** | Yes | No |
| **Background delivery** | Yes (`HKObserverQuery`) | Yes (but different mechanism) |
| **Data retention** | Unlimited (on-device) | 30-day read limit for newly authorized apps |
| **Clinical records (FHIR)** | Yes (with entitlement) | Yes (MedicalDataRecord, newer) |
| **Total quantity types** | ~120 | ~49 |

### 8.2 Key Differences for OneSync

1. **HRV:** HealthKit gives SDNN; Health Connect gives RMSSD. For OneSync's CRS algorithm, you need both. On iOS, you can compute RMSSD from `HKHeartbeatSeriesQuery` IBI data. On Android, you can compute SDNN from the same raw IBI data if the wearable writes beat-level data to Health Connect (Samsung Health does, for example).

2. **ECG:** HealthKit provides raw 512 Hz voltage data. Health Connect has no ECG type. This is a significant iOS advantage for any app wanting to do ECG analysis.

3. **Beat-to-beat data:** `HKHeartbeatSeriesQuery` is a unique HealthKit feature. Health Connect has no equivalent. This gives iOS apps access to richer HRV analysis (time-domain, frequency-domain) than Android apps get from the platform alone.

4. **Data history:** HealthKit has no read-horizon limit. Health Connect limits reads to 30 days before permission was granted (for newly installed/reinstalled apps). This is a significant limitation for onboarding — you can't access a new user's historical health data on Android.

5. **Background delivery:** Both platforms support it, but HealthKit's `HKObserverQuery` with `.immediate` frequency is more granular than Health Connect's change notification system.

6. **Data richness:** HealthKit has roughly 2.5x more data types than Health Connect. The gap is especially large in symptoms, mobility metrics, running biomechanics, and audio exposure.

---

## 9. Complete HKQuantityTypeIdentifier Enumeration (120 types)

For reference, the full list as of iOS 18 / watchOS 11:

**Body Measurements:** BodyMassIndex, BodyFatPercentage, Height, BodyMass, LeanBodyMass, WaistCircumference

**Fitness/Activity:** StepCount, DistanceWalkingRunning, DistanceCycling, DistanceSwimming, DistanceWheelchair, DistanceDownhillSnowSports, DistanceCrossCountrySkiing, DistancePaddleSports, DistanceRowing, DistanceSkatingSports, BasalEnergyBurned, ActiveEnergyBurned, FlightsClimbed, PushCount, SwimmingStrokeCount, AppleExerciseTime, AppleMoveTime, AppleStandTime

**Running:** RunningSpeed, RunningStrideLength, RunningVerticalOscillation, RunningGroundContactTime, RunningPower

**Cycling:** CyclingSpeed, CyclingCadence, CyclingPower, CyclingFunctionalThresholdPower

**Other Sports:** CrossCountrySkiingSpeed, PaddleSportsSpeed, RowingSpeed

**Mobility:** WalkingSpeed, WalkingStepLength, WalkingAsymmetryPercentage, WalkingDoubleSupportPercentage, AppleWalkingSteadiness, StairAscentSpeed, StairDescentSpeed, SixMinuteWalkTestDistance

**Heart:** HeartRate, RestingHeartRate, WalkingHeartRateAverage, HeartRateRecoveryOneMinute, HeartRateVariabilitySdnn, AtrialFibrillationBurden

**Vitals:** BodyTemperature, BasalBodyTemperature, BloodPressureSystolic, BloodPressureDiastolic, RespiratoryRate, OxygenSaturation, AppleSleepingWristTemperature, AppleSleepingBreathingDisturbances, PeripheralPerfusionIndex, ElectrodermalActivity

**Blood/Lab:** BloodGlucose, BloodAlcoholContent, InsulinDelivery

**Respiratory:** ForcedExpiratoryVolume1, ForcedVitalCapacity, PeakExpiratoryFlowRate, InhalerUsage

**Audio:** EnvironmentalAudioExposure, HeadphoneAudioExposure, EnvironmentalSoundReduction

**Fitness Scores:** VO2Max, PhysicalEffort, WorkoutEffortScore, EstimatedWorkoutEffortScore

**Other:** NumberOfTimesFallen, NumberOfAlcoholicBeverages, UVExposure, UnderwaterDepth, WaterTemperature, TimeInDaylight, NikeFuel

**Dietary (38 types):** DietaryEnergyConsumed, DietaryFatTotal, DietaryFatPolyunsaturated, DietaryFatMonounsaturated, DietaryFatSaturated, DietaryCholesterol, DietarySodium, DietaryCarbohydrates, DietaryFiber, DietarySugar, DietaryProtein, DietaryVitaminA, DietaryVitaminB6, DietaryVitaminB12, DietaryVitaminC, DietaryVitaminD, DietaryVitaminE, DietaryVitaminK, DietaryCalcium, DietaryIron, DietaryThiamin, DietaryRiboflavin, DietaryNiacin, DietaryFolate, DietaryBiotin, DietaryPantothenicAcid, DietaryPhosphorus, DietaryIodine, DietaryMagnesium, DietaryZinc, DietarySelenium, DietaryCopper, DietaryManganese, DietaryChromium, DietaryMolybdenum, DietaryChloride, DietaryPotassium, DietaryCaffeine, DietaryWater

---

## 10. Complete HKCategoryTypeIdentifier Enumeration (70 types)

**Sleep:** SleepAnalysis, SleepApneaEvent

**Activity:** AppleStandHour

**Heart Events:** HighHeartRateEvent, LowHeartRateEvent, IrregularHeartRhythmEvent

**Fitness Events:** LowCardioFitnessEvent, AppleWalkingSteadinessEvent

**Audio Events:** AudioExposureEvent, EnvironmentalAudioExposureEvent, HeadphoneAudioExposureEvent

**Hygiene:** ToothbrushingEvent, HandwashingEvent

**Mindfulness:** MindfulSession

**Reproductive Health:** CervicalMucusQuality, OvulationTestResult, MenstrualFlow, IntermenstrualBleeding, SexualActivity, Pregnancy, Lactation, Contraceptive, PregnancyTestResult, ProgesteroneTestResult, InfrequentMenstrualCycles, IrregularMenstrualCycles, PersistentIntermenstrualBleeding, ProlongedMenstrualPeriods, BleedingAfterPregnancy, BleedingDuringPregnancy

**Vitals:** HypertensionEvent

**Symptoms (39 types):** AbdominalCramps, Acne, AppetiteChanges, GeneralizedBodyAche, Bloating, BreastPain, ChestTightnessOrPain, Chills, Constipation, Coughing, Diarrhea, Dizziness, DrySkin, Fainting, Fatigue, Fever, HairLoss, Headache, Heartburn, HotFlashes, LossOfSmell, LossOfTaste, LowerBackPain, MemoryLapse, MoodChanges, Nausea, NightSweats, PelvicPain, RapidPoundingOrFlutteringHeartbeat, RunnyNose, ShortnessOfBreath, SinusCongestion, SkippedHeartbeat, SleepChanges, SoreThroat, VaginalDryness, Vomiting, Wheezing, BladderIncontinence

---

## 11. Special Sample Types (Not Quantity or Category)

| Type | Description |
|---|---|
| `HKElectrocardiogram` | ECG recording with raw voltage data (see Section 3.3) |
| `HKHeartbeatSeriesSample` | Beat-to-beat timestamps (see Section 1.6) |
| `HKAudiogramSample` | Hearing test results across frequencies |
| `HKWorkout` | Exercise sessions with associated data |
| `HKWorkoutRoute` | GPS route data for workouts |
| `HKClinicalRecord` | FHIR clinical data from hospitals |
| `HKVisionPrescription` | Eyeglass/contact lens prescriptions |

---

## 12. Implications for OneSync

### What OneSync Can Access on iOS (via HealthKit)
1. Heart rate (periodic + workout), resting HR, walking HR average, HR recovery
2. HRV as SDNN natively; RMSSD computable from HKHeartbeatSeriesQuery IBI data
3. Sleep stages (REM, Core, Deep, Awake) with minute-level granularity
4. SpO2 readings (periodic + on-demand)
5. Respiratory rate (sleep-derived)
6. Wrist temperature deviation during sleep
7. ECG raw voltage data (512 Hz, user-initiated only)
8. Steps, distance, flights, active energy, stand hours
9. VO2 Max estimates
10. Background delivery via HKObserverQuery with .immediate frequency

### What OneSync CANNOT Access on iOS
1. Raw PPG waveform (research-only via SensorKit)
2. Raw accelerometer/gyroscope data (use CoreMotion instead, limited)
3. Real-time continuous sensor streaming
4. RMSSD as a native metric (must compute from beat-to-beat data)
5. Absolute wrist temperature (only relative deviation during sleep)
6. Blood pressure (no Apple Watch sensor; external device only)
7. Blood glucose (no Apple Watch sensor; CGM integration only)
8. Continuous EDA/GSR (no Apple Watch sensor)

### CRS Algorithm Data Availability
For the Composite Resilience Score algorithm described in ONESYNC_RESEARCH_AND_ALGORITHMS.md:
- **HRV (RMSSD):** Computable from HKHeartbeatSeriesQuery on iOS. Native on Android via Health Connect.
- **Resting HR:** Available on both platforms.
- **Sleep quality:** Available on both (stages on iOS; stages on Android depend on wearable).
- **SpO2:** Available on both.
- **Activity/steps:** Available on both.
- **Respiratory rate:** Available on iOS (sleep only). Available on Android if wearable writes it.
- **Skin temperature:** Available on iOS (sleep, relative). Available on Android (`SkinTemperatureRecord`).

---

## Sources

- [HKQuantityTypeIdentifier (Apple Docs)](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier)
- [HKCategoryTypeIdentifier (Apple Docs)](https://developer.apple.com/documentation/healthkit/hkcategorytypeidentifier)
- [HKHeartbeatSeriesQuery (Apple Docs)](https://developer.apple.com/documentation/healthkit/hkheartbeatseriesquery)
- [HKElectrocardiogram (Apple Docs)](https://developer.apple.com/documentation/healthkit/hkelectrocardiogram)
- [HKCategoryValueSleepAnalysis (Apple Docs)](https://developer.apple.com/documentation/healthkit/hkcategoryvaluesleepanalysis)
- [enableBackgroundDelivery (Apple Docs)](https://developer.apple.com/documentation/HealthKit/HKHealthStore/enableBackgroundDelivery(for:frequency:withCompletion:))
- [WWDC 2019 Session 218 — Exploring New Data Representations in HealthKit](https://asciiwwdc.com/2019/sessions/218)
- [Health Connect Data Types (Android Docs)](https://developer.android.com/health-and-fitness/health-connect/data-types)
- [HKQuantityTypeIdentifier Enum (.NET Mirror)](https://learn.microsoft.com/en-us/dotnet/api/healthkit.hkquantitytypeidentifier?view=net-ios-26.0-10.0)
- [HKCategoryTypeIdentifier Enum (.NET Mirror)](https://learn.microsoft.com/en-us/dotnet/api/healthkit.hkcategorytypeidentifier?view=net-ios-26.0-10.0)
- [What You Can (and Can't) Do With Apple HealthKit Data](https://www.themomentum.ai/blog/what-you-can-and-cant-do-with-apple-healthkit-data)
- [iOS 14: HealthKit expands ECGs (9to5Mac)](https://9to5mac.com/2020/06/23/ios-14-healthkit-new-features-opens-ecg-symptoms-more/)
- [SensorKit Photoplethysmogram (Apple Docs)](https://developer.apple.com/documentation/sensorkit/srsensor/photoplethysmogram)
- [restingHeartRate (Apple Docs)](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/restingheartrate)
- [heartRateRecoveryOneMinute (Apple Docs)](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/heartraterecoveryoneminute)
- [appleSleepingWristTemperature (Apple Docs)](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/applesleepingwristtemperature)
