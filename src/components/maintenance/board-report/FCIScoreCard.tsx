'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, animate, useMotionValue, useTransform } from 'framer-motion'
import { Info } from 'lucide-react'
import { cardEntrance } from '@/lib/animations'
import type { BoardReportMetrics } from '@/lib/services/boardReportService'

// ─── Animated decimal counter ─────────────────────────────────────────────────

function AnimatedFCI({ value }: { value: number }) {
  const motionValue = useMotionValue(0)
  const [display, setDisplay] = useState('0.000')

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 1.0,
      ease: [0.25, 0.1, 0.25, 1],
    })
    const unsubscribe = motionValue.on('change', (v) => {
      setDisplay((v * 100).toFixed(1) + '%')
    })
    return () => {
      controls.stop()
      unsubscribe()
    }
  }, [value, motionValue])

  return <span>{display}</span>
}

// ─── Rating config ────────────────────────────────────────────────────────────

const RATING_CONFIG = {
  GOOD: {
    label: 'Good',
    bg: 'bg-primary-50',
    border: 'border-primary-200',
    textColor: 'text-primary-700',
    badgeBg: 'bg-primary-100 text-primary-700',
    scoreColor: 'text-primary-600',
    dot: 'bg-primary-500',
    description: 'Facility is in excellent condition',
  },
  FAIR: {
    label: 'Fair',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    textColor: 'text-amber-700',
    badgeBg: 'bg-amber-100 text-amber-700',
    scoreColor: 'text-amber-600',
    dot: 'bg-amber-500',
    description: 'Attention recommended — some deferred maintenance accumulating',
  },
  POOR: {
    label: 'Poor',
    bg: 'bg-red-50',
    border: 'border-red-200',
    textColor: 'text-red-700',
    badgeBg: 'bg-red-100 text-red-700',
    scoreColor: 'text-red-600',
    dot: 'bg-red-500',
    description: 'Immediate action required — high deferred maintenance backlog',
  },
}

// ─── Component ────────────────────────────────────────────────────────────────

interface FCIScoreCardProps {
  fci: BoardReportMetrics['fci']
}

export function FCIScoreCard({ fci }: FCIScoreCardProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const cfg = RATING_CONFIG[fci.rating]

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  return (
    <motion.div
      variants={cardEntrance}
      className={`${cfg.bg} border ${cfg.border} rounded-2xl p-6 relative`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase mb-1">
            Facility Condition Index
          </p>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
            <span className={`text-xs font-semibold ${cfg.textColor}`}>{cfg.description}</span>
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setTooltipOpen(!tooltipOpen)}
            className="w-7 h-7 rounded-full bg-white/70 flex items-center justify-center hover:bg-white transition-colors cursor-pointer"
            aria-label="FCI information"
          >
            <Info className="w-3.5 h-3.5 text-slate-500" />
          </button>
          {tooltipOpen && (
            <div className="absolute right-0 top-9 w-64 bg-slate-900 text-white text-xs rounded-xl p-3 shadow-lg z-10">
              <p className="font-semibold mb-1">APPA FCI Standard</p>
              <p className="text-slate-300 mb-2">FCI = Deferred Maintenance ÷ Replacement Value</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary-400" />
                  <span className="text-slate-300">{"< 5%"} — Good</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-slate-300">5–10% — Fair</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-slate-300">{"> 10%"} — Poor</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Score */}
      <div className="mb-4">
        <span className={`text-5xl font-black tracking-tight ${cfg.scoreColor}`}>
          <AnimatedFCI value={fci.score} />
        </span>
        <span className={`ml-2 text-sm font-bold px-3 py-1 rounded-full ${cfg.badgeBg}`}>
          {cfg.label}
        </span>
      </div>

      {/* Sub-stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3">
          <p className="text-xs text-slate-500 mb-0.5">Deferred Maintenance</p>
          <p className="text-sm font-bold text-slate-800">{fmt(fci.deferred)}</p>
        </div>
        <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3">
          <p className="text-xs text-slate-500 mb-0.5">Total Replacement Value</p>
          <p className="text-sm font-bold text-slate-800">{fmt(fci.replacementValue)}</p>
        </div>
      </div>

      {/* Footnote */}
      <p className="mt-3 text-[10px] text-slate-400">
        APPA standard: {"< 5%"} Good | 5–10% Fair | {"> 10%"} Poor
      </p>
    </motion.div>
  )
}
