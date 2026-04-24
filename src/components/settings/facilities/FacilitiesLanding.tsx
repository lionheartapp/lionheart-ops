'use client'

import { useEffect, useState } from 'react'
import { ChevronRight, Plus, Building2 } from 'lucide-react'
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

export default function FacilitiesLanding({ onSelectSchool, onAddSchool }: FacilitiesLandingProps) {
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const data = await fetchApi<School[]>('/api/settings/schools')
        if (!cancelled) setSchools(Array.isArray(data) ? data : [])
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

      {/* Schools list */}
      <div className="space-y-3">
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
                      <img src={school.logoUrl} alt={school.name} className="w-full h-full object-cover" />
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

      {/* District facilities (placeholder for now) */}
      <div className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-700">District Facilities</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Buildings and spaces that belong to the district, not a specific school.
            </p>
          </div>
        </div>
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
          <div className="text-sm text-slate-500">No district-level facilities yet.</div>
          <div className="text-xs text-slate-400 mt-1">e.g. a district office, warehouse, or bus depot</div>
        </div>
      </div>
    </div>
  )
}
