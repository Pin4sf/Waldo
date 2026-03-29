/**
 * Air Quality enrichment via Open-Meteo Air Quality API.
 * Free, no API key. Uses same coordinates as weather.
 *
 * Returns: AQI (US standard), PM2.5, PM10.
 * High AQI (>150) significantly impacts HRV and respiratory health.
 */
import type { DailyHealthData } from '../types/health.js';

const DEFAULT_LAT = 28.6;
const DEFAULT_LON = 77.2;

interface AQResponse {
  daily: {
    time: string[];
    us_aqi: (number | null)[];
    pm2_5: (number | null)[];
    pm10: (number | null)[];
  };
}

export function aqiToLabel(aqi: number): string {
  if (aqi <= 50) return 'good';
  if (aqi <= 100) return 'moderate';
  if (aqi <= 150) return 'unhealthy for sensitive';
  if (aqi <= 200) return 'unhealthy';
  if (aqi <= 300) return 'very unhealthy';
  return 'hazardous';
}

export async function enrichAirQuality(
  days: Map<string, DailyHealthData>,
  lat = DEFAULT_LAT,
  lon = DEFAULT_LON,
): Promise<number> {
  // Air Quality API only supports ~92 days of historical data
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const needsAQ = [...days.entries()]
    .filter(([date, day]) => date >= cutoffStr && day.hrReadings.length > 0 && day.aqi === null)
    .map(([date]) => date)
    .sort();

  if (needsAQ.length === 0) return 0;

  let enriched = 0;

  // Batch into 90-day chunks (API limit)
  for (let i = 0; i < needsAQ.length; i += 90) {
    const batch = needsAQ.slice(i, i + 90);
    const startDate = batch[0]!;
    const endDate = batch[batch.length - 1]!;

    try {
      const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=us_aqi,pm2_5,pm10&timezone=Asia%2FKolkata`;

      const response = await fetch(url);
      if (!response.ok) continue;

      const data = await response.json() as AQResponse;

      for (let j = 0; j < data.daily.time.length; j++) {
        const date = data.daily.time[j]!;
        const day = days.get(date);
        if (!day) continue;

        const aqi = data.daily.us_aqi[j];
        if (aqi !== null && aqi !== undefined) {
          day.aqi = aqi;
          day.pm25 = data.daily.pm2_5[j] ?? null;
          enriched++;
        }
      }
    } catch {
      continue;
    }
  }

  return enriched;
}
