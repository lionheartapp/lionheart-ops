'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryOptions } from '@/lib/queries'
import { StudentsTabSkeleton } from './ITSkeleton'
import { StudentStatusBadge } from './ITDeviceStatusBadge'
import { Plus, Laptop } from 'lucide-react'
import ITSearchFilterBar from './ITSearchFilterBar'
import { IllustrationTeam } from '@/components/illustrations'

interface ITStudentsTabProps {
  onViewStudent: (studentId: string) => void
  onCreateStudent: () => void
  canManage: boolean
}

interface Student {
  id: string
  firstName: string
  lastName: string
  email?: string | null
  studentId?: string | null
  grade?: string | null
  status: string
  school?: { id: string; name: string; color?: string | null } | null
  _count?: { deviceAssignments: number }
  createdAt: string
}

interface School {
  id: string
  name: string
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'TRANSFERRED', label: 'Transferred' },
  { value: 'GRADUATED', label: 'Graduated' },
]

const GRADE_OPTIONS = [
  { value: '', label: 'All Grades' },
  { value: 'K', label: 'Kindergarten' },
  { value: '1', label: '1st Grade' },
  { value: '2', label: '2nd Grade' },
  { value: '3', label: '3rd Grade' },
  { value: '4', label: '4th Grade' },
  { value: '5', label: '5th Grade' },
  { value: '6', label: '6th Grade' },
  { value: '7', label: '7th Grade' },
  { value: '8', label: '8th Grade' },
  { value: '9', label: '9th Grade' },
  { value: '10', label: '10th Grade' },
  { value: '11', label: '11th Grade' },
  { value: '12', label: '12th Grade' },
]

export default function ITStudentsTab({ onViewStudent, onCreateStudent, canManage }: ITStudentsTabProps) {
  const [search, setSearch] = useState('')
  const [schoolFilter, setSchoolFilter] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 50

  const filters = useMemo(() => {
    const f: Record<string, string> = {}
    if (search) f.search = search
    if (schoolFilter) f.schoolId = schoolFilter
    if (gradeFilter) f.grade = gradeFilter
    if (statusFilter) f.status = statusFilter
    f.limit = String(pageSize)
    f.offset = String(page * pageSize)
    return f
  }, [search, schoolFilter, gradeFilter, statusFilter, page])

  const { data, isLoading } = useQuery(queryOptions.itStudents(filters))

  // Fetch schools for filter
  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ['schools-for-it-students'],
    queryFn: async () => {
      const { getAuthHeaders } = await import('@/lib/api-client')
      const res = await fetch('/api/settings/schools', { headers: getAuthHeaders() })
      if (!res.ok) return []
      const json = await res.json()
      return json.ok ? json.data : []
    },
    staleTime: 5 * 60_000,
  })

  if (isLoading) return <StudentsTabSkeleton />

  const result = data as { students?: Student[]; total?: number } | undefined
  const students = result?.students ?? []
  const total = result?.total ?? 0
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <ITSearchFilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(0) }}
        searchPlaceholder="Search by name or student ID..."
        filters={[
          ...(schools.length > 1 ? [{
            label: 'Campus',
            value: schoolFilter,
            onChange: (v: string) => { setSchoolFilter(v); setPage(0) },
            options: [{ value: '', label: 'All Campuses' }, ...schools.map((s) => ({ value: s.id, label: s.name }))],
          }] : []),
          { label: 'Grade', value: gradeFilter, onChange: (v) => { setGradeFilter(v); setPage(0) }, options: GRADE_OPTIONS },
          { label: 'Status', value: statusFilter, onChange: (v) => { setStatusFilter(v); setPage(0) }, options: STATUS_OPTIONS },
        ]}
        trailing={canManage ? (
          <button
            onClick={onCreateStudent}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Student
          </button>
        ) : undefined}
      />

      {/* Results */}
      {students.length === 0 ? (
        <div className="ui-glass py-14 text-center">
          <IllustrationTeam className="w-48 h-40 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-600 mb-1">No students found</p>
          <p className="text-xs text-gray-400 mb-4">Try adjusting your filters or add a new student</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500">{total} student{total !== 1 ? 's' : ''}</p>

          {/* Desktop table */}
          <div className="hidden sm:block ui-glass-table">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-200/50">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Student ID</th>
                  <th className="px-4 py-3 font-medium">Grade</th>
                  <th className="px-4 py-3 font-medium">School</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Devices</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => onViewStudent(s.id)}
                    className="border-b border-gray-100/50 hover:bg-gray-50/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-900">
                      {s.firstName} {s.lastName}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {s.studentId || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {s.grade || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {s.school?.name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StudentStatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3">
                      {(s._count?.deviceAssignments ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
                          <Laptop className="w-3 h-3" />
                          {s._count?.deviceAssignments}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="sm:hidden space-y-2">
            {students.map((s) => (
              <button
                key={s.id}
                onClick={() => onViewStudent(s.id)}
                className="w-full text-left ui-glass-hover p-4"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-gray-900">
                    {s.firstName} {s.lastName}
                  </span>
                  <StudentStatusBadge status={s.status} />
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
                  {s.studentId && <span className="font-mono">#{s.studentId}</span>}
                  {s.grade && <span>Grade {s.grade}</span>}
                  {s.school && <span>{s.school.name}</span>}
                  {(s._count?.deviceAssignments ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 bg-blue-100 text-blue-700 font-medium">
                      <Laptop className="w-3 h-3" />
                      {s._count?.deviceAssignments}
                    </span>
                  )}
                </div>
              </button>
            ))}
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
