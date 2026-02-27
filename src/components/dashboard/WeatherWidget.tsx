'use client'

import { useEffect, useState } from 'react'
import {
  Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle,
  Snowflake, CloudFog, Droplets, Wind, Loader2, CloudSun
} from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'

interface WeatherData {
  temp: number
  condition: string
  icon: string
  humidity: number
  windSpeed: number
  feelsLike: number
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudDrizzle,
  Snowflake,
  CloudFog,
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [noLocation, setNoLocation] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null

  useEffect(() => {
    if (!token) return

    const fetchWeather = async () => {
      try {
        const res = await fetch('/api/weather', {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (handleAuthResponse(res)) return

        if (res.status === 404) {
          setNoLocation(true)
          return
        }

        if (res.ok) {
          const data = await res.json()
          if (data.ok) {
            setWeather(data.data)
          }
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }

    fetchWeather()

    // Refresh every 10 minutes
    const interval = setInterval(fetchWeather, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [token])

  // Don't render if no location set
  if (noLocation) return null

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  if (!weather) return null

  const WeatherIcon = ICON_MAP[weather.icon] || Cloud

  return (
    <div className="bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Weather</h3>
        <span className="text-xs text-gray-500">Now</span>
      </div>

      <div className="flex items-center gap-4">
        <WeatherIcon className="w-10 h-10 text-sky-500 flex-shrink-0" />
        <div>
          <div className="text-3xl font-bold text-gray-900">{weather.temp}°</div>
          <div className="text-sm text-gray-600">{weather.condition}</div>
        </div>
      </div>

      <div className="mt-4 flex gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <Droplets className="w-3.5 h-3.5" />
          <span>{weather.humidity}%</span>
        </div>
        <div className="flex items-center gap-1">
          <Wind className="w-3.5 h-3.5" />
          <span>{weather.windSpeed} mph</span>
        </div>
        <div>
          Feels like {weather.feelsLike}°
        </div>
      </div>
    </div>
  )
}
