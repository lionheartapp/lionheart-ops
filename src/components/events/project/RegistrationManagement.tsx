'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useToast } from '@/components/Toast'
import {
  Search,
  Shield,
  XCircle,
  DollarSign,
  User,
  ChevronDown,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fadeInUp, staggerContainer, listItem } from '@/lib/animations'

// ─── Types ─────────────────────────────────────────────────────────────────────

type RegistrationStatus = 'REGISTERED' | 'WAITLISTED' | 'CANCELLED' | 'DRAFT'
type PaymentStatus = 'UNPAID' | 'DEPOSIT_PAID' | 'PAID' | 'REFUNDED'

interface Registration {
  id: string
  firstName: string
  lastName: string
  email: string
  grade: string | null
  photoUrl: string | null
  status: RegistrationStatus
  paymentStatus: PaymentStatus
  submittedAt: string | null
  createdAt: string
  promotedAt: string | null
}

interface CapacityInfo {
  maxCapacity: number | null
  waitlistEnabled: boolean
  registeredCount: number
  waitlistedCount: number
  cancelledCount: number
}

interface RegistrationsResponse {
  registrations: Registration[]
  total: number
  page: number
  limit: number
  capacity: CapacityInfo
}

interface MedicalData {
  id: string
  allergies: string | null
  medications: string | null
  medicalNotes: string | null
  emergencyName: string | null
  emergencyPhone: string | null
  emergencyRelationship: string | null
}

interface RegistrationManagementProps {
  eventProjectId: string
}

// ─── Badges ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<RegistrationStatus, string> = {
  REGISTERED: 'bg-green-100 text-green-700',
  WAITLISTED: 'bg-amber-100 text-amber-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  DRAFT: 'bg-gray-100 text-gray-500',
}

const PAYMENT_COLORS: Record<PaymentStatus, string> = {
  UNPAID: 'bg-gray-100 text-gray-500',
  DEPOSIT_PAID: 'bg-amber-100 text-amber-700',
  PAID: 'bg-green-100 text-green-700',
  REFUNDED: 'bg-red-100 text-red-600',
}

function StatusBadge({ status }: { status: RegistrationStatus }) {
  const labels: Record<RegistrationStatus, string> = {
    REGISTERED: 'Registered',
    WAITLISTED: 'Waitlisted',
    CANCELLED: 'Cancelled',
    DRAFT: 'Draft',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
      {labels[status]}
    </span>
  )
}

