'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryOptions, queryKeys } from '@/lib/queries'
import { getAuthHeaders } from '@/lib/api-client'
import DetailDrawer from '@/components/DetailDrawer'
import { useToast } from '@/components/Toast'
import { DeviceStatusBadge, DeviceTypeBadge } from './ITDeviceStatusBadge'
import {
  Laptop, Calendar, MapPin, User, Wrench, Search,
  UserPlus, UserMinus, Trash2, Loader2,
} from 'lucide-react'

interface ITDeviceDetailDrawerProps {
  deviceId: string | null
  isOpen: boolean
  onClose: () => void
  canManage: boolean
}

interface DeviceDetail {
  id: string
  assetTag: string
  serialNumber?: string | null
  deviceType: string
  make?: string | null
  model?: string | null
  manufacturer?: string | null
  osVersion?: string | null
  status: string
  isLemon?: boolean
  purchaseDate?: string | null
  purchasePrice?: number | null
  warrantyExpiry?: string | null
  notes?: string | null
  photos: string[]
  createdAt: string
  updatedAt: string
  school?: { id: string; name: string } | null
  building?: { id: string; name: string } | null
  room?: { id: string; roomNumber?: string; displayName?: string | null } | null
  currentAssignment?: {
    id: string
    assignedAt: string
    notes?: string | null
    student?: { id: string; firstName: string; lastName: string } | null
    user?: { id: string; firstName: string; lastName: string; email: string } | null
    assignedBy?: { id: string; firstName: string; lastName: string } | null
  } | null
  assignmentHistory?: Array<{
    id: string
    assignedAt: string
    returnedAt?: string | null
    notes?: string | null
    student?: { id: string; firstName: string; lastName: string } | null
    user?: { id: string; firstName: string; lastName: string; email: string } | null
    assignedBy?: { id: string; firstName: string; lastName: string } | null
  }>
  repairs?: Array<{
    id: string
    repairDate: string
    repairCost: number
    description?: string | null
    repairType?: string | null
    vendor?: string | null
  }>
}

interface StudentSearchResult {
  id: string
  firstName: string
  lastName: string
  studentId?: string | null
  grade?: string | null
  school?: { id: string; name: string } | null
}

