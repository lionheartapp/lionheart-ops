import { useState, useEffect, useMemo, useRef } from 'react'
import { UserPlus, Pencil, Trash2, Download, Search, Filter, Plus, Upload, Users } from 'lucide-react'
import { parseMembersCsv } from '../utils/parseMembersCsv'
import { ROLES, getTeamName, getUserTeamIds, canManageTeams } from '../data/teamsData'
import DrawerModal from './DrawerModal'

/** Generate a slug id from a team display name (e.g. "A/V" -> "av", "Campus Services" -> "campus-services") */
function slugifyTeamId(name) {
  return (name || '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'team'
}

const TEAM_TAG_COLORS = [
  'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
]

function getTagColor(index) {
  return TEAM_TAG_COLORS[index % TEAM_TAG_COLORS.length]
}

function slugify(name) {
  return (name || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '') || 'user'
}

function getRoleLabel(roleId) {
  return ROLES.find((r) => r.id === roleId)?.label ?? roleId ?? '—'
}

function downloadCSV(users, teams) {
  const headers = ['Name', 'Username', 'Email', 'Status', 'Role', 'Teams']
  const rows = (users || []).map((u) => {
    const teamIds = getUserTeamIds(u)
    const teamNames = teamIds.map((id) => getTeamName(teams, id)).join(', ')
    const roleLabel = getRoleLabel(u.role)
    return [
      u.name ?? '',
      `@${slugify(u.name)}`,
      u.email ?? '',
      'Active',
      roleLabel,
      teamNames,
    ]
  })
  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'team-members.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function AddTeamModal({ teams, setTeams, isOpen, onClose }) {
  const [name, setName] = useState('')
  const safeTeams = Array.isArray(teams) ? teams : []

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || !setTeams) return
    const id = slugifyTeamId(trimmed)
    if (safeTeams.some((t) => t.id === id || (t.name || '').toLowerCase() === trimmed.toLowerCase())) {
      return
    }
    setTeams((prev) => [...prev, { id, name: trimmed }])
    setName('')
    onClose()
  }

  return (
    <DrawerModal isOpen={isOpen} onClose={onClose} title="Add team">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Team name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            placeholder="e.g. A/V, Facilities, IT, Athletics"
            required
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={!name.trim()}
            className="px-4 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create team
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </DrawerModal>
  )
}

