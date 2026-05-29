'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight, Plus, Building2, School as SchoolIcon, MapPin, Users, Landmark, TreePine, Edit2, Trash2 } from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import { FloatingInput, FloatingDropdown } from '@/components/ui/FloatingInput'
import DetailDrawer from '@/components/DetailDrawer'
import ConfirmDialog from '@/components/ConfirmDialog'
import RowActionMenu from '@/components/RowActionMenu'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { Input } from '@/components/ui/Input'

// ─── Types ────────────────────────────────────────────────────────────────────

type CampusSummary = {
  id: string
  name: string
  gradeLevel: string | null
}

type School = {
  id: string
  name: string
  color: string
  logoUrl?: string | null
  address?: string | null
  institutionType?: 'PUBLIC' | 'PRIVATE' | 'CHARTER' | 'HYBRID' | 'FAITH_BASED' | null
  campuses: CampusSummary[]
}

type District = {
  id: string
  name: string
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  phone?: string | null
  email?: string | null
  contactName?: string | null
  contactTitle?: string | null
  logoUrl?: string | null
  _count: { users: number; buildings: number }
}

type DistrictBuilding = {
  id: string
  name: string
  code?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  buildingType: string
  isActive: boolean
  _count?: { rooms: number; spaces: number }
}

type DistrictSpace = {
  id: string
  name: string
  spaceType: string
  isActive: boolean
}

