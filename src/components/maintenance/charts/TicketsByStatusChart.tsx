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
import type { TicketsByStatusResult } from '@/lib/services/maintenanceAnalyticsService'

// Status color map matching the existing maintenance dashboard
const STATUS_COLORS: Record<string, string> = {
  BACKLOG: '#64748b',
  TODO: '#3b82f6',
  IN_PROGRESS: '#f59e0b',
  ON_HOLD: '#f97316',
  SCHEDULED: '#8b5cf6',
  QA: '#14b8a6',
  DONE: '#22c55e',
  CANCELLED: '#ef4444',
}

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog',
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  SCHEDULED: 'Scheduled',
  QA: 'QA Review',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
}

interface TicketsByStatusChartProps {
  data: TicketsByStatusResult
}

export default function TicketsByStatusChart({ data }: TicketsByStatusChartProps) {
  if (data.campuses.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No data available for this period
      </div>
    )
  }

  // Build chart data: one row per campus
  const chartData = data.campuses.map((campus) => ({
    name: campus.campusName,
    ...data.statuses.reduce(
      (acc, status) => {
        acc[status] = campus.counts[status] ?? 0
        return acc
      },
      {} as Record<string, number>
    ),
  }))

  // Only show statuses that have at least some data
  const activeStatuses = data.statuses.filter((status) =>
    data.campuses.some((c) => (c.counts[status] ?? 0) > 0)
  )

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(255,255,255,0.95)',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
          formatter={(value) => STATUS_LABELS[value] ?? value}
        />
        {activeStatuses.map((status) => (
          <Bar
            key={status}
            dataKey={status}
            name={status}
            stackId="tickets"
            fill={STATUS_COLORS[status] ?? '#94a3b8'}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
