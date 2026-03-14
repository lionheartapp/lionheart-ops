'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { format, isPast, isBefore, addDays } from 'date-fns'
import { ChevronUp, ChevronDown, AlertCircle, RepeatIcon, User, MapPin } from 'lucide-react'
import { PM_RECURRENCE_LABELS } from '@/lib/types/pm-schedule'
import { IllustrationMaintenance } from '@/components/illustrations'
import type { PmRecurrenceType } from '@/lib/types/pm-schedule'
import { listItem, staggerContainer } from '@/lib/animations'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PmSchedule {
  id: string
  name: string
  description?: string | null
  recurrenceType: string
  intervalDays?: number | null
  months: number[]
  advanceNoticeDays: number
  nextDueDate?: string | null
  isActive: boolean
  avoidSchoolYear: boolean
  checklistItems: string[]
  asset?: { id: string; assetNumber: string; name: string } | null
  building?: { id: string; name: string } | null
  area?: { id: string; name: string } | null
  room?: { id: string; roomNumber?: string | null; displayName?: string | null } | null
  school?: { id: string; name: string } | null
  defaultTechnician?: { id: string; name: string; email: string } | null
}

type SortField = 'name' | 'recurrenceType' | 'nextDueDate' | 'isActive'
type SortDir = 'asc' | 'desc'

// ─── Auth Headers ─────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  if (token) return { Authorization: `Bearer ${token}` }
  return {}
}

// ─── PmScheduleList ───────────────────────────────────────────────────────────

interface PmScheduleListProps {
  onRowClick?: (schedule: PmSchedule) => void
}

