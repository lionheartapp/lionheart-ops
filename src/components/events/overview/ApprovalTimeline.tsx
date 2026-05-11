'use client'

/**
 * ApprovalTimeline — vertical timeline showing gate-by-gate approval progress.
 *
 * Each gate is a node on the timeline with status dot, team name, responder,
 * timestamp, and rejection reason (if any). Pending gates pulse to indicate
 * they're awaiting review.
 */

import { CheckCircle, XCircle, Clock, MoreHorizontal } from 'lucide-react'
import {
  type ApprovalGates,
  type GateState,
  type GateStateV2,
  type ApprovalGatesV1,
} from './ApprovalGatesBar'

// ── Types & Helpers ────────────────────────────────────────────────────

type GateStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED'

interface NormalizedGate {
  key: string
  label: string
  status: GateStatus
  reason?: string | null
  respondedAt?: string | null
  respondedByName?: string | null
  sortOrder: number
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isV2(gates: Record<string, unknown>): boolean {
  return Object.keys(gates).some((k) => UUID_RE.test(k))
}

const V1_LABELS: Record<string, string> = {
  admin: 'Admin',
  av: 'A/V Production',
  facilities: 'Facilities',
  custodial: 'Custodial',
  security: 'Security',
  athletic_director: 'Athletic Director',
}

const ALL_V1_KEYS: (keyof ApprovalGatesV1)[] = ['admin', 'av', 'facilities', 'custodial', 'security', 'athletic_director']

function normalize(gates: ApprovalGates): NormalizedGate[] {
  const raw = gates as Record<string, unknown>
  if (isV2(raw)) {
    const v2 = gates as Record<string, GateStateV2>
    return Object.entries(v2)
      .filter(([, g]) => g && g.status !== 'SKIPPED')
      .map(([key, g], idx) => ({
        key,
        label: g.teamName || 'Unknown Team',
        status: g.status,
        reason: g.reason,
        respondedAt: g.respondedAt,
        respondedByName: g.respondedByName,
        sortOrder: g.sortOrder ?? idx,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  const v1 = gates as ApprovalGatesV1
  return ALL_V1_KEYS
    .filter((k) => { const g = v1[k]; return g && g.status !== 'SKIPPED' })
    .map((k, idx) => {
      const g = v1[k]!
      return {
        key: k,
        label: V1_LABELS[k] ?? k,
        status: g.status,
        reason: g.reason,
        respondedAt: g.respondedAt,
        respondedByName: (g as GateState & { respondedByName?: string | null }).respondedByName,
        sortOrder: idx,
      }
    })
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ── Status config ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<GateStatus, { dot: string; icon: typeof CheckCircle; label: string; textColor: string }> = {
  APPROVED: { dot: 'bg-emerald-500', icon: CheckCircle, label: 'Approved', textColor: 'text-emerald-700' },
  REJECTED: { dot: 'bg-red-500', icon: XCircle, label: 'Rejected', textColor: 'text-red-700' },
  PENDING: { dot: 'bg-amber-400 animate-pulse', icon: Clock, label: 'Awaiting review', textColor: 'text-amber-700' },
  SKIPPED: { dot: 'bg-slate-300', icon: MoreHorizontal, label: 'Skipped', textColor: 'text-slate-500' },
}

// ── Component ──────────────────────────────────────────────────────────

interface ApprovalTimelineProps {
  gates: ApprovalGates | null | undefined
  compact?: boolean
}

export default function ApprovalTimeline({ gates, compact }: ApprovalTimelineProps) {
  if (!gates) return null

  const normalized = normalize(gates)
  if (normalized.length === 0) return null

  return (
    <div className={compact ? 'space-y-0' : 'space-y-0'}>
      {!compact && (
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Approval Progress</h4>
      )}
      <div className="relative">
        {normalized.map((gate, idx) => {
          const config = STATUS_CONFIG[gate.status]
          const Icon = config.icon
          const isLast = idx === normalized.length - 1

          return (
            <div key={gate.key} className="flex gap-3">
              {/* Timeline line + dot */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`w-3 h-3 rounded-full ${config.dot} flex-shrink-0 mt-0.5`} />
                {!isLast && <div className="w-px flex-1 bg-slate-200 min-h-[24px]" />}
              </div>

              {/* Content */}
              <div className={`pb-4 min-w-0 flex-1 ${isLast ? 'pb-0' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{gate.label}</span>
                  <span className={`text-xs font-medium ${config.textColor} flex items-center gap-1`}>
                    <Icon className="w-3 h-3" />
                    {config.label}
                  </span>
                </div>

                {gate.respondedByName && gate.respondedAt && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {gate.respondedByName} · {relativeTime(gate.respondedAt)}
                  </p>
                )}

                {gate.status === 'REJECTED' && gate.reason && (
                  <div className="mt-1.5 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                    <p className="text-xs text-red-700">{gate.reason}</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
