'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryOptions, queryKeys } from '@/lib/queries'
import { Plus, Search, Users, Upload, UserPlus } from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'
import AthleticsTableSkeleton from '@/components/athletics/AthleticsTableSkeleton'
import { FloatingDropdown, type DropdownOption } from '@/components/ui/FloatingInput'
import DetailDrawer from '@/components/DetailDrawer'
import ConfirmDialog from '@/components/ConfirmDialog'
import SportIcon, { GlassSportTile } from '@/components/athletics/SportIcon'
import { IllustrationAthletics, IllustrationTeam } from '@/components/illustrations'

import type { Team, RosterPlayer, OrgUser } from './roster/roster-types'
import RosterPlayerForm from './roster/RosterPlayerForm'
import RosterCSVImport from './roster/RosterCSVImport'
import type { ParsedPlayer, UploadResult } from './roster/RosterCSVImport'
import RosterTable from './roster/RosterTable'
import RosterCards from './roster/RosterCards'

interface RosterSectionProps {
  activeCampusId: string | null
  canWrite?: boolean
  canManageUsers?: boolean
}

export default function RosterSection({ activeCampusId, canWrite = false, canManageUsers = false }: RosterSectionProps) {
  const queryClient = useQueryClient()

  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [search, setSearch] = useState('')

  // ─── Cached Data ──────────────────────────────────────────────────

  const { data: teamsData, isLoading: loading } = useQuery(queryOptions.athleticsTeams())
  const teams = (teamsData ?? []) as Team[]

  const { data: rosterData, isLoading: loadingRoster } = useQuery(
    queryOptions.athleticsRoster(selectedTeamId || undefined)
  )
  const roster = (rosterData ?? []) as RosterPlayer[]

  const { data: usersData } = useQuery({
    ...queryOptions.members(),
    enabled: canManageUsers,
  })
  const orgUsers = (usersData ?? []) as OrgUser[]

  const invalidateRoster = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.athleticsRoster.all })
  }, [queryClient])

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<RosterPlayer | null>(null)

  // Form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [jerseyNumber, setJerseyNumber] = useState('')
  const [position, setPosition] = useState('')
  const [grade, setGrade] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [linkedUserId, setLinkedUserId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Drawer mode: 'single' or 'upload'
  const [drawerMode, setDrawerMode] = useState<'single' | 'upload'>('single')

  // Bulk upload state
  const [uploadParsed, setUploadParsed] = useState<ParsedPlayer[]>([])
  const [uploadFileName, setUploadFileName] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null

  // Listen for external "add" trigger from the Add menu
  useEffect(() => {
    const handleAdd = () => { setEditing(null); setDrawerOpen(true) }
    window.addEventListener('athletics-add-player', handleAdd)
    return () => window.removeEventListener('athletics-add-player', handleAdd)
  }, [])

  // ─── Campus-filtered teams ─────────────────────────────────────────

  const displayTeams = useMemo(() => {
    if (!activeCampusId) return teams
    return teams.filter((t) => !t.schoolId || t.schoolId === activeCampusId)
  }, [teams, activeCampusId])

  const teamOptions: DropdownOption[] = useMemo(() => {
    return displayTeams.map((t) => ({
      value: t.id,
      label: `${t.name} — ${t.sport.name}`,
      color: t.sport.color,
    }))
  }, [displayTeams])

  useEffect(() => {
    if (selectedTeamId && !displayTeams.find((t) => t.id === selectedTeamId)) {
      setSelectedTeamId('')
    }
  }, [displayTeams, selectedTeamId])

  // ─── Campus-filtered roster (for all-teams view) ─────────────────

  const displayRoster = useMemo(() => {
    if (selectedTeamId || !activeCampusId) return roster
    const teamIds = new Set(displayTeams.map((t) => t.id))
    return roster.filter((p) => teamIds.has(p.athleticTeamId))
  }, [roster, selectedTeamId, activeCampusId, displayTeams])

  // ─── Team directory (grouped roster for all-teams view) ─────────

  const teamDirectory = useMemo(() => {
    if (selectedTeamId) return []
    const counts = new Map<string, number>()
    for (const p of displayRoster) {
      counts.set(p.athleticTeamId, (counts.get(p.athleticTeamId) || 0) + 1)
    }
    return displayTeams.map((t) => ({
      ...t,
      playerCount: counts.get(t.id) || 0,
    }))
  }, [selectedTeamId, displayRoster, displayTeams])

  // ─── Filtered roster ───────────────────────────────────────────────

  const filteredRoster = useMemo(() => {
    if (!search.trim()) return displayRoster
    const q = search.toLowerCase()
    return displayRoster.filter((p) =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
      p.jerseyNumber?.includes(q) ||
      p.position?.toLowerCase().includes(q)
    )
  }, [displayRoster, search])

  // ─── Drawer handlers ──────────────────────────────────────────────

  const resetUploadState = useCallback(() => {
    setUploadParsed([])
    setUploadFileName('')
    setUploadError('')
    setUploadResult(null)
  }, [])

  const openCreate = useCallback(() => {
    setEditing(null)
    setDrawerMode('single')
    setFirstName('')
    setLastName('')
    setJerseyNumber('')
    setPosition('')
    setGrade('')
    setHeight('')
    setWeight('')
    setLinkedUserId('')
    setError('')
    resetUploadState()
    setDrawerOpen(true)
  }, [resetUploadState])

  const openEdit = useCallback((player: RosterPlayer) => {
    setEditing(player)
    setFirstName(player.firstName)
    setLastName(player.lastName)
    setJerseyNumber(player.jerseyNumber || '')
    setPosition(player.position || '')
    setGrade(player.grade || '')
    setHeight(player.height || '')
    setWeight(player.weight || '')
    setLinkedUserId(player.userId || '')
    setError('')
    setDrawerOpen(true)
  }, [])

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required')
      return
    }

    setSaving(true)
    setError('')

    try {
      const body: Record<string, unknown> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        jerseyNumber: jerseyNumber.trim() || null,
        position: position.trim() || null,
        grade: grade.trim() || null,
        height: height.trim() || null,
        weight: weight.trim() || null,
        userId: linkedUserId || null,
      }

      let res: Response
      if (editing) {
        res = await fetch(`/api/athletics/roster/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })
      } else {
        body.athleticTeamId = selectedTeamId
        res = await fetch('/api/athletics/roster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })
      }

      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!data.ok) {
        setError(data.error?.message || 'Failed to save')
        return
      }

      setDrawerOpen(false)
      invalidateRoster()
    } catch {
      setError('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/athletics/roster/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (handleAuthResponse(res)) return
      setDeleteTarget(null)
      invalidateRoster()
    } catch {
      // silent
    } finally {
      setDeleting(false)
    }
  }

  const handleBulkUpload = async () => {
    if (!selectedTeamId || uploadParsed.length === 0) return
    setUploading(true)
    setUploadError('')
    setUploadResult(null)

    try {
      const res = await fetch('/api/athletics/roster/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ athleticTeamId: selectedTeamId, players: uploadParsed }),
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!data.ok) {
        setUploadError(data.error?.message || 'Import failed')
        return
      }
      setUploadResult(data.data)
      invalidateRoster()
    } catch {
      setUploadError('Something went wrong')
    } finally {
      setUploading(false)
    }
  }

  const handleDeletePlayer = useCallback((player: RosterPlayer) => {
    setDeleteTarget({ id: player.id, name: `${player.firstName} ${player.lastName}` })
  }, [])

  // ─── Render ────────────────────────────────────────────────────────

  if (loading) {
    return <AthleticsTableSkeleton columns={5} rows={4} />
  }

  const userOptions: DropdownOption[] = [
    { value: '', label: 'No linked user' },
    ...orgUsers.map((u) => ({
      value: u.id,
      label: `${u.firstName || ''} ${u.lastName || ''} (${u.email})`.trim(),
    })),
  ]

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 mb-5">
        <div className="w-full sm:w-64">
          <FloatingDropdown
            id="roster-team"
            label="Select Team"
            value={selectedTeamId}
            onChange={setSelectedTeamId}
            options={[{ value: '', label: 'All Teams' }, ...teamOptions]}
          />
        </div>

        <div className="w-full sm:w-52">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 z-10" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players..."
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 transition-colors placeholder:text-slate-400"
            />
          </div>
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={openCreate}
            disabled={!selectedTeamId}
            title={!selectedTeamId ? 'Select a team first' : undefined}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 transition sm:ml-auto disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Player
          </button>
        )}
      </div>

      {/* Content */}
      {!selectedTeamId && !search ? (
        loadingRoster ? (
          <AthleticsTableSkeleton columns={3} rows={4} showToolbar={false} />
        ) : teamDirectory.length === 0 ? (
          <div className="ui-glass p-8 text-center">
            <IllustrationTeam className="w-48 h-40 mx-auto mb-2" />
            <h2 className="text-lg font-medium text-stone-700 mb-1">No teams available</h2>
            <p className="text-sm text-stone-500">Create teams in the Teams tab first</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamDirectory.map((team) => (
              <button
                key={team.id}
                type="button"
                onClick={() => setSelectedTeamId(team.id)}
                className="flex items-start gap-3 p-4 ui-glass-hover text-left cursor-pointer"
              >
                <GlassSportTile sport={team.sport.name} color={team.sport.color} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{team.name}</div>
                  <div className="text-xs text-stone-500 mt-0.5">
                    {team.sport.name} &middot; {team.level}
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <Users className="w-3.5 h-3.5 text-stone-400" />
                    <span className="text-xs font-medium text-stone-600">
                      {team.playerCount} player{team.playerCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )
      ) : !selectedTeamId && search ? (
        loadingRoster ? (
          <AthleticsTableSkeleton columns={5} rows={4} showToolbar={false} />
        ) : filteredRoster.length === 0 ? (
          <div className="ui-glass p-8 text-center">
            <IllustrationTeam className="w-48 h-40 mx-auto mb-2" />
            <h2 className="text-lg font-medium text-stone-700 mb-1">No matching players</h2>
            <p className="text-sm text-stone-500">Try a different search</p>
          </div>
        ) : (
          <div className="ui-glass-table">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-100">
                <thead>
                  <tr className="bg-stone-50/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider w-12">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Team</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Position</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider hidden sm:table-cell">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {filteredRoster.map((player) => (
                    <tr key={player.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                        {player.jerseyNumber || '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        {player.firstName} {player.lastName}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <SportIcon sport={player.athleticTeam?.sport?.name || ''} size={14} style={{ color: player.athleticTeam?.sport?.color || '#6a6864' }} className="flex-shrink-0" />
                          <span className="text-sm text-stone-600">{player.athleticTeam?.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-stone-600">{player.position || '\u2014'}</td>
                      <td className="px-4 py-3 text-sm text-stone-600 hidden sm:table-cell">{player.grade || '\u2014'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-stone-100 px-4 py-2.5 text-xs text-stone-500">
              {filteredRoster.length} player{filteredRoster.length !== 1 ? 's' : ''} found
            </div>
          </div>
        )
      ) : loadingRoster ? (
        <AthleticsTableSkeleton columns={5} rows={4} showToolbar={false} />
      ) : filteredRoster.length === 0 ? (
        <div className="ui-glass p-8 text-center">
          {roster.length === 0 ? (
            <>
              <IllustrationAthletics className="w-48 h-40 mx-auto mb-2" />
              <p className="text-base font-semibold text-stone-700 mb-1">No players on this roster</p>
              <p className="text-sm text-stone-500 mb-4">Get started by adding a player</p>
              <button
                type="button"
                onClick={openCreate}
                className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors active:scale-[0.97] cursor-pointer"
              >
                Add First Player
              </button>
            </>
          ) : (
            <>
              <p className="text-base font-semibold text-stone-700 mb-1">No matching players</p>
              <p className="text-sm text-stone-500">Try a different search</p>
            </>
          )}
        </div>
      ) : (
        <div className="ui-glass-table">
          <RosterCards players={filteredRoster} onEdit={openEdit} onDelete={handleDeletePlayer} />
          <RosterTable players={filteredRoster} onEdit={openEdit} onDelete={handleDeletePlayer} />
          <div className="border-t border-stone-100 px-4 py-2.5 text-xs text-stone-500">
            {filteredRoster.length} player{filteredRoster.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Create/Edit drawer */}
      <DetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Player' : 'Add Players'}
        footer={
          drawerMode === 'single' || editing ? (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                disabled={saving}
                className="flex-1 py-2.5 text-sm font-medium text-stone-700 border border-stone-200 rounded-full hover:bg-stone-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : editing ? 'Update Player' : 'Add Player'}
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                disabled={uploading}
                className="flex-1 py-2.5 text-sm font-medium text-stone-700 border border-stone-200 rounded-full hover:bg-stone-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={uploadResult ? () => { setDrawerOpen(false); resetUploadState() } : handleBulkUpload}
                disabled={uploading || (!uploadResult && uploadParsed.length === 0)}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition disabled:opacity-50"
              >
                {uploading ? 'Importing...' : uploadResult ? 'Done' : `Import ${uploadParsed.length} Player${uploadParsed.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          )
        }
      >
        {/* Tab switcher -- only show when creating (not editing) */}
        {!editing && (
          <div className="flex gap-1 p-1 bg-stone-100 rounded-lg mb-5">
            <button
              type="button"
              onClick={() => { setDrawerMode('single'); resetUploadState() }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                drawerMode === 'single'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Single
            </button>
            <button
              type="button"
              onClick={() => { setDrawerMode('upload'); setError('') }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                drawerMode === 'upload'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload File
            </button>
          </div>
        )}

        {/* Single player form */}
        {(drawerMode === 'single' || editing) && (
          <RosterPlayerForm
            firstName={firstName}
            lastName={lastName}
            jerseyNumber={jerseyNumber}
            position={position}
            grade={grade}
            height={height}
            weight={weight}
            linkedUserId={linkedUserId}
            userOptions={userOptions}
            error={error}
            onFirstNameChange={setFirstName}
            onLastNameChange={setLastName}
            onJerseyNumberChange={setJerseyNumber}
            onPositionChange={setPosition}
            onGradeChange={setGrade}
            onHeightChange={setHeight}
            onWeightChange={setWeight}
            onLinkedUserIdChange={setLinkedUserId}
          />
        )}

        {/* Upload file view */}
        {drawerMode === 'upload' && !editing && (
          <RosterCSVImport
            uploadParsed={uploadParsed}
            uploadFileName={uploadFileName}
            uploadError={uploadError}
            uploading={uploading}
            uploadResult={uploadResult}
            onParsed={setUploadParsed}
            onFileNameChange={setUploadFileName}
            onErrorChange={setUploadError}
            onResetUpload={resetUploadState}
          />
        )}
      </DetailDrawer>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Player"
        message={`Are you sure you want to remove ${deleteTarget?.name} from the roster? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        isLoading={deleting}
        loadingText="Deleting..."
      />
    </div>
  )
}