function PaymentBadge({ status }: { status: PaymentStatus }) {
  const labels: Record<PaymentStatus, string> = {
    UNPAID: 'Unpaid',
    DEPOSIT_PAID: 'Deposit Paid',
    PAID: 'Paid',
    REFUNDED: 'Refunded',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_COLORS[status]}`}>
      {labels[status]}
    </span>
  )
}

// ─── Medical Modal ─────────────────────────────────────────────────────────────

function MedicalModal({
  registrationId,
  eventProjectId,
  name,
  onClose,
}: {
  registrationId: string
  eventProjectId: string
  name: string
  onClose: () => void
}) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['medical', registrationId],
    queryFn: async () => {
      const res = await fetch(
        `/api/events/projects/${eventProjectId}/registrations/${registrationId}/medical`
      )
      if (res.status === 403) {
        throw new Error('FORBIDDEN')
      }
      if (!res.ok) {
        throw new Error('Failed to load medical data')
      }
      const body = await res.json() as { data: MedicalData }
      return body.data
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative ui-glass-overlay rounded-2xl p-6 w-full max-w-md z-10"
      >
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-indigo-500" />
          <h3 className="text-base font-semibold text-gray-900">Medical Data — {name}</h3>
        </div>

        {isLoading && (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-gray-100 rounded-xl" />
            ))}
          </div>
        )}

        {isError && (
          <div className="text-center py-4">
            {(error as Error).message === 'FORBIDDEN' ? (
              <p className="text-sm text-red-600">You don&apos;t have permission to view medical data.</p>
            ) : (
              <p className="text-sm text-gray-500">No medical data on file for this registration.</p>
            )}
          </div>
        )}

        {data && (
          <div className="space-y-3 text-sm">
            {data.allergies && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-0.5">Allergies</p>
                <p className="text-gray-800">{data.allergies}</p>
              </div>
            )}
            {data.medications && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-0.5">Medications</p>
                <p className="text-gray-800">{data.medications}</p>
              </div>
            )}
            {data.medicalNotes && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-0.5">Medical Notes</p>
                <p className="text-gray-800">{data.medicalNotes}</p>
              </div>
            )}
            {data.emergencyName && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-1">Emergency Contact</p>
                <p className="text-gray-800 font-medium">{data.emergencyName}</p>
                {data.emergencyRelationship && (
                  <p className="text-gray-500 text-xs">{data.emergencyRelationship}</p>
                )}
                {data.emergencyPhone && (
                  <p className="text-gray-700">{data.emergencyPhone}</p>
                )}
              </div>
            )}
            {!data.allergies && !data.medications && !data.medicalNotes && !data.emergencyName && (
              <p className="text-gray-400 text-center py-2">No medical information on file</p>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 active:scale-[0.97] transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Cancel Confirmation ───────────────────────────────────────────────────────

function CancelDialog({
  name,
  onConfirm,
  onClose,
  isPending,
}: {
  name: string
  onConfirm: () => void
  onClose: () => void
  isPending: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative ui-glass-overlay rounded-2xl p-6 w-full max-w-sm z-10"
      >
        <h3 className="text-base font-semibold text-gray-900 mb-2">Cancel Registration</h3>
        <p className="text-sm text-gray-500 mb-5">
          Cancel the registration for <strong>{name}</strong>? This will trigger automatic waitlist promotion if applicable.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all cursor-pointer"
          >
            Keep
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
          >
            {isPending ? 'Cancelling...' : 'Cancel Registration'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Balance Request Confirmation ──────────────────────────────────────────────

function BalanceDialog({
  name,
  email,
  onConfirm,
  onClose,
  isPending,
}: {
  name: string
  email: string
  onConfirm: () => void
  onClose: () => void
  isPending: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative ui-glass-overlay rounded-2xl p-6 w-full max-w-sm z-10"
      >
        <h3 className="text-base font-semibold text-gray-900 mb-2">Request Balance Payment</h3>
        <p className="text-sm text-gray-500 mb-5">
          Send a balance payment request email to <strong>{email}</strong> for <strong>{name}</strong>&apos;s registration?
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
          >
            {isPending ? 'Sending...' : 'Send Request'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Registration Row ──────────────────────────────────────────────────────────

function RegistrationRow({
  reg,
  eventProjectId,
  onCancelClick,
  onBalanceClick,
  onMedicalClick,
}: {
  reg: Registration
  eventProjectId: string
  onCancelClick: () => void
  onBalanceClick: () => void
  onMedicalClick: () => void
}) {
  const [actionsOpen, setActionsOpen] = useState(false)
  const displayName = `${reg.firstName} ${reg.lastName}`
  const initials = `${reg.firstName[0] ?? ''}${reg.lastName[0] ?? ''}`.toUpperCase()

  return (
    <motion.tr variants={listItem} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
      {/* Avatar + Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          {reg.photoUrl ? (
            <img
              src={reg.photoUrl}
              alt={displayName}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-gray-200"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-indigo-600">
              {initials || <User className="w-4 h-4" />}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
            <p className="text-xs text-gray-400 truncate">{reg.email}</p>
          </div>
        </div>
      </td>
      {/* Grade */}
      <td className="px-4 py-3 text-sm text-gray-600">{reg.grade ?? '—'}</td>
      {/* Status */}
      <td className="px-4 py-3"><StatusBadge status={reg.status} /></td>
      {/* Payment */}
      <td className="px-4 py-3"><PaymentBadge status={reg.paymentStatus} /></td>
      {/* Submitted */}
      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
        {reg.submittedAt
          ? formatDistanceToNow(new Date(reg.submittedAt), { addSuffix: true })
          : '—'}
      </td>
      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 justify-end">
          {/* Medical button */}
          <button
            onClick={onMedicalClick}
            title="View medical data"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5" />
          </button>

          {/* Balance request — only for DEPOSIT_PAID */}
          {reg.paymentStatus === 'DEPOSIT_PAID' && (
            <button
              onClick={onBalanceClick}
              title="Request balance payment"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-amber-500 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
            >
              <DollarSign className="w-3.5 h-3.5" />
            </button>
          )}

          {/* More actions dropdown */}
          <div className="relative">
            <button
              onClick={() => setActionsOpen(!actionsOpen)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {actionsOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setActionsOpen(false)} />
                <div className="absolute right-0 top-8 z-20 ui-glass-dropdown min-w-[160px] py-1">
                  {reg.status !== 'CANCELLED' && (
                    <button
                      onClick={() => { setActionsOpen(false); onCancelClick() }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Cancel Registration
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </td>
    </motion.tr>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function RegistrationManagement({ eventProjectId }: RegistrationManagementProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  const [medicalTarget, setMedicalTarget] = useState<{ id: string; name: string } | null>(null)
  const [cancelTarget, setCancelTarget] = useState<{ id: string; name: string } | null>(null)
  const [balanceTarget, setBalanceTarget] = useState<{ id: string; name: string; email: string } | null>(null)

  const queryKey = ['registrations', eventProjectId, statusFilter, search]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const url = new URL(`/api/events/projects/${eventProjectId}/registrations`, window.location.origin)
      if (statusFilter !== 'ALL') url.searchParams.set('status', statusFilter)
      if (search) url.searchParams.set('search', search)
      url.searchParams.set('limit', '50')

      const res = await fetch(url.toString())
      if (!res.ok) throw new Error('Failed to load registrations')
      const body = await res.json() as { data: RegistrationsResponse }
      return body.data
    },
  })

  // ─── Cancel mutation ─────────────────────────────────────────────────────────

  const cancelMutation = useMutation({
    mutationFn: async (registrationId: string) => {
      const res = await fetch(`/api/events/projects/${eventProjectId}/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', registrationId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(body?.error?.message ?? 'Failed to cancel')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrations', eventProjectId] })
      toast('Registration cancelled', 'success')
      setCancelTarget(null)
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to cancel registration', 'error')
    },
  })

  // ─── Balance intent mutation ──────────────────────────────────────────────────

  const balanceMutation = useMutation({
    mutationFn: async (registrationId: string) => {
      const res = await fetch(`/api/registration/${registrationId}/balance-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendEmail: true }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(body?.error?.message ?? 'Failed to send balance request')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrations', eventProjectId] })
      const email = balanceTarget?.email ?? ''
      toast(`Balance payment request sent to ${email}`, 'success')
      setBalanceTarget(null)
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to send balance request', 'error')
    },
  })

  // ─── Skeleton ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-20 bg-gray-100 rounded-2xl" />
        <div className="h-10 bg-gray-100 rounded-2xl" />
        {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-2xl" />)}
      </div>
    )
  }

  const capacity = data?.capacity
  const registrations = data?.registrations ?? []
  const total = data?.total ?? 0
  const capacityPct = capacity?.maxCapacity
    ? Math.min(100, Math.round((capacity.registeredCount / capacity.maxCapacity) * 100))
    : null

  return (
    <>
      <motion.div
        variants={staggerContainer()}
        initial="hidden"
        animate="visible"
        className="space-y-4"
      >
        {/* Summary row */}
        <motion.div
          variants={fadeInUp}
          className="bg-gradient-to-br from-primary-50/80 to-primary-100/80 backdrop-blur-sm border border-primary-200/30 rounded-2xl shadow-sm p-4"
        >
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{capacity?.registeredCount ?? 0}</p>
              <p className="text-xs text-gray-500 mt-0.5">Registered</p>
            </div>
            {(capacity?.waitlistedCount ?? 0) > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-700">{capacity?.waitlistedCount ?? 0}</p>
                <p className="text-xs text-gray-500 mt-0.5">Waitlisted</p>
              </div>
            )}
            {(capacity?.cancelledCount ?? 0) > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-400">{capacity?.cancelledCount ?? 0}</p>
                <p className="text-xs text-gray-500 mt-0.5">Cancelled</p>
              </div>
            )}
            {capacity?.maxCapacity && (
              <div className="flex-1 min-w-[160px]">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{capacity.registeredCount} of {capacity.maxCapacity}</span>
                  <span>{capacityPct}%</span>
                </div>
                <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${capacityPct}%`,
                      background: capacityPct && capacityPct >= 90
                        ? 'linear-gradient(90deg, #EF4444 0%, #DC2626 100%)'
                        : 'linear-gradient(90deg, #10B981 0%, #059669 100%)',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div variants={fadeInUp} className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300 transition-all"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/40 transition-all cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="REGISTERED">Registered</option>
            <option value="WAITLISTED">Waitlisted</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </motion.div>

        {/* Empty state */}
        {registrations.length === 0 && (
          <motion.div variants={fadeInUp} className="text-center py-12">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
              <User className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">No registrations yet</h3>
            <p className="text-sm text-gray-400">
              {search || statusFilter !== 'ALL'
                ? 'No registrations match your search.'
                : 'Share the registration link with parents to get started.'}
            </p>
          </motion.div>
        )}

        {/* Table */}
        {registrations.length > 0 && (
          <motion.div variants={fadeInUp} className="ui-glass-table">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Registrant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Grade</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Payment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Submitted</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <motion.tbody variants={staggerContainer()} initial="hidden" animate="visible">
                {registrations.map((reg) => (
                  <RegistrationRow
                    key={reg.id}
                    reg={reg}
                    eventProjectId={eventProjectId}
                    onCancelClick={() => setCancelTarget({ id: reg.id, name: `${reg.firstName} ${reg.lastName}` })}
                    onBalanceClick={() => setBalanceTarget({ id: reg.id, name: `${reg.firstName} ${reg.lastName}`, email: reg.email })}
                    onMedicalClick={() => setMedicalTarget({ id: reg.id, name: `${reg.firstName} ${reg.lastName}` })}
                  />
                ))}
              </motion.tbody>
            </table>

            {total > 50 && (
              <div className="px-4 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 text-center">Showing 50 of {total} registrations</p>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Medical Modal */}
      {medicalTarget && (
        <MedicalModal
          registrationId={medicalTarget.id}
          eventProjectId={eventProjectId}
          name={medicalTarget.name}
          onClose={() => setMedicalTarget(null)}
        />
      )}

      {/* Cancel Dialog */}
      {cancelTarget && (
        <CancelDialog
          name={cancelTarget.name}
          onConfirm={() => cancelMutation.mutate(cancelTarget.id)}
          onClose={() => setCancelTarget(null)}
          isPending={cancelMutation.isPending}
        />
      )}

      {/* Balance Dialog */}
      {balanceTarget && (
        <BalanceDialog
          name={balanceTarget.name}
          email={balanceTarget.email}
          onConfirm={() => balanceMutation.mutate(balanceTarget.id)}
          onClose={() => setBalanceTarget(null)}
          isPending={balanceMutation.isPending}
        />
      )}
    </>
  )
}