function AddUserModal({ teams, setTeams, users, setUsers, currentUser, isOpen, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', teamIds: [], role: 'viewer' })
  const [newTagName, setNewTagName] = useState('')
  const canAssignRole = canManageTeams(currentUser)
  const safeTeams = Array.isArray(teams) ? teams : []

  const handleAddTag = (e) => {
    e.preventDefault()
    const name = newTagName.trim()
    if (!name || !setTeams) return
    const id = slugifyTeamId(name)
    if (safeTeams.some((t) => t.id === id || t.name.toLowerCase() === name.toLowerCase())) {
      setNewTagName('')
      return
    }
    setTeams((prev) => [...prev, { id, name }])
    setForm((p) => ({ ...p, teamIds: [...p.teamIds, id] }))
    setNewTagName('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim() || form.teamIds.length === 0) return
    const id = 'u' + Date.now()
    setUsers((prev) => [...prev, { ...form, id }])
    setForm({ name: '', email: '', teamIds: [], role: 'viewer' })
    setNewTagName('')
    onClose()
  }

  const toggleTeam = (teamId) => {
    setForm((p) => ({
      ...p,
      teamIds: p.teamIds.includes(teamId) ? p.teamIds.filter((id) => id !== teamId) : [...p.teamIds, teamId],
    }))
  }

  return (
    <DrawerModal isOpen={isOpen} onClose={onClose} title="Add user">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            placeholder="Full name"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            placeholder="email@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Team tags</label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
            Assign one or more team tags (e.g. A/V, Athletics, Admin). Create new tags as needed.
          </p>
          <div className="flex flex-wrap gap-2">
            {safeTeams.map((t) => {
              const isSelected = form.teamIds.includes(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTeam(t.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    isSelected
                      ? 'bg-blue-500 text-white border-blue-500 dark:bg-blue-500 dark:border-blue-500'
                      : 'border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {t.name}
                </button>
              )
            })}
          </div>
          {setTeams && (
            <form onSubmit={handleAddTag} className="flex gap-2 mt-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Create new tag (e.g. Athletics, A/V)"
                className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm placeholder-zinc-400"
              />
              <button
                type="submit"
                disabled={!newTagName.trim()}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-blue-500 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add tag
              </button>
            </form>
          )}
          {form.teamIds.length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Select or create at least one team tag</p>
          )}
        </div>
        {canAssignRole && (
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              className="select-arrow-padded w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            >
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={!form.name.trim() || form.teamIds.length === 0}
            className="px-4 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add user
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </DrawerModal>
  )
}

function EditUserDrawer({ user, teams, setTeams, users, setUsers, currentUser, isOpen, onClose }) {
  const canAssignRole = canManageTeams(currentUser)
  const [form, setForm] = useState({
    name: '',
    email: '',
    teamIds: [],
    role: 'viewer',
  })
  const [newTagName, setNewTagName] = useState('')

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name ?? '',
        email: user.email ?? '',
        teamIds: [...getUserTeamIds(user)],
        role: user.role ?? 'viewer',
      })
    }
  }, [user])

  const safeTeams = Array.isArray(teams) ? teams : []

  const handleAddTag = (e) => {
    e.preventDefault()
    const name = newTagName.trim()
    if (!name) return
    const id = slugifyTeamId(name)
    if (safeTeams.some((t) => t.id === id || t.name.toLowerCase() === name.toLowerCase())) {
      setNewTagName('')
      return
    }
    setTeams((prev) => [...prev, { id, name }])
    setForm((p) => ({ ...p, teamIds: [...p.teamIds, id] }))
    setNewTagName('')
  }

  const handleSave = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    if (!form.teamIds.length) return
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id
          ? { ...u, name: form.name.trim(), email: form.email.trim() || undefined, teamIds: form.teamIds, role: form.role }
          : u
      )
    )
    onClose()
  }

  const toggleTeam = (teamId) => {
    setForm((p) => ({
      ...p,
      teamIds: p.teamIds.includes(teamId) ? p.teamIds.filter((id) => id !== teamId) : [...p.teamIds, teamId],
    }))
  }

  return (
    <DrawerModal isOpen={isOpen} onClose={onClose} title="Edit team member">
      <form onSubmit={handleSave} className="flex flex-col gap-6">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            placeholder="Full name"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            placeholder="email@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Team tags</label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
            Assign one or more team tags (e.g. A/V, Athletics, Admin)
          </p>
          <div className="flex flex-wrap gap-2">
            {safeTeams.map((t) => {
              const isSelected = form.teamIds.includes(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTeam(t.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    isSelected
                      ? 'bg-blue-500 text-white border-blue-500 dark:bg-blue-500 dark:border-blue-500'
                      : 'border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {t.name}
                </button>
              )
            })}
          </div>
          {setTeams && (
            <form onSubmit={handleAddTag} className="flex gap-2 mt-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Create new tag (e.g. Athletics, A/V)"
                className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm placeholder-zinc-400"
              />
              <button
                type="submit"
                disabled={!newTagName.trim()}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-blue-500 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add tag
              </button>
            </form>
          )}
          {form.teamIds.length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Select or create at least one team tag</p>
          )}
        </div>
        {canAssignRole && (
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              className="select-arrow-padded w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            >
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={!form.name.trim() || form.teamIds.length === 0}
            className="px-4 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save changes
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </DrawerModal>
  )
}

export default function MembersPage({ teams = [], setTeams, users = [], setUsers, currentUser }) {
  const [showAddUser, setShowAddUser] = useState(false)
  const [showAddTeam, setShowAddTeam] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const csvInputRef = useRef(null)

  const canManage = canManageTeams(currentUser)
  const safeTeams = Array.isArray(teams) ? teams : []
  const safeUsers = Array.isArray(users) ? users : []

  const filteredUsers = useMemo(() => {
    let result = safeUsers
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((u) => {
        const name = (u.name ?? '').toLowerCase()
        const email = (u.email ?? '').toLowerCase()
        const username = ('@' + slugify(u.name)).toLowerCase()
        const roleLabel = getRoleLabel(u.role).toLowerCase()
        const teamNames = getUserTeamIds(u)
          .map((id) => getTeamName(safeTeams, id) ?? '')
          .join(' ')
          .toLowerCase()
        return name.includes(q) || email.includes(q) || username.includes(q) || roleLabel.includes(q) || teamNames.includes(q)
      })
    }
    if (teamFilter) {
      result = result.filter((u) => getUserTeamIds(u).includes(teamFilter))
    }
    return result
  }, [safeUsers, searchQuery, teamFilter, safeTeams])

  const handleDeleteUser = (u) => {
    if (typeof window !== 'undefined' && !window.confirm(`Remove ${u.name} from the team?`)) return
    setUsers((prev) => prev.filter((x) => x.id !== u.id))
  }

  const resolveRoleId = (roleStr) => {
    if (!roleStr) return 'viewer'
    const r = (roleStr || '').toLowerCase().trim()
    const match = ROLES.find((x) => x.id === r || (x.label || '').toLowerCase() === r)
    return match?.id ?? 'viewer'
  }

  const handleCsvImport = (e) => {
    const file = e.target.files?.[0]
    if (!file || !file.name.toLowerCase().endsWith('.csv')) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const parsed = parseMembersCsv(text)
      if (parsed.length === 0) return

      const existingEmails = new Set(safeUsers.map((u) => (u.email || '').toLowerCase()))
      const newUsers = []
      const teamsToAdd = []

      for (const m of parsed) {
        const email = (m.email || '').trim().toLowerCase()
        if (!email || !email.includes('@') || existingEmails.has(email)) continue
        existingEmails.add(email)

        let teamIds = (m.teamNames || []).map((name) => {
          const id = slugifyTeamId(name)
          if (!safeTeams.some((t) => t.id === id) && !teamsToAdd.some((t) => t.id === id)) {
            teamsToAdd.push({ id, name })
          }
          return id
        })
        if (teamIds.length === 0) {
          const generalId = slugifyTeamId('General')
          if (!safeTeams.some((t) => t.id === generalId) && !teamsToAdd.some((t) => t.id === generalId)) {
            teamsToAdd.push({ id: generalId, name: 'General' })
          }
          teamIds = [generalId]
        }

        newUsers.push({
          id: 'u' + Date.now() + Math.random().toString(36).slice(2, 8),
          name: (m.name || email.split('@')[0] || 'Unknown').trim(),
          email,
          teamIds,
          role: resolveRoleId(m.role),
        })
      }

      const existingIds = new Set(safeTeams.map((t) => t.id))
      const byId = new Map()
      for (const t of teamsToAdd) {
        if (!existingIds.has(t.id) && !byId.has(t.id)) byId.set(t.id, t)
      }
      const uniqueTeams = Array.from(byId.values())
      if (uniqueTeams.length && setTeams) {
        setTeams((prev) => [...prev, ...uniqueTeams])
      }
      if (newUsers.length && setUsers) {
        setUsers((prev) => [...prev, ...newUsers])
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleCreateTag = (e) => {
    e.preventDefault()
    const name = newTagName.trim()
    if (!name || !setTeams) return
    const id = slugifyTeamId(name)
    if (safeTeams.some((t) => t.id === id || t.name.toLowerCase() === name.toLowerCase())) {
      setNewTagName('')
      return
    }
    setTeams((prev) => [...prev, { id, name }])
    setNewTagName('')
  }

  return (
    <div className="space-y-8">
      {/* Teams: create teams for your organization */}
      {canManage && setTeams && (
        <div className="glass-card p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Teams</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                Create teams (e.g. A/V, Athletics, Admin, IT) and assign them to members.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddTeam(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600"
            >
              <Plus className="w-4 h-4" />
              Add team
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {safeTeams.map((t) => (
              <span
                key={t.id}
                className="inline-flex px-2.5 py-0.5 rounded-md text-xs font-medium bg-zinc-100 dark:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-600"
              >
                {t.name}
              </span>
            ))}
            {safeTeams.length === 0 && (
              <span className="text-sm text-zinc-500 dark:text-zinc-400">No teams yet. Add one using the button above.</span>
            )}
          </div>
          <form onSubmit={handleCreateTag} className="flex gap-2 mt-3">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Or type to add quickly (e.g. Athletics, A/V)"
              className="flex-1 min-w-0 max-w-xs px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm placeholder-zinc-400"
            />
            <button
              type="submit"
              disabled={!newTagName.trim()}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Add
            </button>
          </form>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Team members
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {filteredUsers.length} of {safeUsers.length} {safeUsers.length === 1 ? 'user' : 'users'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            onChange={handleCsvImport}
            className="hidden"
          />
          {canManage && (
            <button
              type="button"
              onClick={() => csvInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <Upload className="w-4 h-4" />
              Upload CSV
            </button>
          )}
          <button
            type="button"
            onClick={() => downloadCSV(filteredUsers, safeTeams)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
          {canManage && setTeams && (
            <button
              onClick={() => setShowAddTeam(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <Users className="w-4 h-4" />
              Add team
            </button>
          )}
          {canManage && (
            <button
              onClick={() => setShowAddUser(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100"
            >
              <UserPlus className="w-4 h-4" />
              Add user
            </button>
          )}
        </div>
      </div>

      {/* Search & filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, team, or role..."
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2 min-w-[180px]">
          <Filter className="w-4 h-4 text-zinc-400 shrink-0" aria-hidden />
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="select-arrow-padded flex-1 px-3 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All teams</option>
            {safeTeams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <section className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50">
                <th className="text-left py-3 px-4 font-medium text-zinc-600 dark:text-zinc-400">Name</th>
                <th className="text-left py-3 px-4 font-medium text-zinc-600 dark:text-zinc-400">Status</th>
                <th className="text-left py-3 px-4 font-medium text-zinc-600 dark:text-zinc-400">Role</th>
                <th className="text-left py-3 px-4 font-medium text-zinc-600 dark:text-zinc-400">Email address</th>
                <th className="text-left py-3 px-4 font-medium text-zinc-600 dark:text-zinc-400">Teams</th>
                {canManage && (
                  <th className="text-right py-3 px-4 font-medium text-zinc-600 dark:text-zinc-400 w-20">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const teamIds = getUserTeamIds(u)
                const isYou = currentUser?.id === u.id
                return (
                  <tr
                    key={u.id}
                    className={`border-b border-zinc-100 dark:border-zinc-800 ${
                      isYou ? 'bg-blue-500/5 dark:bg-blue-500/10' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-sm shrink-0">
                          {(u.name ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-zinc-900 dark:text-zinc-100">
                            {u.name}
                            {isYou && (
                              <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(you)</span>
                            )}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            @{slugify(u.name)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden />
                        Active
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex px-2.5 py-0.5 rounded-md text-xs font-medium bg-zinc-100 dark:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-600">
                        {getRoleLabel(u.role)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                      {u.email ?? '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {teamIds.map((tid, i) => (
                          <span
                            key={tid}
                            className={`inline-flex px-2.5 py-0.5 rounded-md text-xs font-medium border ${getTagColor(i)}`}
                          >
                            {getTeamName(safeTeams, tid)}
                          </span>
                        ))}
                        {teamIds.length === 0 && <span className="text-zinc-400 dark:text-zinc-500">—</span>}
                      </div>
                    </td>
                    {canManage && (
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingUser(u)}
                            className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200"
                            aria-label="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {!isYou && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                              aria-label="Remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    {searchQuery || teamFilter ? 'No users match your filters. Try adjusting your search or team filter.' : 'No team members yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {canManage && setTeams && (
        <AddTeamModal
          teams={teams}
          setTeams={setTeams}
          isOpen={showAddTeam}
          onClose={() => setShowAddTeam(false)}
        />
      )}

      {canManage && (
        <AddUserModal
          teams={teams}
          setTeams={setTeams}
          users={users}
          setUsers={setUsers}
          currentUser={currentUser}
          isOpen={showAddUser}
          onClose={() => setShowAddUser(false)}
        />
      )}

      {editingUser && (
        <EditUserDrawer
          user={editingUser}
          teams={teams}
          setTeams={setTeams}
          users={users}
          setUsers={setUsers}
          currentUser={currentUser}
          isOpen={!!editingUser}
          onClose={() => setEditingUser(null)}
        />
      )}
    </div>
  )
}
