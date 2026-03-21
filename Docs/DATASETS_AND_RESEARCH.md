# OneSync — Datasets & Research Foundation

**Date:** March 16, 2026
**Purpose:** Public datasets, academic research, and device accuracy studies relevant to validating the CRS algorithm, stress detection, and sleep-cognition models. Use these before writing training code, and reference them in the IIT Ropar study design.

---

## Quick Summary

| Dataset | Type | Size | HRV? | Stress Labels? | Sleep? | Access | Priority |
|---------|------|------|------|----------------|--------|--------|----------|
| **WESAD** | Lab, real sensors | 15 subjects | Yes (ECG + BVP) | Yes (3 states) | No | Kaggle / UCI | **P0** |
| **SWELL-KW** | Office stress, HRV | 25 subjects | Yes (RMSSD computed) | Yes (3 conditions) | No | Kaggle | **P0** |
| **HRV + Cognitive Load** | Cognitive tests + HRV | N=30 | Yes (RMSSD, LF, HF) | Cognitive load | No | Kaggle | **P0** |
| **TILES-2018/2019** | Longitudinal workplace | 212 workers (10 weeks) | Yes (Fitbit) | Yes (surveys) | Yes | tiles-data.isi.edu | **P1** |
| **Wearanize+** | Sleep + PSG gold std | 130 subjects | Yes (IBI) | No | PSG gold std | Radboud Repo | **P1** |
| **Sleep Deprivation + Cognition** | Sleep → performance | Multiple | No | No | Yes | Kaggle | **P1** |
| **Wearable Stress + Exercise** | Lab, stress + cycling | 36 subjects | Yes (ECG) | Yes (Stroop + TMCT) | No | PhysioNet / Kaggle | **P1** |
| **PMData** | Garmin lifelogging | 16 users (5 months) | Garmin native | No | Yes | Simula / Kaggle | **P2** |
| **Smartwatch 40K** | Synthetic smartwatch | 40,000 rows | Yes (RMSSD) | Yes (1–10 scale) | Yes | Kaggle | **P2** |
| **PhysioNet RR Databases** | Clinical ECG-derived | 50+ subjects | Yes (gold std) | No | No | physionet.org | **P2** |

---

## Tier 1 — Start Here (Direct CRS + Stress Detection Validation)

### 1. WESAD — Wearable Stress and Affect Detection

**Source:** Kaggle (CC BY 4.0) + UCI ML Repository
**Link:** kaggle.com/datasets/orvile/wesad-wearable-stress-affect-detection-dataset
**Paper:** Schmidt et al., ICMI 2018, Boulder

**What it is:** The gold standard academic dataset for wearable stress detection. 15 subjects wore both a chest device (RespiBAN: ECG, EDA, EMG, respiration, temperature, 3-axis accel at 700Hz) and a wrist device (Empatica E4: BVP, EDA, temperature, accel) through a lab protocol with three distinct states:
- **Baseline** — sitting relaxed, reading magazines
- **Stress** — Trier Social Stress Test (public speaking + mental arithmetic)
- **Amusement** — watching funny film clips

**Signals:** ECG (→ RR intervals → RMSSD), Blood Volume Pulse (→ HRV), EDA (electrodermal activity = skin conductance), EMG, respiration rate, body temperature, 3-axis acceleration. 538 columns total.

**Published accuracy:**
- Binary (stress vs non-stress): **up to 93%** with chest ECG features
- 3-class (baseline/stress/amusement): **up to 80%**
- Wrist-only (closer to smartwatch reality): lower, ~70–78%

**What OneSync uses it for:**
- Validate which HRV features (RMSSD, LF/HF ratio, SDNN) best separate stress from baseline
- Benchmark our weighted confidence scoring against published methods
- Understand the accuracy ceiling for wrist-PPG-based stress detection (vs chest ECG)
- Validate that multi-signal approach (HRV + HR + EDA proxy from skin temp) beats single-signal

**Important limitation:** Lab-induced acute stress (Trier Social Stress Test) ≠ chronic workplace stress. Our CRS targets chronic/accumulating cognitive load, not the spike. This dataset validates signal sensitivity, not our exact use case.

