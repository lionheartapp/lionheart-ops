'use client'

import { CheckCircle2, Bus, Home, Users } from 'lucide-react'
import type { RegistrationStatus, PaymentStatus } from './portal-types'

export function StatusBadge({ status }: { status: RegistrationStatus }) {
  const styles: Record<RegistrationStatus, { bg: string; text: string; label: string }> = {
    REGISTERED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Registered' },
    WAITLISTED: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Waitlisted' },
    CANCELLED:  { bg: 'bg-red-100',   text: 'text-red-700',   label: 'Cancelled'  },
    DRAFT:      { bg: 'bg-slate-100',  text: 'text-slate-700',  label: 'Draft'      },
  }
  const s = styles[status] ?? styles.DRAFT
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      {status === 'REGISTERED' && <CheckCircle2 className="w-3 h-3" />}
      {s.label}
    </span>
  )
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const styles: Record<PaymentStatus, { bg: string; text: string; label: string }> = {
    PAID:         { bg: 'bg-green-100', text: 'text-green-700', label: 'Paid' },
    DEPOSIT_PAID: { bg: 'bg-blue-100',  text: 'text-blue-700',  label: 'Deposit Paid' },
    UNPAID:       { bg: 'bg-slate-100',  text: 'text-slate-600',  label: 'No Payment Required' },
  }
  const s = styles[status] ?? styles.UNPAID
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

export const GROUP_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  BUS: { label: 'Bus', icon: Bus, color: 'bg-blue-50 text-blue-600 border-blue-100' },
  CABIN: { label: 'Cabin', icon: Home, color: 'bg-green-50 text-green-600 border-green-100' },
  SMALL_GROUP: { label: 'Group', icon: Users, color: 'bg-purple-50 text-purple-600 border-purple-100' },
}

export function GroupTypeBadge({ type }: { type: string }) {
  const config = GROUP_TYPE_CONFIG[type] ?? {
    label: type,
    icon: Users,
    color: 'bg-slate-50 text-slate-600 border-slate-100',
  }
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  )
}
