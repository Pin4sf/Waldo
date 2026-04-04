/**
 * LocationAdapter — GPS + weather via Open-Meteo.
 *
 * Uses expo-location for GPS access.
 * Calls Open-Meteo (no API key needed) with actual lat/lon.
 *
 * Privacy rules (non-negotiable):
 * - Coordinates rounded to 2 decimal places (~1km precision) before storage
 * - Raw GPS coordinates NEVER logged
 * - Agent sees "28°C, humid, UV high" — not GPS coords
 */
import type { AdapterResult } from '@/types/adapters';

export interface WeatherSnapshot {
  /** Rounded to 2dp for privacy */
  latitude: number;
  longitude: number;
  tempC: number;
  weatherCode: number;
  uvIndex: number;
  humidity: number;
  /** Human-readable description derived from WMO code */
  description: string;
}

/** WMO Weather interpretation codes → description */
function describeWeatherCode(code: number): string {
  if (code === 0) return 'clear';
  if (code <= 3) return 'partly cloudy';
  if (code <= 9) return 'overcast';
  if (code <= 19) return 'foggy';
  if (code <= 29) return 'drizzle';
  if (code <= 39) return 'rain';
  if (code <= 49) return 'freezing drizzle';
  if (code <= 59) return 'snow';
  if (code <= 69) return 'rain showers';
  if (code <= 79) return 'snow showers';
  if (code <= 84) return 'thunderstorm';
  return 'severe weather';
}

export class LocationAdapter {
  private cachedSnapshot: WeatherSnapshot | null = null;
  private cacheExpiresAt = 0;
  /** 15 min cache — aligned with health sync cycle */
  private static readonly CACHE_TTL_MS = 15 * 60 * 1000;

  async getCurrentWeather(): Promise<AdapterResult<WeatherSnapshot>> {
    // Return cached snapshot if fresh
    if (this.cachedSnapshot && Date.now() < this.cacheExpiresAt) {
      return { ok: true, data: this.cachedSnapshot };
    }

    try {
      // Lazy-load expo-location to avoid crash on platforms where it's unavailable
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Location = require('expo-location');

      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        return { ok: false, error: 'Location permission not granted', code: 'PERMISSION_DENIED' };
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Round to 2dp for privacy — ~1km precision is sufficient for weather
      const lat = Math.round(loc.coords.latitude  * 100) / 100;
      const lon = Math.round(loc.coords.longitude * 100) / 100;

      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,relative_humidity_2m,weather_code,uv_index` +
        `&timezone=auto`;

      const resp = await fetch(url);
      if (!resp.ok) {
        return { ok: false, error: `Open-Meteo returned ${resp.status}`, code: 'NETWORK_ERROR' };
      }

      const json = await resp.json() as {
        current: {
          temperature_2m:      number;
          relative_humidity_2m: number;
          weather_code:        number;
          uv_index:            number;
        };
      };

      const snapshot: WeatherSnapshot = {
        latitude:    lat,
        longitude:   lon,
        tempC:       json.current.temperature_2m,
        weatherCode: json.current.weather_code,
        uvIndex:     json.current.uv_index,
        humidity:    json.current.relative_humidity_2m,
        description: describeWeatherCode(json.current.weather_code),
      };

      this.cachedSnapshot = snapshot;
      this.cacheExpiresAt = Date.now() + LocationAdapter.CACHE_TTL_MS;

      return { ok: true, data: snapshot };
    } catch (err) {
      return { ok: false, error: String(err), code: 'UNKNOWN' };
    }
  }

  async requestPermission(): Promise<'granted' | 'denied'> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Location = require('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }
}
