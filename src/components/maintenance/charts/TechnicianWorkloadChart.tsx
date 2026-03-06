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
import type { TechnicianWorkloadResult } from '@/lib/services/maintenanceAnalyticsService'

interface TechnicianWorkloadChartProps {
  data: TechnicianWorkloadResult[]
}

function truncateName(name: string, maxLen = 12): string {
  return name.length > maxLen ? name.slice(0, maxLen) + '…' : name
}

export default function TechnicianWorkloadChart({ data }: TechnicianWorkloadChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No technician activity for this period
      </div>
    )
  }

  const chartData = data.map((tech) => ({
    name: truncateName(tech.name),
    fullName: tech.name,
    'Active Tickets': tech.activeTickets,
    'Hours This Month': tech.hoursThisMonth,
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
        <Tooltip
          labelFormatter={(label, payload) => {
            // Show full name in tooltip
            if (payload && payload.length > 0) {
              const item = chartData.find((d) => d.name === label)
              return item?.fullName ?? label
            }
            return label
          }}
          contentStyle={{
            backgroundColor: 'rgba(255,255,255,0.95)',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
        <Bar dataKey="Active Tickets" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Hours This Month" fill="#f59e0b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
