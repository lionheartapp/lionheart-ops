'use client'

import { motion } from 'framer-motion'
import {
  CheckCircle2, XCircle, Clock3, AlertCircle,
} from 'lucide-react'
import { fadeInUp } from '@/lib/animations'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GateState {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED'
  respondedById?: string | null
  respondedAt?: string | null
  reason?: string | null
}

/** V2 gate state — keyed by team UUID, includes team metadata */
export interface GateStateV2 {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED'
  teamName: string
  trigger?: string
  resourceType?: string | null
  sortOrder?: number
  respondedById?: string | null
  respondedByName?: string | null
  respondedAt?: string | null
  reason?: string | null
  mode?: 'REQUIRED' | 'NOTIFICATION'
  escalationHours?: number | null
}

/** V1 gates: channel-type keys */
export interface ApprovalGatesV1 {
  admin?: GateState
  av?: GateState
  facilities?: GateState
  custodial?: GateState
  security?: GateState
}

/** Union type that accepts both V1 and V2 gate shapes */
export type ApprovalGates = ApprovalGatesV1 | Record<string, GateStateV2>

// ─── V2 Detection ───────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isV2Gates(gates: Record<string, unknown>): boolean {
  return Object.keys(gates).some((key) => UUID_RE.test(key))
}

// ─── V1 Config ──────────────────────────────────────────────────────────────

const ALL_GATE_KEYS = ['admin', 'av', 'facilities', 'custodial', 'security'] as const

const V1_LABELS: Record<string, string> = {
  admin: 'Admin',
  av: 'A/V Production',
  facilities: 'Facilities',
  custodial: 'Custodial',
  security: 'Security',
}

// ─── Status styling ─────────────────────────────────────────────────────────

type GateStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED'

interface StatusStyle {
  iconBg: string
  iconColor: string
  pillBg: string
  pillText: string
  rowBorder: string
  Icon: typeof CheckCircle2
  label: string
}

const STATUS_STYLES: Record<GateStatus, StatusStyle> = {
  APPROVED: {
    iconBg: 'bg-green-100',
    iconColor: 'text-green-700',
    pillBg: 'bg-green-100',
    pillText: 'text-green-700',
    rowBorder: 'border-transparent',
    Icon: CheckCircle2,
    label: 'Approved',
  },
  PENDING: {
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-700',
    pillBg: 'bg-amber-100',
    pillText: 'text-amber-700',
    rowBorder: 'border-amber-200',
    Icon: Clock3,
    label: 'Pending',
  },
  REJECTED: {
    iconBg: 'bg-red-100',
    iconColor: 'text-red-700',
    pillBg: 'bg-red-100',
    pillText: 'text-red-700',
    rowBorder: 'border-red-200',
    Icon: XCircle,
    label: 'Changes requested',
  },
  SKIPPED: {
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-400',
    pillBg: 'bg-slate-100',
    pillText: 'text-slate-500',
    rowBorder: 'border-transparent',
    Icon: Clock3,
    label: 'Skipped',
  },
}

// ─── Normalized gate entry for rendering ────────────────────────────────────

interface NormalizedGate {
  key: string
  label: string
  status: GateStatus
  reason?: string | null
  respondedAt?: string | null
  respondedById?: string | null
  respondedByName?: string | null
  sortOrder: number
}

