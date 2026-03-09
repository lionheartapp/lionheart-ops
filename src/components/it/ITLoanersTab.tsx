'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryOptions, queryKeys } from '@/lib/queries'
import { useToast } from '@/components/Toast'
import {
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  Clock,
  Search,
  Loader2,
} from 'lucide-react'
import { IllustrationDevices } from '@/components/illustrations'

// ─── Types ──────────────────────────────────────────────────────────────

interface Device {
  id: string
  assetTag: string
  deviceType: string
  make?: string | null
  model?: string | null
  status: string
  school?: { id: string; name: string } | null
}

interface Checkout {
  id: string
  deviceId: string
  device: {
    id: string
    assetTag: string
    deviceType: string
    make?: string | null
    model?: string | null
  }
  borrowerStudent?: { id: string; firstName: string; lastName: string } | null
  borrowerUser?: { id: string; firstName: string; lastName: string } | null
  checkedOutAt: string
  dueDate: string
  checkedOutBy?: { id: string; firstName: string; lastName: string } | null
  notes?: string | null
}

interface LoanerData {
  available: Device[]
  checkedOut: Checkout[]
  overdue: Checkout[]
  counts: { available: number; checkedOut: number; overdue: number }
}

interface SearchStudent {
  id: string
  firstName: string
  lastName: string
  studentId?: string | null
  grade?: string | null
  school?: { id: string; name: string } | null
}

interface ITLoanersTabProps {
  canManage: boolean
  canCheckout: boolean
  canCheckin: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function daysOverdue(dueDate: string): number {
  const now = new Date()
  const due = new Date(dueDate)
  const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
}

function defaultDueDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 5)
  return d.toISOString().split('T')[0]
}

function getBorrowerName(c: Checkout): string {
  if (c.borrowerStudent) return `${c.borrowerStudent.firstName} ${c.borrowerStudent.lastName}`
  if (c.borrowerUser) return `${c.borrowerUser.firstName} ${c.borrowerUser.lastName}`
  return 'Unknown'
}

// ─── Skeleton ───────────────────────────────────────────────────────────

function LoanersTabSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="ui-glass p-4 animate-pulse">
            <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
            <div className="h-8 w-16 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
      {/* Available section */}
      <div className="ui-glass p-6 animate-pulse">
        <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
      {/* Table section */}
      <div className="ui-glass-table animate-pulse">
        <div className="h-5 w-40 bg-gray-200 rounded m-4" />
        <div className="space-y-3 p-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────

