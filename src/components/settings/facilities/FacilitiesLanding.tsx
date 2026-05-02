'use client'

import { useEffect, useState } from 'react'
import { ChevronRight, Plus, Building2, Landmark, School as SchoolIcon } from 'lucide-react'
import { fetchApi } from '@/lib/api-client'

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

interface FacilitiesLandingProps {
  onSelectSchool: (schoolId: string) => void
  onAddSchool?: () => void
}

const INSTITUTION_LABELS: Record<NonNullable<School['institutionType']>, string> = {
  PUBLIC: 'Public',
  PRIVATE: 'Private',
  CHARTER: 'Charter',
  HYBRID: 'Hybrid',
  FAITH_BASED: 'Faith-based',
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

type DistrictBuilding = {
  id: string
  name: string
  buildingType: string
}

export default function FacilitiesLanding({ onSelectSchool, onAddSchool }: FacilitiesLandingProps) {
  const [schools, setSchools] = useState<School[]>([])
  const [districtBuildings, setDistrictBuildings] = useState<DistrictBuilding[]>([])
  const [districtId, setDistrictId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ─── Add District Building ────────────────────────────────────────────
  const [addDistrictOpen, setAddDistrictOpen] = useState(false)
  const [addDistrictName, setAddDistrictName] = useState('')
  const [addDistrictSaving, setAddDistrictSaving] = useState(false)
  const [addDistrictError, setAddDistrictError] = useState('')

  const loadDistrictBuildings = async (dId: string) => {
    try {
      const buildings = await fetchApi<DistrictBuilding[]>(
        `/api/settings/campus/buildings?districtId=${dId}`
      )
      setDistrictBuildings(Array.isArray(buildings) ? buildings : [])
    } catch {
      // silent
    }
  }

  const handleAddDistrictBuilding = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = addDistrictName.trim()
    if (!name) {
      setAddDistrictError('Building name is required')
      return
    }
    if (!districtId) {
      setAddDistrictError('No district found')
      return
    }
    setAddDistrictSaving(true)
    setAddDistrictError('')
    try {
      await fetchApi('/api/settings/campus/buildings', {
        method: 'POST',
        body: JSON.stringify({ name, districtId }),
      })
      setAddDistrictOpen(false)
      setAddDistrictName('')
      await loadDistrictBuildings(districtId)
    } catch (err) {
      setAddDistrictError(err instanceof Error ? err.message : 'Failed to create building')
    } finally {
      setAddDistrictSaving(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [schoolData, districtData] = await Promise.all([
          fetchApi<School[]>('/api/settings/schools'),
          fetchApi<{ id: string; name: string }>('/api/settings/campus/district').catch(() => null),
        ])
        if (!cancelled) {
          setSchools(Array.isArray(schoolData) ? schoolData : [])
          if (districtData?.id) {
            setDistrictId(districtData.id)
            await loadDistrictBuildings(districtData.id)
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load schools')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Facilities</h3>
            <p className="text-sm text-slate-500 mt-0.5">Manage schools, campuses, buildings, and spaces</p>
          </div>
        </div>
        {onAddSchool && (
          <button
            onClick={onAddSchool}
            className="bg-slate-900 text-white px-4 py-2 rounded-full flex items-center gap-2 hover:bg-slate-800 text-sm font-medium transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add School
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Schools section */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 mb-1">
          <SchoolIcon className="w-5 h-5 text-slate-400" />
          <h3 className="text-base font-bold text-slate-800 uppercase tracking-wide">Schools</h3>
          <span className="text-sm text-slate-400">Click a school to manage its campuses, buildings, and spaces</span>
        </div>
        {loading && (
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

        {!loading && schools.length === 0 && !error && (
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

        {!loading &&
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

      {/* District facilities */}
      <div className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Landmark className="w-5 h-5 text-slate-400" />
            <div>
              <h3 className="text-base font-bold text-slate-800 uppercase tracking-wide">District Facilities</h3>
              <p className="text-sm text-slate-400 mt-0.5">
                Buildings and spaces that belong to the district, not a specific school.
              </p>
            </div>
          </div>
          {districtId && (
            <button
              onClick={() => { setAddDistrictOpen(true); setAddDistrictError(''); setAddDistrictName('') }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add building
            </button>
          )}
        </div>

        {districtBuildings.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {districtBuildings.map((b) => (
              <div key={b.id} className="flex items-center gap-3 px-5 py-3.5">
                <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm font-medium text-slate-900">{b.name}</span>
                <span className="text-xs text-slate-400 capitalize">{b.buildingType.toLowerCase().replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
            <div className="text-sm text-slate-500">No district-level facilities yet.</div>
            <div className="text-xs text-slate-400 mt-1">e.g. a district office, warehouse, or bus depot</div>
            {districtId && (
              <button
                onClick={() => { setAddDistrictOpen(true); setAddDistrictError(''); setAddDistrictName('') }}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-full hover:bg-slate-800 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add first building
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add District Building drawer */}
      {addDistrictOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Add District Building</h3>
            <form onSubmit={handleAddDistrictBuilding} className="space-y-4">
              {addDistrictError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{addDistrictError}</div>
              )}
              <div>
                <label htmlFor="district-building-name" className="block text-sm font-medium text-slate-700 mb-1">Building name</label>
                <input
                  id="district-building-name"
                  type="text"
                  value={addDistrictName}
                  onChange={(e) => setAddDistrictName(e.target.value)}
                  className="w-full px-3.5 py-3 text-sm text-slate-900 border border-slate-300 rounded-lg bg-white focus:border-slate-900 focus-visible:ring-1 focus-visible:ring-slate-900/10 outline-none transition-colors"
                  placeholder="e.g. District Office, Bus Depot"
                  autoFocus
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddDistrictOpen(false)}
                  disabled={addDistrictSaving}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addDistrictSaving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer"
                >
                  {addDistrictSaving ? 'Adding…' : 'Add Building'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
