'use client'

import { motion } from 'framer-motion'
import {
  Shield, Monitor, Wrench, Sparkles, ShieldAlert, Trophy,
  CheckCircle2, XCircle, Clock3, Minus,
} from 'lucide-react'
import { fadeInUp } from '@/lib/animations'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GateState {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED'
  respondedById?: string | null
  respondedAt?: string | null
  reason?: string | null
}

export interface ApprovalGates {
  admin?: GateState
  av?: GateState
  facilities?: GateState
  custodial?: GateState
  security?: GateState
  athletic_director?: GateState
}

// ─── Config ─────────────────────────────────────────────────────────────────

/** All supported gate types in display order */
const ALL_GATE_KEYS = ['admin', 'av', 'facilities', 'custodial', 'security', 'athletic_director'] as const

const GATE_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  admin: { label: 'Admin', icon: Shield },
  av: { label: 'A/V Production', icon: Monitor },
  facilities: { label: 'Facilities', icon: Wrench },
  custodial: { label: 'Custodial', icon: Sparkles },
  security: { label: 'Security', icon: ShieldAlert },
  athletic_director: { label: 'Athletic Director', icon: Trophy },
}

const GATE_STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ElementType; label: string }> = {
  PENDING: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: Clock3, label: 'Pending' },
  APPROVED: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', icon: CheckCircle2, label: 'Approved' },
  REJECTED: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: XCircle, label: 'Rejected' },
  SKIPPED: { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-400', icon: Minus, label: 'Skipped' },
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ApprovalGatesBar({ gates }: { gates: ApprovalGates }) {
  // Dynamically find which gates exist and are not skipped
  const activeGates = ALL_GATE_KEYS.filter(
    (key) => {
      const gate = gates[key as keyof ApprovalGates]
      return gate && gate.status !== 'SKIPPED'
    },
  )

  if (activeGates.length === 0) return null

  const allApproved = activeGates.every((key) => gates[key as keyof ApprovalGates]!.status === 'APPROVED')
  const anyRejected = activeGates.some((key) => gates[key as keyof ApprovalGates]!.status === 'REJECTED')

  // Responsive grid: 2 cols for ≤3 gates, 3 cols for 4+
  const gridCols = activeGates.length <= 3
    ? 'grid-cols-1 sm:grid-cols-3'
    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'

  return (
    <motion.div variants={fadeInUp} className="space-y-3">
      {/* Summary banner */}
      <div
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${
          allApproved
            ? 'bg-green-50 border border-green-200 text-green-800'
            : anyRejected
            ? 'bg-red-50 border border-red-200 text-red-800'
            : 'bg-amber-50 border border-amber-200 text-amber-800'
        }`}
      >
        {allApproved ? (
          <><CheckCircle2 className="w-4 h-4" /> All approvals granted</>
        ) : anyRejected ? (
          <><XCircle className="w-4 h-4" /> Changes requested — revise and resubmit</>
        ) : (
          <><Clock3 className="w-4 h-4" /> Awaiting approvals — event cannot be confirmed until all teams approve</>
        )}
      </div>

      {/* Individual gate pills */}
      <div className={`grid ${gridCols} gap-2`}>
        {activeGates.map((key) => {
          const gate = gates[key as keyof ApprovalGates]!
          const config = GATE_CONFIG[key] ?? { label: key, icon: Shield }
          const statusStyle = GATE_STATUS_STYLES[gate.status]
          const GateIcon = config.icon
          const StatusIcon = statusStyle.icon

          return (
            <div
              key={key}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border ${statusStyle.bg}`}
            >
              <GateIcon className={`w-4 h-4 ${statusStyle.text} flex-shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-900">{config.label}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <StatusIcon className={`w-3 h-3 ${statusStyle.text}`} />
                  <span className={`text-[10px] font-medium ${statusStyle.text}`}>{statusStyle.label}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Show rejection reasons */}
      {anyRejected && (
        <div className="space-y-1.5">
          {activeGates
            .filter((key) => {
              const gate = gates[key as keyof ApprovalGates]
              return gate?.status === 'REJECTED' && gate.reason
            })
            .map((key) => {
              const gate = gates[key as keyof ApprovalGates]!
              const config = GATE_CONFIG[key] ?? { label: key }
              return (
                <div key={key} className="flex items-start gap-2 px-3 py-2 bg-red-50 rounded-lg">
                  <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-700">
                    <span className="font-semibold">{config.label}:</span> {gate.reason}
                  </p>
                </div>
              )
            })}
        </div>
      )}
    </motion.div>
  )
}
