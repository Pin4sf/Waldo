# OneSync -- Hardware Strategy Note (Parallel Track)

Last updated: March 7, 2026

This is a STRATEGIC NOTE documenting the parallel hardware direction. No changes to the current software MVP plan. The software architecture must remain hardware-ready without being hardware-dependent.

---

## THE VISION

OneSync is not just a software product. The full vision includes custom hardware (OneBand wristband + ear/temple module) designed for athletic cognitive performance monitoring, initially targeting NFL teams.

## TEAM SPLIT

| Person | Responsibility |
|--------|---------------|
| **Shivansh** | Software platform (OneSync OS, Agent OS, app, backend, AI) |
| **Ansh + Mayur** | Hardware development (OneBand wristband, ear/temple module, firmware, sensors) |

## TARGET MARKET

- **NFL teams** -- coach/manager dashboards showing real-time cognitive readiness per player
- **Professional sports** broadly -- any sport where cognitive fatigue affects performance
- **Initial pitch**: Software platform with existing wearables -> prove value -> introduce custom hardware

---

## EAR/TEMPLE MODULE -- BIOSENSING RESEARCH

### Anatomical Locations Ranked for Cognitive Biosensing

| Location | Best Signals | EEG Quality | Practicality for NFL |
|----------|-------------|-------------|---------------------|
| **Temple (temporal region)** | EEG (thin bone, temporal cortex access), EMG (temporalis muscle), PPG (superficial temporal artery) | Good -- 60-70% of scalp-EEG amplitude | Moderate -- under helmet, potential pressure from helmet padding |
| **Periauricular (behind ear)** | EEG (cEEGrid validated), skin temp | Moderate -- 30-50% of scalp-EEG | **Best** -- fits in helmet ear cutout, no hair interference, protected from impact |
| **Mastoid process (bony bump behind ear)** | EEG reference/ground, bone conduction, head impact IMU | Low-moderate as active EEG site | Good -- stable bony surface for IMU, natural reference electrode |
| **Ear canal (in-ear)** | PPG (gold standard during motion), core body temp (tympanic), limited EEG | Low -- 10-30% of scalp-EEG | Good -- existing sports in-ear devices prove feasibility |
| **Tragus** | PPG, vagus nerve proximity | Very low EEG | Moderate -- good secondary PPG site |

**Answer to "what's the bone behind the ear?":** That's the **mastoid process** -- the bony protrusion you can feel behind your earlobe. It's a standard EEG reference electrode location (TP9/TP10 in the 10-20 system) and an excellent spot for an IMU to detect head impacts.

### Recommended Approach: Periauricular + In-Ear Hybrid

The **behind-the-ear (periauricular)** region is the sweet spot because:
- No hair interference (unlike scalp)
- Fits naturally in helmet ear cutouts
- Protected from direct impacts by the helmet
- Validated by cEEGrid research (University of Oldenburg, Debener et al.)
- Captures temporal lobe EEG + temporal muscle EMG simultaneously
- Pairs with an **in-ear tip** for PPG and tympanic temperature

---

## SIGNAL ANALYSIS BY SENSOR TYPE

### EEG -- What's Actually Possible from the Ear

| Metric | From Periauricular (6-8 electrodes) | From In-Ear (1-3 electrodes) |
|--------|--------------------------------------|-------------------------------|
| **Cognitive fatigue detection** | Good (theta/alpha ratio increase) | Moderate |
| **Focus / attention tracking** | Good (beta increase, alpha suppression) | Poor-Moderate |
| **Stress / arousal** | Moderate-Good (beta, alpha asymmetry) | Poor |
| **Drowsiness / alertness** | Very Good (best-validated ear-EEG use case) | Moderate |
| **Flow state** | Moderate (theta-alpha crossover) | Poor |
| **Concussion markers** | Under research (altered alpha/theta) | Insufficient |

**Key finding:** With 6-8 periauricular electrodes (cEEGrid-style flex array), you can achieve:
- **>85% accuracy** for binary cognitive state (alert vs. fatigued)
- **75-85% accuracy** for multi-class (focused / normal / fatigued / stressed)
- This is sufficient for relative within-player tracking across a game

**Frequency bands accessible from ear/temple:**
- Alpha (8-13 Hz) -- attention, relaxation (well-captured)
- Beta (13-30 Hz) -- cognitive engagement, focus (well-captured)
- Theta (4-8 Hz) -- memory, cognitive load, fatigue (well-captured)
- Gamma (>30 Hz) -- heavily attenuated, not reliable from ear

