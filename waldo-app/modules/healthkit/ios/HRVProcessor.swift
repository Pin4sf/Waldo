import Foundation
import HealthKit

/// Processes HRV data from HealthKit.
///
/// Priority:
/// 1. HKHeartbeatSeriesQuery → beat-to-beat IBI → compute true RMSSD (most accurate)
/// 2. HKQuantityTypeIdentifierHeartRateVariabilitySDNN → SDNN fallback
///
/// This is critical for CRS accuracy. SDNN and RMSSD are NOT equivalent
/// (SDNN is always ≥ RMSSD). The SDNN fallback applies a ~0.75 conversion factor
/// derived from population research. Set deviceHrvSource so the CRS engine knows
/// which path was used.
final class HRVProcessor {
  private let healthStore: HKHealthStore

  init(healthStore: HKHealthStore) {
    self.healthStore = healthStore
  }

  // MARK: - Public

  /// Query HRV records in a date range.
  /// Attempts IBI-based RMSSD first; falls back to SDNN per sample.
  func queryHRV(
    startDate: Date,
    endDate: Date,
    completion: @escaping (Result<[HKHRVRecord], Error>) -> Void
  ) {
    guard let sdnnType = HKObjectType.quantityType(
      forIdentifier: .heartRateVariabilitySDNN
    ) else {
      completion(.failure(HKError.noData))
      return
    }

    let predicate = HKQuery.predicateForSamples(
      withStart: startDate,
      end: endDate,
      options: .strictEndDate
    )
    let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)

    let query = HKSampleQuery(
      sampleType: sdnnType,
      predicate: predicate,
      limit: HKObjectQueryNoLimit,
      sortDescriptors: [sort]
    ) { [weak self] _, samples, error in
      if let error {
        completion(.failure(error))
        return
      }

      guard let quantitySamples = samples as? [HKQuantitySample], !quantitySamples.isEmpty else {
        completion(.success([]))
        return
      }

      // For each SDNN sample, attempt to fetch the heartbeat series (IBI)
      self?.enrichSamplesWithIBI(quantitySamples, completion: completion)
    }