**Kaggle notebooks to start with:**
- "HRV-Based Stress Classification Using the WESAD" by anuragkr24
- "WESAD HRV Features Extraction & Classification" by anuragkr24

---

### 2. SWELL-KW — Knowledge Work Stress Dataset

**Source:** Kaggle (free) + DANS data archive
**Link:** kaggle.com/datasets/qiriro/swell-heart-rate-variability-hrv
**Paper:** Koldijk et al., ICMI 2014 + IEEE Trans. Affect. Comput. 2018

**What it is:** 25 knowledge workers did realistic computer tasks (email + document writing) under three conditions directly relevant to OneSync's target users:
1. **No stress (neutral):** Work as long as needed
2. **Time pressure:** 2/3 of the time the user took in neutral
3. **Interruption:** 8 irrelevant email interruptions during the task

HRV indices computed from IBI using a 5-minute sliding window — this is exactly how OneSync computes CRS. Includes subjective ratings: task load, mental effort, perceived stress (PSS-4), emotion (SAM).

**What OneSync uses it for:**
- **Most directly relevant dataset we have.** Knowledge workers under time pressure and interruption = OneSync's exact target user under stress
- Validate that HRV drops under time pressure (confirms CRS stress component logic)
- Cross-reference with self-reported stress (our Feedback Loop target)
- Feature selection: which HRV features from a 5-min window best predict perceived stress?
- Establish realistic baselines for knowledge worker RMSSD distributions

**Note:** The dataset is HRV indices only (not raw RR intervals). RMSSD, SDNN, LF, HF, LF/HF, pNN50, pNN20 are pre-computed. Good for model training, not for testing the IBI → RMSSD pipeline itself.

---

### 3. HRV and Cognitive Mental Load

**Source:** Kaggle (CC BY-NC-SA 4.0)
**Link:** kaggle.com/datasets/audityasutarto/heart-rate-variability-and-cognitive-mental-load
**Paper:** Izzah et al., Jurnal Teknik Industri (2022) + JOSI (2023)

**What it is:** HRV features measured during two cognitive load tests — the d2 Attention Test (sustained selective attention) and the Switcher Featuring Test. 30 participants. NASA-TLX workload rating as ground truth.

**Columns:** participant, trial, HR, SDNN, RMSSD, LF, HF, LF/HF ratio, NASA-TLX score (9 columns total, 18 columns in extended version)

**What OneSync uses it for:**
- Direct validation that RMSSD correlates with cognitive load (the HRV → CRS link)
- NASA-TLX is a well-validated cognitive workload metric — correlating our CRS with NASA scores validates CRS concept
- LF/HF ratio behavior under cognitive stress (not just acute physical/emotional stress)
- Small and clean enough for a quick EDA notebook in a day

---

## Tier 2 — Deeper Validation (Sleep + Longitudinal + Real Wearables)

### 4. TILES-2018 and TILES-2019

**Source:** tiles-data.isi.edu (USC Institute for Information Sciences)
**Papers:** Mundnich et al., Scientific Data 2020 (Nature); Booth et al., PMC 2022

**What it is:** Two longitudinal datasets from hospital workers wearing real consumer wearables at a real workplace — the closest thing to OneSync's actual use case.

- **TILES-2018:** 212 hospital employees (nurses, nursing assistants, physicians), Fitbit Alta HR for 10 weeks + Mindsync EAR (ambient audio), OMsignal smart shirt (ECG, respiration, posture) for a subset, office/locker room environmental sensors, EMA surveys
- **TILES-2019:** 57 medical residents in ICU, same sensor suite, 5 weeks

**Data includes:** Continuous HR + step data from Fitbit, 5-min HRV windows, sleep duration, EMA survey responses (stress, mood, fatigue, social), job performance indicators, personality assessment (Big Five), PSQI sleep quality

**What OneSync uses it for:**
- **Time-of-day HRV normalization validation** — TILES has 10 weeks of continuous HR/HRV data. We can empirically validate that HRV dips in the afternoon (our March 7 correction to ALGORITHMS_AND_HEALTH.md)
- Validate that sleep quality (previous night) predicts next-day HRV baseline
- Model the 7-day "dead zone" problem — how many days does it take for personal baselines to stabilize?
- Validate CRS weight rationale — does sleep account for more variance in performance than HRV?
- Real wearable data from non-lab setting = most honest validation source available

