import Foundation

// MARK: - HRV

/// A single HRV record returned from HealthKit.
/// When beat-to-beat IBI is available, rmssd is computed on-device.
/// Falls back to SDNN when IBI series is unavailable.
struct HKHRVRecord: Codable {
  let timestamp: Double   // Unix ms
  let sdnn: Double        // SDNN in ms (always present)
  let rmssd: Double?      // RMSSD in ms (present when IBI available)
  let deviceHrvSource: String  // "healthkit_ibi" | "healthkit_sdnn"
  let sampleCount: Int    // Number of IBI samples used (0 if SDNN fallback)
  let qualityPct: Double  // Fraction of valid IBI samples (0.0-1.0)
}

// MARK: - Heart Rate

struct HKHeartRateRecord: Codable {
  let timestamp: Double   // Unix ms
  let bpm: Double
  /// 0 = not set, 1 = sedentary, 2 = active
  let motionContext: Int
  let source: String
}

struct HKRestingHeartRateRecord: Codable {
  let timestamp: Double   // Unix ms
  let bpm: Double
  let source: String
}

// MARK: - Sleep

struct HKSleepRecord: Codable {
  let stage: String       // "inBed" | "asleepCore" | "asleepDeep" | "asleepREM" | "awake"
  let startMs: Double     // Unix ms (local time preserved via UTC offset)
  let endMs: Double       // Unix ms
  let durationMinutes: Double
  let source: String
}

// MARK: - Steps

struct HKStepsResult: Codable {
  let totalSteps: Double
  let startMs: Double
  let endMs: Double
  let source: String
}

// MARK: - SpO2

struct HKSpO2Record: Codable {
  let timestamp: Double   // Unix ms
  let percentage: Double
  let source: String
}

// MARK: - Respiratory Rate

struct HKRespiratoryRecord: Codable {
  let timestamp: Double   // Unix ms
  let breathsPerMinute: Double
  let source: String
}

// MARK: - Permissions

struct HKPermissionResult: Codable {
  let overall: String     // "granted" | "denied" | "not_determined" | "restricted"
  let byType: [String: String]
  let deniedTypes: [String]
}
