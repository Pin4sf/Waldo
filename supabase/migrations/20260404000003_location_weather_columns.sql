-- Migration: add GPS-based weather columns to health_snapshots
--
-- Previously weather was estimated via Open-Meteo using a default/timezone location.
-- Now the app fetches real GPS coordinates and queries Open-Meteo with exact lat/lon.
--
-- Privacy: coordinates rounded to 2 decimal places (~1km) before storage.
-- Agent sees weather description, never raw GPS.

ALTER TABLE health_snapshots
  ADD COLUMN IF NOT EXISTS latitude      REAL,        -- rounded to 2dp (~1km)
  ADD COLUMN IF NOT EXISTS longitude     REAL,        -- rounded to 2dp (~1km)
  ADD COLUMN IF NOT EXISTS weather_temp_c REAL,       -- Celsius
  ADD COLUMN IF NOT EXISTS weather_code  INTEGER,     -- WMO weather code
  ADD COLUMN IF NOT EXISTS uv_index      REAL,
  ADD COLUMN IF NOT EXISTS humidity_pct  REAL;

COMMENT ON COLUMN health_snapshots.latitude      IS 'GPS latitude rounded to 2dp for privacy';
COMMENT ON COLUMN health_snapshots.longitude     IS 'GPS longitude rounded to 2dp for privacy';
COMMENT ON COLUMN health_snapshots.weather_temp_c IS 'Temperature in Celsius from Open-Meteo';
COMMENT ON COLUMN health_snapshots.weather_code  IS 'WMO weather code from Open-Meteo';
COMMENT ON COLUMN health_snapshots.uv_index      IS 'UV index from Open-Meteo';
COMMENT ON COLUMN health_snapshots.humidity_pct  IS 'Relative humidity % from Open-Meteo';
