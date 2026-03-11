'use client'

import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryOptions, queryKeys } from '@/lib/queries'
import { Plus, Search, Eye, Edit2 } from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'
import AthleticsTableSkeleton from '@/components/athletics/AthleticsTableSkeleton'
import DetailDrawer from '@/components/DetailDrawer'
import { FloatingInput, FloatingSelect } from '@/components/ui/FloatingInput'
import RowActionMenu from '@/components/RowActionMenu'
import SeasonsPanel from '@/components/athletics/SeasonsPanel'
import { GlassSportTile } from '@/components/athletics/SportIcon'
import { IllustrationAthletics } from '@/components/illustrations'

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

export default function SportsSection({ canWrite = false }: { canWrite?: boolean }) {
  const queryClient = useQueryClient()
  const { data: sportsData, isLoading: loading } = useQuery(queryOptions.athleticsSports())
  const sports = (sportsData ?? []) as Sport[]
  const invalidateSports = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.athleticsSports.all })
  }, [queryClient])

  const [search, setSearch] = useState('')

  // Create/Edit drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingSport, setEditingSport] = useState<Sport | null>(null)
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

  const filtered = sports.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.abbreviation && s.abbreviation.toLowerCase().includes(search.toLowerCase()))
  )

  const openCreate = () => {
    setEditingSport(null)
    setCreateForm({ name: '', abbreviation: '', color: '#3b82f6', seasonType: 'FALL' })
    setCreateError('')
    setDrawerOpen(true)
  }

  const openEdit = (sport: Sport) => {
    setEditingSport(sport)
    setCreateForm({
      name: sport.name,
      abbreviation: sport.abbreviation || '',
      color: sport.color,
      seasonType: sport.seasonType,
    })
    setCreateError('')
    setDrawerOpen(true)
  }

  const handleSave = async () => {
    if (!createForm.name.trim()) {
      setCreateError('Sport name is required')
      return
    }
    setCreateSaving(true)
    setCreateError('')
    try {
      const url = editingSport
        ? `/api/athletics/sports/${editingSport.id}`
        : '/api/athletics/sports'
      const method = editingSport ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: createForm.name.trim(),
          abbreviation: createForm.abbreviation.trim() || null,
          color: createForm.color,
          seasonType: createForm.seasonType,
        }),
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!data.ok) {
        setCreateError(data.error?.message || `Failed to ${editingSport ? 'update' : 'create'} sport`)
        return
      }
      setCreateForm({ name: '', abbreviation: '', color: '#3b82f6', seasonType: 'FALL' })
      setDrawerOpen(false)
      invalidateSports()
    } catch {
      setCreateError(`Failed to ${editingSport ? 'update' : 'create'} sport`)
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
            className="w-full pl-9 pr-3 py-3.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-gray-900 focus-visible:ring-1 focus-visible:ring-gray-900/10 transition-colors"
          />
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-gray-900 text-white rounded-full hover:bg-gray-800 transition ml-auto"
          >
            <Plus className="w-4 h-4" />
            Add Sport
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <AthleticsTableSkeleton columns={5} rows={4} showToolbar={false} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          {search ? (
            <>
              <p className="text-base font-semibold text-gray-700 mb-1">No sports match your search</p>
              <p className="text-sm text-gray-500">Try a different search term</p>
            </>
          ) : (
            <>
              <IllustrationAthletics className="w-48 h-40 mx-auto mb-2" />
              <p className="text-base font-semibold text-gray-700 mb-1">No sports created yet</p>
              <p className="text-sm text-gray-500 mb-4">Add your first sport to start building teams and schedules.</p>
              <button
                type="button"
                onClick={() => openCreate()}
                className="px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors active:scale-[0.97] cursor-pointer"
              >
                Create First Sport
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto ui-glass-table">
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
                      <GlassSportTile sport={sport.name} color={sport.color} size="sm" />
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
                          label: 'Sport Details',
                          icon: <Eye className="w-4 h-4" />,
                          onClick: () => openDetail(sport),
                        },
                        ...(canWrite
                          ? [
                              {
                                label: 'Edit',
                                icon: <Edit2 className="w-4 h-4" />,
                                onClick: () => openEdit(sport),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Sport Drawer */}
      <DetailDrawer
        isOpen={drawerOpen}
        onClose={() => { setDrawerOpen(false); setCreateError('') }}
        title={editingSport ? 'Edit Sport' : 'New Sport'}
        width="md"
        footer={
          <button
            type="button"
            onClick={handleSave}
            disabled={createSaving}
            className="w-full py-3.5 text-sm font-semibold text-white bg-gray-900 rounded-full hover:bg-gray-800 disabled:opacity-50 transition"
          >
            {createSaving ? 'Saving...' : editingSport ? 'Update Sport' : 'Create Sport'}
          </button>
        }
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
