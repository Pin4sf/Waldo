package com.waldo.healthconnect

import expo.modules.kotlin.Package

class HealthConnectPackage : Package {
  override fun createModules() = listOf(HealthConnectModule())
}
