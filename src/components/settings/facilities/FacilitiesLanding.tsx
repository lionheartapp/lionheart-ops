'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight, Plus, Building2, School as SchoolIcon, MapPin, Users, Landmark } from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import { FloatingInput, FloatingDropdown } from '@/components/ui/FloatingInput'
import DetailDrawer from '@/components/DetailDrawer'
import AddressAutocomplete from '@/components/AddressAutocomplete'

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
  const loadDistrict = async () => {
    setDistrictLoading(true)
    setDistrictError(null)
    try {
      const d = await fetchApi<District>('/api/settings/campus/district')
      setDistrict(d)
      if (d?.id) {
        const buildings = await fetchApi<DistrictBuilding[]>(`/api/settings/campus/buildings?districtId=${d.id}`)
        setDistrictBuildings(Array.isArray(buildings) ? buildings : [])
      }
    } catch {
      setDistrict(null)
      setDistrictBuildings([])
    } finally {
      setDistrictLoading(false)
    }
  }

  const handleCreateDistrict = async () => {
    if (!districtName.trim()) return
    setCreatingDistrict(true)
    try {
      const res = await fetch('/api/settings/campus/district', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth-token')}`,
          'X-Organization-ID': localStorage.getItem('org-id') || '',
        },
        body: JSON.stringify({ name: districtName.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to create district')
      setDistrictName('')
      loadDistrict()
    } catch (err) {
      setDistrictError(err instanceof Error ? err.message : 'Failed to create district')
    } finally {
      setCreatingDistrict(false)
    }
  }

  useEffect(() => { loadDistrict() }, [])

  // ── Add building handler ─────────────────────────────────────────────────
  const handleAddBuilding = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!district || !buildingForm.name.trim()) return
    setBuildingSaving(true)
    setBuildingError('')
    try {
      const res = await fetch('/api/settings/campus/buildings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth-token')}`,
          'X-Organization-ID': localStorage.getItem('org-id') || '',
        },
        body: JSON.stringify({
          name: buildingForm.name.trim(),
          code: buildingForm.code.trim() || null,
          buildingType: buildingForm.buildingType,
          address: buildingForm.address.trim() || null,
          districtId: district.id,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to create building')
      setShowAddBuilding(false)
      setBuildingForm({ name: '', code: '', buildingType: 'GENERAL', address: '' })
      loadDistrict()
    } catch (err) {
      setBuildingError(err instanceof Error ? err.message : 'Failed to create building')
    } finally {
      setBuildingSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header — full-width, flush top */}
      <div className="px-4 sm:px-8 py-5 bg-white/60 backdrop-blur-sm border-b border-slate-200/60">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Facilities</h3>
              <p className="text-sm text-slate-500 mt-0.5">Manage district offices, schools, campuses, and buildings</p>
            </div>
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
            <button
              onClick={() => { setShowAddBuilding(true); setBuildingError('') }}
              className="bg-slate-900 text-white px-4 py-2 rounded-full flex items-center gap-2 hover:bg-slate-800 text-sm font-medium transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Building
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div className="mt-5 pt-5 border-t border-slate-200/60">
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
                  {/* eslint-disable-next-line no-restricted-syntax -- inline create, not a form field */}
                  <input
                    type="text"
                    placeholder="District name"
                    value={districtName}
                    onChange={(e) => setDistrictName(e.target.value)}
                    disabled={creatingDistrict}
                    className="flex-1 h-11 px-4 text-sm rounded-full border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
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
              <>
                {/* District info card */}
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center flex-shrink-0">
                        <Landmark className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">{district.name}</h4>
                        {formatDistrictAddress(district) && (
                          <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-0.5">
                            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                            {formatDistrictAddress(district)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-4 h-4" />
                        {district._count.buildings} {district._count.buildings === 1 ? 'building' : 'buildings'}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-4 h-4" />
                        {district._count.users} {district._count.users === 1 ? 'person' : 'people'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Buildings section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 mb-1">
                    <Building2 className="w-5 h-5 text-slate-400" />
                    <h3 className="text-base font-bold text-slate-800 uppercase tracking-wide">Buildings</h3>
                    <span className="text-sm text-slate-400">District-level offices and facilities</span>
                  </div>

                  {districtBuildings.length === 0 && (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-10 text-center">
                      <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto mb-3">
                        <Building2 className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="text-sm font-medium text-slate-700">No district buildings yet</div>
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
                  )}

                  {districtBuildings.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => onSelectDistrictBuilding?.(b.id, b.name)}
                      className="w-full text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-5 h-5 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{b.name}</span>
                            {b.code && <span className="text-xs text-slate-400">({b.code})</span>}
                            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {BUILDING_TYPE_LABELS[b.buildingType] || b.buildingType}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            {b.address && (
                              <div className="flex items-center gap-1.5 text-sm text-slate-500">
                                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="truncate">{b.address}</span>
                              </div>
                            )}
                            {b._count && (b._count.rooms > 0 || b._count.spaces > 0) && (
                              <span className="text-xs text-slate-400">
                                {b._count.rooms} {b._count.rooms === 1 ? 'room' : 'rooms'}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              </>
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
              <div className="flex items-center gap-3 mb-1">
                <SchoolIcon className="w-5 h-5 text-slate-400" />
                <h3 className="text-base font-bold text-slate-800 uppercase tracking-wide">Schools</h3>
                <span className="text-sm text-slate-400">Click a school to manage its campuses, buildings, and spaces</span>
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
    </div>
  )
}
