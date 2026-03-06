'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryOptions, queryKeys } from '@/lib/queries'
import { Plus, Search, Eye, Edit2, Trash2, Trophy } from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'
import AthleticsTableSkeleton from '@/components/athletics/AthleticsTableSkeleton'
import DetailDrawer from '@/components/DetailDrawer'
import { FloatingInput, FloatingSelect, FloatingDropdown, type DropdownOption } from '@/components/ui/FloatingInput'
import RowActionMenu from '@/components/RowActionMenu'
import ConfirmDialog from '@/components/ConfirmDialog'
import TournamentDetail from '@/components/athletics/TournamentDetail'
import { GlassSportTile } from '@/components/athletics/SportIcon'

interface Sport {
  id: string
  name: string
  color: string
}

interface Tournament {
  id: string
  name: string
  sportId: string
  format: string
  startDate: string
  endDate: string
  sport: { id: string; name: string; color: string }
  _count: { brackets: number }
}

interface TournamentsSectionProps {
  activeCampusId: string | null
  canWrite?: boolean
}

const FORMAT_LABELS: Record<string, string> = {
  SINGLE_ELIMINATION: 'Single Elim',
  DOUBLE_ELIMINATION: 'Double Elim',
  ROUND_ROBIN: 'Round Robin',
  POOL_PLAY: 'Pool Play',
}

const FORMAT_OPTIONS = [
  { value: 'SINGLE_ELIMINATION', label: 'Single Elimination' },
  { value: 'DOUBLE_ELIMINATION', label: 'Double Elimination' },
  { value: 'ROUND_ROBIN', label: 'Round Robin' },
  { value: 'POOL_PLAY', label: 'Pool Play' },
]

