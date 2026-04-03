import Foundation
import HealthKit

/// Manages HealthKit background delivery via HKObserverQuery.
///
/// When new data arrives from Apple Watch (even when app is suspended),
/// iOS wakes the app briefly and fires the observer callback. This class
/// bridges that callback to the JS event system via Expo Modules API.
///
/// IMPORTANT: The completion handler MUST be called within ~30s or iOS
/// penalises future background delivery frequency. Do NOT do network I/O
/// (Supabase sync) inside the completion handler — only write to local
/// SQLite, then let the JS layer schedule sync separately.
final class BackgroundDelivery {
  private let healthStore: HKHealthStore
  private var activeObservers: [HKObserverQuery] = []
  private var onNewData: ((String) -> Void)?

  init(healthStore: HKHealthStore) {
    self.healthStore = healthStore
  }

  func setCallback(_ callback: @escaping (String) -> Void) {
    self.onNewData = callback
  }

  /// Register background delivery for the given HealthKit types.
  /// Call once on app launch from the native module.
  func enable(
    types: [HealthKitTypeMapping],
    completion: @escaping (Error?) -> Void
  ) {
    var pendingCount = types.count
    var firstError: Error?

    for mapping in types {
      guard let sampleType = mapping.sampleType else {
        pendingCount -= 1
        if pendingCount == 0 { completion(firstError) }
        continue
      }

      // Enable background delivery at OS level
      let frequency: HKUpdateFrequency = mapping.isHighPriority ? .immediate : .hourly

      healthStore.enableBackgroundDelivery(for: sampleType, frequency: frequency) { success, error in
        if let error, firstError == nil {
          firstError = error
          print("[BackgroundDelivery] Failed to enable for \(mapping.identifier): \(error)")
        }
        if !success {
          print("[BackgroundDelivery] Warning: enableBackgroundDelivery returned false for \(mapping.identifier)")
        }
      }

      // Register HKObserverQuery
      let observer = HKObserverQuery(sampleType: sampleType, predicate: nil) { [weak self] _, completionHandler, error in
        defer { completionHandler() } // Must call within ~30s

        if let error {
          print("[BackgroundDelivery] Observer error for \(mapping.identifier): \(error)")
          return
        }

        // Notify JS layer — it will query the new data and run CRS pipeline
        self?.onNewData?(mapping.identifier)
      }

      healthStore.execute(observer)
      activeObservers.append(observer)

      pendingCount -= 1
      if pendingCount == 0 { completion(firstError) }
    }
  }

  func stop() {
    for observer in activeObservers {
      healthStore.stop(observer)
    }
    activeObservers.removeAll()
  }
}

// MARK: - Type mapping

struct HealthKitTypeMapping {
  let identifier: String
  let sampleType: HKSampleType?
  /// High-priority types get .immediate frequency; others get .hourly
  let isHighPriority: Bool

  static let allSupported: [HealthKitTypeMapping] = [
    HealthKitTypeMapping(
      identifier: "hrv",
      sampleType: HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN),
      isHighPriority: true
    ),
    HealthKitTypeMapping(
      identifier: "heart_rate",
      sampleType: HKObjectType.quantityType(forIdentifier: .heartRate),
      isHighPriority: true
    ),
    HealthKitTypeMapping(
      identifier: "resting_heart_rate",
      sampleType: HKObjectType.quantityType(forIdentifier: .restingHeartRate),
      isHighPriority: false
    ),
    HealthKitTypeMapping(
      identifier: "sleep",
      sampleType: HKObjectType.categoryType(forIdentifier: .sleepAnalysis),
      isHighPriority: false
    ),
    HealthKitTypeMapping(
      identifier: "steps",
      sampleType: HKObjectType.quantityType(forIdentifier: .stepCount),
      isHighPriority: false
    ),
    HealthKitTypeMapping(
      identifier: "spo2",
      sampleType: HKObjectType.quantityType(forIdentifier: .oxygenSaturation),
      isHighPriority: false
    ),
    HealthKitTypeMapping(
      identifier: "respiratory_rate",
      sampleType: HKObjectType.quantityType(forIdentifier: .respiratoryRate),
      isHighPriority: false
    ),
  ]
}
