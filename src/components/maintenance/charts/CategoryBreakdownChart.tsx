'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { PieLabelRenderProps } from 'recharts'
import type { CategoryBreakdownResult } from '@/lib/services/maintenanceAnalyticsService'

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

interface CategoryBreakdownChartProps {
  data: CategoryBreakdownResult[]
}

const RADIAN = Math.PI / 180

interface LabelProps extends PieLabelRenderProps {
  name?: string
  count?: number
}

function renderCustomLabel(props: LabelProps) {
  const { cx, cy, midAngle, innerRadius, outerRadius, name, count } = props
  const cxNum = typeof cx === 'number' ? cx : 0
  const cyNum = typeof cy === 'number' ? cy : 0
  const midAngleNum = typeof midAngle === 'number' ? midAngle : 0
  const innerR = typeof innerRadius === 'number' ? innerRadius : 0
  const outerR = typeof outerRadius === 'number' ? outerRadius : 0

  const radius = innerR + (outerR - innerR) * 1.3
  const x = cxNum + radius * Math.cos(-midAngleNum * RADIAN)
  const y = cyNum + radius * Math.sin(-midAngleNum * RADIAN)

  if (!count || count < 1) return null

  return (
    <text
      x={x}
      y={y}
      fill="#374151"
      textAnchor={x > cxNum ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={10}
    >
      {`${name ?? ''} (${count})`}
    </text>
  )
}

export default function CategoryBreakdownChart({ data }: CategoryBreakdownChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        No ticket data for this period
      </div>
    )
  }

  const chartData = data.map((item) => ({
    name: CATEGORY_LABELS[item.category] ?? item.category,
    rawCategory: item.category,
    count: item.count,
    pct: item.pct,
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          dataKey="count"
          nameKey="name"
          labelLine={false}
          label={(props) => renderCustomLabel(props as LabelProps)}
        >
          {chartData.map((entry) => (
            <Cell
              key={entry.rawCategory}
              fill={CATEGORY_COLORS[entry.rawCategory] ?? '#94a3b8'}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [
            `${value ?? 0} tickets`,
            String(name),
          ]}
          contentStyle={{
            backgroundColor: 'rgba(255,255,255,0.95)',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: '11px' }}
          formatter={(value) => value}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