**Critical NFL consideration:** EEG during active play (running, tackling) will be artifact-contaminated. **Usable EEG windows are between plays** (huddle, pre-snap, sideline) -- 25-40 seconds between plays plus sideline time. This is actually the most interesting cognitive window: decision-making readiness, fatigue accumulation, focus quality.

Strategy: **Accelerometer-gated EEG acquisition** -- only analyze data during low-movement periods, flagged by the mastoid IMU.

### EMG -- Temple/Jaw Muscle Monitoring

| Signal | Sensor Location | What It Reveals | Strength |
|--------|----------------|-----------------|----------|
| **Jaw clenching intensity** | Temple (temporalis muscle) | Direct stress/arousal marker | Very strong (50-500 uV) |
| **Clenching frequency** | Temple | Chronic stress pattern | Strong |
| **Pre-snap tension** | Temple | Anticipatory arousal, readiness | Strong |
| **Fatigue (baseline tension rise)** | Temple | Mental fatigue accumulates as increased resting tension | Moderate |

**EMG is much more robust to motion than EEG.** You can capture meaningful temporal EMG even during moderate physical activity. This makes it the most reliable cognitive stress marker DURING active play.

### PPG -- Heart Rate / HRV

| Location | Accuracy (HR) | HRV Reliability | Motion Artifact |
|----------|---------------|-----------------|-----------------|
| **Ear canal** | +/-1-2 BPM (near ECG-grade) | Excellent | Very low |
| **Tragus** | +/-2-3 BPM | Good | Low-moderate |
| **Temple** | +/-2-4 BPM | Good | Moderate |
| **Wrist (comparison)** | +/-3-7 BPM | Moderate, degrades during movement | **High -- worst during exercise** |

**Ear-based PPG is dramatically superior to wrist PPG during physical activity.** This alone justifies the ear module for sports use. During NFL gameplay, wrist PPG becomes nearly unusable while ear canal PPG maintains accuracy.

### Core Body Temperature

**Tympanic (ear canal) temperature** is the clinical gold standard for core body temperature. The tympanic membrane shares blood supply with the hypothalamus (internal carotid artery). Accuracy: +/-0.1-0.2C of true core temp.

**NFL value:** Heat stroke prevention and thermoregulatory monitoring. This alone could justify the ear module to NFL medical staff -- heat-related illness is a major concern.

### Head Impact Detection

**Mastoid-mounted IMU** (6-axis accelerometer + gyroscope) provides:
- Direct head kinematics during impacts
- Rotational acceleration (key concussion metric)
- Cumulative head impact exposure over a game/season
- This is a massive value-add for NFL -- ties into their Head Health Initiative

---

## COMPLETE HARDWARE SENSOR CONFIGURATION

### Ear Module (Behind-Ear + In-Ear)

| Sensor | Location | Purpose |
|--------|----------|---------|
| 6-8 dry EEG electrodes (Ag/AgCl or conductive polymer) | Periauricular flex-PCB array (cEEGrid-style) | Cognitive state: focus, fatigue, stress, alertness |
| 2 EMG electrodes | Temple-facing edge of behind-ear module | Temporal muscle tension, jaw clenching, stress |
| PPG sensor (green + IR LED + photodiode) | In-ear tip | HR, HRV (gold standard during motion) |
| Thermistor / IR temperature sensor | In-ear tip, aimed at tympanic membrane | Core body temperature |
| 6-axis IMU (accelerometer + gyroscope) | Behind-ear module body | Head impact detection, motion artifact reference |
| MEMS microphone | In-ear or behind-ear | Ambient sound, communication detection, audio artifact reference |
| Bluetooth LE 5.x SoC | Behind-ear module | Data transmission |
| Rechargeable battery (50-100 mAh) | Behind-ear module | Target: 4+ hour runtime |

### OneBand (Wristband)

| Sensor | Purpose |
|--------|---------|
| EDA/GSR electrodes | Sympathetic nervous system arousal (palmar wrist -- much higher sweat gland density than ear) |
| PPG (backup) | HR/HRV when ear module is removed |
| SpO2 sensor | Blood oxygen saturation |
| 9-axis IMU | Body motion, activity classification |
| Skin temperature | Peripheral temperature (complements core temp from ear) |
| Barometer (optional) | Altitude/environmental context |

### Combined: The Cognitive Performance Signal Stack