**Access:** Register at tiles-data.isi.edu. Data use agreement required. Free for research.

**Practical note:** This dataset is large (multi-GB). Start with the EMA survey + daily Fitbit summary CSV before touching raw time-series.

---

### 5. Wearanize+

**Source:** Radboud Data Repository (CC BY 4.0)
**Link:** pmc.ncbi.nlm.nih.gov/articles/PMC12888818/ (Radboud University, 2025)

**What it is:** 130 healthy adults, one night each, with simultaneous full polysomnography (PSG gold standard) and three wearables: Zmax EEG headband, Empatica E4 wristband (PPG → IBI → HRV, EDA, skin temp), ActivPAL leg patch. Questionnaires: PSQI, MADRE, PHQ-9.

PSG channels recorded at 256 Hz. Empatica E4: BVP at 64 Hz, EDA at 4 Hz, skin temp at 4 Hz, IBI computed from BVP.

**What OneSync uses it for:**
- **Validate sleep scoring accuracy** — compare Empatica E4 wrist PPG-derived sleep stages against gold-standard PSG. This gives us the accuracy ceiling for wrist PPG sleep staging (Samsung Galaxy Watch uses wrist PPG)
- Understand where wrist wearable sleep data fails vs succeeds (which stages are most misclassified)
- Calibrate our sleep score component: if wrist PPG misclassifies deep sleep 30% of the time, how should we weight the confidence of the sleep component in CRS?
- IBI quality analysis: what percentage of Empatica E4 IBI readings pass our artifact filter (the 300–2000ms physiological range + adaptive median filter)?

---

### 6. Sleep Deprivation and Cognitive Performance

**Source:** Kaggle (free)
**Link:** kaggle.com/datasets/sacramentotechnology/sleep-deprivation-and-cognitive-performance

**What it is:** Effects of sleep deprivation on cognitive performance and emotional regulation, 2024 study. Reaction time, sustained attention, error rate, mood ratings under different sleep conditions.

**What OneSync uses it for:**
- Directly validates the sleep component weight (35%) in CRS
- Build a simple regression: sleep duration/quality → next-day cognitive performance
- Quantify: how much does <6h sleep degrade performance vs 7–9h? (Calibrate the penalty slopes in our sleep score function)

---

### 7. Wearable Device Dataset during Stress and Exercise (PhysioNet)

**Source:** PhysioNet → Kaggle (ODC-By 1.0)
**Link:** kaggle.com/datasets/protobioengineering/wearable-device-dataset-during-stress-and-exercise
**Original:** physionet.org/content/wearable-device-dataset/1.0.1/

**What it is:** 36 subjects (18+18, two cohorts) through controlled stress and exercise protocols:
- **Stress:** Stroop Test + Trier Mental Challenge Test (math under time pressure + annoying sound) + opinion reversal + backward counting from 1022 in steps of 13
- **Aerobic exercise:** Bike at increasing pace/resistance (60–95 rpm)
- **Anaerobic exercise:** Wingate Test (30s max effort cycles)
Participants self-reported stress level 1–10 before/after each task. Blood glucose measured throughout.

**What OneSync uses it for:**
- Validate that stress detection signals look different from exercise signals (our activity exclusion logic in stress detection)
- Baseline → stress → rest → stress patterns: validate our 10-minute temporal persistence threshold
- Blood glucose as a confound signal: understand what exercise-induced HR/HRV changes look like (false positive territory for stress detection)
- Stroop Test is a validated cognitive stress induction — HRV response patterns directly inform our stress threshold calibration

---

## Tier 3 — Feature Exploration and Algorithm Testing

### 8. PMData — Sports Lifelogging Dataset (Garmin)

**Source:** Kaggle + Simula Datasets (simula.no)
**Link:** kaggle.com/datasets/vlbthambawita/pmdata-a-sports-logging-dataset

**What it is:** 16 participants, ~5 months of continuous logging. Garmin wearable data (HR, steps, sleep, stress score, calories), food logging (photos), weight measurements, subjective wellbeing ratings.

