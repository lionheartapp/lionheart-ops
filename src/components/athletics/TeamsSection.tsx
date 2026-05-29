'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryOptions, queryKeys } from '@/lib/queries'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'
import AthleticsTableSkeleton from '@/components/athletics/AthleticsTableSkeleton'
import DetailDrawer from '@/components/DetailDrawer'
import { FloatingInput, FloatingDropdown, type DropdownOption } from '@/components/ui/FloatingInput'
import { SearchInput } from '@/components/ui/SearchInput'
import RowActionMenu from '@/components/RowActionMenu'
import ConfirmDialog from '@/components/ConfirmDialog'
import { GlassSportTile } from '@/components/athletics/SportIcon'
import { IllustrationTeam } from '@/components/illustrations'
import { OptimizedImage } from '@/components/ui/OptimizedImage'

type Sport = {
  id: string
  name: string
  color: string
  seasonType: string
}

type Season = {
  id: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
  sport: { id: string; name: string; color: string }
  _count: { teams: number }
}

type Team = {
  id: string
  name: string
  level: string
  gradeLevel: string | null
  coachUserId: string | null
  coachName: string | null
  campusId: string | null
  sport: { id: string; name: string; color: string }
  season: { id: string; name: string }
  _count: { games: number; practices: number }
}

type User = {
  id: string
  name: string
  firstName: string | null
  lastName: string | null
  email: string
  avatar: string | null
}

type Game = {
  id: string
  athleticTeamId: string
  homeAway: string
  homeScore: number | null
  awayScore: number | null
  isFinal: boolean
}

type TeamRecord = { wins: number; losses: number; ties: number }

function calcTeamRecords(games: Game[]): Record<string, TeamRecord> {
  const records: Record<string, TeamRecord> = {}
  for (const g of games) {
    if (g.homeScore == null || g.awayScore == null || !g.isFinal) continue
    if (!records[g.athleticTeamId]) records[g.athleticTeamId] = { wins: 0, losses: 0, ties: 0 }
    const rec = records[g.athleticTeamId]
    if (g.homeScore === g.awayScore) { rec.ties++; continue }
    const isHome = g.homeAway === 'HOME'
    const homeWon = g.homeScore > g.awayScore
    if ((isHome && homeWon) || (!isHome && !homeWon)) rec.wins++
    else rec.losses++
  }
  return records
}

const LEVEL_LABELS: Record<string, string> = {
  VARSITY: 'Varsity',
  VARSITY_B: 'Varsity B',
  JUNIOR_VARSITY: 'JV',
  FRESHMAN: 'Freshman',
  FROSH_SOPH: 'Frosh-Soph',
  C_TEAM: 'C-Team',
  CLUB: 'Club',
  INTRAMURAL: 'Intramural',
  UNIFIED: 'Unified',
}

const LEVEL_STYLES: Record<string, string> = {
  VARSITY: 'bg-indigo-100 text-indigo-700',
  VARSITY_B: 'bg-indigo-50 text-indigo-600',
  JUNIOR_VARSITY: 'bg-sky-100 text-sky-700',
  FRESHMAN: 'bg-teal-100 text-teal-700',
  FROSH_SOPH: 'bg-teal-50 text-teal-600',
  C_TEAM: 'bg-stone-100 text-stone-600',
  CLUB: 'bg-violet-100 text-violet-700',
  INTRAMURAL: 'bg-orange-100 text-orange-700',
  UNIFIED: 'bg-rose-100 text-rose-700',
}

const GRADE_LABELS: Record<string, string> = {
  ELEMENTARY: 'Elementary',
  MIDDLE_SCHOOL: 'Middle School',
  HIGH_SCHOOL: 'High School',
}

const GRADE_STYLES: Record<string, string> = {
  ELEMENTARY: 'bg-amber-100 text-amber-700',
  MIDDLE_SCHOOL: 'bg-stone-100 text-stone-600',
  HIGH_SCHOOL: 'bg-emerald-100 text-emerald-700',
}

interface TeamsSectionProps {
  activeCampusId: string | null
  canWrite?: boolean
}

