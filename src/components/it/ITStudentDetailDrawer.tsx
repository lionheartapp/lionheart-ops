'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryOptions, queryKeys } from '@/lib/queries'
import { getAuthHeaders } from '@/lib/api-client'
import DetailDrawer from '@/components/DetailDrawer'
import { useToast } from '@/components/Toast'
import { StudentStatusBadge, DeviceStatusBadge, DeviceTypeBadge } from './ITDeviceStatusBadge'
import { User, GraduationCap, Building2, Laptop, Trash2, Loader2 } from 'lucide-react'

interface ITStudentDetailDrawerProps {
  studentId: string | null
  isOpen: boolean
  onClose: () => void
  canManage: boolean
}

interface StudentDetail {
  id: string
  firstName: string
  lastName: string
  email?: string | null
  studentId?: string | null
  grade?: string | null
  gradeNumeric?: number | null
  status: string
  rosterSource?: string
  createdAt: string
  updatedAt: string
  school?: { id: string; name: string; gradeLevel?: string; color?: string | null } | null
  activeAssignments?: Array<{
    id: string
    assignedAt: string
    notes?: string | null
    device: {
      id: string
      assetTag: string
      serialNumber?: string | null
      deviceType: string
      make?: string | null
      model?: string | null
      status: string
    }
  }>
  allAssignments?: Array<{
    id: string
    assignedAt: string
    returnedAt?: string | null
    notes?: string | null
    device: {
      id: string
      assetTag: string
      serialNumber?: string | null
      deviceType: string
      make?: string | null
      model?: string | null
      status: string
    }
  }>
}

export default function ITStudentDetailDrawer({ studentId, isOpen, onClose, canManage }: ITStudentDetailDrawerProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const { data, isLoading } = useQuery({
    ...queryOptions.itStudentDetail(studentId ?? ''),
    enabled: !!studentId,
  })

  const student = data as StudentDetail | undefined

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/it/students/${studentId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error('Failed to delete student')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itStudents.all })
      toast('Student deleted', 'success')
      onClose()
    },
    onError: () => {
      toast('Failed to delete student', 'error')
    },
  })

  return (
    <DetailDrawer isOpen={isOpen} onClose={onClose} title="Student Details" width="lg">
      {isLoading || !student ? (
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
              {student.firstName} {student.lastName}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <StudentStatusBadge status={student.status} />
              {student.rosterSource && student.rosterSource !== 'MANUAL' && (
                <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700">
                  {student.rosterSource}
                </span>
              )}
            </div>
          </div>

          {/* Student info */}
          <div className="px-6 py-4 space-y-3 border-b border-slate-200/50">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {student.studentId && (
                <div className="flex items-center gap-2 text-slate-600">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>ID: <span className="font-mono">{student.studentId}</span></span>
                </div>
              )}
              {student.email && (
                <div className="text-slate-600 text-xs truncate">
                  {student.email}
                </div>
              )}
              {student.grade && (
                <div className="flex items-center gap-2 text-slate-600">
                  <GraduationCap className="w-4 h-4 text-slate-400" />
                  <span>Grade {student.grade}</span>
                </div>
              )}
              {student.school && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span>{student.school.name}</span>
                </div>
              )}
            </div>
            <div className="text-xs text-slate-400">
              Added {new Date(student.createdAt).toLocaleDateString()}
            </div>
          </div>

          {/* Active Devices */}
          <div className="px-6 py-4 border-b border-slate-200/50">
            <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <Laptop className="w-4 h-4 text-slate-400" />
              Active Devices
              {(student.activeAssignments?.length ?? 0) > 0 && (
                <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700">
                  {student.activeAssignments?.length}
                </span>
              )}
            </h3>
            {student.activeAssignments && student.activeAssignments.length > 0 ? (
              <div className="space-y-2">
                {student.activeAssignments.map((a) => (
                  <div key={a.id} className="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-slate-700">{a.device.assetTag}</span>
                        <DeviceTypeBadge type={a.device.deviceType} />
                        <DeviceStatusBadge status={a.device.status} />
                      </div>
                      <p className="text-xs text-slate-500">
                        {[a.device.make, a.device.model].filter(Boolean).join(' ')}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">
                      Since {new Date(a.assignedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No devices currently assigned</p>
            )}
          </div>

          {/* Assignment History */}
          {student.allAssignments && student.allAssignments.length > 0 && (
            <div className="px-6 py-4 border-b border-slate-200/50">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Assignment History</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {student.allAssignments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-xs text-slate-600 py-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-500">{a.device.assetTag}</span>
                      <span>{[a.device.make, a.device.model].filter(Boolean).join(' ')}</span>
                    </div>
                    <span className="text-slate-400">
                      {new Date(a.assignedAt).toLocaleDateString()}
                      {a.returnedAt
                        ? ` → ${new Date(a.returnedAt).toLocaleDateString()}`
                        : ' → present'}
                    </span>
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
                  <p className="text-sm text-slate-700">Delete this student record? This action cannot be undone.</p>
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
                  Delete Student
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </DetailDrawer>
  )
}