| # | Signal Category | Source | What It Measures |
|---|----------------|--------|-----------------|
| 1 | **Brain state** | Ear EEG (periauricular) | Focus, fatigue, cognitive load, alertness |
| 2 | **Neuromuscular state** | Ear EMG (temporal) | Stress tension, jaw clenching, anticipatory arousal |
| 3 | **Cardiovascular state** | Ear PPG (in-ear) | HR, HRV, autonomic balance (accurate during motion) |
| 4 | **Thermoregulatory state** | Ear thermistor (tympanic) | Core temperature, heat stress risk |
| 5 | **Autonomic arousal** | Wrist EDA | Stress, emotional arousal, sympathetic activation |
| 6 | **Physical state** | Wrist + Ear IMU | Activity level, exertion, recovery |
| 7 | **Head impact exposure** | Ear IMU (mastoid) | Cumulative head kinematics, rotational acceleration |
| 8 | **Environmental context** | Ear mic + wrist barometer | Noise levels, altitude, communication detection |

### What's Still Missing (Even With Both Modules)

| Signal | Why It Matters | Current Status |
|--------|---------------|----------------|
| Blood biomarkers (cortisol, lactate) | Direct stress/fatigue hormones | Sweat-based sensing emerging, not reliable yet |
| Eye tracking / pupil dilation | Strong cognitive load marker | Would need glasses-based module |
| High-density EEG | Better spatial resolution | Accept limitation -- periauricular is sufficient for state classification |
| Respiratory rate | Fatigue, recovery marker | Partially inferrable from PPG respiratory sinus arrhythmia |

### Verdict: Is This Enough for Cognitive Performance Mapping?

**Yes.** The wristband + ear module provides sufficient signals for **relative cognitive state tracking** -- measuring how an individual athlete's state changes over a game, across games, and across a season.

It is NOT enough for clinical diagnosis or cross-individual comparison without calibration. But NFL teams want: "Is Player X's cognitive readiness declining in the 4th quarter vs 1st?" -- and this sensor suite answers that definitively.

---

## NFL FEASIBILITY

### Physical Survivability

| Challenge | Risk | Mitigation |
|-----------|------|------------|
| Impact (tackles) | High | Behind-ear module protected by helmet. Medical-grade encapsulation, flex-PCB, conformal coating |
| Sweat | High | IP67/68 rating. Ear canal is less sweaty than most body locations. Hydrophobic electrode coating |
| Helmet interaction | Medium | NFL helmets have ear cutouts. Custom-fit modules nestle into this space. Collaborate with Riddell/Vicis/Schutt |
| Temperature extremes | Medium | Games -10C to +45C. Battery and electronics rated accordingly |
| RF interference | Low-Medium | Stadium RF is dense. Shielded design, high CMRR on EEG amplifier |

### Precedent for Ear Devices in NFL

- **Quarterback communication earpieces** -- already approved, establishes in-ear electronics precedent
- **Cosinuss** -- proven in-ear vital signs monitoring in professional cycling and team sports
- **Riddell InSite** -- helmet-mounted impact sensors were NFL-approved (now discontinued)
- **Zebra RFID chips** -- approved in shoulder pads since 2014 for player tracking
- **Instrumented mouthguards** -- Stanford/Michigan research, NFL-funded for head impact measurement

### Approval Path

| Phase | Scope | Difficulty |
|-------|-------|-----------|
| **Practice/training** | Easiest -- team medical staff discretion | Low |
| **Sideline during games** | Moderate -- team equipment staff approval | Medium |
| **In-game on-field** | Hardest -- NFL Competition Committee + NFLPA | High (2-4 year timeline) |

**Strategy:** Start with practice/training use. Build evidence base. Then pursue sideline, then in-game.

### Key Regulatory/Political Considerations

- **NFLPA** must approve (player biometric data is a sensitive labor issue)
- **HIPAA compliance** for health data storage and transmission
- **FDA classification** -- if marketed as "cognitive performance monitoring" (wellness), likely exempt. If marketed as "concussion detection" (medical), FDA Class II clearance needed
- **Data rights** -- who owns the cognitive data? Player? Team? This is a negotiation point

---

## EXISTING COMPETITORS AND RESEARCH

### Products to Watch

| Company | Product | Relevance |
|---------|---------|-----------|
| **cEEGrid / TMSi** | Flex-PCB periauricular EEG array | Core EEG technology reference for ear module |
| **IDUN Technologies** (Zurich) | Behind-ear dry EEG patch | Commercial EEG from behind ear, SDK available |
| **Neurable** | MW75 Neuro headphones | Focus/distraction tracking via around-ear EEG |
| **Cosinuss** | In-ear vital signs | Proven sports-grade ear PPG + core temp |
| **Muse S/2** | Headband EEG (TP9/TP10 mastoid positions) | Consumer EEG, meditation/focus |
| **BrainScope Ahead 300** | FDA-cleared EEG concussion assessment | Precedent for EEG in sports medicine |
| **Catapult / Kinexon** | Player tracking (GPS, accelerometer) | Current NFL standard -- no cognitive data |