export default function ITLoanersTab({ canManage, canCheckout, canCheckin }: ITLoanersTabProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Checkout form state
  const [checkoutDeviceId, setCheckoutDeviceId] = useState<string | null>(null)
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<SearchStudent | null>(null)
  const [dueDate, setDueDate] = useState(defaultDueDate)
  const [checkoutNotes, setCheckoutNotes] = useState('')

  // ─── Queries ────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery(queryOptions.itLoaners())

  // Student search for checkout form
  const { data: studentResults = [], isFetching: searchingStudents } = useQuery<SearchStudent[]>({
    queryKey: ['it-student-search', studentSearch],
    queryFn: async () => {
      if (studentSearch.length < 2) return []
      const { getAuthHeaders } = await import('@/lib/api-client')
      const params = new URLSearchParams({ search: studentSearch, limit: '10' })
      const res = await fetch(`/api/it/students?${params}`, { headers: getAuthHeaders() })
      if (!res.ok) return []
      const json = await res.json()
      return json.ok ? (json.data?.students ?? json.data ?? []) : []
    },
    enabled: studentSearch.length >= 2 && checkoutDeviceId !== null,
    staleTime: 10_000,
  })

  // ─── Mutations ──────────────────────────────────────────────────────

  const checkoutMutation = useMutation({
    mutationFn: async (body: { deviceId: string; borrowerStudentId?: string; dueDate: string; notes?: string }) => {
      const { getAuthHeaders } = await import('@/lib/api-client')
      const res = await fetch('/api/it/loaners/checkout', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error?.message || 'Checkout failed')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itLoaners.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.itDevices.all })
      toast('Device checked out successfully', 'success')
      resetCheckoutForm()
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to checkout device', 'error')
    },
  })

  const checkinMutation = useMutation({
    mutationFn: async (checkoutId: string) => {
      const { getAuthHeaders } = await import('@/lib/api-client')
      const res = await fetch(`/api/it/loaners/${checkoutId}/checkin`, {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error?.message || 'Check-in failed')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itLoaners.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.itDevices.all })
      toast('Device checked in successfully', 'success')
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to check in device', 'error')
    },
  })

  // ─── Handlers ───────────────────────────────────────────────────────

  const resetCheckoutForm = useCallback(() => {
    setCheckoutDeviceId(null)
    setStudentSearch('')
    setSelectedStudent(null)
    setDueDate(defaultDueDate())
    setCheckoutNotes('')
  }, [])

  const handleCheckout = useCallback(() => {
    if (!checkoutDeviceId || !selectedStudent) return
    checkoutMutation.mutate({
      deviceId: checkoutDeviceId,
      borrowerStudentId: selectedStudent.id,
      dueDate: new Date(dueDate).toISOString(),
      notes: checkoutNotes || undefined,
    })
  }, [checkoutDeviceId, selectedStudent, dueDate, checkoutNotes, checkoutMutation])

  const handleCheckin = useCallback(
    (checkoutId: string) => {
      if (confirm('Check in this device? It will be returned to the loaner pool.')) {
        checkinMutation.mutate(checkoutId)
      }
    },
    [checkinMutation]
  )

  // ─── Render ─────────────────────────────────────────────────────────

  if (isLoading) return <LoanersTabSkeleton />

  const loaner = data as LoanerData | undefined
  const available = loaner?.available ?? []
  const checkedOut = loaner?.checkedOut ?? []
  const overdue = loaner?.overdue ?? []
  const counts = loaner?.counts ?? { available: 0, checkedOut: 0, overdue: 0 }

  return (
    <div className="space-y-6">
      {/* ── Summary Stats Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="ui-glass p-4">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-green-600" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Available</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{counts.available}</p>
        </div>
        <div className="ui-glass p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownToLine className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Checked Out</span>
          </div>
          <p className="text-2xl font-bold text-blue-700">{counts.checkedOut}</p>
        </div>
        <div className="ui-glass p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Overdue</span>
          </div>
          <p className="text-2xl font-bold text-amber-700">{counts.overdue}</p>
        </div>
      </div>

      {/* ── Available Devices ──────────────────────────────────────── */}
      <div className="ui-glass p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Package className="w-4 h-4 text-green-600" />
          Available Loaners
          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
            {available.length}
          </span>
        </h3>

        {available.length === 0 ? (
          <div className="text-center py-8">
            <IllustrationDevices className="w-40 h-32 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-600 mb-1">No available loaners in the pool</p>
            <p className="text-xs text-gray-400">
              Mark devices as &quot;Loaner&quot; status in the Devices tab to add them here
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {available.map((device) => (
              <div key={device.id}>
                <div className="ui-glass-hover p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs text-gray-500">{device.assetTag}</span>
                    {device.school && (
                      <span className="text-[10px] text-gray-400">{device.school.name}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    {[device.make, device.model].filter(Boolean).join(' ') || device.deviceType}
                  </p>
                  <p className="text-xs text-gray-500 mb-3">{device.deviceType}</p>

                  {canCheckout && (
                    <>
                      {checkoutDeviceId === device.id ? (
                        <button
                          onClick={() => resetCheckoutForm()}
                          className="w-full text-center px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            resetCheckoutForm()
                            setCheckoutDeviceId(device.id)
                          }}
                          className="w-full flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all"
                        >
                          <ArrowDownToLine className="w-3.5 h-3.5" />
                          Checkout
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Inline Checkout Form */}
                {checkoutDeviceId === device.id && (
                  <div className="mt-2 ui-glass p-4 space-y-3 border-l-2 border-blue-400">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      Checkout Details
                    </h4>

                    {/* Student Search */}
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Student</label>
                      {selectedStudent ? (
                        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                          <span className="text-sm text-blue-900">
                            {selectedStudent.firstName} {selectedStudent.lastName}
                            {selectedStudent.grade && (
                              <span className="text-xs text-blue-600 ml-1.5">Grade {selectedStudent.grade}</span>
                            )}
                          </span>
                          <button
                            onClick={() => {
                              setSelectedStudent(null)
                              setStudentSearch('')
                            }}
                            className="text-blue-400 hover:text-blue-600 text-xs"
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search student by name..."
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-shadow"
                          />
                          {searchingStudents && (
                            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />
                          )}
                        </div>
                      )}

                      {/* Search Results Dropdown */}
                      {!selectedStudent && studentSearch.length >= 2 && (studentResults as SearchStudent[]).length > 0 && (
                        <div className="mt-1 ui-glass-dropdown max-h-40 overflow-y-auto">
                          {(studentResults as SearchStudent[]).map((s) => (
                            <button
                              key={s.id}
                              onClick={() => {
                                setSelectedStudent(s)
                                setStudentSearch('')
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between"
                            >
                              <span className="text-gray-900">
                                {s.firstName} {s.lastName}
                              </span>
                              <span className="text-xs text-gray-400">
                                {[s.grade && `Gr ${s.grade}`, s.studentId && `#${s.studentId}`]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {!selectedStudent && studentSearch.length >= 2 && !searchingStudents && (studentResults as SearchStudent[]).length === 0 && (
                        <p className="text-xs text-gray-400 mt-1">No students found</p>
                      )}
                    </div>

                    {/* Due Date */}
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Due Date</label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-shadow"
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Notes (optional)</label>
                      <textarea
                        value={checkoutNotes}
                        onChange={(e) => setCheckoutNotes(e.target.value)}
                        rows={2}
                        placeholder="Reason for checkout, condition notes..."
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-shadow resize-none"
                      />
                    </div>

                    {/* Confirm */}
                    <button
                      onClick={handleCheckout}
                      disabled={!selectedStudent || checkoutMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {checkoutMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowDownToLine className="w-4 h-4" />
                      )}
                      Confirm Checkout
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Overdue Devices ────────────────────────────────────────── */}
      {overdue.length > 0 && (
        <div className="ui-glass p-6 border-l-4 border-red-400">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            Overdue
            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
              {overdue.length}
            </span>
          </h3>

          {/* Desktop table */}
          <div className="hidden sm:block ui-glass-table">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-200/50">
                  <th className="px-4 py-3 font-medium">Borrower</th>
                  <th className="px-4 py-3 font-medium">Asset Tag</th>
                  <th className="px-4 py-3 font-medium">Device</th>
                  <th className="px-4 py-3 font-medium">Checked Out</th>
                  <th className="px-4 py-3 font-medium">Due Date</th>
                  <th className="px-4 py-3 font-medium">Overdue</th>
                  {canCheckin && <th className="px-4 py-3 font-medium">Action</th>}
                </tr>
              </thead>
              <tbody>
                {overdue
                  .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                  .map((c) => (
                    <tr key={c.id} className="border-b border-gray-100/50 bg-red-50/30">
                      <td className="px-4 py-3 text-gray-900 font-medium">{getBorrowerName(c)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.device.assetTag}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {[c.device.make, c.device.model].filter(Boolean).join(' ') || c.device.deviceType}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatDate(c.checkedOutAt)}</td>
                      <td className="px-4 py-3 text-xs text-red-600 font-medium">{formatDate(c.dueDate)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                          {daysOverdue(c.dueDate)} day{daysOverdue(c.dueDate) !== 1 ? 's' : ''}
                        </span>
                      </td>
                      {canCheckin && (
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleCheckin(c.id)}
                            disabled={checkinMutation.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 active:scale-[0.97] transition-all disabled:opacity-50"
                          >
                            <ArrowUpFromLine className="w-3 h-3" />
                            Check In
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {overdue
              .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
              .map((c) => (
                <div key={c.id} className="ui-glass-hover p-4 border-l-2 border-red-400">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-gray-900">{getBorrowerName(c)}</span>
                    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                      {daysOverdue(c.dueDate)}d overdue
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 mb-2">
                    <span className="font-mono">{c.device.assetTag}</span>
                    <span>{[c.device.make, c.device.model].filter(Boolean).join(' ')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-red-600">Due: {formatDate(c.dueDate)}</span>
                    {canCheckin && (
                      <button
                        onClick={() => handleCheckin(c.id)}
                        disabled={checkinMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 active:scale-[0.97] transition-all disabled:opacity-50"
                      >
                        <ArrowUpFromLine className="w-3 h-3" />
                        Check In
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Checked Out Devices ────────────────────────────────────── */}
      <div className="ui-glass p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          Checked Out
          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
            {checkedOut.length}
          </span>
        </h3>

        {checkedOut.length === 0 ? (
          <div className="text-center py-8">
            <IllustrationDevices className="w-40 h-32 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-600 mb-1">No devices currently checked out</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block ui-glass-table">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-200/50">
                    <th className="px-4 py-3 font-medium">Borrower</th>
                    <th className="px-4 py-3 font-medium">Asset Tag</th>
                    <th className="px-4 py-3 font-medium">Device</th>
                    <th className="px-4 py-3 font-medium">Checked Out</th>
                    <th className="px-4 py-3 font-medium">Due Date</th>
                    <th className="px-4 py-3 font-medium">Checked Out By</th>
                    {canCheckin && <th className="px-4 py-3 font-medium">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {checkedOut.map((c) => (
                    <tr key={c.id} className="border-b border-gray-100/50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-gray-900 font-medium">{getBorrowerName(c)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.device.assetTag}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {[c.device.make, c.device.model].filter(Boolean).join(' ') || c.device.deviceType}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatDate(c.checkedOutAt)}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{formatDate(c.dueDate)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {c.checkedOutBy
                          ? `${c.checkedOutBy.firstName} ${c.checkedOutBy.lastName}`
                          : '—'}
                      </td>
                      {canCheckin && (
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleCheckin(c.id)}
                            disabled={checkinMutation.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 active:scale-[0.97] transition-all disabled:opacity-50"
                          >
                            <ArrowUpFromLine className="w-3 h-3" />
                            Check In
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-2">
              {checkedOut.map((c) => (
                <div key={c.id} className="ui-glass-hover p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-gray-900">{getBorrowerName(c)}</span>
                    <span className="text-xs text-gray-400">{formatDate(c.dueDate)}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 mb-2">
                    <span className="font-mono">{c.device.assetTag}</span>
                    <span>{[c.device.make, c.device.model].filter(Boolean).join(' ')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      Out since {formatDate(c.checkedOutAt)}
                    </span>
                    {canCheckin && (
                      <button
                        onClick={() => handleCheckin(c.id)}
                        disabled={checkinMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 active:scale-[0.97] transition-all disabled:opacity-50"
                      >
                        <ArrowUpFromLine className="w-3 h-3" />
                        Check In
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
