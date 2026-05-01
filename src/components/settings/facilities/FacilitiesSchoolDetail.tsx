'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronRight,
  Plus,
  Building2,
  MapPin,
  Pencil,
  Trash2,
  Map as MapIcon,
} from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import SchoolsManagement, {
  type SchoolsManagementHandle,
} from '@/components/settings/SchoolsManagement'
import { AddCampusDrawer, EditCampusDrawer } from '@/components/settings/campus/CampusFormDrawers'

// ─── Types ───────────────────────────────────────────────────────────────

type InstitutionType = 'PUBLIC' | 'PRIVATE' | 'CHARTER' | 'HYBRID' | 'FAITH_BASED'
type GradeLevel = 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL'

type School = {
  id: string
  name: string
  color: string
  logoUrl?: string | null
  address?: string | null
  institutionType?: InstitutionType | null
  campuses: Array<{ id: string; name: string; gradeLevel: GradeLevel | null }>
}

type CampusRow = {
  id: string
  name: string
  address: string | null
  gradeLevel: GradeLevel | null
  campusKind: 'HEADQUARTERS' | 'CAMPUS' | 'SATELLITE'
  latitude: number | null
  longitude: number | null
  schoolId: string | null
  siteId: string | null
  school: { id: string; name: string } | null
  site: { id: string; label: string | null; address: string } | null
  _count: { buildings: number; spaces: number; users: number }
}

interface FacilitiesSchoolDetailProps {
  schoolId: string
  onBack: () => void
  onOpenCampus: (campusId: string) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────

const INSTITUTION_LABELS: Record<InstitutionType, string> = {
  PUBLIC: 'Public',
  PRIVATE: 'Private',
  CHARTER: 'Charter',
  HYBRID: 'Hybrid',
  FAITH_BASED: 'Faith-based',
}

const GRADE_BADGE: Record<GradeLevel, { label: string; bg: string; text: string }> = {
  ELEMENTARY: { label: 'K-5', bg: 'bg-violet-50', text: 'text-violet-700' },
  MIDDLE_SCHOOL: { label: '6-8', bg: 'bg-sky-50', text: 'text-sky-700' },
  HIGH_SCHOOL: { label: '9-12', bg: 'bg-rose-50', text: 'text-rose-700' },
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function gradeRangeLabel(campuses: Array<{ gradeLevel: GradeLevel | null }>): string | null {
  const levels = new Set(campuses.map((c) => c.gradeLevel).filter(Boolean) as GradeLevel[])
  if (levels.size === 0) return null
  const hasElem = levels.has('ELEMENTARY')
  const hasMid = levels.has('MIDDLE_SCHOOL')
  const hasHigh = levels.has('HIGH_SCHOOL')
  if (hasElem && hasHigh) return 'K-12'
  if (hasElem && hasMid) return 'K-8'
  if (hasMid && hasHigh) return '6-12'
  if (hasElem) return 'K-5'
  if (hasMid) return '6-8'
  if (hasHigh) return '9-12'
  return null
}

// Key used to group campuses into sites: real siteId if present, otherwise
// fall back to address (or the campus id itself if no address).
function groupKey(c: CampusRow): string {
  if (c.siteId) return `site:${c.siteId}`
  if (c.address) return `addr:${c.address.trim().toLowerCase()}`
  return `solo:${c.id}`
}

function groupLabel(c: CampusRow): { label: string | null; address: string | null } {
  if (c.site) return { label: c.site.label, address: c.site.address }
  return { label: null, address: c.address }
}

// ─── Component ───────────────────────────────────────────────────────────

export default function FacilitiesSchoolDetail({
  schoolId,
  onBack,
  onOpenCampus,
}: FacilitiesSchoolDetailProps) {
  const [school, setSchool] = useState<School | null>(null)
  const [campuses, setCampuses] = useState<CampusRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const schoolsHandleRef = useRef<SchoolsManagementHandle>(null)

  // ─── Add Campus drawer state ─────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<{
    name: string
    address: string
    campusKind: string
  }>({ name: '', address: '', campusKind: 'CAMPUS' })
  // When adding "at this site" we carry the siteId so the new campus shares it
  const [addSiteId, setAddSiteId] = useState<string | null>(null)
  const [addError, setAddError] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  const openAddCampus = (opts?: { siteId?: string | null; address?: string | null }): void => {
    setAddSiteId(opts?.siteId ?? null)
    setAddForm({
      name: '',
      address: opts?.address ?? '',
      campusKind: 'CAMPUS',
    })
    setAddError('')
    setAddOpen(true)
  }

  const closeAddCampus = (): void => {
    setAddOpen(false)
    setAddError('')
  }

  const handleAddCampusSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const name = addForm.name.trim()
    if (!name) {
      setAddError('Campus name is required')
      return
    }
    setAddSaving(true)
    setAddError('')
    try {
      await fetchApi('/api/settings/campus/campuses', {
        method: 'POST',
        body: JSON.stringify({
          name,
          address: addForm.address.trim() || null,
          campusKind: addForm.campusKind,
          schoolId,
          siteId: addSiteId || null,
        }),
      })
      setAddOpen(false)
      await loadAll()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to create campus')
    } finally {
      setAddSaving(false)
    }
  }