### Key Research Papers

- Debener et al., "Unobtrusive ambulatory EEG using flexible printed electrodes around the ear" (Scientific Reports, 2015)
- Bleichner & Debener, "Concealed, Unobtrusive Ear-Centered EEG Acquisition: cEEGrids" (Frontiers in Human Neuroscience, 2017)
- Kidmose et al., "A Study of Evoked Potentials from Ear-EEG" (IEEE Trans. Biomedical Engineering, 2013)
- Goverdovsky et al., "In-Ear EEG from Viscoelastic Generic Earpieces" (IEEE Sensors Journal, 2016)
- Mandic group (Imperial College London) -- extensive in-ear EEG for cognitive state

---

## SOFTWARE REQUIREMENTS (For When Hardware Is Ready)

These requirements inform software architecture decisions NOW:

### 1. Sensor Abstraction Layer
All health data must be source-agnostic:
```
{ value, timestamp, source, device_id, sensor_location, confidence, sample_rate }
```
Whether data comes from Health Connect, Samsung SDK, or OneBand -- same interface.

### 2. High-Frequency Data Path
Consumer wearables: data every 15 min.
Custom hardware: potentially 100Hz+ streaming (EEG at 250Hz, EMG at 500Hz, PPG at 100Hz).
The data pipeline must handle both batch and stream ingestion.

### 3. Multi-Device Fusion
When a player wears both wristband and ear module:
- Sensor fusion logic combines signals for unified cognitive score
- Conflict resolution (two HR sources? Use higher-confidence one)
- Schema needs: device_id, sensor_location fields from day one

### 4. Team Dashboard (Multi-User)
NFL use case requires:
- Role-based access: player, coach, trainer, team manager
- Real-time multi-player view during games
- Historical analytics per player, per game, per season
- Supabase RLS supports this with team_id + role scoping

### 5. Real-Time Streaming
During a game, coaches need LIVE cognitive load:
- Supabase Realtime (WebSocket) for live telemetry
- Sub-second data delivery from hardware -> phone -> cloud -> dashboard
- This aligns with Phase 2's Supabase Realtime for in-app chat

### 6. CRS Algorithm Extensibility
Current CRS has 4 components (HRV, sleep, circadian, activity).
Hardware adds: EDA component, EEG-cognitive component, EMG-stress component.
The weighted scoring system is already designed for adding new components.

### 7. Accelerometer-Gated Processing
EEG quality depends on motion state. The software must:
- Classify motion state from IMU data (still, walking, running, impact)
- Only process EEG during low-motion windows
- Tag all neural data with motion_state and quality_score
- This is a software concern even though the sensor is hardware

---

## WHAT DOESN'T CHANGE IN MVP

- Build with consumer wearables (Samsung, Garmin, Health Connect)
- Prove CRS algorithm works with available signals
- Validate AI agent value proposition
- All Phase 1-3 plans remain as-is

## CONVERGENCE TIMELINE

| Phase | Software | Hardware | Integration |
|-------|----------|----------|-------------|
| Phase 1-2 | MVP + expand with consumer wearables | OneBand + ear module prototyping | None yet |
| Phase 3 | Multi-user, team dashboard foundations | Hardware alpha testing | Define integration protocol |
| Phase 4 | Custom hardware SDK, team dashboard | Hardware beta | First integrated demo |
| Phase 5 | Full platform with custom hardware support | Production hardware | NFL pilot with full stack |

## OPEN QUESTIONS FOR ANSH + MAYUR

1. Electrode material choice: dry Ag/AgCl vs conductive polymer vs textile -- tradeoff between signal quality, comfort, and durability
2. Flex-PCB design: cEEGrid-style adhesive array vs rigid behind-ear clip
3. In-ear tip: universal fit (silicone tips like earbuds) vs custom-molded (better contact, higher cost)
4. BLE data throughput: can BLE 5.x handle 250Hz EEG (8 channels) + 100Hz PPG + 500Hz EMG simultaneously?
5. Battery chemistry: target 4h+ runtime with full sensor suite active
6. Firmware: on-device preprocessing (artifact rejection, feature extraction) vs raw streaming?
