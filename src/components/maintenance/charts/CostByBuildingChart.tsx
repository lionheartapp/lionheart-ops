'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useMemo } from 'react'
import type { CostByBuildingResult } from '@/lib/services/maintenanceAnalyticsService'

const BUILDING_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444',
]

interface CostByBuildingChartProps {
  data: CostByBuildingResult[]
}

function formatCurrency(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`
  return `$${value.toFixed(0)}`
}

export default function CostByBuildingChart({ data }: CostByBuildingChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        No cost data for this period
      </div>
    )
  }

  // Get top 5 buildings by total cost across all months
  const topBuildings = useMemo(() => {
    const totals: Map<string, number> = new Map()
    for (const month of data) {
      for (const b of month.buildings) {
        totals.set(b.buildingName, (totals.get(b.buildingName) ?? 0) + b.total)
      }
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name)
  }, [data])

  // Build chart data: one row per month, one bar per top building
  const chartData = useMemo(() => {
    return data.map((month) => {
      const row: Record<string, string | number> = { month: month.month }
      const buildingMap = new Map(month.buildings.map((b) => [b.buildingName, b.total]))
      for (const building of topBuildings) {
        row[building] = buildingMap.get(building) ?? 0
      }
      return row
    })
  }, [data, topBuildings])

  // Custom tooltip to show labor vs materials breakdown
  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean
    payload?: Array<{ name: string; value: number; color: string }>
    label?: string
  }) => {
    if (!active || !payload || payload.length === 0) return null

    const monthData = data.find((d) => d.month === label)

    return (
      <div
        style={{
          backgroundColor: 'rgba(255,255,255,0.97)',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '12px',
        }}
      >
        <p className="font-medium text-slate-900 mb-1">{label}</p>
        {payload.map((p) => {
          const bData = monthData?.buildings.find((b) => b.buildingName === p.name)
          return (
            <div key={p.name} className="text-slate-700">
              <span style={{ color: p.color }}>■</span>{' '}
              <span className="font-medium">{p.name}</span>:{' '}
              <span>{formatCurrency(p.value)}</span>
              {bData && (
                <span className="text-slate-400 ml-1">
                  (labor: {formatCurrency(bData.laborCost)}, materials:{' '}
                  {formatCurrency(bData.materialsCost)})
                </span>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis
          tick={{ fontSize: 12 }}
          tickFormatter={formatCurrency}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
        {topBuildings.map((name, i) => (
          <Bar
            key={name}
            dataKey={name}
            fill={BUILDING_COLORS[i % BUILDING_COLORS.length]}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