function normalizeGates(gates: ApprovalGates): NormalizedGate[] {
  const raw = gates as Record<string, unknown>
  if (isV2Gates(raw)) {
    const v2Gates = gates as Record<string, GateStateV2>
    return Object.entries(v2Gates)
      .filter(([, gate]) => gate && gate.status !== 'SKIPPED')
      .map(([key, gate], idx) => ({
        key,
        label: gate.teamName || 'Unknown Team',
        status: gate.status,
        reason: gate.reason,
        respondedAt: gate.respondedAt,
        respondedById: gate.respondedById,
        respondedByName: gate.respondedByName,
        sortOrder: gate.sortOrder ?? idx,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  const v1Gates = gates as ApprovalGatesV1
  return ALL_GATE_KEYS
    .filter((key) => {
      const gate = v1Gates[key]
      return gate && gate.status !== 'SKIPPED'
    })
    .map((key, idx) => {
      const gate = v1Gates[key]!
      const extended = gate as GateState & { respondedByName?: string | null }
      return {
        key,
        label: V1_LABELS[key] ?? key,
        status: gate.status,
        reason: gate.reason,
        respondedAt: gate.respondedAt,
        respondedById: gate.respondedById,
        respondedByName: extended.respondedByName,
        sortOrder: idx,
      }
    })
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTimestamp(iso?: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function relativeTime(iso?: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return null
}

// ─── Header ─────────────────────────────────────────────────────────────────

interface HeaderState {
  title: string
  subtitle: string
  pillBg: string
  pillText: string
  pillLabel: string
  iconBg: string
  iconColor: string
  Icon: typeof CheckCircle2
}

function buildHeaderState(gates: NormalizedGate[]): HeaderState {
  const total = gates.length
  const approved = gates.filter((g) => g.status === 'APPROVED').length
  const rejected = gates.some((g) => g.status === 'REJECTED')

  if (rejected) {
    return {
      title: 'Changes requested',
      subtitle: 'Review feedback below and resubmit',
      pillBg: 'bg-red-100',
      pillText: 'text-red-700',
      pillLabel: 'Action needed',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-700',
      Icon: AlertCircle,
    }
  }

  if (approved === total) {
    return {
      title: 'All approvals granted',
      subtitle: `${total} of ${total} teams approved`,
      pillBg: 'bg-green-100',
      pillText: 'text-green-700',
      pillLabel: 'Approved',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-700',
      Icon: CheckCircle2,
    }
  }

  return {
    title: 'Awaiting approvals',
    subtitle: `${approved} of ${total} ${total === 1 ? 'team' : 'teams'} approved`,
    pillBg: 'bg-amber-100',
    pillText: 'text-amber-700',
    pillLabel: 'Pending',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-700',
    Icon: Clock3,
  }
}

// ─── Sub-components ─────────────────────────────────────────────────────────

interface ProgressBarProps {
  gates: NormalizedGate[]
}

function ProgressBar({ gates }: ProgressBarProps) {
  return (
    <div className="flex gap-1 h-1 mb-4" aria-hidden="true">
      {gates.map((gate) => {
        const segmentColor =
          gate.status === 'APPROVED'
            ? 'bg-green-500'
            : gate.status === 'REJECTED'
            ? 'bg-red-400'
            : 'bg-gray-200'
        return (
          <div
            key={gate.key}
            className={`flex-1 rounded-full transition-colors duration-300 ${segmentColor}`}
          />
        )
      })}
    </div>
  )
}

interface GateRowProps {
  gate: NormalizedGate
  hint?: string | null
}

function buildSubtitle(gate: NormalizedGate, hint?: string | null): string {
  const stamp = formatTimestamp(gate.respondedAt)
  const rel = relativeTime(gate.respondedAt)
  const by = gate.respondedByName ? ` by ${gate.respondedByName}` : ''

  if (gate.status === 'APPROVED' && stamp) return `Approved${by} · ${stamp}`
  if (gate.status === 'REJECTED' && stamp) return `Reviewed${by} · ${stamp}`
  if (gate.status === 'PENDING' && rel) return `Requested ${rel}`
  return hint ?? 'Awaiting response'
}

function GateRow({ gate, hint }: GateRowProps) {
  const style = STATUS_STYLES[gate.status]
  const StatusIcon = style.Icon

  return (
    <div
      className={`flex items-start gap-3 px-3.5 py-3 rounded-xl bg-gray-50 border ${style.rowBorder} transition-colors duration-200`}
    >
      <div
        className={`w-8 h-8 rounded-full ${style.iconBg} flex items-center justify-center flex-shrink-0`}
      >
        <StatusIcon className={`w-4 h-4 ${style.iconColor}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900">{gate.label}</span>
          <span
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${style.pillBg} ${style.pillText}`}
          >
            {style.label}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{buildSubtitle(gate, hint)}</p>
        {gate.status === 'REJECTED' && gate.reason && (
          <p className="text-xs text-red-700 mt-1.5 leading-relaxed">{gate.reason}</p>
        )}
      </div>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ApprovalGatesBar({ gates }: { gates: ApprovalGates }) {
  const activeGates = normalizeGates(gates)

  if (activeGates.length === 0) return null

  const header = buildHeaderState(activeGates)
  const HeaderIcon = header.Icon

  // Find the first non-approved gate — used for "waiting on X first" hints
  const firstUnresolvedIdx = activeGates.findIndex((g) => g.status !== 'APPROVED')

  return (
    <motion.div
      variants={fadeInUp}
      className="bg-white border border-gray-200 rounded-xl p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-full ${header.iconBg} flex items-center justify-center`}
          >
            <HeaderIcon className={`w-3.5 h-3.5 ${header.iconColor}`} />
          </div>
          <div>
            <p className="text-[15px] font-medium text-gray-900 leading-tight">
              {header.title}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{header.subtitle}</p>
          </div>
        </div>
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full ${header.pillBg} ${header.pillText} whitespace-nowrap`}
        >
          {header.pillLabel}
        </span>
      </div>

      {/* Segmented progress bar */}
      <ProgressBar gates={activeGates} />

      {/* Per-team rows */}
      <div className="flex flex-col gap-2">
        {activeGates.map((gate, idx) => {
          const isWaitingOnEarlier =
            gate.status === 'PENDING' &&
            firstUnresolvedIdx !== -1 &&
            idx > firstUnresolvedIdx
          const earlierLabels = isWaitingOnEarlier
            ? activeGates
                .slice(0, idx)
                .filter((g) => g.status !== 'APPROVED')
                .map((g) => g.label)
                .join(' + ')
            : null
          const hint = earlierLabels ? `Waiting on ${earlierLabels} first` : null

          return <GateRow key={gate.key} gate={gate} hint={hint} />
        })}
      </div>
    </motion.div>
  )
}