**What OneSync uses it for:**
- Garmin-native stress score behavior over time: understand what Garmin calls "stress" and how it relates to HRV
- Long-term baseline drift: how do HRV baselines shift over months?
- Activity pattern effects on next-day HRV
- Validate our 7-day and 30-day rolling baseline window lengths

---

### 9. Smartwatch Health Metrics Dataset (40,000 rows)

**Source:** Kaggle (free)
**Link:** kaggle.com/datasets/amar5693/smartwatch-health-metrics-dataset-40000

**What it is:** 40,000 rows of synthetic but physiologically realistic daily smartwatch data. Sleep duration (total/deep/REM), average HR, HRV, stress level (1–10), SpO2, screen unlocks, sedentary minutes, steps.

**Important:** This is synthetic (generated, not real measurements). Use for:
- Rapid prototyping of CRS pipeline before using real data
- Testing edge cases (extreme HRV values, missing data, overlapping conditions)
- Dashboard/visualization testing with realistic-looking distributions
- **Do not use for model validation** — synthetic data inflates accuracy

---

### 10. PhysioNet RR Interval Databases

**Source:** physionet.org (free, various licenses)
**Key databases:**
- **Normal Sinus Rhythm RR Interval Database:** 54 long-term ECG recordings, 30 men + 24 women, ages 28–76, normal sinus rhythm
- **Congestive Heart Failure RR Database:** 29 ECG recordings (for comparison/outlier detection)
- **MIT-BIH Normal Sinus Rhythm Database** (on Kaggle: Heart Rate Time Series): 1800 evenly-spaced instantaneous HR measurements per subject

**What OneSync uses it for:**
- **Algorithm unit testing** — run our RMSSD computation function on gold-standard ECG-derived RR intervals and verify output matches published values
- Validate our artifact rejection (interpolation instead of deletion): compare RMSSD with vs without interpolation on the same RR series
- Stress the IBI pipeline with real cardiac data including ectopic beats
- Test our physiological range filter (300–2000ms window) on real data

---

## Device Accuracy Reality Check

> Source: kygo.app analysis of 17 peer-reviewed studies (2024–2025) comparing consumer wearables against gold standards. This directly informs how much we should trust each device's data in OneSync's CRS.

### Nocturnal HRV Accuracy (vs ECG gold standard)

| Device | MAPE (lower = better) | Notes |
|--------|----------------------|-------|
| **Oura Gen 4** | **5.96%** | Best available wrist device |
| WHOOP | 8.17% | Good, mainly sleep-time |
| Garmin | 10.52% | Good for daily baseline |
| Polar Chest Strap | 16.32% | Surprisingly worse than Oura |
| Samsung Galaxy Watch | Not in this study | Estimated ~8–12% from other studies |

### Sleep Staging Accuracy (independent study, vs PSG)

| Device | Cohen's κ | Deep Sleep | REM | Wake |
|--------|----------|------------|-----|------|
| **Apple Watch 8** | **0.53** | 50.7% | 68.6% | 52.2% |
| Fitbit Sense | 0.42 | 48.3% | 55.5% | 39.2% |
| WHOOP 4.0 | 0.37 | **69.6%** | 62.0% | 32.5% |
| Garmin | 0.21 | Poor | 28.7% | 27.6% |

> κ=0.53 means moderate agreement with PSG (gold standard is κ=1.0). Garmin's κ=0.21 (poor) means sleep stage data from Garmin is nearly unreliable for fine-grained staging. **This is critical for OneSync's sleep component** — Garmin users' sleep scores will be less accurate than Samsung/Apple/Oura users.

### Key implications for OneSync CRS:

1. **Sleep score confidence should be device-tagged.** Samsung/Oura/Apple get full weight. Garmin sleep stages get 50–60% weight (reflect uncertainty). Xiaomi/budget devices get 40% weight (HR+duration only, no staging).

2. **HRV quality varies by device.** When a Samsung GW6 reports RMSSD=45ms, that has ~8–10% measurement error baked in. Build this into the confidence scoring — never treat wrist HRV as ground truth.

3. **WHOOP is best for deep sleep detection** (69.6%) — if we ever integrate WHOOP, their deep sleep value is the most trustworthy. For REM, Apple Watch is better.

