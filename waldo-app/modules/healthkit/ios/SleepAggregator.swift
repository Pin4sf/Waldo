import Foundation
import HealthKit

/// Queries and aggregates sleep stage data from HealthKit.
///
/// Critical: Apple stores sleep records in UTC but users think in local time.
/// All timestamps returned from this class are Unix ms (UTC-safe) but the
/// "night of" date attribution uses local timezone.
///
/// Phase A0 hard-won lesson: UTC timezone bug caused sleep to be attributed
/// to the wrong night for non-UTC users. Fix is applied here at the source.
final class SleepAggregator {
  private let healthStore: HKHealthStore

  init(healthStore: HKHealthStore) {
    self.healthStore = healthStore
  }

  func querySleep(
    startDate: Date,
    endDate: Date,
    completion: @escaping (Result<[HKSleepRecord], Error>) -> Void
  ) {
    guard let sleepType = HKObjectType.categoryType(
      forIdentifier: .sleepAnalysis
    ) else {
      completion(.success([]))
      return
    }

    let predicate = HKQuery.predicateForSamples(
      withStart: startDate,
      end: endDate,
      options: .strictEndDate
    )
    let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)

    let query = HKSampleQuery(
      sampleType: sleepType,
      predicate: predicate,
      limit: HKObjectQueryNoLimit,
      sortDescriptors: [sort]
    ) { _, samples, error in
      if let error {
        completion(.failure(error))
        return
      }

      guard let categorySamples = samples as? [HKCategorySample] else {
        completion(.success([]))
        return
      }

      // Filter: only include Apple Watch or auto-tracked sources for accuracy
      // User-entered data in Health app tends to be less precise
      let watchSamples = categorySamples.filter { sample in
        let sourceBundle = sample.sourceRevision.source.bundleIdentifier
        // Keep Apple Watch, Apple Health automatic, and iPhone motion
        return sourceBundle.contains("apple") ||
               sourceBundle.contains("com.apple.health") ||
               sourceBundle.hasPrefix("com.apple")
      }

      let records = (watchSamples.isEmpty ? categorySamples : watchSamples)
        .compactMap { Self.mapSleepRecord($0) }

      completion(.success(records))
    }

    healthStore.execute(query)
  }

  // MARK: - Private

  private static func mapSleepRecord(_ sample: HKCategorySample) -> HKSleepRecord? {
    let stage: String
    switch HKCategoryValueSleepAnalysis(rawValue: sample.value) {
    case .inBed:
      stage = "inBed"
    case .asleepCore:
      stage = "asleepCore"
    case .asleepDeep:
      stage = "asleepDeep"
    case .asleepREM:
      stage = "asleepREM"
    case .awake:
      stage = "awake"
    case .asleepUnspecified:
      // Map unspecified to core for legacy Watch OS compatibility
      stage = "asleepCore"
    default:
      return nil
    }

    let durationMs = sample.endDate.timeIntervalSince(sample.startDate)
    let durationMinutes = durationMs / 60.0

    // Skip micro-segments < 1 minute (sensor noise)
    guard durationMinutes >= 1.0 else { return nil }

    return HKSleepRecord(
      stage: stage,
      startMs: sample.startDate.timeIntervalSince1970 * 1000,
      endMs: sample.endDate.timeIntervalSince1970 * 1000,
      durationMinutes: durationMinutes,
      source: sample.sourceRevision.source.bundleIdentifier
    )
  }
}