  // ─── Edit Campus drawer state ────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false)
  const [editCampus, setEditCampus] = useState<CampusRow | null>(null)
  const [editForm, setEditForm] = useState<{
    name: string
    address: string
    campusKind: string
  }>({ name: '', address: '', campusKind: 'CAMPUS' })
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const openEditCampus = (campus: CampusRow): void => {
    setEditCampus(campus)
    setEditForm({
      name: campus.name,
      address: campus.address ?? '',
      campusKind: campus.campusKind,
    })
    setEditError('')
    setEditOpen(true)
  }

  const closeEditCampus = (): void => {
    setEditOpen(false)
    setEditError('')
    setEditCampus(null)
  }

  const handleEditCampusSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!editCampus) return
    const name = editForm.name.trim()
    if (!name) {
      setEditError('Campus name is required')
      return
    }
    setEditSaving(true)
    setEditError('')
    try {
      await fetchApi(`/api/settings/campus/campuses/${editCampus.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          address: editForm.address.trim() || null,
          campusKind: editForm.campusKind,
        }),
      })
      setEditOpen(false)
      setEditCampus(null)
      await loadAll()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update campus')
    } finally {
      setEditSaving(false)
    }
  }

  // ─── Delete Campus ──────────────────────────────────────────────────────
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDeleteCampus = async (campusId: string): Promise<void> => {
    setDeleting(true)
    try {
      await fetchApi(`/api/settings/campus/campuses/${campusId}`, {
        method: 'DELETE',
      })
      setDeleteConfirmId(null)
      await loadAll()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to delete campus')
    } finally {
      setDeleting(false)
    }
  }

  const loadAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const [allSchools, allCampuses] = await Promise.all([
        fetchApi<School[]>('/api/settings/schools'),
        fetchApi<CampusRow[]>('/api/settings/campus/campuses'),
      ])
      const found = Array.isArray(allSchools)
        ? allSchools.find((s) => s.id === schoolId) ?? null
        : null
      setSchool(found)
      const filtered = Array.isArray(allCampuses)
        ? allCampuses.filter((c) => c.schoolId === schoolId)
        : []
      setCampuses(filtered)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load school')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId])

  // Group campuses by site (or shared address)
  const groups = useMemo(() => {
    const byKey = new Map<string, { label: string | null; address: string | null; rows: CampusRow[] }>()
    for (const c of campuses) {
      const key = groupKey(c)
      const existing = byKey.get(key)
      if (existing) {
        existing.rows.push(c)
      } else {
        const { label, address } = groupLabel(c)
        byKey.set(key, { label, address, rows: [c] })
      }
    }
    return Array.from(byKey.entries()).map(([key, g]) => ({ key, ...g }))
  }, [campuses])

  const gradeSummary = useMemo(() => gradeRangeLabel(campuses), [campuses])
  const typeLabel = school?.institutionType ? INSTITUTION_LABELS[school.institutionType] : null

  // ─── UI: Loading skeleton ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Facilities
        </button>
        <div className="bg-white border border-slate-200 rounded-xl p-6 animate-pulse">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-xl bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-56 bg-slate-200 rounded" />
              <div className="h-3 w-72 bg-slate-200 rounded" />
            </div>
          </div>
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse">
            <div className="h-4 w-48 bg-slate-200 rounded mb-3" />
            <div className="h-24 w-full bg-slate-100 rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  if (error || !school) {
    return (
      <div className="space-y-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Facilities
        </button>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? 'School not found'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <button
          onClick={onBack}
          className="hover:text-slate-800 transition-colors cursor-pointer"
        >
          Facilities
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <span className="text-slate-900 font-medium truncate">{school.name}</span>
      </nav>

      {/* School header card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-5 flex-wrap">
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0 overflow-hidden"
            style={{ backgroundColor: school.color }}
          >
            {school.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={school.logoUrl} alt={school.name} className="w-full h-full object-cover" />
            ) : (
              getInitials(school.name)
            )}
          </div>
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold text-slate-900">{school.name}</h2>
              {typeLabel && (
                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  {typeLabel}
                </span>
              )}
              {gradeSummary && (
                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  {gradeSummary}
                </span>
              )}
            </div>
            {school.address && (
              <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{school.address}</span>
              </div>
            )}
            <div className="text-xs text-slate-400 mt-1">
              {campuses.length} {campuses.length === 1 ? 'campus' : 'campuses'} ·{' '}
              {groups.length} {groups.length === 1 ? 'site' : 'sites'}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => schoolsHandleRef.current?.openEdit(school.id)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit school
            </button>
            <button
              onClick={() => openAddCampus()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add campus
            </button>
          </div>
        </div>
      </div>

      {/* Site groups */}
      <div className="space-y-4">
        {groups.length === 0 && (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-10 text-center">
            <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto mb-3">
              <Building2 className="w-5 h-5 text-slate-400" />
            </div>
            <div className="text-sm font-medium text-slate-700">No campuses yet</div>
            <div className="text-xs text-slate-500 mt-1">
              Add a campus to start organizing buildings and spaces.
            </div>
          </div>
        )}

        {groups.map((group) => (
          <div
            key={group.key}
            className="bg-white border border-slate-200 rounded-xl overflow-hidden"
          >
            {/* Site header */}
            <div className="flex items-center gap-4 p-5 border-b border-slate-100">
              {/* Map thumbnail placeholder */}
              <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                <MapIcon className="w-6 h-6 text-emerald-600/70" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm font-semibold text-slate-900">
                    {group.label ?? (group.address ?? 'Unassigned address')}
                  </div>
                  {group.rows.length > 1 && (
                    <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                      Shared by {group.rows.length} campuses
                    </span>
                  )}
                </div>
                {group.address && group.label && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{group.address}</span>
                  </div>
                )}
                {!group.address && (
                  <div className="text-xs text-slate-400 mt-1 italic">No address set</div>
                )}
              </div>
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition cursor-pointer">
                <Pencil className="w-3 h-3" />
                Edit address
              </button>
            </div>

            {/* Campus rows */}
            <div className="divide-y divide-slate-100">
              {group.rows.map((campus) => {
                const badge = campus.gradeLevel ? GRADE_BADGE[campus.gradeLevel] : null
                return (
                  <button
                    key={campus.id}
                    onClick={() => onOpenCampus(campus.id)}
                    className="w-full text-left flex items-center gap-4 p-4 hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    {badge ? (
                      <span
                        className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded ${badge.bg} ${badge.text} flex-shrink-0`}
                      >
                        {badge.label}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded bg-slate-100 text-slate-500 flex-shrink-0">
                        —
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {campus.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {campus._count.buildings}{' '}
                        {campus._count.buildings === 1 ? 'building' : 'buildings'} ·{' '}
                        {campus._count.spaces}{' '}
                        {campus._count.spaces === 1 ? 'space' : 'spaces'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditCampus(campus)
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        aria-label="Edit campus"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteConfirmId(campus.id)
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        aria-label="Delete campus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors ml-1" />
                    </div>
                  </button>
                )
              })}

              {/* Add another campus at this site */}
              <button
                onClick={() => {
                  const firstRow = group.rows[0]
                  openAddCampus({
                    siteId: firstRow?.siteId ?? null,
                    address: group.address,
                  })
                }}
                className="w-full flex items-center justify-center gap-2 py-3 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-50/80 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add another campus at this site
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Hidden SchoolsManagement — powers the Edit school drawer via ref */}
      <div className="hidden">
        <SchoolsManagement
          ref={schoolsHandleRef}
          hideTable
          onSchoolsChanged={loadAll}
        />
      </div>

      {/* Add Campus drawer */}
      <AddCampusDrawer
        isOpen={addOpen}
        onClose={closeAddCampus}
        form={addForm}
        onFormChange={(update) => setAddForm((prev) => ({ ...prev, ...update }))}
        error={addError}
        saving={addSaving}
        onSubmit={handleAddCampusSubmit}
      />

      {/* Edit Campus drawer */}
      <EditCampusDrawer
        isOpen={editOpen}
        onClose={closeEditCampus}
        campus={editCampus ? { id: editCampus.id, name: editCampus.name, campusKind: editCampus.campusKind, address: editCampus.address } : null}
        form={editForm}
        onFormChange={(update) => setEditForm((prev) => ({ ...prev, ...update }))}
        error={editError}
        saving={editSaving}
        onSubmit={handleEditCampusSubmit}
      />

      {/* Delete Campus confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Delete campus?</h3>
              <p className="text-sm text-slate-500 mt-1">
                This will remove the campus and all associated buildings and spaces. This action cannot be undone.
              </p>
            </div>
            {editError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{editError}</div>}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setDeleteConfirmId(null); setEditError('') }}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCampus(deleteConfirmId)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-full hover:bg-red-700 disabled:opacity-50 transition cursor-pointer"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
