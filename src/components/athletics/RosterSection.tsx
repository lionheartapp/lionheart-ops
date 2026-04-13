'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryOptions, queryKeys } from '@/lib/queries'
import { Plus, Search, Users, Trash2, Edit2, Upload, UserPlus, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'
import AthleticsTableSkeleton from '@/components/athletics/AthleticsTableSkeleton'
import { FloatingInput, FloatingDropdown, type DropdownOption } from '@/components/ui/FloatingInput'
import DetailDrawer from '@/components/DetailDrawer'
import ConfirmDialog from '@/components/ConfirmDialog'
import RowActionMenu from '@/components/RowActionMenu'
import SportIcon, { GlassSportTile } from '@/components/athletics/SportIcon'
import { IllustrationAthletics, IllustrationTeam } from '@/components/illustrations'

interface Team {
  id: string
  name: string
  level: string
  schoolId: string | null
  sport: { id: string; name: string; color: string }
  season: { id: string; name: string }
}

interface RosterPlayer {
  id: string
  athleticTeamId: string
  firstName: string
  lastName: string
  jerseyNumber: string | null
  position: string | null
  grade: string | null
  height: string | null
  weight: string | null
  userId: string | null
  isActive: boolean
  user: { id: string; firstName: string | null; lastName: string | null; email: string } | null
  athleticTeam: { id: string; name: string; sport: { name: string; color: string } }
}

interface OrgUser {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
}

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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadParsed, setUploadParsed] = useState<Array<{
    firstName: string; lastName: string; jerseyNumber?: string;
    position?: string; grade?: string; height?: string; weight?: string
  }>>([])
  const [uploadFileName, setUploadFileName] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ created: number; errors: string[] } | null>(null)

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

  // ─── CSV parsing ──────────────────────────────────────────────────

  const CSV_HEADERS = ['First Name', 'Last Name', 'Jersey Number', 'Position', 'Grade', 'Height', 'Weight']

  const downloadTemplate = () => {
    const csv = CSV_HEADERS.join(',') + '\nJohn,Doe,23,Guard,10th,6\'1",185\nJane,Smith,7,Forward,11th,5\'9",160\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'roster-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) {
      setUploadError('File must have a header row and at least one player row')
      return
    }

    // Flexible header detection — normalize column names
    const headerLine = lines[0]
    const rawHeaders = splitCSVLine(headerLine).map((h) => h.toLowerCase().replace(/[^a-z]/g, ''))

    const colMap: Record<string, number> = {}
    rawHeaders.forEach((h, i) => {
      if (h.includes('first')) colMap.firstName = i
      else if (h.includes('last')) colMap.lastName = i
      else if (h.includes('jersey') || h.includes('number') || h === 'no' || h === 'num') colMap.jerseyNumber = i
      else if (h.includes('pos')) colMap.position = i
      else if (h.includes('grade') || h.includes('year') || h.includes('class')) colMap.grade = i
      else if (h.includes('height') || h === 'ht') colMap.height = i
      else if (h.includes('weight') || h === 'wt') colMap.weight = i
    })

    if (colMap.firstName === undefined || colMap.lastName === undefined) {
      setUploadError('CSV must have "First Name" and "Last Name" columns')
      return
    }

    const players = []
    const rowErrors: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const cols = splitCSVLine(lines[i])
      const firstName = cols[colMap.firstName]?.trim() || ''
      const lastName = cols[colMap.lastName]?.trim() || ''

      if (!firstName && !lastName) continue // skip blank rows

      if (!firstName || !lastName) {
        rowErrors.push(`Row ${i + 1}: Missing ${!firstName ? 'first' : 'last'} name`)
        continue
      }

      players.push({
        firstName,
        lastName,
        jerseyNumber: colMap.jerseyNumber !== undefined ? cols[colMap.jerseyNumber]?.trim() : undefined,
        position: colMap.position !== undefined ? cols[colMap.position]?.trim() : undefined,
        grade: colMap.grade !== undefined ? cols[colMap.grade]?.trim() : undefined,
        height: colMap.height !== undefined ? cols[colMap.height]?.trim() : undefined,
        weight: colMap.weight !== undefined ? cols[colMap.weight]?.trim() : undefined,
      })
    }

    if (players.length === 0) {
      setUploadError(rowErrors.length ? rowErrors.join('; ') : 'No valid player rows found')
      return
    }
    if (rowErrors.length) {
      setUploadError(`${rowErrors.length} row(s) skipped: ${rowErrors[0]}${rowErrors.length > 1 ? ` and ${rowErrors.length - 1} more` : ''}`)
    }

    setUploadParsed(players)
  }

  /** Simple CSV line splitter that handles quoted fields */
  const splitCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue }
      if (char === ',' && !inQuotes) { result.push(current); current = ''; continue }
      current += char
    }
    result.push(current)
    return result
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadError('')
    setUploadParsed([])
    setUploadResult(null)

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'csv') {
      setUploadError('Please upload a .csv file')
      return
    }
    if (file.size > 1024 * 1024) {
      setUploadError('File must be under 1 MB')
      return
    }

    setUploadFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result
      if (typeof text === 'string') parseCSV(text)
    }
    reader.readAsText(file)
    // Reset input so re-selecting the same file works
    e.target.value = ''
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

  const resetUploadState = () => {
    setUploadParsed([])
    setUploadFileName('')
    setUploadError('')
    setUploadResult(null)
  }

  const openCreate = () => {
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
  }

  const openEdit = (player: RosterPlayer) => {
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
  }

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
        <div className="w-full sm:w-64">
          <FloatingDropdown
            id="roster-team"
            label="Select Team"
            value={selectedTeamId}
            onChange={setSelectedTeamId}
            options={[{ value: '', label: 'All Teams' }, ...teamOptions]}
          />
        </div>

        <div className="relative w-full sm:w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 z-10" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players..."
            className="w-full pl-9 pr-3 py-3.5 text-sm border border-stone-300 rounded-lg bg-white focus:outline-none focus:border-slate-900 focus-visible:ring-1 focus-visible:ring-slate-900/10 transition-colors"
          />
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
                        {player.jerseyNumber || '—'}
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
                      <td className="px-4 py-3 text-sm text-stone-600">{player.position || '—'}</td>
                      <td className="px-4 py-3 text-sm text-stone-600 hidden sm:table-cell">{player.grade || '—'}</td>
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
          {/* Mobile card list */}
          <div className="sm:hidden divide-y divide-stone-100">
            {filteredRoster.map((player) => (
              <div key={player.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 text-center text-sm font-semibold text-slate-900 flex-shrink-0">
                  {player.jerseyNumber || '—'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900">
                    {player.firstName} {player.lastName}
                    {!player.isActive && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium">Inactive</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-stone-500">
                    <span>{player.position || '—'}</span>
                    {player.grade && <><span className="text-stone-300">|</span><span>{player.grade}</span></>}
                  </div>
                </div>
                <RowActionMenu
                  items={[
                    { label: 'Edit', icon: <Edit2 className="w-4 h-4" />, onClick: () => openEdit(player) },
                    { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, onClick: () => setDeleteTarget({ id: player.id, name: `${player.firstName} ${player.lastName}` }), variant: 'danger' },
                  ]}
                />
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="overflow-x-auto hidden sm:block">
            <table className="min-w-full divide-y divide-stone-100">
              <thead>
                <tr className="bg-stone-50/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider w-12">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Position</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Grade</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider hidden md:table-cell">Ht/Wt</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider hidden lg:table-cell">Linked User</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wider w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {filteredRoster.map((player) => (
                  <tr key={player.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      {player.jerseyNumber || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">
                        {player.firstName} {player.lastName}
                      </div>
                      {!player.isActive && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-stone-600">{player.position || '—'}</td>
                    <td className="px-4 py-3 text-sm text-stone-600">{player.grade || '—'}</td>
                    <td className="px-4 py-3 text-sm text-stone-600 hidden md:table-cell">
                      {player.height || player.weight
                        ? `${player.height || '—'} / ${player.weight || '—'}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-stone-500 hidden lg:table-cell">
                      {player.user
                        ? `${player.user.firstName || ''} ${player.user.lastName || ''}`.trim() || player.user.email
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RowActionMenu
                        items={[
                          { label: 'Edit', icon: <Edit2 className="w-4 h-4" />, onClick: () => openEdit(player) },
                          {
                            label: 'Delete',
                            icon: <Trash2 className="w-4 h-4" />,
                            onClick: () => setDeleteTarget({ id: player.id, name: `${player.firstName} ${player.lastName}` }),
                            variant: 'danger',
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
        {/* Tab switcher — only show when creating (not editing) */}
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
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FloatingInput id="first-name" label="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <FloatingInput id="last-name" label="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <FloatingInput id="jersey-number" label="Jersey Number" value={jerseyNumber} onChange={(e) => setJerseyNumber(e.target.value)} />
            <FloatingInput id="position" label="Position" value={position} onChange={(e) => setPosition(e.target.value)} />
            <FloatingInput id="grade" label="Grade" value={grade} onChange={(e) => setGrade(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <FloatingInput id="height" label="Height" value={height} onChange={(e) => setHeight(e.target.value)} />
              <FloatingInput id="weight" label="Weight" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
            <FloatingDropdown
              id="linked-user"
              label="Link to User (optional)"
              value={linkedUserId}
              onChange={setLinkedUserId}
              options={userOptions}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        {/* Upload file view */}
        {drawerMode === 'upload' && !editing && (
          <div className="space-y-5">
            {/* Template download */}
            <button
              type="button"
              onClick={downloadTemplate}
              className="w-full flex items-center gap-3 px-4 py-3 border border-dashed border-stone-300 rounded-xl text-left hover:border-stone-400 hover:bg-stone-50/50 transition-colors group cursor-pointer"
            >
              <div className="p-2 rounded-lg bg-stone-100 group-hover:bg-indigo-50 transition-colors">
                <Download className="w-4 h-4 text-stone-500 group-hover:text-indigo-600 transition-colors" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Download CSV Template</p>
                <p className="text-xs text-stone-500 mt-0.5">Pre-formatted with the correct column headers</p>
              </div>
            </button>

            {/* File drop zone */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center gap-3 px-4 py-8 border-2 border-dashed border-stone-200 rounded-xl hover:border-stone-400 hover:bg-stone-50/30 transition-colors cursor-pointer"
            >
              <div className="p-3 rounded-full bg-stone-100">
                <FileSpreadsheet className="w-6 h-6 text-stone-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-stone-700">
                  {uploadFileName || 'Click to upload a CSV file'}
                </p>
                <p className="text-xs text-stone-400 mt-1">
                  Columns: First Name, Last Name, Jersey Number, Position, Grade, Height, Weight
                </p>
              </div>
            </button>

            {/* Parse error */}
            {uploadError && !uploadResult && (
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-red-50 border border-red-100">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{uploadError}</p>
              </div>
            )}

            {/* Preview table */}
            {uploadParsed.length > 0 && !uploadResult && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-stone-700">
                    {uploadParsed.length} player{uploadParsed.length !== 1 ? 's' : ''} ready to import
                  </p>
                  <button
                    type="button"
                    onClick={() => { resetUploadState() }}
                    className="text-xs text-stone-500 hover:text-stone-700 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
                <div className="border border-stone-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-stone-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-stone-500">Name</th>
                        <th className="px-3 py-2 text-left font-semibold text-stone-500">#</th>
                        <th className="px-3 py-2 text-left font-semibold text-stone-500">Pos</th>
                        <th className="px-3 py-2 text-left font-semibold text-stone-500">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {uploadParsed.map((p, i) => (
                        <tr key={i} className="hover:bg-stone-50/50">
                          <td className="px-3 py-1.5 text-slate-900 font-medium">{p.firstName} {p.lastName}</td>
                          <td className="px-3 py-1.5 text-stone-600">{p.jerseyNumber || '—'}</td>
                          <td className="px-3 py-1.5 text-stone-600">{p.position || '—'}</td>
                          <td className="px-3 py-1.5 text-stone-600">{p.grade || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Upload result */}
            {uploadResult && (
              <div className="space-y-3">
                <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-emerald-50 border border-emerald-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-emerald-800 font-medium">
                    Successfully imported {uploadResult.created} player{uploadResult.created !== 1 ? 's' : ''}
                  </p>
                </div>
                {uploadResult.errors.length > 0 && (
                  <div className="px-3.5 py-3 rounded-lg bg-amber-50 border border-amber-100 space-y-1">
                    <p className="text-sm font-medium text-amber-800">{uploadResult.errors.length} issue{uploadResult.errors.length !== 1 ? 's' : ''}</p>
                    <ul className="text-xs text-amber-700 space-y-0.5">
                      {uploadResult.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>• {err}</li>
                      ))}
                      {uploadResult.errors.length > 5 && (
                        <li className="text-amber-500">...and {uploadResult.errors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
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
