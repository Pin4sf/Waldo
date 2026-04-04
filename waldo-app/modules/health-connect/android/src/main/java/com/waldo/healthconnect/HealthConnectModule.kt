package com.waldo.healthconnect

import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit

private const val TAG = "WaldoHealthConnect"

class HealthConnectModule : Module() {

  private val client: HealthConnectClient? by lazy {
    try {
      HealthConnectClient.getOrCreate(appContext.reactContext!!)
    } catch (e: Exception) {
      Log.w(TAG, "Health Connect not available: ${e.message}")
      null
    }
  }

  override fun definition() = ModuleDefinition {
    Name("HealthConnect")

    // ── Availability ───────────────────────────────────────────────────
    Function("isAvailable") {
      client != null &&
        HealthConnectClient.getSdkStatus(appContext.reactContext!!) ==
          HealthConnectClient.SDK_AVAILABLE
    }

    // ── Permissions ────────────────────────────────────────────────────
    AsyncFunction("hasPermissions") {
      val c = client ?: return@AsyncFunction false
      try {
        val granted = c.permissionController.getGrantedPermissions()
        REQUIRED_PERMISSIONS.all { it in granted }
      } catch (e: Exception) {
        Log.w(TAG, "hasPermissions error: ${e.message}")
        false
      }
    }

    // Returns a list of granted permission strings — JS layer checks completeness
    AsyncFunction("requestPermissions") {
      // Expo Modules can't launch the HC permission activity directly.
      // Return current state; the JS layer must use HealthConnectPermissionManager.
      val c = client ?: return@AsyncFunction emptyList<String>()
      try {
        c.permissionController.getGrantedPermissions().map { it.toString() }
      } catch (e: Exception) {
        Log.w(TAG, "requestPermissions error: ${e.message}")
        emptyList<String>()
      }
    }

    // ── Heart Rate ─────────────────────────────────────────────────────
    AsyncFunction("readHeartRate") { dateStr: String ->
      withContext(Dispatchers.IO) {
        val c = client ?: return@withContext heartRateEmpty()
        try {
          val filter = dayFilter(dateStr)
          val response = c.readRecords(ReadRecordsRequest(HeartRateRecord::class, filter))
          val allBpms = response.records.flatMap { r -> r.samples.map { it.beatsPerMinute.toInt() } }
          if (allBpms.isEmpty()) return@withContext heartRateEmpty()

          val avg = allBpms.average().toInt()

          // Resting HR: lowest 10th percentile of readings (sedentary proxy)
          val sorted = allBpms.sorted()
          val p10idx = maxOf(0, (allBpms.size * 0.10).toInt())
          val resting = sorted.take(p10idx + 1).average().toInt()

          mapOf(
            "restingHR"    to resting,
            "avgHR"        to avg,
            "sampleCount"  to allBpms.size,
            "source"       to "health_connect",
          )
        } catch (e: Exception) {
          Log.w(TAG, "readHeartRate error: ${e.message}")
          heartRateEmpty()
        }
      }
    }

    // ── HRV ────────────────────────────────────────────────────────────
    AsyncFunction("readHRV") { dateStr: String ->
      withContext(Dispatchers.IO) {
        val c = client ?: return@withContext hrvEmpty(isSamsungProxy = false)
        try {
          val filter = dayFilter(dateStr)
          val response = c.readRecords(ReadRecordsRequest(HeartRateVariabilityRmssdRecord::class, filter))

          if (response.records.isNotEmpty()) {
            // HC provides RMSSD directly
            val rmssd = response.records.map { it.heartRateVariabilityMillis }.average()
            mapOf(
              "rmssd"         to rmssd,
              "readingCount"  to response.records.size,
              "source"        to "health_connect_rmssd",
              "isSamsungProxy" to false,
            )
          } else {
            // No HRV records — Samsung or watch that doesn't write RMSSD to HC
            // Fall back to HR-based proxy: compute RMSSD approximation from HR variance
            val hrFilter = dayFilter(dateStr)
            val hrResponse = c.readRecords(ReadRecordsRequest(HeartRateRecord::class, hrFilter))
            val allBpms = hrResponse.records.flatMap { r -> r.samples.map { it.beatsPerMinute.toDouble() } }

            if (allBpms.size < 10) return@withContext hrvEmpty(isSamsungProxy = true)

            // HR-variance proxy: std dev of HR BPM × 6.5 approximates RMSSD
            // Reference: Shaffer & Ginsberg (2017) — rough linear relationship
            val mean = allBpms.average()
            val variance = allBpms.map { (it - mean) * (it - mean) }.average()
            val stdDev = Math.sqrt(variance)
            val rmssdProxy = (stdDev * 6.5).coerceIn(10.0, 120.0)

            mapOf(
              "rmssd"         to rmssdProxy,
              "readingCount"  to allBpms.size,
              "source"        to "hr_variance_proxy",
              "isSamsungProxy" to true,
            )
          }
        } catch (e: Exception) {
          Log.w(TAG, "readHRV error: ${e.message}")
          hrvEmpty(isSamsungProxy = false)
        }
      }
    }

    // ── Sleep ──────────────────────────────────────────────────────────
    AsyncFunction("readSleep") { dateStr: String ->
      withContext(Dispatchers.IO) {
        val c = client ?: return@withContext sleepEmpty()
        try {
          // Query sleep ending today or starting yesterday (captures overnight sessions)
          val date     = LocalDate.parse(dateStr)
          val startMs  = date.minusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant()
          val endMs    = date.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant()
          val filter   = TimeRangeFilter.between(startMs, endMs)

          val response = c.readRecords(ReadRecordsRequest(SleepSessionRecord::class, filter))
          val session  = response.records
            .filter { it.endTime > it.startTime }
            .maxByOrNull { ChronoUnit.MINUTES.between(it.startTime, it.endTime) }
            ?: return@withContext sleepEmpty()

          val durationHours = ChronoUnit.MINUTES.between(session.startTime, session.endTime) / 60.0

          // Aggregate stages
          var deep = 0.0; var rem = 0.0; var light = 0.0; var awake = 0.0
          session.stages.forEach { stage ->
            val mins = ChronoUnit.MINUTES.between(stage.startTime, stage.endTime).toDouble()
            when (stage.stage) {
              SleepSessionRecord.STAGE_TYPE_DEEP    -> deep  += mins
              SleepSessionRecord.STAGE_TYPE_REM     -> rem   += mins
              SleepSessionRecord.STAGE_TYPE_LIGHT   -> light += mins
              SleepSessionRecord.STAGE_TYPE_AWAKE   -> awake += mins
            }
          }

          mapOf(
            "durationHours" to durationHours,
            "startTime"     to session.startTime.toEpochMilli(),
            "endTime"       to session.endTime.toEpochMilli(),
            "stages"        to mapOf("deep" to deep, "rem" to rem, "light" to light, "awake" to awake),
            "source"        to "health_connect",
          )
        } catch (e: Exception) {
          Log.w(TAG, "readSleep error: ${e.message}")
          sleepEmpty()
        }
      }
    }

    // ── Steps ──────────────────────────────────────────────────────────
    AsyncFunction("readSteps") { dateStr: String ->
      withContext(Dispatchers.IO) {
        val c = client ?: return@withContext mapOf("steps" to 0, "source" to "error")
        try {
          val filter   = dayFilter(dateStr)
          val response = c.readRecords(ReadRecordsRequest(StepsRecord::class, filter))
          val total    = response.records.sumOf { it.count }
          mapOf("steps" to total.toInt(), "source" to "health_connect")
        } catch (e: Exception) {
          Log.w(TAG, "readSteps error: ${e.message}")
          mapOf("steps" to 0, "source" to "error")
        }
      }
    }

    // ── SpO2 ───────────────────────────────────────────────────────────
    AsyncFunction("readSpO2") { dateStr: String ->
      withContext(Dispatchers.IO) {
        val c = client ?: return@withContext mapOf("avgPct" to null, "count" to 0)
        try {
          val filter   = dayFilter(dateStr)
          val response = c.readRecords(ReadRecordsRequest(OxygenSaturationRecord::class, filter))
          if (response.records.isEmpty()) return@withContext mapOf("avgPct" to null, "count" to 0)
          val avg = response.records.map { it.percentage.value }.average()
          mapOf("avgPct" to avg, "count" to response.records.size)
        } catch (e: Exception) {
          Log.w(TAG, "readSpO2 error: ${e.message}")
          mapOf("avgPct" to null, "count" to 0)
        }
      }
    }

    // ── Resting HR (direct record) ─────────────────────────────────────
    AsyncFunction("readRestingHR") { dateStr: String ->
      withContext(Dispatchers.IO) {
        val c = client ?: return@withContext mapOf("bpm" to null)
        try {
          val filter   = dayFilter(dateStr)
          val response = c.readRecords(ReadRecordsRequest(RestingHeartRateRecord::class, filter))
          val bpm      = response.records.lastOrNull()?.beatsPerMinute?.toInt()
          mapOf("bpm" to bpm)
        } catch (e: Exception) {
          Log.w(TAG, "readRestingHR error: ${e.message}")
          mapOf("bpm" to null)
        }
      }
    }

    // ── Exercise ───────────────────────────────────────────────────────
    AsyncFunction("readExercise") { dateStr: String ->
      withContext(Dispatchers.IO) {
        val c = client ?: return@withContext mapOf("minutesTotal" to 0, "sessionCount" to 0)
        try {
          val filter   = dayFilter(dateStr)
          val response = c.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class, filter))
          val minutes  = response.records.sumOf { ChronoUnit.MINUTES.between(it.startTime, it.endTime) }
          mapOf("minutesTotal" to minutes.toInt(), "sessionCount" to response.records.size)
        } catch (e: Exception) {
          Log.w(TAG, "readExercise error: ${e.message}")
          mapOf("minutesTotal" to 0, "sessionCount" to 0)
        }
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private fun dayFilter(dateStr: String): TimeRangeFilter {
    val date  = LocalDate.parse(dateStr)
    val start = date.atStartOfDay(ZoneId.systemDefault()).toInstant()
    val end   = date.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant()
    return TimeRangeFilter.between(start, end)
  }

  private fun heartRateEmpty() = mapOf(
    "restingHR" to 0, "avgHR" to 0, "sampleCount" to 0, "source" to "mock",
  )

  private fun hrvEmpty(isSamsungProxy: Boolean) = mapOf(
    "rmssd" to 0.0, "readingCount" to 0,
    "source" to "mock", "isSamsungProxy" to isSamsungProxy,
  )

  private fun sleepEmpty() = mapOf(
    "durationHours" to 0.0, "startTime" to 0L, "endTime" to 0L,
    "stages" to null, "source" to "mock",
  )

  companion object {
    val REQUIRED_PERMISSIONS = setOf(
      HealthPermission.getReadPermission(HeartRateRecord::class),
      HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class),
      HealthPermission.getReadPermission(SleepSessionRecord::class),
      HealthPermission.getReadPermission(StepsRecord::class),
      HealthPermission.getReadPermission(OxygenSaturationRecord::class),
      HealthPermission.getReadPermission(RestingHeartRateRecord::class),
      HealthPermission.getReadPermission(ExerciseSessionRecord::class),
    )
  }
}