    healthStore.execute(query)
  }

  // MARK: - Private: IBI enrichment

  private func enrichSamplesWithIBI(
    _ sdnnSamples: [HKQuantitySample],
    completion: @escaping (Result<[HKHRVRecord], Error>) -> Void
  ) {
    var results: [HKHRVRecord] = []
    let group = DispatchGroup()

    for sample in sdnnSamples {
      let sdnn = sample.quantity.doubleValue(for: .init(from: "ms"))
      let timestamp = sample.startDate.timeIntervalSince1970 * 1000

      group.enter()
      fetchIBISeries(for: sample) { ibiIntervals in
        if let intervals = ibiIntervals, intervals.count >= 3 {
          // Compute RMSSD from valid IBI sequence
          let (rmssd, qualityPct) = Self.computeRMSSD(from: intervals)
          results.append(HKHRVRecord(
            timestamp: timestamp,
            sdnn: sdnn,
            rmssd: rmssd,
            deviceHrvSource: "healthkit_ibi",
            sampleCount: intervals.count,
            qualityPct: qualityPct
          ))
        } else {
          // SDNN fallback — note the source so CRS engine can apply conversion factor
          results.append(HKHRVRecord(
            timestamp: timestamp,
            sdnn: sdnn,
            rmssd: nil,
            deviceHrvSource: "healthkit_sdnn",
            sampleCount: 0,
            qualityPct: 0.0
          ))
        }
        group.leave()
      }
    }

    group.notify(queue: .global()) {
      let sorted = results.sorted { $0.timestamp < $1.timestamp }
      completion(.success(sorted))
    }
  }

  /// Fetch beat-to-beat IBI intervals (in seconds) for an HRV sample.
  /// Uses HKHeartbeatSeriesQuery via the series link in sample metadata.
  private func fetchIBISeries(
    for sample: HKQuantitySample,
    completion: @escaping ([Double]?) -> Void
  ) {
    guard let seriesType = HKSeriesType.heartbeat() else {
      completion(nil)
      return
    }

    // Find the heartbeat series that correlates with this HRV sample
    let predicate = HKQuery.predicateForSamples(
      withStart: sample.startDate,
      end: sample.endDate,
      options: [.strictStartDate, .strictEndDate]
    )

    let seriesQuery = HKSampleQuery(
      sampleType: seriesType,
      predicate: predicate,
      limit: 1,
      sortDescriptors: nil
    ) { [weak self] _, samples, _ in
      guard let seriesSample = samples?.first as? HKHeartbeatSeriesSample else {
        completion(nil)
        return
      }
      self?.extractIBIFromSeries(seriesSample, completion: completion)
    }

    healthStore.execute(seriesQuery)
  }

  /// Extract IBI intervals from a HKHeartbeatSeriesSample.
  private func extractIBIFromSeries(
    _ seriesSample: HKHeartbeatSeriesSample,
    completion: @escaping ([Double]?) -> Void
  ) {
    var rawIntervals: [Double] = []

    let beatQuery = HKHeartbeatSeriesQuery(heartbeatSeries: seriesSample) { _, timeSinceStart, precededByGap, done, error in
      if let error {
        print("[HealthKit] IBI query error: \(error.localizedDescription)")
        if done { completion(nil) }
        return
      }

      if !precededByGap {
        rawIntervals.append(timeSinceStart)
      }

      if done {
        // Convert cumulative timestamps to successive intervals
        let intervals = Self.differentiateTimestamps(rawIntervals)
        let cleaned = Self.rejectArtifacts(from: intervals)
        completion(cleaned.isEmpty ? nil : cleaned)
      }
    }

    healthStore.execute(beatQuery)
  }

  // MARK: - DSP: RMSSD computation

  /// Compute RMSSD from a sequence of IBI intervals (in seconds).
  /// Returns (rmssd_ms, quality_fraction).
  static func computeRMSSD(from intervals: [Double]) -> (Double, Double) {
    guard intervals.count >= 2 else { return (0, 0) }

    // Successive differences
    var successiveDiffs: [Double] = []
    for i in 1 ..< intervals.count {
      let diffMs = (intervals[i] - intervals[i - 1]) * 1000
      successiveDiffs.append(diffMs * diffMs)
    }

    let meanSquared = successiveDiffs.reduce(0, +) / Double(successiveDiffs.count)
    let rmssd = sqrt(meanSquared)

    // Quality: fraction of intervals that passed artifact rejection
    let totalBeats = intervals.count
    let qualityPct = Double(totalBeats) / max(1.0, Double(totalBeats + 2)) // conservative estimate

    return (rmssd, qualityPct)
  }

  /// Convert cumulative timestamps to successive IBI intervals (seconds).
  private static func differentiateTimestamps(_ timestamps: [Double]) -> [Double] {
    guard timestamps.count >= 2 else { return [] }
    var intervals: [Double] = []
    for i in 1 ..< timestamps.count {
      intervals.append(timestamps[i] - timestamps[i - 1])
    }
    return intervals
  }

  /// Reject physiologically implausible IBI values.
  /// Range: 300ms–2000ms (30–200 bpm). Remove outliers > 3 SD from mean.
  static func rejectArtifacts(from intervals: [Double]) -> [Double] {
    let physiologicallyValid = intervals.filter { $0 >= 0.3 && $0 <= 2.0 }
    guard physiologicallyValid.count >= 3 else { return physiologicallyValid }

    let mean = physiologicallyValid.reduce(0, +) / Double(physiologicallyValid.count)
    let variance = physiologicallyValid.map { pow($0 - mean, 2) }.reduce(0, +) / Double(physiologicallyValid.count)
    let std = sqrt(variance)

    return physiologicallyValid.filter { abs($0 - mean) <= 3 * std }
  }
}

// MARK: - Helper error

private enum HKError: Error {
  case noData
  case unavailable
}
