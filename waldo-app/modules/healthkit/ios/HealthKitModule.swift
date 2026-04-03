import ExpoModulesCore
import HealthKit
import Foundation

/// Expo Modules API wrapper for Apple HealthKit.
///
/// Exposes all 7 health data types needed for CRS computation to JavaScript.
/// HRV processing (IBI → RMSSD) lives in HRVProcessor.
/// Sleep aggregation lives in SleepAggregator.
/// Background delivery lives in BackgroundDelivery.
///
/// Security rules:
/// - NEVER log health values (BPM, HRV ms, sleep hours, CRS scores)
/// - Log only: event types, error codes, sample counts
/// - All health values flow through to JS layer encrypted via SQLCipher
public class HealthKitModule: Module {

  private let healthStore = HKHealthStore()
  private lazy var hrvProcessor = HRVProcessor(healthStore: healthStore)
  private lazy var sleepAggregator = SleepAggregator(healthStore: healthStore)
  private lazy var queries = HealthKitQueries(healthStore: healthStore)
  private lazy var backgroundDelivery = BackgroundDelivery(healthStore: healthStore)

  public func definition() -> ModuleDefinition {
    Name("HealthKit")

    // MARK: - Availability

    Function("isAvailable") { () -> Bool in
      return HKHealthStore.isHealthDataAvailable()
    }

    // MARK: - Permissions

    AsyncFunction("requestPermissions") { (promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable() else {
        promise.resolve([
          "overall": "restricted",
          "byType": [:],
          "deniedTypes": []
        ])
        return
      }

      let typesToRead: Set<HKObjectType> = Self.allReadTypes()

      self.healthStore.requestAuthorization(toShare: nil, read: typesToRead) { success, error in
        if let error {
          promise.reject("PERMISSION_ERROR", error.localizedDescription)
          return
        }

        let result = self.buildPermissionResult()
        promise.resolve(result)
      }
    }

    AsyncFunction("getPermissionStatus") { (promise: Promise) in
      let result = self.buildPermissionResult()
      promise.resolve(result)
    }

    // MARK: - HRV

    AsyncFunction("queryHRV") { (startMs: Double, endMs: Double, promise: Promise) in
      let start = Date(timeIntervalSince1970: startMs / 1000)
      let end = Date(timeIntervalSince1970: endMs / 1000)

      self.hrvProcessor.queryHRV(startDate: start, endDate: end) { result in
        switch result {
        case .success(let records):
          // Encode as JS-compatible dictionaries — no logging of values
          let dicts = records.map { record -> [String: Any] in
            var dict: [String: Any] = [
              "timestamp": record.timestamp,
              "sdnn": record.sdnn,
              "deviceHrvSource": record.deviceHrvSource,
              "sampleCount": record.sampleCount,
              "qualityPct": record.qualityPct,
            ]
            if let rmssd = record.rmssd {
              dict["rmssd"] = rmssd
            }
            return dict
          }
          promise.resolve(dicts)
        case .failure(let error):
          promise.reject("HRV_QUERY_ERROR", error.localizedDescription)
        }
      }
    }

    // MARK: - Heart Rate

    AsyncFunction("queryHeartRate") { (startMs: Double, endMs: Double, promise: Promise) in
      let start = Date(timeIntervalSince1970: startMs / 1000)
      let end = Date(timeIntervalSince1970: endMs / 1000)

      self.queries.queryHeartRate(startDate: start, endDate: end) { result in
        switch result {
        case .success(let records):
          let dicts = records.map { r in
            ["timestamp": r.timestamp, "bpm": r.bpm, "motionContext": r.motionContext, "source": r.source] as [String: Any]
          }
          promise.resolve(dicts)
        case .failure(let error):
          promise.reject("HR_QUERY_ERROR", error.localizedDescription)
        }
      }
    }

    // MARK: - Resting Heart Rate

    AsyncFunction("queryRestingHeartRate") { (startMs: Double, endMs: Double, promise: Promise) in
      let start = Date(timeIntervalSince1970: startMs / 1000)
      let end = Date(timeIntervalSince1970: endMs / 1000)

      self.queries.queryRestingHeartRate(startDate: start, endDate: end) { result in
        switch result {
        case .success(let records):
          let dicts = records.map { r in
            ["timestamp": r.timestamp, "bpm": r.bpm, "source": r.source] as [String: Any]
          }
          promise.resolve(dicts)
        case .failure(let error):
          promise.reject("RHR_QUERY_ERROR", error.localizedDescription)
        }
      }
    }

    // MARK: - Sleep

    AsyncFunction("querySleep") { (startMs: Double, endMs: Double, promise: Promise) in
      let start = Date(timeIntervalSince1970: startMs / 1000)
      let end = Date(timeIntervalSince1970: endMs / 1000)

      self.sleepAggregator.querySleep(startDate: start, endDate: end) { result in
        switch result {
        case .success(let records):
          let dicts = records.map { r in
            ["stage": r.stage, "startMs": r.startMs, "endMs": r.endMs,
             "durationMinutes": r.durationMinutes, "source": r.source] as [String: Any]
          }
          promise.resolve(dicts)
        case .failure(let error):
          promise.reject("SLEEP_QUERY_ERROR", error.localizedDescription)
        }
      }
    }

    // MARK: - Steps

    AsyncFunction("querySteps") { (startMs: Double, endMs: Double, promise: Promise) in
      let start = Date(timeIntervalSince1970: startMs / 1000)
      let end = Date(timeIntervalSince1970: endMs / 1000)

      self.queries.querySteps(startDate: start, endDate: end) { result in
        switch result {
        case .success(let stepsResult):
          promise.resolve([
            "totalSteps": stepsResult.totalSteps,
            "startMs": stepsResult.startMs,
            "endMs": stepsResult.endMs,
            "source": stepsResult.source
          ])
        case .failure(let error):
          promise.reject("STEPS_QUERY_ERROR", error.localizedDescription)
        }
      }
    }

    // MARK: - SpO2

    AsyncFunction("querySpO2") { (startMs: Double, endMs: Double, promise: Promise) in
      let start = Date(timeIntervalSince1970: startMs / 1000)
      let end = Date(timeIntervalSince1970: endMs / 1000)

      self.queries.querySpO2(startDate: start, endDate: end) { result in
        switch result {
        case .success(let records):
          let dicts = records.map { r in
            ["timestamp": r.timestamp, "percentage": r.percentage, "source": r.source] as [String: Any]
          }
          promise.resolve(dicts)
        case .failure(let error):
          promise.reject("SPO2_QUERY_ERROR", error.localizedDescription)
        }
      }
    }

    // MARK: - Respiratory Rate

    AsyncFunction("queryRespiratoryRate") { (startMs: Double, endMs: Double, promise: Promise) in
      let start = Date(timeIntervalSince1970: startMs / 1000)
      let end = Date(timeIntervalSince1970: endMs / 1000)

      self.queries.queryRespiratoryRate(startDate: start, endDate: end) { result in
        switch result {
        case .success(let records):
          let dicts = records.map { r in
            ["timestamp": r.timestamp, "breathsPerMinute": r.breathsPerMinute, "source": r.source] as [String: Any]
          }
          promise.resolve(dicts)
        case .failure(let error):
          promise.reject("RR_QUERY_ERROR", error.localizedDescription)
        }
      }
    }

    // MARK: - Background Delivery

    AsyncFunction("enableBackgroundDelivery") { (promise: Promise) in
      self.backgroundDelivery.enable(types: HealthKitTypeMapping.allSupported) { error in
        if let error {
          // Non-fatal: background delivery may be unavailable in simulator
          // Log error code only — no health values
          promise.reject("BG_DELIVERY_ERROR", error.localizedDescription)
        } else {
          promise.resolve(nil)
        }
      }
    }

    // MARK: - Background event bridge

    Events("onHealthDataUpdated")

    OnStartObserving {
      self.backgroundDelivery.setCallback { [weak self] typeIdentifier in
        self?.sendEvent("onHealthDataUpdated", ["type": typeIdentifier])
      }
    }

    OnStopObserving {
      self.backgroundDelivery.setCallback { _ in }
    }
  }

  // MARK: - Private helpers

  private static func allReadTypes() -> Set<HKObjectType> {
    var types = Set<HKObjectType>()
    let quantityIdentifiers: [HKQuantityTypeIdentifier] = [
      .heartRateVariabilitySDNN,
      .heartRate,
      .restingHeartRate,
      .stepCount,
      .oxygenSaturation,
      .respiratoryRate,
    ]
    for id in quantityIdentifiers {
      if let t = HKObjectType.quantityType(forIdentifier: id) {
        types.insert(t)
      }
    }
    if let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
      types.insert(sleepType)
    }
    if let heartbeatType = HKSeriesType.heartbeat() {
      types.insert(heartbeatType)
    }
    return types
  }

