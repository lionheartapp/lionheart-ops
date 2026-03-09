'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryOptions } from '@/lib/queries'
import { DevicesTabSkeleton } from './ITSkeleton'
import { DeviceStatusBadge, DeviceTypeBadge } from './ITDeviceStatusBadge'
import { Plus, Laptop, Monitor, Tablet, Printer, HardDrive, Cpu } from 'lucide-react'
import ITSearchFilterBar from './ITSearchFilterBar'

interface ITDevicesTabProps {
  onViewDevice: (deviceId: string) => void
  onCreateDevice: () => void
  canManage: boolean
}

interface Device {
  id: string
  assetTag: string
  serialNumber?: string | null
  deviceType: string
  make?: string | null
  model?: string | null
  status: string
  isLemon?: boolean
  school?: { id: string; name: string } | null
  building?: { id: string; name: string } | null
  room?: { id: string; roomNumber?: string; displayName?: string | null } | null
  currentAssignment?: {
    student?: { id: string; firstName: string; lastName: string } | null
    user?: { id: string; firstName: string; lastName: string; email: string } | null
  } | null
  createdAt: string
}

const DEVICE_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'CHROMEBOOK', label: 'Chromebook' },
  { value: 'LAPTOP', label: 'Laptop' },
  { value: 'TABLET', label: 'Tablet' },
  { value: 'DESKTOP', label: 'Desktop' },
  { value: 'MONITOR', label: 'Monitor' },
  { value: 'PRINTER', label: 'Printer' },
  { value: 'OTHER', label: 'Other' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'REPAIR', label: 'In Repair' },
  { value: 'LOANER', label: 'Loaner' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'LOST', label: 'Lost' },
  { value: 'DECOMMISSIONED', label: 'Decommissioned' },
]

const DEVICE_TYPE_ICONS: Record<string, typeof Laptop> = {
  CHROMEBOOK: Laptop,
  LAPTOP: Laptop,
  TABLET: Tablet,
  DESKTOP: Cpu,
  MONITOR: Monitor,
  PRINTER: Printer,
  OTHER: HardDrive,
}

interface School {
  id: string
  name: string
}

export default function ITDevicesTab({ onViewDevice, onCreateDevice, canManage }: ITDevicesTabProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [schoolFilter, setSchoolFilter] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 50

  const filters = useMemo(() => {
    const f: Record<string, string> = {}
    if (search) f.search = search
    if (typeFilter) f.deviceType = typeFilter
    if (statusFilter) f.status = statusFilter
    if (schoolFilter) f.schoolId = schoolFilter
    f.limit = String(pageSize)
    f.offset = String(page * pageSize)
    return f
  }, [search, typeFilter, statusFilter, schoolFilter, page])

  const { data, isLoading } = useQuery(queryOptions.itDevices(filters))

  // Fetch schools for filter
  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ['schools-for-it-devices'],
    queryFn: async () => {
      const { getAuthHeaders } = await import('@/lib/api-client')
      const res = await fetch('/api/settings/schools', { headers: getAuthHeaders() })
      if (!res.ok) return []
      const json = await res.json()
      return json.ok ? json.data : []
    },
    staleTime: 5 * 60_000,
  })

  if (isLoading) return <DevicesTabSkeleton />

  const result = data as { devices?: Device[]; total?: number } | undefined
  const devices = result?.devices ?? []
  const total = result?.total ?? 0
  const totalPages = Math.ceil(total / pageSize)

  const getAssigneeName = (device: Device) => {
    const a = device.currentAssignment
    if (!a) return null
    if (a.student) return `${a.student.firstName} ${a.student.lastName}`
    if (a.user) return `${a.user.firstName} ${a.user.lastName}`
    return null
  }

  const getLocationText = (device: Device) => {
    const parts = [
      device.building?.name,
      device.room?.displayName || device.room?.roomNumber,
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(' › ') : device.school?.name || '—'
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <ITSearchFilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(0) }}
        searchPlaceholder="Search by asset tag, serial, make, model..."
        filters={[
          { label: 'Device Type', value: typeFilter, onChange: (v) => { setTypeFilter(v); setPage(0) }, options: DEVICE_TYPE_OPTIONS },
          { label: 'Status', value: statusFilter, onChange: (v) => { setStatusFilter(v); setPage(0) }, options: STATUS_OPTIONS },
          ...(schools.length > 1 ? [{
            label: 'Campus',
            value: schoolFilter,
            onChange: (v: string) => { setSchoolFilter(v); setPage(0) },
            options: [{ value: '', label: 'All Campuses' }, ...schools.map((s) => ({ value: s.id, label: s.name }))],
          }] : []),
        ]}
        trailing={canManage ? (
          <button
            onClick={onCreateDevice}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Device
          </button>
        ) : undefined}
      />

      {/* Results */}
      {devices.length === 0 ? (
        <div className="ui-glass p-12 text-center">
          <p className="text-sm text-gray-500">No devices found</p>
          <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or add a new device</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500">{total} device{total !== 1 ? 's' : ''}</p>

          {/* Desktop table */}
          <div className="hidden sm:block ui-glass-table">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-200/50">
                  <th className="px-4 py-3 font-medium">Asset Tag</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Make / Model</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Assigned To</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => {
                  const Icon = DEVICE_TYPE_ICONS[d.deviceType] || HardDrive
                  const assignee = getAssigneeName(d)
                  return (
                    <tr
                      key={d.id}
                      onClick={() => onViewDevice(d.id)}
                      className="border-b border-gray-100/50 hover:bg-gray-50/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-gray-400" />
                          <span className="font-mono text-xs text-gray-700">{d.assetTag}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><DeviceTypeBadge type={d.deviceType} /></td>
                      <td className="px-4 py-3 text-gray-700">
                        {[d.make, d.model].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <DeviceStatusBadge status={d.status} />
                          {d.isLemon && (
                            <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700">
                              Lemon
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{getLocationText(d)}</td>
                      <td className="px-4 py-3">
                        {assignee ? (
                          <span className="text-xs text-gray-600">{assignee}</span>
                        ) : (
                          <span className="text-xs text-gray-400">Unassigned</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="sm:hidden space-y-2">
            {devices.map((d) => {
              const Icon = DEVICE_TYPE_ICONS[d.deviceType] || HardDrive
              const assignee = getAssigneeName(d)
              return (
                <button
                  key={d.id}
                  onClick={() => onViewDevice(d.id)}
                  className="w-full text-left ui-glass-hover p-4"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-gray-400" />
                      <span className="font-mono text-xs text-gray-500">{d.assetTag}</span>
                    </div>
                    <DeviceStatusBadge status={d.status} />
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate mb-2">
                    {[d.make, d.model].filter(Boolean).join(' ') || d.deviceType}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DeviceTypeBadge type={d.deviceType} />
                    {assignee && (
                      <span className="text-xs text-gray-500">{assignee}</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-500">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
