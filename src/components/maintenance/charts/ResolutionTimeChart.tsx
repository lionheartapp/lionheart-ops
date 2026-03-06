'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts'
import type { ResolutionTimeResult } from '@/lib/services/maintenanceAnalyticsService'

const CATEGORY_COLORS: Record<string, string> = {
  ELECTRICAL: '#f59e0b',
  PLUMBING: '#3b82f6',
  HVAC: '#06b6d4',
  STRUCTURAL: '#8b5cf6',
  CUSTODIAL_BIOHAZARD: '#ef4444',
  IT_AV: '#6366f1',
  GROUNDS: '#22c55e',
  OTHER: '#94a3b8',
}

const CATEGORY_LABELS: Record<string, string> = {
  ELECTRICAL: 'Electrical',
  PLUMBING: 'Plumbing',
  HVAC: 'HVAC',
  STRUCTURAL: 'Structural',
  CUSTODIAL_BIOHAZARD: 'Custodial',
  IT_AV: 'IT/AV',
  GROUNDS: 'Grounds',
  OTHER: 'Other',
}

interface ResolutionTimeChartProps {
  data: ResolutionTimeResult[]
}

export default function ResolutionTimeChart({ data }: ResolutionTimeChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No resolved tickets in this period
      </div>
    )
  }

  const chartData = data.map((item) => ({
    category: CATEGORY_LABELS[item.category] ?? item.category,
    avgHours: item.avgHours,
    rawCategory: item.category,
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 24, left: 72, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 12 }}
          label={{
            value: 'Avg Hours to Resolve',
            position: 'insideBottom',
            offset: -2,
            fontSize: 11,
            fill: '#6b7280',
          }}
        />
        <YAxis
          dataKey="category"
          type="category"
          tick={{ fontSize: 12 }}
          width={68}
        />
        <Tooltip
          formatter={(value) => [`${value ?? 0}h`, 'Avg Resolution']}
          contentStyle={{
            backgroundColor: 'rgba(255,255,255,0.95)',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Bar dataKey="avgHours" radius={[0, 4, 4, 0]}>
          {chartData.map((entry) => (
            <Cell
              key={entry.rawCategory}
              fill={CATEGORY_COLORS[entry.rawCategory] ?? '#94a3b8'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