export default function PmScheduleList({ onRowClick }: PmScheduleListProps) {
  const [sortField, setSortField] = useState<SortField>('nextDueDate')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { data: schedules = [], isLoading } = useQuery<PmSchedule[]>({
    queryKey: ['pm-schedules-list'],
    queryFn: async () => {
      const res = await fetch('/api/maintenance/pm-schedules', {
        headers: getAuthHeaders(),
      })
      if (!res.ok) return []
      const json = await res.json()
      return json.data || []
    },
    staleTime: 30_000,
  })

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  // Client-side sort
  const sorted = [...schedules].sort((a, b) => {
    let aVal: string | number | boolean = ''
    let bVal: string | number | boolean = ''

    switch (sortField) {
      case 'name':
        aVal = a.name.toLowerCase()
        bVal = b.name.toLowerCase()
        break
      case 'recurrenceType':
        aVal = a.recurrenceType
        bVal = b.recurrenceType
        break
      case 'nextDueDate':
        aVal = a.nextDueDate ? new Date(a.nextDueDate).getTime() : Infinity
        bVal = b.nextDueDate ? new Date(b.nextDueDate).getTime() : Infinity
        break
      case 'isActive':
        aVal = a.isActive ? 1 : 0
        bVal = b.isActive ? 1 : 0
        break
    }

    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="w-3.5 h-3.5 opacity-30" />
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-primary-600" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-primary-600" />
    )
  }

  const getLocationLabel = (s: PmSchedule) => {
    const parts = [
      s.building?.name,
      s.area?.name,
      s.room ? (s.room.displayName || s.room.roomNumber) : null,
    ].filter(Boolean)
    return parts.join(' › ') || null
  }

  const getDueDateStatus = (dateStr: string | null | undefined) => {
    if (!dateStr) return { label: '—', className: 'text-slate-400' }
    const date = new Date(dateStr)
    if (isPast(date)) {
      return {
        label: format(date, 'MMM d, yyyy'),
        className: 'text-red-600 font-semibold',
        overdue: true,
      }
    }
    const soonThreshold = addDays(new Date(), 7)
    if (isBefore(date, soonThreshold)) {
      return {
        label: format(date, 'MMM d, yyyy'),
        className: 'text-amber-600 font-medium',
      }
    }
    return { label: format(date, 'MMM d, yyyy'), className: 'text-slate-700' }
  }

  if (isLoading) {
    return (
      <div className="ui-glass-table animate-pulse" role="status" aria-label="Loading schedules">
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-slate-100 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (schedules.length === 0) {
    return (
      <div className="ui-glass p-12 text-center">
        <IllustrationMaintenance className="w-48 h-40 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-700">No PM schedules yet</p>
        <p className="text-sm text-slate-500 mt-1">Create a schedule to get started</p>
      </div>
    )
  }

  return (
    <div className="ui-glass-table">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/50">
            <th
              className="text-left px-4 py-3 font-semibold text-slate-600 cursor-pointer hover:text-slate-900 transition-colors"
              onClick={() => handleSort('name')}
              aria-sort={sortField === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
            >
              <div className="flex items-center gap-1">
                Name
                <SortIcon field="name" />
              </div>
            </th>
            <th
              className="text-left px-4 py-3 font-semibold text-slate-600 cursor-pointer hover:text-slate-900 transition-colors"
              onClick={() => handleSort('recurrenceType')}
              aria-sort={sortField === 'recurrenceType' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
            >
              <div className="flex items-center gap-1">
                Recurrence
                <SortIcon field="recurrenceType" />
              </div>
            </th>
            <th
              className="text-left px-4 py-3 font-semibold text-slate-600 cursor-pointer hover:text-slate-900 transition-colors"
              onClick={() => handleSort('nextDueDate')}
              aria-sort={sortField === 'nextDueDate' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
            >
              <div className="flex items-center gap-1">
                Next Due
                <SortIcon field="nextDueDate" />
              </div>
            </th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600">
              Asset / Location
            </th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600">
              Technician
            </th>
            <th
              className="text-left px-4 py-3 font-semibold text-slate-600 cursor-pointer hover:text-slate-900 transition-colors"
              onClick={() => handleSort('isActive')}
              aria-sort={sortField === 'isActive' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
            >
              <div className="flex items-center gap-1">
                Status
                <SortIcon field="isActive" />
              </div>
            </th>
          </tr>
        </thead>
        <motion.tbody
          initial="hidden"
          animate="visible"
          variants={staggerContainer(0.04, 0.05)}
        >
          {sorted.map((s) => {
            const dueStatus = getDueDateStatus(s.nextDueDate)
            const locationLabel = getLocationLabel(s)

            return (
              <motion.tr
                key={s.id}
                variants={listItem}
                className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors cursor-pointer"
                onClick={() => onRowClick?.(s)}
              >
                {/* Name */}
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-slate-900">{s.name}</span>
                    {s.checklistItems.length > 0 && (
                      <span className="text-xs text-slate-400">
                        {s.checklistItems.length} checklist items
                      </span>
                    )}
                  </div>
                </td>

                {/* Recurrence */}
                <td className="px-4 py-3 text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <RepeatIcon className="w-3.5 h-3.5 text-slate-400" />
                    {PM_RECURRENCE_LABELS[s.recurrenceType as PmRecurrenceType] || s.recurrenceType}
                    {s.recurrenceType === 'CUSTOM' && s.intervalDays && (
                      <span className="text-xs text-slate-400">({s.intervalDays}d)</span>
                    )}
                  </div>
                </td>

                {/* Next due */}
                <td className={`px-4 py-3 ${dueStatus.className}`}>
                  <div className="flex items-center gap-1.5">
                    {dueStatus.overdue && <AlertCircle className="w-3.5 h-3.5" />}
                    {dueStatus.label}
                  </div>
                </td>

                {/* Asset / Location */}
                <td className="px-4 py-3 text-slate-600">
                  <div className="flex flex-col gap-0.5 max-w-[200px]">
                    {s.asset && (
                      <span className="truncate text-xs">
                        {s.asset.assetNumber} — {s.asset.name}
                      </span>
                    )}
                    {locationLabel && (
                      <span className="flex items-center gap-1 text-xs text-slate-500 truncate">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {locationLabel}
                      </span>
                    )}
                    {!s.asset && !locationLabel && (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>
                </td>

                {/* Technician */}
                <td className="px-4 py-3 text-slate-600">
                  {s.defaultTechnician ? (
                    <div className="flex items-center gap-1.5 text-xs">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {s.defaultTechnician.name}
                    </div>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {s.isActive ? 'Active' : 'Paused'}
                  </span>
                </td>
              </motion.tr>
            )
          })}
        </motion.tbody>
      </table>

      {/* Row count */}
      <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
        {sorted.length} schedule{sorted.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
