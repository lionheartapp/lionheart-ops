/**
 * Weather Service
 *
 * Uses Open-Meteo API (free, no key required) to fetch current weather.
 * Caches results for 5 minutes per coordinate pair.
 */

export interface WeatherData {
  temp: number          // Fahrenheit
  condition: string     // "Clear", "Cloudy", "Rainy", etc.
  icon: string          // Lucide icon name: "Sun", "Cloud", "CloudRain", etc.
  humidity: number      // 0-100%
  windSpeed: number     // mph
  feelsLike: number     // Fahrenheit (approximation)
}

// In-memory cache: key = "lat,lng" → { data, fetchedAt }
const cache = new Map<string, { data: WeatherData; fetchedAt: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Map WMO weather codes to human-readable conditions + Lucide icon names.
 * See: https://open-meteo.com/en/docs (WMO Weather interpretation codes)
 */
function mapWeatherCode(code: number): { condition: string; icon: string } {
  if (code === 0) return { condition: 'Clear sky', icon: 'Sun' }
  if (code === 1) return { condition: 'Mainly clear', icon: 'Sun' }
  if (code === 2) return { condition: 'Partly cloudy', icon: 'CloudSun' }
  if (code === 3) return { condition: 'Overcast', icon: 'Cloud' }
  if (code >= 45 && code <= 48) return { condition: 'Foggy', icon: 'CloudFog' }
  if (code >= 51 && code <= 55) return { condition: 'Drizzle', icon: 'CloudDrizzle' }
  if (code >= 56 && code <= 57) return { condition: 'Freezing drizzle', icon: 'CloudSnow' }
  if (code >= 61 && code <= 65) return { condition: 'Rain', icon: 'CloudRain' }
  if (code >= 66 && code <= 67) return { condition: 'Freezing rain', icon: 'CloudSnow' }
  if (code >= 71 && code <= 77) return { condition: 'Snow', icon: 'Snowflake' }
  if (code >= 80 && code <= 82) return { condition: 'Rain showers', icon: 'CloudRain' }
  if (code >= 85 && code <= 86) return { condition: 'Snow showers', icon: 'Snowflake' }
  if (code >= 95 && code <= 99) return { condition: 'Thunderstorm', icon: 'CloudLightning' }
  return { condition: 'Unknown', icon: 'Cloud' }
}

/** Convert Celsius to Fahrenheit */
function cToF(c: number): number {
  return Math.round((c * 9) / 5 + 32)
}

/** Convert km/h to mph */
function kmhToMph(kmh: number): number {
  return Math.round(kmh * 0.621371)
}

// ─── Daily Forecast ───────────────────────────────────────────────────────────

export interface WeatherForecastDay {
  date: string              // YYYY-MM-DD
  tempMax: number           // Fahrenheit
  tempMin: number           // Fahrenheit
  condition: string         // Human-readable
  icon: string              // Lucide icon name
  precipitationChance: number // 0-100%
}

/**
 * Fetch a daily weather forecast for a specific date.
 * Uses Open-Meteo daily forecast API with start_date/end_date parameters.
 * Returns null on any failure or if the date is out of range (>16 days).
 */
export async function fetchWeatherForecast(
  lat: number,
  lng: number,
  targetDate: string // YYYY-MM-DD
): Promise<WeatherForecastDay | null> {
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude', lat.toString())
    url.searchParams.set('longitude', lng.toString())
    url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max')
    url.searchParams.set('temperature_unit', 'celsius')
    url.searchParams.set('start_date', targetDate)
    url.searchParams.set('end_date', targetDate)
    url.searchParams.set('timezone', 'America/Los_Angeles')

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      console.warn(`[Weather] Open-Meteo forecast returned ${res.status}`)
      return null
    }

    const data = await res.json()
    const daily = data.daily

    if (!daily || !daily.time || daily.time.length === 0) {
      return null
    }

    const { condition, icon } = mapWeatherCode(daily.weather_code[0])

    return {
      date: daily.time[0],
      tempMax: cToF(daily.temperature_2m_max[0]),
      tempMin: cToF(daily.temperature_2m_min[0]),
      condition,
      icon,
      precipitationChance: Math.round(daily.precipitation_probability_max?.[0] ?? 0),
    }
  } catch (error) {
    console.error('[Weather] Forecast error:', error)
    return null
  }
}

// ─── Current Weather ──────────────────────────────────────────────────────────

/**
 * Fetch current weather for a lat/lng coordinate.
 * Returns null on any failure.
 */
export async function fetchWeather(lat: number, lng: number): Promise<WeatherData | null> {
  // Round to 2 decimals for cache key
  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`
  const cached = cache.get(cacheKey)

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data
  }

  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude', lat.toString())
    url.searchParams.set('longitude', lng.toString())
    url.searchParams.set('current', 'temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m,apparent_temperature')
    url.searchParams.set('temperature_unit', 'celsius')
    url.searchParams.set('wind_speed_unit', 'kmh')

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      console.warn(`[Weather] Open-Meteo returned ${res.status}`)
      return null
    }

    const data = await res.json()
    const current = data.current

    if (!current) {
      console.warn('[Weather] No current data in response')
      return null
    }

    const { condition, icon } = mapWeatherCode(current.weather_code)

    const weatherData: WeatherData = {
      temp: cToF(current.temperature_2m),
      condition,
      icon,
      humidity: Math.round(current.relative_humidity_2m),
      windSpeed: kmhToMph(current.wind_speed_10m),
      feelsLike: cToF(current.apparent_temperature),
    }

    cache.set(cacheKey, { data: weatherData, fetchedAt: Date.now() })
    return weatherData
  } catch (error) {
    console.error('[Weather] Error:', error)
    return null
  }
}