4. **Oura is the most accurate overall** for both sleep and HRV — Oura users will get the highest-quality CRS of any currently supported device.

---

## Validation Roadmap for OneSync

### Phase 1 (Now — before MVP launch): Algorithm sanity checks

| What to validate | Dataset | Expected outcome |
|------------------|---------|-----------------|
| RMSSD computation matches published values | PhysioNet RR databases | Error < 1ms vs reference implementation |
| Artifact interpolation vs deletion bias | PhysioNet + WESAD ECG | Interpolation produces less biased RMSSD |
| Stress vs baseline HRV difference is detectable | WESAD wrist BVP | RMSSD drops ≥15% under TSST stress |
| Sleep duration → next-day cognitive performance | Sleep Deprivation dataset | r > 0.5 correlation |
| HRV + sleep > either signal alone for CRS | WESAD + SWELL combined | Multivariate model outperforms univariate |

**Time estimate:** 1–2 weekends. Python notebooks. No ML training needed — pure statistics.

### Phase 2 (Weeks 4–8, during MVP build): Feature validation

| What to validate | Dataset | Expected outcome |
|------------------|---------|-----------------|
| Knowledge worker HRV under time pressure | SWELL-KW | RMSSD decreases during time pressure condition |
| Time-of-day HRV normalization factors | TILES-2018 | HRV shows circadian pattern, afternoon dip |
| Personal baseline stabilization window | TILES longitudinal | 5–7 days sufficient for reliable baseline |
| Multi-signal confidence > single signal | WESAD | Weighted confidence outperforms binary AND gate |

### Phase 3 (IIT Ropar Study): Clinical validation

| What to validate | Ground truth | Target |
|------------------|-------------|--------|
| CRS vs PVT (reaction time) | Psychomotor Vigilance Task | r > 0.6 |
| CRS vs N-back working memory | N-back task scores | r > 0.5 |
| Stress alert accuracy | Salivary cortisol | Specificity > 80% |
| Sleep component vs PSG | Polysomnography | κ > 0.45 for Samsung GW |

---

## Quick Start: What to Run This Week

```
1. Download WESAD from Kaggle (kaggle.com/datasets/orvile/wesad-wearable-stress-affect-detection-dataset)
   → Run the "HRV-Based Stress Classification" notebook
   → Note: wrist (E4) vs chest accuracy difference
   → Goal: understand what RMSSD looks like before/during/after TSST

2. Download SWELL HRV from Kaggle (kaggle.com/datasets/qiriro/swell-heart-rate-variability-hrv)
   → Plot RMSSD distributions for 3 conditions (neutral / time_pressure / interruption)
   → Goal: confirm HRV drops under knowledge-work stress (validates CRS logic)

3. Download HRV + Cognitive Load (kaggle.com/datasets/audityasutarto/heart-rate-variability-and-cognitive-mental-load)
   → Correlate RMSSD with NASA-TLX score
   → Goal: quantify RMSSD → cognitive load relationship (validates CRS HRV weight)

4. PhysioNet RR data for algorithm unit test:
   → physionet.org/content/nsr2db/ (Normal Sinus Rhythm)
   → Compute RMSSD using our TypeScript formula (ported to Python)
   → Compare against reference RMSSD values from published papers
```

All four are free to download, no registration required for 1–3, and the entire initial analysis fits in a single Jupyter notebook.

---

## References

- Schmidt et al. "Introducing WESAD" — ICMI 2018
- Koldijk et al. "SWELL Knowledge Work Dataset" — ICMI 2014; IEEE TAFFC 2018
- Mundnich et al. "TILES-2018" — Scientific Data (Nature) 2020
- Booth et al. "TILES-2019" — PMC 2022
- Wearanize+ — PMC 2025 (Radboud University)
- Izzah et al. "Machine Learning for Cognitive Stress Detection Using HRV" — JTI 2022
- Hongn et al. "Wearable Device Dataset during Stress and Exercise" — PhysioNet 2023
- kygo.app "What's the Most Accurate Wearable Data" — 17-study meta-analysis, 2024–2025
- Thambawita et al. "PMData: A Sports Logging Dataset" — MMSports 2020