export default function ITDeviceDetailDrawer({ deviceId, isOpen, onClose, canManage }: ITDeviceDetailDrawerProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [showAssign, setShowAssign] = useState(false)
  const [assignSearch, setAssignSearch] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const { data, isLoading } = useQuery({
    ...queryOptions.itDeviceDetail(deviceId ?? ''),
    enabled: !!deviceId,
  })

  const device = data as DeviceDetail | undefined

  // Search students for assignment
  const { data: studentResults = [] } = useQuery<StudentSearchResult[]>({
    queryKey: ['student-search', assignSearch],
    queryFn: async () => {
      if (!assignSearch.trim()) return []
      const res = await fetch(`/api/it/students?search=${encodeURIComponent(assignSearch)}&limit=10`, {
        headers: getAuthHeaders(),
      })
      if (!res.ok) return []
      const json = await res.json()
      return json.ok ? (json.data?.students ?? []) : []
    },
    enabled: showAssign && assignSearch.trim().length >= 2,
    staleTime: 10_000,
  })

  const assignMutation = useMutation({
    mutationFn: async (body: { studentId?: string; userId?: string }) => {
      const res = await fetch(`/api/it/devices/${deviceId}/assign`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error?.message || 'Assignment failed')
      }
      return res.json()
    },
    onSuccess: () => {
      setShowAssign(false)
      setAssignSearch('')
      queryClient.invalidateQueries({ queryKey: queryKeys.itDeviceDetail.byId(deviceId!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.itDevices.all })
      toast('Device assigned successfully', 'success')
    },
    onError: (err: Error) => {
      toast(err.message, 'error')
    },
  })

  const unassignMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/it/devices/${deviceId}/unassign`, {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error?.message || 'Unassignment failed')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itDeviceDetail.byId(deviceId!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.itDevices.all })
      toast('Device unassigned', 'success')
    },
    onError: (err: Error) => {
      toast(err.message, 'error')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/it/devices/${deviceId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error('Failed to delete device')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itDevices.all })
      toast('Device deleted', 'success')
      onClose()
    },
    onError: () => {
      toast('Failed to delete device', 'error')
    },
  })

  const location = [
    device?.building?.name,
    device?.room?.displayName || device?.room?.roomNumber,
  ].filter(Boolean).join(' › ')

  const assigneeName = device?.currentAssignment
    ? device.currentAssignment.student
      ? `${device.currentAssignment.student.firstName} ${device.currentAssignment.student.lastName}`
      : device.currentAssignment.user
        ? `${device.currentAssignment.user.firstName} ${device.currentAssignment.user.lastName}`
        : null
    : null

  return (
    <DetailDrawer isOpen={isOpen} onClose={onClose} title={device?.assetTag ?? 'Device'} width="lg">
      {isLoading || !device ? (
        <div className="space-y-4 animate-pulse p-4">
          <div className="h-6 w-48 bg-slate-200 rounded" />
          <div className="h-4 w-32 bg-slate-100 rounded" />
          <div className="h-20 w-full bg-slate-100 rounded-xl" />
        </div>
      ) : (
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-6 pb-4 border-b border-slate-200/50">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">
              {[device.make, device.model].filter(Boolean).join(' ') || device.deviceType}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <DeviceStatusBadge status={device.status} />
              <DeviceTypeBadge type={device.deviceType} />
              {device.isLemon && (
                <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">
                  Lemon
                </span>
              )}
            </div>
          </div>

          {/* Device info */}
          <div className="px-6 py-4 space-y-3 border-b border-slate-200/50">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Laptop className="w-4 h-4 text-slate-400" />
                <span>Asset: <span className="font-mono">{device.assetTag}</span></span>
              </div>
              {device.serialNumber && (
                <div className="text-slate-600 text-xs">
                  Serial: <span className="font-mono">{device.serialNumber}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>Added {new Date(device.createdAt).toLocaleDateString()}</span>
              </div>
              {(location || device.school?.name) && (
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{location || device.school?.name}</span>
                </div>
              )}
            </div>

            {device.purchaseDate && (
              <div className="text-xs text-slate-500">
                Purchased: {new Date(device.purchaseDate).toLocaleDateString()}
                {device.purchasePrice != null && ` — $${device.purchasePrice.toFixed(2)}`}
              </div>
            )}
            {device.warrantyExpiry && (
              <div className="text-xs text-slate-500">
                Warranty expires: {new Date(device.warrantyExpiry).toLocaleDateString()}
              </div>
            )}
            {device.osVersion && (
              <div className="text-xs text-slate-500">OS: {device.osVersion}</div>
            )}
            {device.notes && (
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{device.notes}</p>
            )}
          </div>

          {/* Current Assignment */}
          <div className="px-6 py-4 border-b border-slate-200/50">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Current Assignment</h3>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              {assigneeName ? (
                <span className="text-sm text-slate-700">{assigneeName}</span>
              ) : (
                <span className="text-sm text-slate-400">Unassigned</span>
              )}
              {canManage && (
                <div className="flex gap-2 ml-auto">
                  {assigneeName && (
                    <button
                      onClick={() => unassignMutation.mutate()}
                      disabled={unassignMutation.isPending}
                      className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      Unassign
                    </button>
                  )}
                  <button
                    onClick={() => setShowAssign(!showAssign)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    {assigneeName ? 'Reassign' : 'Assign'}
                  </button>
                </div>
              )}
            </div>

            {/* Assign search */}
            {showAssign && canManage && (
              <div className="mt-3 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search students by name or ID..."
                    value={assignSearch}
                    onChange={(e) => setAssignSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                    autoFocus
                  />
                </div>
                {studentResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {studentResults.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => assignMutation.mutate({ studentId: s.id })}
                        disabled={assignMutation.isPending}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-100 transition-colors flex items-center justify-between"
                      >
                        <div>
                          <span className="font-medium text-slate-900">
                            {s.firstName} {s.lastName}
                          </span>
                          {s.studentId && (
                            <span className="ml-2 text-xs text-slate-500 font-mono">#{s.studentId}</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">
                          {s.grade && `Grade ${s.grade}`}
                          {s.school && ` · ${s.school.name}`}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {assignSearch.trim().length >= 2 && studentResults.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-2">No students found</p>
                )}
              </div>
            )}
          </div>

          {/* Assignment History */}
          {device.assignmentHistory && device.assignmentHistory.length > 0 && (
            <div className="px-6 py-4 border-b border-slate-200/50">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Assignment History</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {device.assignmentHistory.map((a) => {
                  const name = a.student
                    ? `${a.student.firstName} ${a.student.lastName}`
                    : a.user
                      ? `${a.user.firstName} ${a.user.lastName}`
                      : 'Unknown'
                  return (
                    <div key={a.id} className="flex items-center justify-between text-xs text-slate-600 py-1">
                      <span>{name}</span>
                      <span className="text-slate-400">
                        {new Date(a.assignedAt).toLocaleDateString()}
                        {a.returnedAt && ` → ${new Date(a.returnedAt).toLocaleDateString()}`}
                        {!a.returnedAt && ' → present'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Repair History */}
          {device.repairs && device.repairs.length > 0 && (
            <div className="px-6 py-4 border-b border-slate-200/50">
              <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-slate-400" />
                Repair History
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {device.repairs.map((r) => (
                  <div key={r.id} className="bg-slate-50 rounded-lg p-2.5 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-slate-700">
                        {r.repairType || 'Repair'}
                      </span>
                      <span className="text-slate-400">
                        {new Date(r.repairDate).toLocaleDateString()}
                      </span>
                    </div>
                    {r.description && (
                      <p className="text-slate-600">{r.description}</p>
                    )}
                    <div className="flex gap-3 mt-1 text-slate-400">
                      {r.repairCost > 0 && <span>${r.repairCost.toFixed(2)}</span>}
                      {r.vendor && <span>{r.vendor}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {canManage && (
            <div className="px-6 py-4">
              {showDeleteConfirm ? (
                <div className="space-y-2">
                  <p className="text-sm text-slate-700">Delete this device? This action cannot be undone.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleteMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                      Confirm Delete
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Device
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </DetailDrawer>
  )
}
