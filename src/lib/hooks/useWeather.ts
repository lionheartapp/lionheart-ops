'use client'

/**
 * useWeather — TanStack Query wrapper around the internal `/api/weather`
 * route. The route uses Open-Meteo on the server side and falls back to the
 * org's primary school coordinates when no lat/lng is passed.
 *
 * Going through the internal route avoids whitelisting `api.open-meteo.com`
 * in our CSP `connect-src` and gives us org-aware location defaults for free.
 */

import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'

export interface WeatherSnapshot {
  /** Current temperature in Fahrenheit. */
  temp: number
  /** Human-readable condition, e.g. "Partly cloudy". */
  condition: string
  /** Lucide icon name returned by the server (e.g. "Sun", "CloudRain"). */
  icon: string
  /** Relative humidity 0–100 (%). */
  humidity: number
  /** Wind speed (mph). */
  windSpeed: number
  /** Apparent temperature in Fahrenheit. */
  feelsLike: number
}

interface UseWeatherOptions {
  /** Override coordinates. Otherwise the server uses the org's primary school. */
  latitude?: number
  longitude?: number
  /** Disable the fetch — useful when the dashboard hasn't loaded yet. */
  enabled?: boolean
}

interface UseWeatherResult {
  data: WeatherSnapshot | null
  loading: boolean
  error: string | null
}

export function useWeather(options: UseWeatherOptions = {}): UseWeatherResult {
  const { latitude, longitude, enabled = true } = options

  const query = useQuery<WeatherSnapshot>({
    queryKey: ['weather', latitude ?? null, longitude ?? null],
    queryFn: () => {
      const params = new URLSearchParams()
      if (latitude !== undefined) params.set('lat', String(latitude))
      if (longitude !== undefined) params.set('lng', String(longitude))
      const qs = params.toString()
      return fetchApi<WeatherSnapshot>(qs ? `/api/weather?${qs}` : '/api/weather')
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes — matches server-side cache TTL
    refetchOnWindowFocus: false,
    retry: 1,
  })

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
  }
}
