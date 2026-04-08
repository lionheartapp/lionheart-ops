import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn(), child: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }) },
}))

import { fetchWeather, fetchWeatherForecast } from '@/lib/services/weatherService'

describe('fetchWeather', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns WeatherData on successful API response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        current: {
          temperature_2m: 20,         // 20°C → 68°F
          weather_code: 0,            // Clear sky
          relative_humidity_2m: 45,
          wind_speed_10m: 16.1,       // ~10 mph
          apparent_temperature: 18,   // 18°C → 64°F
        },
      }), { status: 200 })
    )

    const result = await fetchWeather(34.05, -118.24)
    expect(result).not.toBeNull()
    expect(result!.temp).toBe(68)
    expect(result!.condition).toBe('Clear sky')
    expect(result!.icon).toBe('Sun')
    expect(result!.humidity).toBe(45)
    expect(result!.windSpeed).toBe(10)
    expect(result!.feelsLike).toBe(64)
  })

  it('returns null when API returns non-OK status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Service Unavailable', { status: 503 })
    )

    // Use unique coordinates to avoid cache from previous test
    const result = await fetchWeather(51.51, -0.13)
    expect(result).toBeNull()
  })

  it('returns null when response has no current data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    )

    const result = await fetchWeather(48.86, 2.35)
    expect(result).toBeNull()
  })

  it('returns null when fetch throws (network error)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

    const result = await fetchWeather(55.68, 12.57)
    expect(result).toBeNull()
  })

  it('uses cached result within TTL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        current: {
          temperature_2m: 25,
          weather_code: 3,
          relative_humidity_2m: 60,
          wind_speed_10m: 10,
          apparent_temperature: 23,
        },
      }), { status: 200 })
    )

    // First call — fetches from API
    const result1 = await fetchWeather(40.71, -74.01)
    expect(result1).not.toBeNull()
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    // Second call — should use cache
    const result2 = await fetchWeather(40.71, -74.01)
    expect(result2).toEqual(result1)
    expect(fetchSpy).toHaveBeenCalledTimes(1) // no additional fetch
  })

  it('maps thunderstorm weather code correctly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        current: {
          temperature_2m: 30,
          weather_code: 95,
          relative_humidity_2m: 80,
          wind_speed_10m: 30,
          apparent_temperature: 35,
        },
      }), { status: 200 })
    )

    const result = await fetchWeather(35.00, -85.00)
    expect(result!.condition).toBe('Thunderstorm')
    expect(result!.icon).toBe('CloudLightning')
  })

  it('maps snow weather code correctly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        current: {
          temperature_2m: -5,
          weather_code: 71,
          relative_humidity_2m: 90,
          wind_speed_10m: 20,
          apparent_temperature: -10,
        },
      }), { status: 200 })
    )

    const result = await fetchWeather(42.00, -72.00)
    expect(result!.condition).toBe('Snow')
    expect(result!.icon).toBe('Snowflake')
    expect(result!.temp).toBe(23) // -5°C → 23°F
  })
})

describe('fetchWeatherForecast', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns forecast data on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        daily: {
          time: ['2026-04-10'],
          temperature_2m_max: [25],
          temperature_2m_min: [15],
          weather_code: [2],
          precipitation_probability_max: [30],
        },
      }), { status: 200 })
    )

    const result = await fetchWeatherForecast(34.05, -118.24, '2026-04-10')
    expect(result).not.toBeNull()
    expect(result!.date).toBe('2026-04-10')
    expect(result!.tempMax).toBe(77)  // 25°C → 77°F
    expect(result!.tempMin).toBe(59)  // 15°C → 59°F
    expect(result!.condition).toBe('Partly cloudy')
    expect(result!.icon).toBe('CloudSun')
    expect(result!.precipitationChance).toBe(30)
  })

  it('returns null when no daily data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    )

    const result = await fetchWeatherForecast(34.05, -118.24, '2026-04-10')
    expect(result).toBeNull()
  })

  it('returns null on API error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Error', { status: 500 })
    )

    const result = await fetchWeatherForecast(34.05, -118.24, '2026-04-10')
    expect(result).toBeNull()
  })

  it('returns null on network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Timeout'))

    const result = await fetchWeatherForecast(34.05, -118.24, '2026-04-10')
    expect(result).toBeNull()
  })

  it('defaults precipitationChance to 0 when missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        daily: {
          time: ['2026-04-10'],
          temperature_2m_max: [20],
          temperature_2m_min: [10],
          weather_code: [0],
        },
      }), { status: 200 })
    )

    const result = await fetchWeatherForecast(34.05, -118.24, '2026-04-10')
    expect(result!.precipitationChance).toBe(0)
  })
})
