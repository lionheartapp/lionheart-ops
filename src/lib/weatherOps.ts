/**
 * Weather utilities for proactive water management alerts.
 * Uses Open-Meteo (no API key required) for 3-day forecast.
 */

export type ForecastDay = {
  date: string
  tempMaxF: number
  tempMinF: number
  precipitationInches: number
}

const HEAT_WAVE_THRESHOLD_F = 95
const HEAVY_RAIN_THRESHOLD_INCHES = 2

/**
 * Convert mm to inches
 */
function mmToInches(mm: number): number {
  return mm / 25.4
}

/**
 * Convert °C to °F
 */
function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32
}

/**
 * Fetch 3-day forecast for given coordinates using Open-Meteo.
 */
export async function get3DayForecast(lat: number, lon: number): Promise<ForecastDay[]> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=America/Los_Angeles&forecast_days=3`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Weather fetch failed: ${res.status}`)
  }
  const data = (await res.json()) as {
    daily?: {
      time?: string[]
      temperature_2m_max?: number[]
      temperature_2m_min?: number[]
      precipitation_sum?: number[]
    }
  }
  const daily = data.daily
  if (!daily?.time?.length) return []

  const days: ForecastDay[] = []
  for (let i = 0; i < Math.min(3, daily.time.length); i++) {
    const precipMm = daily.precipitation_sum?.[i] ?? 0
    const tempMaxC = daily.temperature_2m_max?.[i] ?? 0
    days.push({
      date: daily.time[i],
      tempMaxF: celsiusToFahrenheit(tempMaxC),
      tempMinF: celsiusToFahrenheit(daily.temperature_2m_min?.[i] ?? 0),
      precipitationInches: mmToInches(precipMm),
    })
  }
  return days
}

export type ProactiveAlert = {
  type: 'heat_wave' | 'heavy_rain'
  message: string
}

/**
 * Check forecast for proactive alerts.
 * Heat wave: any day > 95°F
 * Heavy rain: any day > 2" precipitation
 */
export async function getProactiveAlerts(
  lat: number,
  lon: number,
  assetType: 'POND' | 'POOL' | 'FOUNTAIN' | 'OTHER'
): Promise<ProactiveAlert[]> {
  const alerts: ProactiveAlert[] = []
  try {
    const forecast = await get3DayForecast(lat, lon)
    for (const day of forecast) {
      if (day.tempMaxF > HEAT_WAVE_THRESHOLD_F) {
        alerts.push({
          type: 'heat_wave',
          message:
            assetType === 'POOL'
              ? 'High heat predicted; AI suggests increasing Chlorine due to faster evaporation.'
              : 'High heat predicted; AI suggests increasing Aeration due to faster evaporation.',
        })
        break
      }
    }
    if (assetType === 'POND') {
      for (const day of forecast) {
        if (day.precipitationInches > HEAVY_RAIN_THRESHOLD_INCHES) {
          alerts.push({
            type: 'heavy_rain',
            message:
              'Potential runoff detected; prepare for turbidity spikes.',
          })
          break
        }
      }
    }
  } catch (err) {
    console.warn('Weather fetch failed, skipping proactive alerts:', err)
  }
  return alerts
}