  private func buildPermissionResult() -> [String: Any] {
    let typeMap: [(String, HKObjectType?)] = [
      ("hrv", HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN)),
      ("heart_rate", HKObjectType.quantityType(forIdentifier: .heartRate)),
      ("resting_heart_rate", HKObjectType.quantityType(forIdentifier: .restingHeartRate)),
      ("sleep", HKObjectType.categoryType(forIdentifier: .sleepAnalysis)),
      ("steps", HKObjectType.quantityType(forIdentifier: .stepCount)),
      ("spo2", HKObjectType.quantityType(forIdentifier: .oxygenSaturation)),
      ("respiratory_rate", HKObjectType.quantityType(forIdentifier: .respiratoryRate)),
    ]

    var byType: [String: String] = [:]
    var deniedTypes: [String] = []

    for (key, type) in typeMap {
      guard let objectType = type else { continue }
      let status = healthStore.authorizationStatus(for: objectType)
      let statusStr: String
      switch status {
      case .sharingAuthorized:
        statusStr = "granted"
      case .sharingDenied:
        statusStr = "denied"
        deniedTypes.append(key)
      case .notDetermined:
        statusStr = "not_determined"
      @unknown default:
        statusStr = "not_determined"
      }
      byType[key] = statusStr
    }

    let overall = deniedTypes.isEmpty ? "granted" : (byType.values.contains("granted") ? "partial" : "denied")

    return [
      "overall": overall,
      "byType": byType,
      "deniedTypes": deniedTypes,
    ]
  }
}