export default function TeamsSection({ activeCampusId, canWrite = false }: TeamsSectionProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')

  // Filter state
  const [filterSportId, setFilterSportId] = useState('')
  const [filterSeasonId, setFilterSeasonId] = useState('')

  // ─── Cached Data ──────────────────────────────────────────────────

  const { data: teamsData, isLoading: loading } = useQuery(
    queryOptions.athleticsTeams(filterSportId || undefined, filterSeasonId || undefined)
  )
  const teams = useMemo(() => (teamsData ?? []) as Team[], [teamsData])

  const { data: sportsData } = useQuery(queryOptions.athleticsSports())
  const sports = useMemo(() => (sportsData ?? []) as Sport[], [sportsData])

  const { data: seasonsData } = useQuery(queryOptions.athleticsSeasons())
  const seasons = useMemo(() => (seasonsData ?? []) as Season[], [seasonsData])

  const { data: usersData } = useQuery(queryOptions.members())
  const users = useMemo(() => (usersData ?? []) as User[], [usersData])

  const { data: gamesData } = useQuery(queryOptions.athleticsGames())
  const allGames = useMemo(() => (gamesData ?? []) as Game[], [gamesData])

  const invalidateTeams = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.athleticsTeams.all })
  }, [queryClient])

  // Create/Edit drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState({
    name: '',
    sportId: '',
    seasonId: '',
    level: 'VARSITY',
    gradeLevel: '',
    coachUserId: '',
    coachName: '',
  })

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null)
  const [deleting, setDeleting] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null

  // Listen for external "add" trigger from the Add menu
  useEffect(() => {
    const handleAdd = () => { setEditingTeam(null); setDrawerOpen(true) }
    window.addEventListener('athletics-add-team', handleAdd)
    return () => window.removeEventListener('athletics-add-team', handleAdd)
  }, [])

  // Reset season filter when sport filter changes
  useEffect(() => {
    setFilterSeasonId('')
  }, [filterSportId])

  // ─── Derived Data ──────────────────────────────────────────────────

  // Filter seasons by selected sport for the filter bar
  const filteredSeasons = useMemo(() => {
    if (!filterSportId) return seasons
    return seasons.filter((s) => s.sport.id === filterSportId)
  }, [seasons, filterSportId])

  // Form seasons filtered by form sport
  const formSeasons = useMemo(() => {
    if (!form.sportId) return seasons
    return seasons.filter((s) => s.sport.id === form.sportId)
  }, [seasons, form.sportId])

  // Client-side campus filter
  const displayTeams = useMemo(() => {
    let result = teams
    if (activeCampusId) {
      result = result.filter((t) => !t.campusId || t.campusId === activeCampusId)
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.sport.name.toLowerCase().includes(q) ||
          t.season.name.toLowerCase().includes(q)
      )
    }
    return result
  }, [teams, activeCampusId, search])

  // Per-team season records
  const teamRecords = useMemo(() => calcTeamRecords(allGames), [allGames])

  // Dropdown options
  const sportOptions: DropdownOption[] = sports.map((s) => ({
    value: s.id,
    label: s.name,
    color: s.color,
  }))

  const seasonOptions: DropdownOption[] = formSeasons.map((s) => ({
    value: s.id,
    label: s.name,
  }))

  const coachOptions: DropdownOption[] = users.map((u) => ({
    value: u.id,
    label: u.name || u.email,
  }))

  // ─── Drawer Handlers ───────────────────────────────────────────────

  const openCreate = () => {
    setEditingTeam(null)
    setForm({ name: '', sportId: '', seasonId: '', level: 'VARSITY', gradeLevel: '', coachUserId: '', coachName: '' })
    setFormError('')
    setDrawerOpen(true)
  }

  const openEdit = (team: Team) => {
    setEditingTeam(team)
    setForm({
      name: team.name,
      sportId: team.sport.id,
      seasonId: team.season.id,
      level: team.level,
      gradeLevel: team.gradeLevel || '',
      coachUserId: team.coachUserId || '',
      coachName: team.coachName || '',
    })
    setFormError('')
    setDrawerOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Team name is required'); return }
    if (!form.sportId) { setFormError('Sport is required'); return }
    if (!form.seasonId) { setFormError('Season is required'); return }

    setSaving(true)
    setFormError('')

    try {
      if (editingTeam) {
        // Update
        const res = await fetch(`/api/athletics/teams/${editingTeam.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: form.name.trim(),
            level: form.level,
            gradeLevel: form.gradeLevel || null,
            coachUserId: form.coachUserId || null,
            coachName: form.coachName.trim() || null,
          }),
        })
        if (handleAuthResponse(res)) return
        const data = await res.json()
        if (!data.ok) { setFormError(data.error?.message || 'Failed to update team'); return }
      } else {
        // Create
        const res = await fetch('/api/athletics/teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: form.name.trim(),
            sportId: form.sportId,
            seasonId: form.seasonId,
            level: form.level,
            gradeLevel: form.gradeLevel || null,
            coachUserId: form.coachUserId || undefined,
            coachName: form.coachName.trim() || undefined,
            campusId: activeCampusId || undefined,
          }),
        })
        if (handleAuthResponse(res)) return
        const data = await res.json()
        if (!data.ok) { setFormError(data.error?.message || 'Failed to create team'); return }
      }

      setDrawerOpen(false)
      invalidateTeams()
    } catch {
      setFormError('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/athletics/teams/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (handleAuthResponse(res)) return
      setDeleteTarget(null)
      invalidateTeams()
    } catch {
      // silent
    } finally {
      setDeleting(false)
    }
  }

  // When sport changes in form, reset seasonId
  const handleFormSportChange = (sportId: string) => {
    setForm({ ...form, sportId, seasonId: '' })
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 mb-4">
        <div className="relative flex-1 max-w-xs w-full">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Search</label>
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="Search teams..."
            size="sm"
          />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
          <div className="w-full sm:w-44">
            <FloatingDropdown
              id="filter-sport"
              label="Sport"
              value={filterSportId}
              onChange={setFilterSportId}
              options={[{ value: '', label: 'All Sports' }, ...sportOptions]}
            />
          </div>
          <div className="w-full sm:w-44">
            <FloatingDropdown
              id="filter-season"
              label="Season"
              value={filterSeasonId}
              onChange={setFilterSeasonId}
              options={[
                { value: '', label: 'All Seasons' },
                ...filteredSeasons.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 transition sm:ml-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create team
          </button>
        )}
      </div>

      {!loading && displayTeams.length > 0 && (
        <div className="mb-4 rounded-2xl border border-stone-200/70 bg-white/70 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="font-semibold text-slate-900">{displayTeams.length} team{displayTeams.length !== 1 ? 's' : ''}</span>
            <span className="text-stone-500">{sports.length} sport{sports.length !== 1 ? 's' : ''}</span>
            <span className="text-stone-500">{seasons.length} season{seasons.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <AthleticsTableSkeleton columns={7} rows={4} showToolbar={false} />
      ) : displayTeams.length === 0 ? (
        <div className="text-center py-12">
          <IllustrationTeam className="w-48 h-40 mx-auto mb-2" />
          <p className="text-base font-semibold text-stone-700 mb-1">
            {search || filterSportId || filterSeasonId ? 'No teams match your filters' : 'No teams created yet'}
          </p>
          <p className="text-sm text-stone-500 mb-4">
            {search || filterSportId || filterSeasonId ? 'Try adjusting your search or filters.' : 'Get started by creating your first team.'}
          </p>
          {!search && !filterSportId && !filterSeasonId && (
            <button
              type="button"
              onClick={openCreate}
              className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors active:scale-[0.97] cursor-pointer"
            >
              Create First Team
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="sm:hidden space-y-2">
            {displayTeams.map((team) => {
              const rec = teamRecords[team.id]
              return (
                <div key={team.id} className="ui-glass-hover p-4 flex items-center gap-3">
                  <GlassSportTile sport={team.sport.name} color={team.sport.color} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 text-sm">{team.name}</div>
                    <div className="text-xs text-stone-500 mt-0.5">{team.sport.name}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${LEVEL_STYLES[team.level] || 'bg-stone-100 text-stone-600'}`}>
                        {LEVEL_LABELS[team.level] || team.level}
                      </span>
                      {rec && (
                        <span className="text-xs font-medium text-stone-600">
                          <span className="text-green-600">{rec.wins}</span>-<span className="text-red-500">{rec.losses}</span>
                          {rec.ties > 0 && <>-<span className="text-stone-500">{rec.ties}</span></>}
                        </span>
                      )}
                    </div>
                  </div>
                  <RowActionMenu
                    items={[
                      { label: 'Edit', icon: <Edit2 className="w-4 h-4" />, onClick: () => openEdit(team) },
                      { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, onClick: () => setDeleteTarget(team), variant: 'danger' },
                    ]}
                  />
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="overflow-x-auto ui-glass-table hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left px-4 py-3 font-medium text-stone-500 text-xs uppercase tracking-wider">Team</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-500 text-xs uppercase tracking-wider">Sport</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-500 text-xs uppercase tracking-wider">Season</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-500 text-xs uppercase tracking-wider">Level</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-500 text-xs uppercase tracking-wider hidden md:table-cell">Coach</th>
                  <th className="text-center px-4 py-3 font-medium text-stone-500 text-xs uppercase tracking-wider hidden md:table-cell">Record</th>
                  <th className="text-center px-4 py-3 font-medium text-stone-500 text-xs uppercase tracking-wider hidden md:table-cell">G/P</th>
                  <th className="w-12 px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {displayTeams.map((team) => {
                  const coach = users.find((u) => u.id === team.coachUserId)
                  return (
                    <tr key={team.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <GlassSportTile sport={team.sport.name} color={team.sport.color} size="sm" />
                          <span className="font-medium text-slate-900">{team.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-stone-600">{team.sport.name}</td>
                      <td className="px-4 py-3 text-stone-500">{team.season.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {team.gradeLevel && (
                            <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${GRADE_STYLES[team.gradeLevel] || 'bg-stone-100 text-stone-600'}`}>
                              {GRADE_LABELS[team.gradeLevel] || team.gradeLevel}
                            </span>
                          )}
                          <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${LEVEL_STYLES[team.level] || 'bg-stone-100 text-stone-600'}`}>
                            {LEVEL_LABELS[team.level] || team.level}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-stone-500 hidden md:table-cell">
                        {coach ? (
                          <div className="flex items-center gap-2">
                            {coach.avatar ? (
                              <OptimizedImage src={coach.avatar} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-semibold text-stone-500">
                                  {(coach.firstName?.[0] || coach.email[0] || '?').toUpperCase()}
                                </span>
                              </div>
                            )}
                            <span>{coach.firstName ? `${coach.firstName} ${coach.lastName || ''}`.trim() : coach.name || coach.email}</span>
                          </div>
                        ) : team.coachName || '—'}
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        {(() => {
                          const rec = teamRecords[team.id]
                          if (!rec) return <span className="text-stone-400">—</span>
                          return (
                            <span className="text-sm font-medium text-stone-700">
                              <span className="text-green-600">{rec.wins}</span>
                              {'-'}
                              <span className="text-red-500">{rec.losses}</span>
                              {rec.ties > 0 && <>{'-'}<span className="text-stone-500">{rec.ties}</span></>}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3 text-center text-stone-500 hidden md:table-cell">
                        {team._count.games}/{team._count.practices}
                      </td>
                      <td className="px-2 py-3">
                        <RowActionMenu
                          items={[
                            {
                              label: 'Edit',
                              icon: <Edit2 className="w-4 h-4" />,
                              onClick: () => openEdit(team),
                            },
                            {
                              label: 'Delete',
                              icon: <Trash2 className="w-4 h-4" />,
                              onClick: () => setDeleteTarget(team),
                              variant: 'danger',
                            },
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

      {/* Create/Edit Team Drawer */}
      <DetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingTeam ? 'Edit Team' : 'New Team'}
        width="lg"
        footer={
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 disabled:opacity-50 transition"
          >
            {saving ? 'Saving...' : editingTeam ? 'Update Team' : 'Create Team'}
          </button>
        }
      >
        <div className="space-y-5">
          <FloatingInput
            id="team-name"
            label="Team Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />

          <FloatingDropdown
            id="team-sport"
            label="Sport"
            value={form.sportId}
            onChange={handleFormSportChange}
            options={sportOptions}
            required
            disabled={!!editingTeam}
          />

          <FloatingDropdown
            id="team-season"
            label="Season"
            value={form.seasonId}
            onChange={(v) => setForm({ ...form, seasonId: v })}
            options={seasonOptions}
            required
            disabled={!!editingTeam}
          />

          <FloatingDropdown
            id="team-grade-level"
            label="Grade Level"
            value={form.gradeLevel}
            onChange={(v) => setForm({ ...form, gradeLevel: v })}
            options={[
              { value: '', label: 'None' },
              { value: 'ELEMENTARY', label: 'Elementary' },
              { value: 'MIDDLE_SCHOOL', label: 'Middle School' },
              { value: 'HIGH_SCHOOL', label: 'High School' },
            ]}
          />

          <FloatingDropdown
            id="team-level"
            label="Competition Level"
            value={form.level}
            onChange={(v) => setForm({ ...form, level: v })}
            options={[
              { value: 'VARSITY', label: 'Varsity' },
              { value: 'VARSITY_B', label: 'Varsity B' },
              { value: 'JUNIOR_VARSITY', label: 'Junior Varsity' },
              { value: 'FRESHMAN', label: 'Freshman' },
              { value: 'FROSH_SOPH', label: 'Frosh-Soph' },
              { value: 'C_TEAM', label: 'C-Team' },
              { value: 'CLUB', label: 'Club' },
              { value: 'INTRAMURAL', label: 'Intramural' },
              { value: 'UNIFIED', label: 'Unified' },
            ]}
          />

          <FloatingDropdown
            id="team-coach"
            label="Link to Staff Member"
            value={form.coachUserId}
            onChange={(v) => setForm({ ...form, coachUserId: v, coachName: v ? '' : form.coachName })}
            options={[{ value: '', label: 'None' }, ...coachOptions]}
          />

          {!form.coachUserId && (
            <FloatingInput
              id="team-coach-name"
              label="Coach Name"
              value={form.coachName}
              onChange={(e) => setForm({ ...form, coachName: e.target.value })}
              placeholder="e.g. John Smith"
            />
          )}

          {formError && <p className="text-sm text-red-600">{formError}</p>}
        </div>
      </DetailDrawer>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Team"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This will remove all associated games and practices.`}
        requireText={deleteTarget?.name}
        confirmText="Delete"
        variant="danger"
        isLoading={deleting}
        loadingText="Deleting..."
      />
    </div>
  )
}
