import Foundation
import HealthKit

/// Implements all HealthKit data queries except HRV (in HRVProcessor)
/// and sleep (in SleepAggregator).
final class HealthKitQueries {
  private let healthStore: HKHealthStore

  init(healthStore: HKHealthStore) {
    self.healthStore = healthStore
  }

  // MARK: - Heart Rate

  func queryHeartRate(
    startDate: Date,
    endDate: Date,
    completion: @escaping (Result<[HKHeartRateRecord], Error>) -> Void
  ) {
    guard let hrType = HKObjectType.quantityType(forIdentifier: .heartRate) else {
      completion(.success([]))
      return
    }

    let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictEndDate)
    let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)

    let query = HKSampleQuery(
      sampleType: hrType,
      predicate: predicate,
      limit: HKObjectQueryNoLimit,
      sortDescriptors: [sort]
    ) { _, samples, error in
      if let error { completion(.failure(error)); return }

      let records = (samples as? [HKQuantitySample] ?? []).map { sample -> HKHeartRateRecord in
        let bpm = sample.quantity.doubleValue(for: HKUnit(from: "count/min"))
        let motionContext = sample.metadata?[HKMetadataKeyHeartRateMotionContext] as? Int ?? 0
        return HKHeartRateRecord(
          timestamp: sample.startDate.timeIntervalSince1970 * 1000,
          bpm: bpm,
          motionContext: motionContext,
          source: sample.sourceRevision.source.bundleIdentifier
        )
      }
      completion(.success(records))
    }

    healthStore.execute(query)
  }

  // MARK: - Resting Heart Rate

  func queryRestingHeartRate(
    startDate: Date,
    endDate: Date,
    completion: @escaping (Result<[HKRestingHeartRateRecord], Error>) -> Void
  ) {
    guard let rhrType = HKObjectType.quantityType(forIdentifier: .restingHeartRate) else {
      completion(.success([]))
      return
    }

    let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictEndDate)

    let query = HKSampleQuery(
      sampleType: rhrType,
      predicate: predicate,
      limit: HKObjectQueryNoLimit,
      sortDescriptors: nil
    ) { _, samples, error in
      if let error { completion(.failure(error)); return }

      let records = (samples as? [HKQuantitySample] ?? []).map { sample in
        HKRestingHeartRateRecord(
          timestamp: sample.startDate.timeIntervalSince1970 * 1000,
          bpm: sample.quantity.doubleValue(for: HKUnit(from: "count/min")),
          source: sample.sourceRevision.source.bundleIdentifier
        )
      }
      completion(.success(records))
    }

    healthStore.execute(query)
  }

  // MARK: - Steps

  func querySteps(
    startDate: Date,
    endDate: Date,
    completion: @escaping (Result<HKStepsResult, Error>) -> Void
  ) {
    guard let stepsType = HKObjectType.quantityType(forIdentifier: .stepCount) else {
      completion(.success(HKStepsResult(
        totalSteps: 0,
        startMs: startDate.timeIntervalSince1970 * 1000,
        endMs: endDate.timeIntervalSince1970 * 1000,
        source: "none"
      )))
      return
    }

    let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictEndDate)

    // Use statistics query to avoid double-counting from multiple sources
    let query = HKStatisticsQuery(
      quantityType: stepsType,
      quantitySamplePredicate: predicate,
      options: .cumulativeSum
    ) { _, statistics, error in
      if let error { completion(.failure(error)); return }

      let total = statistics?.sumQuantity()?.doubleValue(for: HKUnit.count()) ?? 0
      completion(.success(HKStepsResult(
        totalSteps: total,
        startMs: startDate.timeIntervalSince1970 * 1000,
        endMs: endDate.timeIntervalSince1970 * 1000,
        source: "healthkit"
      )))
    }

    healthStore.execute(query)
  }

  // MARK: - SpO2

  func querySpO2(
    startDate: Date,
    endDate: Date,
    completion: @escaping (Result<[HKSpO2Record], Error>) -> Void
  ) {
    guard let spo2Type = HKObjectType.quantityType(forIdentifier: .oxygenSaturation) else {
      completion(.success([]))
      return
    }

    let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictEndDate)

    let query = HKSampleQuery(
      sampleType: spo2Type,
      predicate: predicate,
      limit: HKObjectQueryNoLimit,
      sortDescriptors: nil
    ) { _, samples, error in
      if let error { completion(.failure(error)); return }

      let records = (samples as? [HKQuantitySample] ?? []).map { sample in
        HKSpO2Record(
          timestamp: sample.startDate.timeIntervalSince1970 * 1000,
          percentage: sample.quantity.doubleValue(for: HKUnit.percent()) * 100,
          source: sample.sourceRevision.source.bundleIdentifier
        )
      }
      completion(.success(records))
    }

    healthStore.execute(query)
  }

  // MARK: - Respiratory Rate

  func queryRespiratoryRate(
    startDate: Date,
    endDate: Date,
    completion: @escaping (Result<[HKRespiratoryRecord], Error>) -> Void
  ) {
    guard let rrType = HKObjectType.quantityType(forIdentifier: .respiratoryRate) else {
      completion(.success([]))
      return
    }

    let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictEndDate)

    let query = HKSampleQuery(
      sampleType: rrType,
      predicate: predicate,
      limit: HKObjectQueryNoLimit,
      sortDescriptors: nil
    ) { _, samples, error in
      if let error { completion(.failure(error)); return }

      let records = (samples as? [HKQuantitySample] ?? []).map { sample in
        HKRespiratoryRecord(
          timestamp: sample.startDate.timeIntervalSince1970 * 1000,
          breathsPerMinute: sample.quantity.doubleValue(for: HKUnit(from: "count/min")),
          source: sample.sourceRevision.source.bundleIdentifier
        )
      }
      completion(.success(records))
    }

    healthStore.execute(query)
  }
}
