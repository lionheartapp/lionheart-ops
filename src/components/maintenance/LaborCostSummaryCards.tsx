'use client'

import { Clock, DollarSign, Receipt, TrendingUp } from 'lucide-react'
import AnimatedCounter from '@/components/motion/AnimatedCounter'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CostSummary {
  totalLaborHours: number
  laborCost: number
  materialsCost: number
  grandTotal: number
}

interface LaborCostSummaryCardsProps {
  summary: CostSummary
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LaborCostSummaryCards({ summary }: LaborCostSummaryCardsProps) {
  const cards = [
    {
      icon: Clock,
      label: 'Total Hours',
      value: summary.totalLaborHours,
      format: (v: number) => `${v.toFixed(1)} hrs`,
      colorClass: 'text-blue-600',
      bgClass: 'bg-blue-50',
    },
    {
      icon: DollarSign,
      label: 'Labor Cost',
      value: summary.laborCost,
      format: (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      colorClass: 'text-primary-600',
      bgClass: 'bg-primary-50',
    },
    {
      icon: Receipt,
      label: 'Materials',
      value: summary.materialsCost,
      format: (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      colorClass: 'text-amber-600',
      bgClass: 'bg-amber-50',
    },
    {
      icon: TrendingUp,
      label: 'Grand Total',
      value: summary.grandTotal,
      format: (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      colorClass: 'text-purple-600',
      bgClass: 'bg-purple-50',
      emphasis: true,
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className={`bg-gradient-to-br from-primary-50/80 to-primary-100/80 backdrop-blur-sm border border-primary-200/30 rounded-xl p-3 text-center ${card.emphasis ? 'ring-1 ring-primary-300/50' : ''}`}
          >
            <div className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${card.bgClass} mb-2`}>
              <Icon className={`w-3.5 h-3.5 ${card.colorClass}`} />
            </div>
            <p className={`text-sm font-semibold ${card.emphasis ? 'text-primary-800' : 'text-slate-800'}`}>
              {card.format(card.value)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">{card.label}</p>
          </div>
        )
      })}
    </div>
  )
}
