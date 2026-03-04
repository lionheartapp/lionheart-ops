'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, Eye } from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'
import DetailDrawer from '@/components/DetailDrawer'
import { FloatingInput, FloatingSelect } from '@/components/ui/FloatingInput'
import RowActionMenu from '@/components/RowActionMenu'
import SeasonsPanel from '@/components/athletics/SeasonsPanel'

type Sport = {
  id: string
  name: string
  abbreviation: string | null
  color: string
  icon: string | null
  seasonType: string
  isActive: boolean
  _count: { athleticTeams: number; athleticSeasons: number }
}

const SEASON_TYPE_LABELS: Record<string, string> = {
  FALL: 'Fall',
  WINTER: 'Winter',
  SPRING: 'Spring',
  YEAR_ROUND: 'Year-Round',
}

const SEASON_TYPE_STYLES: Record<string, string> = {
  FALL: 'bg-orange-100 text-orange-700',
  WINTER: 'bg-blue-100 text-blue-700',
  SPRING: 'bg-green-100 text-green-700',
  YEAR_ROUND: 'bg-purple-100 text-purple-700',
}

const COLOR_PRESETS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
]

export default function SportsSection() {
  const [sports, setSports] = useState<Sport[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Create drawer
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    abbreviation: '',
    color: '#3b82f6',
    seasonType: 'FALL',
  })
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState('')

  // Detail drawer
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null

  const fetchSports = async () => {
    if (!token) return
    try {
      const res = await fetch('/api/athletics/sports', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (data.ok) setSports(data.data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSports()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = sports.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.abbreviation && s.abbreviation.toLowerCase().includes(search.toLowerCase()))
  )

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      setCreateError('Sport name is required')
      return
    }
    setCreateSaving(true)
    setCreateError('')
    try {
      const res = await fetch('/api/athletics/sports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: createForm.name.trim(),
          abbreviation: createForm.abbreviation.trim() || undefined,
          color: createForm.color,
          seasonType: createForm.seasonType,
        }),
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!data.ok) {
        setCreateError(data.error?.message || 'Failed to create sport')
        return
      }
      setCreateForm({ name: '', abbreviation: '', color: '#3b82f6', seasonType: 'FALL' })
      setCreateOpen(false)
      fetchSports()
    } catch {
      setCreateError('Failed to create sport')
    } finally {
      setCreateSaving(false)
    }
  }

  const openDetail = (sport: Sport) => {
    setSelectedSport(sport)
    setDetailOpen(true)
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sports..."
            className="w-full pl-9 pr-3 py-3.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900/10 transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition"
        >
          <Plus className="w-4 h-4" />
          Add Sport
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">
            {search ? 'No sports match your search' : 'No sports created yet'}
          </p>
          {!search && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Create your first sport
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Sport</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden sm:table-cell">Abbreviation</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Season</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden md:table-cell">Seasons</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden md:table-cell">Teams</th>
                <th className="w-12 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((sport) => (
                <tr
                  key={sport.id}
                  className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                  onClick={() => openDetail(sport)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: sport.color }}
                      />
                      <span className="font-medium text-gray-900">{sport.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                    {sport.abbreviation || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${SEASON_TYPE_STYLES[sport.seasonType] || 'bg-gray-100 text-gray-600'}`}>
                      {SEASON_TYPE_LABELS[sport.seasonType] || sport.seasonType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500 hidden md:table-cell">
                    {sport._count.athleticSeasons}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500 hidden md:table-cell">
                    {sport._count.athleticTeams}
                  </td>
                  <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                    <RowActionMenu
                      items={[
                        {
                          label: 'View Seasons',
                          icon: <Eye className="w-4 h-4" />,
                          onClick: () => openDetail(sport),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Sport Drawer */}
      <DetailDrawer
        isOpen={createOpen}
        onClose={() => { setCreateOpen(false); setCreateError('') }}
        title="New Sport"
        width="md"
      >
        <div className="space-y-5">
          <FloatingInput
            id="sport-name"
            label="Sport Name"
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            required
          />
          <FloatingInput
            id="sport-abbr"
            label="Abbreviation"
            value={createForm.abbreviation}
            onChange={(e) => setCreateForm({ ...createForm, abbreviation: e.target.value })}
            maxLength={10}
          />
          <FloatingSelect
            id="sport-season-type"
            label="Season Type"
            value={createForm.seasonType}
            onChange={(e) => setCreateForm({ ...createForm, seasonType: e.target.value })}
          >
            <option value="FALL">Fall</option>
            <option value="WINTER">Winter</option>
            <option value="SPRING">Spring</option>
            <option value="YEAR_ROUND">Year-Round</option>
          </FloatingSelect>

          {/* Color swatches */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Color</label>
            <div className="flex gap-2">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setCreateForm({ ...createForm, color })}
                  className={`w-8 h-8 rounded-full transition-all ${
                    createForm.color === color
                      ? 'ring-2 ring-offset-2 ring-gray-900 scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Select color ${color}`}
                />
              ))}
            </div>
          </div>

          {createError && <p className="text-sm text-red-600">{createError}</p>}

          <button
            type="button"
            onClick={handleCreate}
            disabled={createSaving}
            className="w-full py-3.5 text-sm font-semibold text-white bg-gray-900 rounded-full hover:bg-gray-800 disabled:opacity-50 transition"
          >
            {createSaving ? 'Creating...' : 'Create Sport'}
          </button>
        </div>
      </DetailDrawer>

      {/* Sport Detail Drawer */}
      <DetailDrawer
        isOpen={detailOpen}
        onClose={() => { setDetailOpen(false); setSelectedSport(null) }}
        title="Sport Details"
        width="lg"
      >
        {selectedSport && (
          <div className="space-y-6">
            {/* Sport header */}
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: selectedSport.color + '20' }}
              >
                <span
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: selectedSport.color }}
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedSport.name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  {selectedSport.abbreviation && (
                    <span className="text-sm text-gray-500">{selectedSport.abbreviation}</span>
                  )}
                  <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${SEASON_TYPE_STYLES[selectedSport.seasonType] || 'bg-gray-100 text-gray-600'}`}>
                    {SEASON_TYPE_LABELS[selectedSport.seasonType] || selectedSport.seasonType}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="px-4 py-3 rounded-lg bg-gray-50 text-center">
                <p className="text-xl font-semibold text-gray-900">{selectedSport._count.athleticSeasons}</p>
                <p className="text-xs text-gray-500 mt-0.5">Seasons</p>
              </div>
              <div className="px-4 py-3 rounded-lg bg-gray-50 text-center">
                <p className="text-xl font-semibold text-gray-900">{selectedSport._count.athleticTeams}</p>
                <p className="text-xs text-gray-500 mt-0.5">Teams</p>
              </div>
            </div>

            <div className="h-px bg-gray-200" />

            {/* Seasons panel */}
            <SeasonsPanel sportId={selectedSport.id} sportName={selectedSport.name} />
          </div>
        )}
      </DetailDrawer>
    </div>
  )
}
