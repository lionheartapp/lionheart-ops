'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronRight,
  Plus,
  Building2,
  MapPin,
  Pencil,
  Trash2,
  Search,
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  DoorOpen,
  Layers,
  Sparkles,
} from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import SchoolsManagement, {
  type SchoolsManagementHandle,
} from '@/components/settings/SchoolsManagement'
import { AddCampusDrawer, EditCampusDrawer } from '@/components/settings/campus/CampusFormDrawers'

// ─── Types ───────────────────────────────────────────────────────────────

type InstitutionType = 'PUBLIC' | 'PRIVATE' | 'CHARTER' | 'HYBRID' | 'FAITH_BASED'
type GradeLevel = 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL'
type CampusKind = 'HEADQUARTERS' | 'CAMPUS' | 'SATELLITE'

interface School {
  id: string
  name: string
  color: string
  logoUrl?: string | null
  address?: string | null
  institutionType?: InstitutionType | null
  campuses: Array<{ id: string; name: string; gradeLevel: GradeLevel | null }>
}

interface CampusRow {
  id: string
  name: string
  address: string | null
  gradeLevel: GradeLevel | null
  campusKind: CampusKind
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
  onOpenCampus: (campusId: string, campusName: string, schoolName: string) => void
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
  ELEMENTARY: { label: 'K–5', bg: 'bg-violet-50', text: 'text-violet-700' },
  MIDDLE_SCHOOL: { label: '6–8', bg: 'bg-sky-50', text: 'text-sky-700' },
  HIGH_SCHOOL: { label: '9–12', bg: 'bg-rose-50', text: 'text-rose-700' },
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
  if (hasElem && hasHigh) return 'K–12'
  if (hasElem && hasMid) return 'K–8'
  if (hasMid && hasHigh) return '6–12'
  if (hasElem) return 'K–5'
  if (hasMid) return '6–8'
  if (hasHigh) return '9–12'
  return null
}

// Identify which campuses share a site (for the "Shares site" chip).
function sharedSiteCampusIds(campuses: CampusRow[]): Map<string, string[]> {
  const bySite = new Map<string, string[]>()
  for (const c of campuses) {
    if (!c.siteId) continue
    const existing = bySite.get(c.siteId) ?? []
    existing.push(c.id)
    bySite.set(c.siteId, existing)
  }
  // Only keep sites with more than one campus
  return new Map([...bySite.entries()].filter(([, ids]) => ids.length > 1))
}

// ─── Setup completeness ─────────────────────────────────────────────────

interface SetupStep {
  key: string
  label: string
  done: boolean
}

