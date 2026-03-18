'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useMemo } from 'react'
import type { LaborHoursByMonthResult } from '@/lib/services/maintenanceAnalyticsService'

// Color palette for up to 12 buildings
const BUILDING_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1',
  '#84cc16', '#64748b',
]

interface LaborHoursChartProps {
  data: LaborHoursByMonthResult[]
}

export default function LaborHoursChart({ data }: LaborHoursChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        No labor data for this period
      </div>
    )
  }

  // Extract all unique building names across all months
  const buildings = useMemo(() => {
    const seen = new Set<string>()
    for (const month of data) {
      for (const b of month.buildings) seen.add(b.buildingName)
    }
    return [...seen]
  }, [data])

  // Build flat chart data
  const chartData = useMemo(() => {
    return data.map((month) => {
      const row: Record<string, string | number> = { month: month.month }
      const buildingMap = new Map(month.buildings.map((b) => [b.buildingName, b.hours]))
      for (const building of buildings) {
        row[building] = buildingMap.get(building) ?? 0
      }
      return row
    })
  }, [data, buildings])

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <defs>
          {buildings.map((name, i) => (
            <linearGradient key={name} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={BUILDING_COLORS[i % BUILDING_COLORS.length]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={BUILDING_COLORS[i % BUILDING_COLORS.length]} stopOpacity={0.05} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 12 }} unit="h" />
        <Tooltip
          formatter={(value, name) => [`${value ?? 0}h`, String(name)]}
          contentStyle={{
            backgroundColor: 'rgba(255,255,255,0.95)',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
        {buildings.map((name, i) => (
          <Area
            key={name}
            type="monotone"
            dataKey={name}
            stackId="1"
            stroke={BUILDING_COLORS[i % BUILDING_COLORS.length]}
            fill={`url(#grad-${i})`}
            strokeWidth={1.5}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}
