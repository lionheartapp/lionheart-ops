'use client'

/**
 * WeatherWidget — half-width dashboard widget that sits above the calendar.
 *
 * Style: clean white card matching the dashboard's product surface language.
 *
 * Data: pulled from the internal `/api/weather` route, which proxies
 * Open-Meteo on the server side and falls back to the org's primary school
 * coordinates. To override per-widget, pass `latitude`/`longitude`.
 */

import { motion } from 'framer-motion'
import {
  MapPin,
  Sun,
  Cloud,
  CloudSun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudDrizzle,
  CloudFog,
  Snowflake,
  Wind,
  Droplets,
  Thermometer,
  type LucideIcon,
} from 'lucide-react'
import { useWeather } from '@/lib/hooks/useWeather'
import { cardEntrance } from '@/lib/animations'

interface WeatherWidgetProps {
  /** Override the default coordinates (server uses org's primary school by default). */
  latitude?: number
  longitude?: number
  /** City label shown in the header. */
  cityLabel?: string
  /** Smaller secondary label, e.g. the school name. */
  contextLabel?: string
}

export default function WeatherWidget({
  latitude,
  longitude,
  cityLabel,
  contextLabel,
}: WeatherWidgetProps) {
  const { data, loading, error } = useWeather({ latitude, longitude })

  if (loading) {
    return <WeatherSkeleton />
  }

  if (error || !data) {
    return <WeatherErrorState message={error ?? 'Weather unavailable'} />
  }

  const Icon = resolveIcon(data.icon)
  const { accentClasses, conditionColor } = pickConditionStyles(data.icon)

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={cardEntrance}
      className="relative flex h-full cursor-default flex-col overflow-hidden rounded-xl border border-gray-200 bg-white p-5"
    >
      {/* Top row — location + condition pill */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <MapPin className="w-3.5 h-3.5" aria-hidden />
            <p className="text-xs font-semibold tracking-wide uppercase">
              {cityLabel ?? 'Local weather'}
            </p>
          </div>
          {contextLabel && (
            <p className="text-[11px] text-slate-400 mt-0.5">{contextLabel}</p>
          )}
        </div>

        <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${accentClasses}`}>
          <Icon className={`w-3.5 h-3.5 ${conditionColor}`} aria-hidden />
          <span className={`text-[11px] font-semibold ${conditionColor}`}>{data.condition}</span>
        </div>
      </div>

      {/* Big temperature */}
      <div className="flex items-end gap-1 mt-3">
        <span className="text-6xl font-bold leading-none tracking-tight text-slate-900 tabular-nums">
          {data.temp}
        </span>
        <span className="text-xl font-medium text-slate-500 mb-2">°F</span>
      </div>

      {/* Stats row — pushed to the bottom of the card */}
      <div className="mt-auto pt-4 border-t border-slate-100 grid grid-cols-3 gap-3">
        <Stat
          label="Feels like"
          value={`${data.feelsLike}°`}
          icon={<Thermometer className="w-3 h-3 text-slate-400" aria-hidden />}
        />
        <Stat
          label="Wind"
          value={`${data.windSpeed}`}
          subValue="mph"
          icon={<Wind className="w-3 h-3 text-slate-400" aria-hidden />}
        />
        <Stat
          label="Humidity"
          value={`${data.humidity}%`}
          icon={<Droplets className="w-3 h-3 text-slate-400" aria-hidden />}
        />
      </div>
    </motion.div>
  )
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

interface StatProps {
  label: string
  value: string
  subValue?: string
  icon?: React.ReactNode
}

function Stat({ label, value, subValue, icon }: StatProps) {
  return (
    <div>
      <div className="flex items-center gap-1">
        {icon}
        <p className="text-[10px] font-bold tracking-wider uppercase text-slate-400">{label}</p>
      </div>
      <p className="text-sm font-bold text-slate-900 mt-0.5">
        {value}
        {subValue && <span className="text-slate-400 font-medium ml-1 text-xs">{subValue}</span>}
      </p>
    </div>
  )
}

function WeatherSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-3 w-28 bg-slate-100 rounded" />
          <div className="h-2.5 w-36 bg-slate-100 rounded" />
        </div>
        <div className="h-6 w-24 bg-slate-100 rounded-full" />
      </div>
      <div className="h-14 w-24 bg-slate-100 rounded mt-4" />
      <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <div className="h-2 w-16 bg-slate-100 rounded" />
          <div className="h-3 w-12 bg-slate-100 rounded" />
        </div>
        <div className="space-y-1.5">
          <div className="h-2 w-12 bg-slate-100 rounded" />
          <div className="h-3 w-10 bg-slate-100 rounded" />
        </div>
        <div className="space-y-1.5">
          <div className="h-2 w-10 bg-slate-100 rounded" />
          <div className="h-3 w-8 bg-slate-100 rounded" />
        </div>
      </div>
    </div>
  )
}

function WeatherErrorState({ message }: { message: string }) {
  // The /api/weather endpoint returns a clear "NO_LOCATION" message when the
  // org hasn't set school coordinates yet. Surface that helpfully instead of
  // the raw error.
  const friendlyMessage = message.toLowerCase().includes('no location')
    ? 'Add a school address in Settings to see local weather.'
    : "We'll retry on the next refresh."

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-2 text-slate-500">
        <Cloud className="w-4 h-4" aria-hidden />
        <p className="text-xs font-semibold uppercase tracking-wide">Weather</p>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-700">{message}</p>
      <p className="mt-1 text-xs text-slate-400">{friendlyMessage}</p>
    </div>
  )
}

// ─── Icon resolution + condition styling ──────────────────────────────────────

const ICON_REGISTRY: Record<string, LucideIcon> = {
  Sun,
  Cloud,
  CloudSun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudDrizzle,
  CloudFog,
  Snowflake,
}

function resolveIcon(name: string): LucideIcon {
  return ICON_REGISTRY[name] ?? Cloud
}

interface ConditionStyle {
  /** Background + border classes for the condition pill. */
  accentClasses: string
  /** Text color for the icon and label inside the pill. */
  conditionColor: string
}

function pickConditionStyles(iconName: string): ConditionStyle {
  // Sunny family
  if (iconName === 'Sun') {
    return {
      accentClasses: 'bg-amber-50 border border-amber-100',
      conditionColor: 'text-amber-700',
    }
  }
  // Partly sunny
  if (iconName === 'CloudSun') {
    return {
      accentClasses: 'bg-blue-50 border border-blue-100',
      conditionColor: 'text-blue-700',
    }
  }
  // Wet weather
  if (iconName === 'CloudRain' || iconName === 'CloudDrizzle') {
    return {
      accentClasses: 'bg-sky-50 border border-sky-100',
      conditionColor: 'text-sky-700',
    }
  }
  // Snow
  if (iconName === 'Snowflake' || iconName === 'CloudSnow') {
    return {
      accentClasses: 'bg-slate-50 border border-slate-100',
      conditionColor: 'text-slate-700',
    }
  }
  // Storm
  if (iconName === 'CloudLightning') {
    return {
      accentClasses: 'bg-violet-50 border border-violet-100',
      conditionColor: 'text-violet-700',
    }
  }
  // Fog / overcast / fallback
  return {
    accentClasses: 'bg-slate-100 border border-slate-200',
    conditionColor: 'text-slate-700',
  }
}