function computeSetupSteps(school: School, campuses: CampusRow[]): SetupStep[] {
  const totalBuildings = campuses.reduce((n, c) => n + c._count.buildings, 0)
  const totalSpaces = campuses.reduce((n, c) => n + c._count.spaces, 0)
  const allHaveAddress =
    campuses.length > 0 && campuses.every((c) => Boolean(c.address || c.site?.address))
  return [
    { key: 'school', label: 'School info added', done: Boolean(school.name) },
    { key: 'campuses', label: 'At least one campus', done: campuses.length > 0 },
    { key: 'addresses', label: 'Every campus has an address', done: allHaveAddress },
    { key: 'buildings', label: 'At least one building', done: totalBuildings > 0 },
    { key: 'rooms', label: 'At least one room', done: totalSpaces > 0 },
  ]
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
  const [search, setSearch] = useState('')
  const logoInputRef = useRef<HTMLInputElement>(null)

  const schoolsHandleRef = useRef<SchoolsManagementHandle>(null)

  // ─── Add Campus drawer state ─────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<{
    name: string
    address: string
    campusKind: string
  }>({ name: '', address: '', campusKind: 'CAMPUS' })
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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Failed to delete campus')
    } finally {
      setDeleting(false)
    }
  }

  const loadAll = async (): Promise<void> => {
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load school')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId])

  // Remove parent content padding so the hero can bleed edge-to-edge.
  // The padding is on #main-content > div (DashboardLayout inner wrapper).
  useEffect(() => {
    const wrapper = document.querySelector('#main-content > div') as HTMLElement | null
    if (!wrapper) return
    const origPadding = wrapper.style.cssText
    wrapper.style.paddingTop = '0'
    wrapper.style.paddingLeft = '0'
    wrapper.style.paddingRight = '0'
    return () => {
      wrapper.style.cssText = origPadding
    }
  }, [])

  // ─── Logo upload ────────────────────────────────────────────────────────
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !school) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 2 * 1024 * 1024) return // 2MB limit

    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      try {
        await fetchApi(`/api/settings/schools/${school.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ logoUrl: dataUrl }),
        })
        setSchool((prev) => prev ? { ...prev, logoUrl: dataUrl } : prev)
      } catch {
        // silent
      }
    }
    reader.readAsDataURL(file)
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  // ─── Derived state ───────────────────────────────────────────────────────
  const gradeSummary = useMemo(() => gradeRangeLabel(campuses), [campuses])
  const typeLabel = school?.institutionType ? INSTITUTION_LABELS[school.institutionType] : null
  const sharedSites = useMemo(() => sharedSiteCampusIds(campuses), [campuses])

  const totals = useMemo(() => {
    const buildings = campuses.reduce((n, c) => n + c._count.buildings, 0)
    const spaces = campuses.reduce((n, c) => n + c._count.spaces, 0)
    const missingAddress = campuses.filter((c) => !c.address && !c.site?.address).length
    return { buildings, spaces, missingAddress }
  }, [campuses])

  const setupSteps = useMemo(
    () => (school ? computeSetupSteps(school, campuses) : []),
    [school, campuses],
  )
  const setupPct = setupSteps.length
    ? Math.round((setupSteps.filter((s) => s.done).length / setupSteps.length) * 100)
    : 0
  const setupComplete = setupPct === 100

  const filteredCampuses = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return campuses
    return campuses.filter((c) =>
      [c.name, c.address ?? '', c.site?.address ?? ''].some((s) => s.toLowerCase().includes(q)),
    )
  }, [campuses, search])

  // ─── Loading skeleton ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Facilities
        </button>
        <div className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-56 bg-slate-200 rounded" />
              <div className="h-3 w-72 bg-slate-200 rounded" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-slate-50 rounded-lg p-4 animate-pulse">
              <div className="h-3 w-16 bg-slate-200 rounded mb-2" />
              <div className="h-6 w-10 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 bg-slate-200 rounded" />
                <div className="h-3 w-60 bg-slate-100 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error || !school) {
    return (
      <div className="space-y-5">
        <button
          type="button"
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

  // ─── Main view ──────────────────────────────────────────────────────────
  return (
    <div>
      {/* Full-width dark hero */}
      <div
        className="relative pb-6 mb-0 overflow-hidden px-4 sm:px-10 pt-6 lg:pt-8"
        style={{
          background: `linear-gradient(135deg, #1e293b 0%, ${school.color}dd 50%, ${school.color} 100%)`,
        }}
      >

        {/* Ambient glow */}
        <div
          className="absolute -top-20 -right-20 w-80 h-80 rounded-full blur-[100px] opacity-30 pointer-events-none"
          style={{ backgroundColor: school.color }}
        />
        <div
          className="absolute -bottom-10 -left-10 w-60 h-60 rounded-full blur-[80px] opacity-20 pointer-events-none"
          style={{ backgroundColor: school.color }}
        />

        {/* Breadcrumb */}
        <nav className="relative flex items-center gap-2 text-sm text-white/60 mb-6" aria-label="Breadcrumb">
          <button
            type="button"
            onClick={onBack}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Facilities
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-white/30" />
          <span className="text-white font-medium truncate">{school.name}</span>
        </nav>

        {/* School info row */}
        <div className="relative flex items-center gap-5 flex-wrap mb-6">
          {/* Logo with upload */}
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            className="relative w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0 overflow-hidden group cursor-pointer ring-2 ring-white/20 shadow-xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
            title="Upload school logo"
          >
            {school.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={school.logoUrl} alt={school.name} className="w-full h-full object-cover" />
            ) : (
              getInitials(school.name)
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
              <Camera className="w-5 h-5 text-white" />
            </div>
          </button>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleLogoUpload}
          />

          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold text-white">{school.name}</h2>
              {typeLabel && (
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/15 text-white/80 font-medium backdrop-blur-sm border border-white/10">
                  {typeLabel}
                  {gradeSummary ? ` · ${gradeSummary}` : ''}
                </span>
              )}
            </div>
            {school.address && (
              <div className="flex items-center gap-1.5 text-sm text-white/60 mt-1.5">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{school.address}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => schoolsHandleRef.current?.openEdit(school.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-white/15 border border-white/20 rounded-full hover:bg-white/25 backdrop-blur-sm shadow-sm transition-colors duration-200 cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit school
            </button>
            <button
              type="button"
              onClick={() => openAddCampus()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-900 bg-white rounded-full hover:bg-white/90 shadow-sm transition-colors duration-200 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add campus
            </button>
          </div>
        </div>

        {/* Stats strip — glassmorphic cards */}
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Campuses" value={campuses.length} icon={<Building2 className="w-4 h-4" />} dark />
          <StatCard
            label="Buildings"
            value={totals.buildings}
            icon={<Layers className="w-4 h-4" />}
            dim={totals.buildings === 0}
            dark
          />
          <StatCard
            label="Spaces"
            value={totals.spaces}
            icon={<DoorOpen className="w-4 h-4" />}
            dim={totals.spaces === 0}
            dark
          />
          <StatCard
            label="Setup"
            value={`${setupPct}%`}
            icon={
              setupComplete ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Sparkles className="w-4 h-4 text-amber-400" />
              )
            }
            accent={setupComplete ? 'success' : 'progress'}
            dark
          />
        </div>
      </div>

      {/* Content below hero — re-apply padding since parent padding is removed */}
      <div className="px-4 sm:px-10 pb-10 space-y-5 mt-5">

      {/* Setup banner — only when something is incomplete */}
      {!setupComplete && (
        <SetupBanner
          steps={setupSteps}
          missingAddressCount={totals.missingAddress}
          onResume={() => {
            // Jump to the first incomplete step
            const next = setupSteps.find((s) => !s.done)
            if (next?.key === 'addresses') {
              const target = campuses.find((c) => !c.address && !c.site?.address)
              if (target) openEditCampus(target)
              return
            }
            if (next?.key === 'campuses' || next?.key === 'school') {
              openAddCampus()
              return
            }
            // Buildings/rooms live inside a campus — drop the user into the first one
            const first = campuses[0]
            if (first) onOpenCampus(first.id, first.name, school?.name ?? '')
          }}
        />
      )}

      {/* Campuses section header */}
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-slate-400" />
        <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Campuses</h4>
        <span className="text-xs text-slate-400">Click a campus to manage its buildings and spaces</span>
      </div>

      {/* Search bar */}
      {campuses.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campuses…"
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-colors"
            />
          </div>
          <span className="text-xs text-slate-400">
            {filteredCampuses.length} of {campuses.length}
          </span>
        </div>
      )}

      {/* Campus cards */}
      <div className="space-y-3">
        {campuses.length === 0 && (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-10 text-center">
            <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto mb-3">
              <Building2 className="w-5 h-5 text-slate-400" />
            </div>
            <div className="text-sm font-medium text-slate-700">No campuses yet</div>
            <div className="text-xs text-slate-500 mt-1 mb-4">
              Add your first campus to start organizing buildings and spaces.
            </div>
            <button
              type="button"
              onClick={() => openAddCampus()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 transition-colors duration-200 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add campus
            </button>
          </div>
        )}

        {campuses.length > 0 && filteredCampuses.length === 0 && (
          <div className="text-sm text-slate-500 text-center py-8">
            No campuses match &ldquo;{search}&rdquo;.
          </div>
        )}

        {filteredCampuses.map((campus) => (
          <CampusCard
            key={campus.id}
            campus={campus}
            schoolColor={school.color}
            sharesSite={Boolean(campus.siteId && sharedSites.has(campus.siteId))}
            onOpen={() => onOpenCampus(campus.id, campus.name, school.name)}
            onEdit={() => openEditCampus(campus)}
            onDelete={() => setDeleteConfirmId(campus.id)}
            onAddBuilding={() => onOpenCampus(campus.id, campus.name, school.name)}
          />
        ))}

        {/* Add another campus — flush dashed */}
        {campuses.length > 0 && (
          <button
            type="button"
            onClick={() => openAddCampus()}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-slate-500 hover:text-slate-800 border border-dashed border-slate-300 rounded-xl hover:border-slate-400 hover:bg-slate-50/60 transition-colors duration-200 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add another campus
          </button>
        )}
      </div>

      {/* Hidden SchoolsManagement — powers the Edit school drawer via ref */}
      <div className="hidden">
        <SchoolsManagement ref={schoolsHandleRef} hideTable onSchoolsChanged={loadAll} />
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
        campus={
          editCampus
            ? {
                id: editCampus.id,
                name: editCampus.name,
                campusKind: editCampus.campusKind,
                address: editCampus.address,
              }
            : null
        }
        form={editForm}
        onFormChange={(update) => setEditForm((prev) => ({ ...prev, ...update }))}
        error={editError}
        saving={editSaving}
        onSubmit={handleEditCampusSubmit}
      />

      {/* Delete Campus confirmation */}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Delete campus?</h3>
              <p className="text-sm text-slate-500 mt-1">
                This will remove the campus and all associated buildings and spaces. This action
                cannot be undone.
              </p>
            </div>
            {editError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {editError}
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmId(null)
                  setEditError('')
                }}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-colors duration-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCampus(deleteConfirmId)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-full hover:bg-red-700 disabled:opacity-50 transition-colors duration-200 cursor-pointer"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>{/* end content wrapper */}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  dim?: boolean
  accent?: 'success' | 'progress'
  dark?: boolean
}

function StatCard({ label, value, icon, dim, accent, dark }: StatCardProps) {
  if (dark) {
    const accentBorder =
      accent === 'success'
        ? 'border-emerald-400/30'
        : accent === 'progress'
          ? 'border-amber-400/30'
          : 'border-white/10'
    return (
      <div className={`bg-white/10 backdrop-blur-sm rounded-xl p-4 border ${accentBorder}`}>
        <div className="flex items-center gap-1.5 text-xs font-medium text-white/60 mb-1">
          <span className="text-white/40">{icon}</span>
          {label}
        </div>
        <div
          className={`text-2xl font-bold tabular-nums ${
            dim ? 'text-white/30' : 'text-white'
          }`}
        >
          {value}
        </div>
      </div>
    )
  }

  const accentBorder =
    accent === 'success'
      ? 'border-emerald-200'
      : accent === 'progress'
        ? 'border-amber-200'
        : 'border-slate-200/80'
  return (
    <div className={`bg-white rounded-xl p-4 border ${accentBorder} shadow-sm`}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1">
        <span className="text-slate-400">{icon}</span>
        {label}
      </div>
      <div
        className={`text-2xl font-bold tabular-nums ${
          dim ? 'text-slate-300' : 'text-slate-900'
        }`}
      >
        {value}
      </div>
    </div>
  )
}

interface SetupBannerProps {
  steps: SetupStep[]
  missingAddressCount: number
  onResume: () => void
}

function SetupBanner({ steps, missingAddressCount, onResume }: SetupBannerProps) {
  const next = steps.find((s) => !s.done)
  const summaryParts: string[] = []
  if (missingAddressCount > 0) {
    summaryParts.push(
      `${missingAddressCount} ${missingAddressCount === 1 ? 'campus needs' : 'campuses need'} an address`,
    )
  }
  const totalBuildings = steps.find((s) => s.key === 'buildings')
  if (totalBuildings && !totalBuildings.done) summaryParts.push('0 buildings added')
  const totalRooms = steps.find((s) => s.key === 'rooms')
  if (totalRooms && !totalRooms.done) summaryParts.push('0 rooms mapped')

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
        <AlertTriangle className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-amber-900">Finish your campus setup</div>
        <div className="text-xs text-amber-800/80 mt-0.5 truncate">
          {summaryParts.length > 0 ? summaryParts.join(' · ') : `Next: ${next?.label ?? 'continue'}`}
        </div>
      </div>
      <button
        type="button"
        onClick={onResume}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-white border border-amber-300 rounded-full hover:bg-amber-100 transition-colors duration-200 cursor-pointer flex-shrink-0"
      >
        Resume setup
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

interface CampusCardProps {
  campus: CampusRow
  schoolColor: string
  sharesSite: boolean
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
  onAddBuilding: () => void
}

function CampusCard({
  campus,
  schoolColor,
  sharesSite,
  onOpen,
  onEdit,
  onDelete,
  onAddBuilding,
}: CampusCardProps) {
  const badge = campus.gradeLevel ? GRADE_BADGE[campus.gradeLevel] : null
  const isPrimary = campus.campusKind === 'HEADQUARTERS'
  const address = campus.address || campus.site?.address || null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      className="group bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-sm transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
          style={{ backgroundColor: schoolColor }}
        >
          {getInitials(campus.name)}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-900">
              {campus.name}
            </span>
            {isPrimary && (
              <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                Primary
              </span>
            )}
            {badge && (
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}
              >
                {badge.label}
              </span>
            )}
            {sharesSite && (
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500"
                title="Shares a physical site with another campus"
              >
                Shared site
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-slate-500">
            {address ? (
              <span className="flex items-center gap-1 min-w-0 truncate">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{address}</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEdit() }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-dashed border-amber-300 hover:bg-amber-100 transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                Add address
              </button>
            )}
            <span className="text-slate-300">·</span>
            <span>
              {campus._count.buildings}{' '}
              {campus._count.buildings === 1 ? 'building' : 'buildings'}
            </span>
            <span className="text-slate-300">·</span>
            <span>
              {campus._count.spaces} {campus._count.spaces === 1 ? 'room' : 'rooms'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onAddBuilding}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-colors duration-200 cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
          >
            <Plus className="w-3 h-3" />
            Building
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors duration-200 cursor-pointer"
            aria-label="Edit campus"
            title="Edit campus"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors duration-200 cursor-pointer"
            aria-label="Delete campus"
            title="Delete campus"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors ml-1" />
        </div>
      </div>
    </div>
  )
}