export default function TournamentsSection({ activeCampusId, canWrite = false }: TournamentsSectionProps) {
  const queryClient = useQueryClient()

  // ─── Cached Data ──────────────────────────────────────────────────

  const { data: tournamentsData, isLoading: loading } = useQuery(queryOptions.athleticsTournaments())
  const tournaments = (tournamentsData ?? []) as Tournament[]

  const { data: sportsData } = useQuery(queryOptions.athleticsSports())
  const sports = (sportsData ?? []) as Sport[]

  const invalidateTournaments = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.athleticsTournaments.all })
  }, [queryClient])

  const [search, setSearch] = useState('')
  const [filterSportId, setFilterSportId] = useState('')

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Tournament | null>(null)
  const [formName, setFormName] = useState('')
  const [formSportId, setFormSportId] = useState('')
  const [formFormat, setFormFormat] = useState('SINGLE_ELIMINATION')
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Detail view
  const [detailTournamentId, setDetailTournamentId] = useState<string | null>(null)

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Tournament | null>(null)
  const [deleting, setDeleting] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null

  const sportOptions: DropdownOption[] = useMemo(
    () => sports.map((s) => ({ value: s.id, label: s.name })),
    [sports],
  )

  const filtered = useMemo(() => {
    let list = tournaments
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (t) => t.name.toLowerCase().includes(q) || t.sport.name.toLowerCase().includes(q),
      )
    }
    if (filterSportId) {
      list = list.filter((t) => t.sportId === filterSportId)
    }
    return list
  }, [tournaments, search, filterSportId])

  const openCreate = () => {
    setEditing(null)
    setFormName('')
    setFormSportId(sports[0]?.id || '')
    setFormFormat('SINGLE_ELIMINATION')
    setFormStartDate('')
    setFormEndDate('')
    setFormError('')
    setDrawerOpen(true)
  }

  const openEdit = (t: Tournament) => {
    setEditing(t)
    setFormName(t.name)
    setFormSportId(t.sportId)
    setFormFormat(t.format)
    setFormStartDate(t.startDate.slice(0, 10))
    setFormEndDate(t.endDate.slice(0, 10))
    setFormError('')
    setDrawerOpen(true)
  }

  const handleSave = async () => {
    if (!formName.trim() || !formSportId || !formStartDate || !formEndDate) {
      setFormError('All fields are required')
      return
    }

    setFormSaving(true)
    setFormError('')

    try {
      const url = editing
        ? `/api/athletics/tournaments/${editing.id}`
        : '/api/athletics/tournaments'
      const method = editing ? 'PUT' : 'POST'

      const body = editing
        ? { name: formName, startDate: formStartDate, endDate: formEndDate }
        : { name: formName, sportId: formSportId, format: formFormat, startDate: formStartDate, endDate: formEndDate }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!data.ok) { setFormError(data.error?.message || 'Failed to save'); return }

      setDrawerOpen(false)
      invalidateTournaments()
    } catch {
      setFormError('Something went wrong')
    } finally {
      setFormSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/athletics/tournaments/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (data.ok) {
        setDeleteTarget(null)
        invalidateTournaments()
      }
    } catch { /* ignore */ } finally { setDeleting(false) }
  }

  // Detail mode
  if (detailTournamentId) {
    return (
      <TournamentDetail
        tournamentId={detailTournamentId}
        onBack={() => {
          setDetailTournamentId(null)
          invalidateTournaments()
        }}
      />
    )
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
          <input
            type="text"
            placeholder="Search tournaments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-3.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-gray-900 focus-visible:ring-1 focus-visible:ring-gray-900/10 transition-colors"
          />
        </div>
        <div className="w-full sm:w-44">
          <FloatingDropdown
            id="filter-tournament-sport"
            label="Sport"
            value={filterSportId}
            onChange={setFilterSportId}
            options={[
              { value: '', label: 'All Sports' },
              ...sports.map((s) => ({ value: s.id, label: s.name, color: s.color })),
            ]}
          />
        </div>
        {canWrite && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-gray-900 text-white rounded-full hover:bg-gray-800 transition sm:ml-auto"
          >
            <Plus className="w-4 h-4" />
            Add Tournament
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <AthleticsTableSkeleton columns={5} rows={4} showToolbar={false} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Trophy className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            {tournaments.length === 0 ? 'No tournaments yet. Create one to get started.' : 'No tournaments match your search.'}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="sm:hidden space-y-2">
            {filtered.map((t) => {
              const start = new Date(t.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              const end = new Date(t.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              return (
                <div
                  key={t.id}
                  className="ui-glass-hover p-4 flex items-center gap-3 cursor-pointer"
                  onClick={() => setDetailTournamentId(t.id)}
                >
                  <GlassSportTile sport={t.sport.name} color={t.sport.color} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm">{t.name}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                        {FORMAT_LABELS[t.format] || t.format}
                      </span>
                      <span className="text-xs text-gray-500">{start} – {end}</span>
                    </div>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <RowActionMenu
                      items={[
                        { label: 'View', icon: <Eye className="w-4 h-4" />, onClick: () => setDetailTournamentId(t.id) },
                        { label: 'Edit', icon: <Edit2 className="w-4 h-4" />, onClick: () => openEdit(t) },
                        { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, onClick: () => setDeleteTarget(t), variant: 'danger' },
                      ]}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="ui-glass-table hidden sm:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Sport</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Format</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Dates</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">Matchups</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((t) => {
                  const start = new Date(t.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  const end = new Date(t.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setDetailTournamentId(t.id)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <GlassSportTile sport={t.sport.name} color={t.sport.color} size="sm" />
                          <span className="text-gray-700">{t.sport.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          {FORMAT_LABELS[t.format] || t.format}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{start} – {end}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{t._count.brackets}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <RowActionMenu
                          items={[
                            { label: 'View', icon: <Eye className="w-4 h-4" />, onClick: () => setDetailTournamentId(t.id) },
                            { label: 'Edit', icon: <Edit2 className="w-4 h-4" />, onClick: () => openEdit(t) },
                            { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, onClick: () => setDeleteTarget(t), variant: 'danger' },
                          ]}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Create/Edit Drawer */}
      <DetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Tournament' : 'New Tournament'}
      >
        <div className="space-y-4 p-1">
          <FloatingInput
            label="Tournament Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g. Fall Championship"
          />

          {!editing && (
            <>
              <FloatingDropdown
                label="Sport"
                value={formSportId}
                onChange={setFormSportId}
                options={sportOptions}
                placeholder="Select sport"
              />

              <FloatingSelect
                label="Format"
                value={formFormat}
                onChange={(e) => setFormFormat(e.target.value)}
              >
                {FORMAT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </FloatingSelect>
            </>
          )}

          <FloatingInput
            label="Start Date"
            type="date"
            value={formStartDate}
            onChange={(e) => setFormStartDate(e.target.value)}
          />

          <FloatingInput
            label="End Date"
            type="date"
            value={formEndDate}
            onChange={(e) => setFormEndDate(e.target.value)}
          />

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setDrawerOpen(false)}
              disabled={formSaving}
              className="flex-1 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-full hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={formSaving}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-gray-900 rounded-full hover:bg-gray-800 transition disabled:opacity-50"
            >
              {formSaving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </DetailDrawer>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Tournament"
        message={`Delete "${deleteTarget?.name}"? All brackets and results will be permanently removed.`}
        confirmText="Delete"
        variant="danger"
        isLoading={deleting}
        loadingText="Deleting..."
      />
    </div>
  )
}