const SPACE_TYPE_LABELS: Record<string, string> = {
  FIELD: 'Athletic Field',
  COURT: 'Court',
  GYM: 'Gymnasium',
  COMMON: 'Gathering Area',
  PARKING: 'Parking',
  OTHER: 'Other',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface FacilitiesLandingProps {
  onSelectSchool: (schoolId: string) => void
  onSelectDistrictBuilding?: (buildingId: string, buildingName: string) => void
  onAddSchool?: () => void
}

// ─── Constants & helpers ──────────────────────────────────────────────────────

type FacilitiesTab = 'district' | 'schools'

const TABS: { key: FacilitiesTab; label: string }[] = [
  { key: 'district', label: 'District' },
  { key: 'schools', label: 'Schools' },
]

const INSTITUTION_LABELS: Record<NonNullable<School['institutionType']>, string> = {
  PUBLIC: 'Public',
  PRIVATE: 'Private',
  CHARTER: 'Charter',
  HYBRID: 'Hybrid',
  FAITH_BASED: 'Faith-based',
}

const BUILDING_TYPE_LABELS: Record<string, string> = {
  GENERAL: 'General',
  ACADEMIC: 'Academic',
  ADMINISTRATION: 'Administration',
  ATHLETICS: 'Athletics',
  ARTS_CULTURE: 'Arts & Culture',
  RESIDENTIAL: 'Residential',
  MAINTENANCE: 'Maintenance',
  DINING: 'Dining',
  LIBRARY: 'Library',
  RECREATION: 'Recreation',
  PARKING: 'Parking',
  OTHER: 'Other',
}

/** Accent color per building type — keeps the list visually scannable. */
const BUILDING_TYPE_COLORS: Record<string, { bg: string; icon: string; border: string }> = {
  ADMINISTRATION: { bg: 'bg-blue-50', icon: 'text-blue-500', border: 'border-l-blue-400' },
  ACADEMIC: { bg: 'bg-indigo-50', icon: 'text-indigo-500', border: 'border-l-indigo-400' },
  ATHLETICS: { bg: 'bg-orange-50', icon: 'text-orange-500', border: 'border-l-orange-400' },
  ARTS_CULTURE: { bg: 'bg-purple-50', icon: 'text-purple-500', border: 'border-l-purple-400' },
  MAINTENANCE: { bg: 'bg-amber-50', icon: 'text-amber-500', border: 'border-l-amber-400' },
  DINING: { bg: 'bg-rose-50', icon: 'text-rose-500', border: 'border-l-rose-400' },
  LIBRARY: { bg: 'bg-cyan-50', icon: 'text-cyan-500', border: 'border-l-cyan-400' },
  RECREATION: { bg: 'bg-emerald-50', icon: 'text-emerald-500', border: 'border-l-emerald-400' },
  RESIDENTIAL: { bg: 'bg-teal-50', icon: 'text-teal-500', border: 'border-l-teal-400' },
  PARKING: { bg: 'bg-slate-100', icon: 'text-slate-500', border: 'border-l-slate-400' },
  GENERAL: { bg: 'bg-slate-50', icon: 'text-slate-400', border: 'border-l-slate-300' },
  OTHER: { bg: 'bg-slate-50', icon: 'text-slate-400', border: 'border-l-slate-300' },
}

function getBuildingColors(type: string) {
  return BUILDING_TYPE_COLORS[type] ?? BUILDING_TYPE_COLORS.GENERAL
}

function gradeRangeLabel(campuses: CampusSummary[]): string | null {
  const levels = new Set(campuses.map((c) => c.gradeLevel).filter(Boolean))
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

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function formatDistrictAddress(d: District): string | null {
  const parts = [d.address, d.city, d.state ? `${d.state} ${d.zip ?? ''}`.trim() : null].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FacilitiesLanding({ onSelectSchool, onSelectDistrictBuilding, onAddSchool }: FacilitiesLandingProps) {
  const [activeTab, setActiveTab] = useState<FacilitiesTab>('district')

  // Schools state
  const [schools, setSchools] = useState<School[]>([])
  const [schoolsLoading, setSchoolsLoading] = useState(true)
  const [schoolsError, setSchoolsError] = useState<string | null>(null)

  // District state
  const [district, setDistrict] = useState<District | null>(null)
  const [districtBuildings, setDistrictBuildings] = useState<DistrictBuilding[]>([])
  const [districtSpaces, setDistrictSpaces] = useState<DistrictSpace[]>([])
  const [districtLoading, setDistrictLoading] = useState(true)
  const [districtError, setDistrictError] = useState<string | null>(null)

  // Create district state
  const [districtName, setDistrictName] = useState('')
  const [creatingDistrict, setCreatingDistrict] = useState(false)

  // Add building drawer
  const [showAddBuilding, setShowAddBuilding] = useState(false)
  const [buildingForm, setBuildingForm] = useState({ name: '', code: '', buildingType: 'GENERAL', address: '' })
  const [buildingSaving, setBuildingSaving] = useState(false)
  const [buildingError, setBuildingError] = useState('')

  // Add space drawer
  const [showAddSpace, setShowAddSpace] = useState(false)
  const [spaceForm, setSpaceForm] = useState({ name: '', spaceType: 'FIELD' })
  const [spaceSaving, setSpaceSaving] = useState(false)
  const [spaceError, setSpaceError] = useState('')

  // ── Load schools ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    fetchApi<School[]>('/api/settings/schools')
      .then((data) => { if (!cancelled) setSchools(Array.isArray(data) ? data : []) })
      .catch((e) => { if (!cancelled) setSchoolsError(e instanceof Error ? e.message : 'Failed to load schools') })
      .finally(() => { if (!cancelled) setSchoolsLoading(false) })
    return () => { cancelled = true }
  }, [])

  // ── Load district + buildings ────────────────────────────────────────────
  const loadDistrict = useCallback(async () => {
    setDistrictLoading(true)
    setDistrictError(null)
    try {
      const d = await fetchApi<District>('/api/settings/campus/district')
      setDistrict(d)
      if (d?.id) {
        const [buildings, spaces] = await Promise.all([
          fetchApi<DistrictBuilding[]>(`/api/settings/campus/buildings?districtId=${d.id}`),
          fetchApi<DistrictSpace[]>(`/api/settings/campus/spaces?districtId=${d.id}`),
        ])
        setDistrictBuildings(Array.isArray(buildings) ? buildings : [])
        setDistrictSpaces(Array.isArray(spaces) ? spaces : [])
      }
    } catch {
      // No district yet — try to auto-create one using the org name
      try {
        await autoCreateDistrict()
      } catch {
        setDistrict(null)
        setDistrictBuildings([])
        setDistrictSpaces([])
      }
    } finally {
      setDistrictLoading(false)
    }
  }, [])

  /** Auto-creates a district from the org name when none exists. */
  const autoCreateDistrict = async () => {
    const name = localStorage.getItem('org-name') || 'My District'
    const d = await fetchApi<District>('/api/settings/campus/district', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
    setDistrict(d)
    setDistrictBuildings([])
    setDistrictSpaces([])
  }

  const handleCreateDistrict = async () => {
    if (!districtName.trim()) return
    setCreatingDistrict(true)
    try {
      const d = await fetchApi<District>('/api/settings/campus/district', {
        method: 'POST',
        body: JSON.stringify({ name: districtName.trim() }),
      })
      setDistrictName('')
      setDistrict(d)
      setDistrictBuildings([])
      setDistrictSpaces([])
    } catch (err) {
      setDistrictError(err instanceof Error ? err.message : 'Failed to create district')
    } finally {
      setCreatingDistrict(false)
    }
  }

  useEffect(() => { void loadDistrict() }, [loadDistrict])

  // ── Add building handler ─────────────────────────────────────────────────
  const handleAddBuilding = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!district || !buildingForm.name.trim()) return
    setBuildingSaving(true)
    setBuildingError('')
    try {
      await fetchApi('/api/settings/campus/buildings', {
        method: 'POST',
        body: JSON.stringify({
          name: buildingForm.name.trim(),
          code: buildingForm.code.trim() || null,
          buildingType: buildingForm.buildingType,
          address: buildingForm.address.trim() || null,
          districtId: district.id,
        }),
      })
      setShowAddBuilding(false)
      setBuildingForm({ name: '', code: '', buildingType: 'GENERAL', address: '' })
      loadDistrict()
    } catch (err) {
      setBuildingError(err instanceof Error ? err.message : 'Failed to create building')
    } finally {
      setBuildingSaving(false)
    }
  }

  // ── Add space handler ──────────────────────────────────────────────────
  const handleAddSpace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!district || !spaceForm.name.trim()) return
    setSpaceSaving(true)
    setSpaceError('')
    try {
      await fetchApi('/api/settings/campus/spaces', {
        method: 'POST',
        body: JSON.stringify({
          name: spaceForm.name.trim(),
          spaceType: spaceForm.spaceType,
          districtId: district.id,
        }),
      })
      setShowAddSpace(false)
      setSpaceForm({ name: '', spaceType: 'FIELD' })
      loadDistrict()
    } catch (err) {
      setSpaceError(err instanceof Error ? err.message : 'Failed to create space')
    } finally {
      setSpaceSaving(false)
    }
  }

  // ── Edit building state + handler ──────────────────────────────────────────
  const [editingBuilding, setEditingBuilding] = useState<DistrictBuilding | null>(null)
  const [editBuildingForm, setEditBuildingForm] = useState({ name: '', code: '', buildingType: 'GENERAL', address: '' })
  const [editBuildingSaving, setEditBuildingSaving] = useState(false)
  const [editBuildingError, setEditBuildingError] = useState('')

  const openEditBuilding = (b: DistrictBuilding) => {
    setEditingBuilding(b)
    setEditBuildingForm({ name: b.name, code: b.code || '', buildingType: b.buildingType, address: b.address || '' })
    setEditBuildingError('')
  }

  const handleEditBuilding = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingBuilding || !editBuildingForm.name.trim()) return
    setEditBuildingSaving(true)
    setEditBuildingError('')
    try {
      await fetchApi(`/api/settings/campus/buildings/${editingBuilding.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editBuildingForm.name.trim(),
          code: editBuildingForm.code.trim() || null,
          buildingType: editBuildingForm.buildingType,
          address: editBuildingForm.address.trim() || null,
        }),
      })
      setEditingBuilding(null)
      loadDistrict()
    } catch (err) {
      setEditBuildingError(err instanceof Error ? err.message : 'Failed to update building')
    } finally {
      setEditBuildingSaving(false)
    }
  }

  // ── Delete building state + handler ─────────────────────────────────────
  const [deleteBuildingTarget, setDeleteBuildingTarget] = useState<DistrictBuilding | null>(null)
  const [deleteBuildingLoading, setDeleteBuildingLoading] = useState(false)

  const handleDeleteBuilding = async () => {
    if (!deleteBuildingTarget) return
    setDeleteBuildingLoading(true)
    try {
      await fetchApi(`/api/settings/campus/buildings/${deleteBuildingTarget.id}?permanent=true`, { method: 'DELETE' })
      setDeleteBuildingTarget(null)
      loadDistrict()
    } catch {
      // keep dialog open on error
    } finally {
      setDeleteBuildingLoading(false)
    }
  }

  // ── Edit space state + handler ──────────────────────────────────────────
  const [editingSpace, setEditingSpace] = useState<DistrictSpace | null>(null)
  const [editSpaceForm, setEditSpaceForm] = useState({ name: '', spaceType: 'FIELD' })
  const [editSpaceSaving, setEditSpaceSaving] = useState(false)
  const [editSpaceError, setEditSpaceError] = useState('')

  const openEditSpace = (s: DistrictSpace) => {
    setEditingSpace(s)
    setEditSpaceForm({ name: s.name, spaceType: s.spaceType })
    setEditSpaceError('')
  }

  const handleEditSpace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSpace || !editSpaceForm.name.trim()) return
    setEditSpaceSaving(true)
    setEditSpaceError('')
    try {
      await fetchApi(`/api/settings/campus/spaces/${editingSpace.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editSpaceForm.name.trim(),
          spaceType: editSpaceForm.spaceType,
        }),
      })
      setEditingSpace(null)
      loadDistrict()
    } catch (err) {
      setEditSpaceError(err instanceof Error ? err.message : 'Failed to update space')
    } finally {
      setEditSpaceSaving(false)
    }
  }

  // ── Delete space state + handler ────────────────────────────────────────
  const [deleteSpaceTarget, setDeleteSpaceTarget] = useState<DistrictSpace | null>(null)
  const [deleteSpaceLoading, setDeleteSpaceLoading] = useState(false)

  const handleDeleteSpace = async () => {
    if (!deleteSpaceTarget) return
    setDeleteSpaceLoading(true)
    try {
      await fetchApi(`/api/settings/campus/spaces/${deleteSpaceTarget.id}?permanent=true`, { method: 'DELETE' })
      setDeleteSpaceTarget(null)
      loadDistrict()
    } catch {
      // keep dialog open on error
    } finally {
      setDeleteSpaceLoading(false)
    }
  }

  const SPACE_TYPE_OPTIONS = [
    { value: 'FIELD', label: 'Athletic Field' },
    { value: 'COURT', label: 'Court' },
    { value: 'GYM', label: 'Gymnasium' },
    { value: 'COMMON', label: 'Gathering Area' },
    { value: 'PARKING', label: 'Parking' },
    { value: 'OTHER', label: 'Other' },
  ]

  return (
    <div className="space-y-6">
      {/* Header — full-width, flush top (matches all other settings tabs) */}
      <div className="-mt-6 lg:-mt-8 -mx-4 sm:-mx-10 py-5 bg-white/60 backdrop-blur-sm border-b border-slate-200/60 px-4 sm:px-10">
        <div className="px-4 sm:px-8 flex items-center gap-4">
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Facilities</h3>
            <p className="text-sm text-slate-500 mt-0.5">Manage district offices, schools, campuses, and buildings</p>
          </div>
        </div>

        {/* Tab bar + action buttons */}
        <div className="mt-5 pt-5 border-t border-slate-200/60 mx-4 sm:mx-8 flex items-center justify-between gap-4 flex-wrap">
          <div className="inline-flex gap-1 rounded-full bg-slate-100 p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`relative px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 cursor-pointer ${
                  activeTab === t.key ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {activeTab === t.key && (
                  <motion.div
                    layoutId="facilitiesTabPill"
                    className="absolute inset-0 rounded-full bg-slate-900"
                    transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }}
                  />
                )}
                <span className="relative z-10">{t.label}</span>
              </button>
            ))}
          </div>
          {activeTab === 'schools' && onAddSchool && (
            <button
              onClick={onAddSchool}
              className="bg-slate-900 text-white px-4 py-2 rounded-full flex items-center gap-2 hover:bg-slate-800 text-sm font-medium transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add School
            </button>
          )}
          {activeTab === 'district' && district && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowAddSpace(true); setSpaceError('') }}
                className="bg-white text-slate-700 border border-slate-200 px-4 py-2 rounded-full flex items-center gap-2 hover:bg-slate-50 hover:border-slate-300 text-sm font-medium transition-colors duration-200 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Space
              </button>
              <button
                onClick={() => { setShowAddBuilding(true); setBuildingError('') }}
                className="bg-slate-900 text-white px-4 py-2 rounded-full flex items-center gap-2 hover:bg-slate-800 text-sm font-medium transition-colors duration-200 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Building
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Content with padding ── */}
      <div className="px-4 sm:px-8 pb-10 space-y-6">

        {/* ════════════════ District Tab ════════════════ */}
        {activeTab === 'district' && (
          <>
            {districtLoading && (
              <div className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-xl p-6 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-5 w-48 bg-slate-200 rounded" />
                      <div className="h-3 w-72 bg-slate-200 rounded" />
                    </div>
                  </div>
                </div>
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-slate-200" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-40 bg-slate-200 rounded" />
                        <div className="h-3 w-56 bg-slate-200 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!districtLoading && !district && (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-10 text-center">
                <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto mb-3">
                  <Landmark className="w-5 h-5 text-slate-400" />
                </div>
                <div className="text-sm font-medium text-slate-700">No district configured</div>
                <div className="text-xs text-slate-500 mt-1 mb-4">
                  Create a district to manage district-level offices and buildings.
                </div>
                <div className="flex items-center justify-center gap-2 max-w-sm mx-auto">
                  <Input
                    type="text"
                    placeholder="District name"
                    value={districtName}
                    onChange={(e) => setDistrictName(e.target.value)}
                    disabled={creatingDistrict}
                    size="sm"
                    className="flex-1 h-11 rounded-full text-sm"
                  />
                  <button
                    onClick={handleCreateDistrict}
                    disabled={creatingDistrict || !districtName.trim()}
                    className="h-11 px-5 bg-slate-900 text-white text-sm font-semibold rounded-full hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    {creatingDistrict ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            )}

            {!districtLoading && district && (
              <div className="space-y-8">
                {/* ── District overview bar ─────────────────────────────────── */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Landmark className="w-4.5 h-4.5 text-slate-500" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{district.name}</h4>
                      {formatDistrictAddress(district) && (
                        <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">{formatDistrictAddress(district)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      {district._count.buildings}
                    </span>
                    {districtSpaces.length > 0 && (
                      <span className="flex items-center gap-1.5">
                        <TreePine className="w-3.5 h-3.5" />
                        {districtSpaces.length}
                      </span>
                    )}
                    {district._count.users > 0 && (
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        {district._count.users}
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Buildings section ─────────────────────────────────────── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Buildings</h4>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{districtBuildings.length}</span>
                  </div>

                  {districtBuildings.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                      <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-3">
                        <Building2 className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="text-sm font-medium text-slate-700">No buildings yet</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Add buildings like district offices, admin centers, or warehouses.
                      </div>
                      <button
                        onClick={() => { setShowAddBuilding(true); setBuildingError('') }}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-full hover:bg-slate-800 transition cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Add your first building
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {districtBuildings.map((b) => {
                        const colors = getBuildingColors(b.buildingType)
                        return (
                          <button
                            key={b.id}
                            onClick={() => onSelectDistrictBuilding?.(b.id, b.name)}
                            className={`w-full text-left bg-white border border-slate-200 border-l-[3px] ${colors.border} rounded-xl px-5 py-4 hover:border-slate-300 hover:shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-all cursor-pointer group`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0 transition-colors`}>
                                <Building2 className={`w-5 h-5 ${colors.icon} transition-colors`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-slate-900">{b.name}</span>
                                  <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 font-medium">
                                    {BUILDING_TYPE_LABELS[b.buildingType] || b.buildingType}
                                  </span>
                                  {b.code && <span className="text-xs text-slate-400">({b.code})</span>}
                                </div>
                                {(b.address || (b._count && (b._count.rooms > 0 || b._count.spaces > 0))) && (
                                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                                    {b.address && (
                                      <span className="flex items-center gap-1 truncate">
                                        <MapPin className="w-3 h-3 flex-shrink-0" />
                                        {b.address}
                                      </span>
                                    )}
                                    {b._count && b._count.rooms > 0 && (
                                      <span>{b._count.rooms} {b._count.rooms === 1 ? 'room' : 'rooms'}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                <RowActionMenu
                                  items={[
                                    { label: 'Edit', icon: <Edit2 className="w-4 h-4" />, onClick: () => openEditBuilding(b) },
                                    { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, onClick: () => setDeleteBuildingTarget(b), variant: 'danger' as const },
                                  ]}
                                />
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* ── Spaces section ────────────────────────────────────────── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Outdoor Spaces</h4>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{districtSpaces.length}</span>
                  </div>

                  {districtSpaces.length === 0 ? (
                    <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center">
                      <p className="text-sm text-slate-400">No outdoor spaces yet.</p>
                      <button
                        onClick={() => { setShowAddSpace(true); setSpaceError('') }}
                        className="mt-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                      >
                        + Add a space
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {districtSpaces.map((s) => (
                        <div
                          key={s.id}
                          className="w-full text-left bg-white border border-slate-200 border-l-[3px] border-l-emerald-400 rounded-xl px-5 py-4 hover:border-slate-300 hover:shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-all group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                              <TreePine className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-slate-900">{s.name}</span>
                                <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 font-medium">
                                  {SPACE_TYPE_LABELS[s.spaceType] || s.spaceType}
                                </span>
                              </div>
                            </div>
                            <RowActionMenu
                              items={[
                                { label: 'Edit', icon: <Edit2 className="w-4 h-4" />, onClick: () => openEditSpace(s) },
                                { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, onClick: () => setDeleteSpaceTarget(s), variant: 'danger' as const },
                              ]}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {districtError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{districtError}</div>
            )}
          </>
        )}

        {/* ════════════════ Schools Tab ════════════════ */}
        {activeTab === 'schools' && (
          <>
            {schoolsError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{schoolsError}</div>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-2.5 mb-1 px-1">
                <SchoolIcon className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Schools</h3>
                <span className="text-xs text-slate-400 hidden sm:inline">&middot; Click a school to manage its campuses</span>
              </div>

              {schoolsLoading && (
                <>
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-xl bg-slate-200 flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-48 bg-slate-200 rounded" />
                          <div className="h-3 w-64 bg-slate-200 rounded" />
                          <div className="h-3 w-40 bg-slate-200 rounded" />
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {!schoolsLoading && schools.length === 0 && !schoolsError && (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto mb-3">
                    <Building2 className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="text-sm font-medium text-slate-700">No schools yet</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Add your first school to start organizing campuses, buildings, and spaces.
                  </div>
                  {onAddSchool && (
                    <button
                      onClick={onAddSchool}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-full hover:bg-slate-800 transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Add your first school
                    </button>
                  )}
                </div>
              )}

              {!schoolsLoading &&
                schools.map((school) => {
                  const grade = gradeRangeLabel(school.campuses)
                  const typeLabel = school.institutionType ? INSTITUTION_LABELS[school.institutionType] : null
                  const metaBadge = [typeLabel, grade].filter(Boolean).join(' · ')
                  return (
                    <button
                      key={school.id}
                      onClick={() => onSelectSchool(school.id)}
                      className="w-full text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-5">
                        <div
                          className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0 overflow-hidden"
                          style={{ backgroundColor: school.color }}
                        >
                          {school.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={school.logoUrl} alt={school.name} className="w-full h-full object-contain bg-white p-1.5" />
                          ) : (
                            getInitials(school.name)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="font-semibold text-slate-900">{school.name}</div>
                            {metaBadge && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{metaBadge}</span>
                            )}
                          </div>
                          {school.address && (
                            <div className="text-sm text-slate-500 mt-0.5 truncate">{school.address}</div>
                          )}
                          <div className="text-xs text-slate-400 mt-1">
                            {school.campuses.length} {school.campuses.length === 1 ? 'campus' : 'campuses'}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors flex-shrink-0" />
                      </div>
                    </button>
                  )
                })}
            </div>
          </>
        )}
      </div>

      {/* ── Add Building Drawer ── */}
      <DetailDrawer
        isOpen={showAddBuilding}
        onClose={() => { if (!buildingSaving) setShowAddBuilding(false) }}
        title="Add District Building"
        width="lg"
        footer={
          <div className="space-y-3">
            <button
              type="submit"
              form="add-district-building-form"
              className="w-full py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={buildingSaving || !buildingForm.name.trim()}
            >
              {buildingSaving ? 'Creating...' : 'Create Building'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddBuilding(false)}
              className="w-full text-sm text-slate-500 hover:text-slate-700 transition py-1"
              disabled={buildingSaving}
            >
              Cancel
            </button>
          </div>
        }
      >
        <form id="add-district-building-form" onSubmit={handleAddBuilding} className="space-y-5">
          {buildingError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{buildingError}</div>
          )}

          <p className="text-sm text-slate-500">Add a district-level building such as an office, admin center, or warehouse.</p>

          <FloatingInput
            id="district-building-name"
            label="Building name"
            value={buildingForm.name}
            onChange={(e) => setBuildingForm((p) => ({ ...p, name: e.target.value }))}
            disabled={buildingSaving}
            autoFocus
          />

          <FloatingInput
            id="district-building-code"
            label="Building code (optional)"
            value={buildingForm.code}
            onChange={(e) => setBuildingForm((p) => ({ ...p, code: e.target.value }))}
            disabled={buildingSaving}
          />

          <FloatingDropdown
            id="district-building-type"
            label="Building type"
            value={buildingForm.buildingType}
            onChange={(v) => setBuildingForm((p) => ({ ...p, buildingType: v }))}
            disabled={buildingSaving}
            options={Object.entries(BUILDING_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
          />

          <div>
            <label htmlFor="district-building-address" className="block text-xs text-slate-500 font-medium mb-1.5">
              Address
            </label>
            <AddressAutocomplete
              value={buildingForm.address}
              onChange={(value) => setBuildingForm((p) => ({ ...p, address: value }))}
            />
          </div>
        </form>
      </DetailDrawer>

      {/* ── Add Space Drawer ── */}
      <DetailDrawer
        isOpen={showAddSpace}
        onClose={() => { if (!spaceSaving) setShowAddSpace(false) }}
        title="Add District Space"
        width="lg"
        footer={
          <div className="space-y-3">
            <button
              type="submit"
              form="add-district-space-form"
              className="w-full py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              disabled={spaceSaving || !spaceForm.name.trim()}
            >
              {spaceSaving ? 'Creating...' : 'Create Space'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddSpace(false)}
              className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors duration-200 py-1 cursor-pointer"
              disabled={spaceSaving}
            >
              Cancel
            </button>
          </div>
        }
      >
        <form id="add-district-space-form" onSubmit={handleAddSpace} className="space-y-5">
          {spaceError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{spaceError}</div>
          )}

          <p className="text-sm text-slate-500">Add a district-level outdoor space such as a parking lot, athletic field, or gathering area.</p>

          <FloatingInput
            id="district-space-name"
            label="Space name"
            value={spaceForm.name}
            onChange={(e) => setSpaceForm((p) => ({ ...p, name: e.target.value }))}
            disabled={spaceSaving}
            autoFocus
          />

          <FloatingDropdown
            id="district-space-type"
            label="Space type"
            value={spaceForm.spaceType}
            onChange={(v) => setSpaceForm((p) => ({ ...p, spaceType: v }))}
            disabled={spaceSaving}
            options={SPACE_TYPE_OPTIONS}
          />
        </form>
      </DetailDrawer>

      {/* ── Edit Building Drawer ── */}
      <DetailDrawer
        isOpen={!!editingBuilding}
        onClose={() => { if (!editBuildingSaving) setEditingBuilding(null) }}
        title="Edit Building"
        width="lg"
        footer={
          <div className="space-y-3">
            <button
              type="submit"
              form="edit-district-building-form"
              className="w-full py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              disabled={editBuildingSaving || !editBuildingForm.name.trim()}
            >
              {editBuildingSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => setEditingBuilding(null)}
              className="w-full text-sm text-slate-500 hover:text-slate-700 transition py-1 cursor-pointer"
              disabled={editBuildingSaving}
            >
              Cancel
            </button>
          </div>
        }
      >
        <form id="edit-district-building-form" onSubmit={handleEditBuilding} className="space-y-5">
          {editBuildingError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{editBuildingError}</div>
          )}

          <FloatingInput
            id="edit-building-name"
            label="Building name"
            value={editBuildingForm.name}
            onChange={(e) => setEditBuildingForm((p) => ({ ...p, name: e.target.value }))}
            disabled={editBuildingSaving}
            autoFocus
          />

          <FloatingInput
            id="edit-building-code"
            label="Building code (optional)"
            value={editBuildingForm.code}
            onChange={(e) => setEditBuildingForm((p) => ({ ...p, code: e.target.value }))}
            disabled={editBuildingSaving}
          />

          <FloatingDropdown
            id="edit-building-type"
            label="Building type"
            value={editBuildingForm.buildingType}
            onChange={(v) => setEditBuildingForm((p) => ({ ...p, buildingType: v }))}
            disabled={editBuildingSaving}
            options={Object.entries(BUILDING_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
          />

          <div>
            <label htmlFor="edit-building-address" className="block text-xs text-slate-500 font-medium mb-1.5">
              Address
            </label>
            <AddressAutocomplete
              value={editBuildingForm.address}
              onChange={(value) => setEditBuildingForm((p) => ({ ...p, address: value }))}
            />
          </div>
        </form>
      </DetailDrawer>

      {/* ── Edit Space Drawer ── */}
      <DetailDrawer
        isOpen={!!editingSpace}
        onClose={() => { if (!editSpaceSaving) setEditingSpace(null) }}
        title="Edit Space"
        width="lg"
        footer={
          <div className="space-y-3">
            <button
              type="submit"
              form="edit-district-space-form"
              className="w-full py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              disabled={editSpaceSaving || !editSpaceForm.name.trim()}
            >
              {editSpaceSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => setEditingSpace(null)}
              className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors duration-200 py-1 cursor-pointer"
              disabled={editSpaceSaving}
            >
              Cancel
            </button>
          </div>
        }
      >
        <form id="edit-district-space-form" onSubmit={handleEditSpace} className="space-y-5">
          {editSpaceError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{editSpaceError}</div>
          )}

          <FloatingInput
            id="edit-space-name"
            label="Space name"
            value={editSpaceForm.name}
            onChange={(e) => setEditSpaceForm((p) => ({ ...p, name: e.target.value }))}
            disabled={editSpaceSaving}
            autoFocus
          />

          <FloatingDropdown
            id="edit-space-type"
            label="Space type"
            value={editSpaceForm.spaceType}
            onChange={(v) => setEditSpaceForm((p) => ({ ...p, spaceType: v }))}
            disabled={editSpaceSaving}
            options={SPACE_TYPE_OPTIONS}
          />
        </form>
      </DetailDrawer>

      {/* ── Delete Building Confirm ── */}
      <ConfirmDialog
        isOpen={!!deleteBuildingTarget}
        onClose={() => setDeleteBuildingTarget(null)}
        onConfirm={handleDeleteBuilding}
        title="Delete Building"
        message={`Are you sure you want to delete "${deleteBuildingTarget?.name}"? This will also remove all rooms inside it.`}
        confirmText="Delete"
        isLoading={deleteBuildingLoading}
        loadingText="Deleting…"
        variant="danger"
      />

      {/* ── Delete Space Confirm ── */}
      <ConfirmDialog
        isOpen={!!deleteSpaceTarget}
        onClose={() => setDeleteSpaceTarget(null)}
        onConfirm={handleDeleteSpace}
        title="Delete Space"
        message={`Are you sure you want to delete "${deleteSpaceTarget?.name}"?`}
        confirmText="Delete"
        isLoading={deleteSpaceLoading}
        loadingText="Deleting…"
        variant="danger"
      />
    </div>
  )
}
