/**
 * Weather enrichment via Open-Meteo Historical Weather API.
 * Free, no API key needed. Fills in weather for days without workout weather data.
 *
 * Ark is in India (Asia/Kolkata), coordinates ~28.6°N, 77.2°E (Delhi region).
 * We infer this from the timezone in the Apple Health export.
 */
import type { DailyHealthData } from '../types/health.js';

// Default coordinates for India (Delhi/NCR — Ark's timezone is Asia/Kolkata)
const DEFAULT_LAT = 28.6;
const DEFAULT_LON = 77.2;

interface OpenMeteoResponse {
  daily: {
    time: string[];
    temperature_2m_mean: (number | null)[];
    relative_humidity_2m_mean: (number | null)[];
    precipitation_sum: (number | null)[];
    weather_code: (number | null)[];
  };
}

/** WMO weather codes → readable descriptions */
export function weatherCodeToDescription(code: number): string {
  if (code === 0) return 'clear';
  if (code <= 3) return 'partly cloudy';
  if (code <= 49) return 'foggy';
  if (code <= 59) return 'drizzle';
  if (code <= 69) return 'rain';
  if (code <= 79) return 'snow';
  if (code <= 82) return 'rain showers';
  if (code <= 86) return 'snow showers';
  if (code <= 99) return 'thunderstorm';
  return 'unknown';
}

/**
 * Fetch historical weather for a date range from Open-Meteo.
 * Batches up to 30 days per request for efficiency.
 */
export async function enrichWeather(
  days: Map<string, DailyHealthData>,
  lat = DEFAULT_LAT,
  lon = DEFAULT_LON,
): Promise<number> {
  // Find days that need weather data (no workout weather)
  const needsWeather = [...days.entries()]
    .filter(([, day]) => !day.weather)
    .map(([date]) => date)
    .sort();

  if (needsWeather.length === 0) return 0;

  // Batch into 30-day chunks
  let enriched = 0;
  for (let i = 0; i < needsWeather.length; i += 30) {
    const batch = needsWeather.slice(i, i + 30);
    const startDate = batch[0]!;
    const endDate = batch[batch.length - 1]!;

    try {
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_mean,relative_humidity_2m_mean,precipitation_sum,weather_code&timezone=Asia%2FKolkata`;

      const response = await fetch(url);
      if (!response.ok) continue;

      const data = await response.json() as OpenMeteoResponse;

      for (let j = 0; j < data.daily.time.length; j++) {
        const date = data.daily.time[j]!;
        const day = days.get(date);
        if (!day || day.weather) continue;

        const tempC = data.daily.temperature_2m_mean[j];
        const humidity = data.daily.relative_humidity_2m_mean[j];

        if (tempC !== null && tempC !== undefined) {
          day.weather = {
            temperatureF: tempC * 9 / 5 + 32,
            humidity: humidity ?? 0,
            source: 'api',
          };
          enriched++;
        }
      }
    } catch {
      // Network error — skip this batch, don't crash
      continue;
    }
  }

  return enriched;
}
