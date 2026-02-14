import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { UserPlus, Pencil, Trash2, Download, Search, Filter } from 'lucide-react'
import { ROLES, getTeamName, getUserTeamIds, canManageTeams } from '../data/teamsData'
import DrawerModal from './DrawerModal'

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

function EditUserDrawer({ user, teams, users, setUsers, currentUser, isOpen, onClose }) {
  const canAssignRole = canManageTeams(currentUser)
  const [form, setForm] = useState({
    name: '',
    email: '',
    teamIds: [],
    role: 'viewer',
  })

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
          {form.teamIds.length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Select at least one team</p>
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

export default function MembersPage({ teams = [], users = [], setUsers, currentUser }) {
  const [showAddUser, setShowAddUser] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [newUser, setNewUser] = useState({ name: '', email: '', teamIds: [], role: 'viewer' })
  const [searchQuery, setSearchQuery] = useState('')
  const [teamFilter, setTeamFilter] = useState('')

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

  const handleAddUser = (e) => {
    e.preventDefault()
    if (!newUser.name.trim()) return
    if (newUser.teamIds.length === 0) return
    const id = 'u' + Date.now()
    setUsers((prev) => [...prev, { ...newUser, id }])
    setNewUser({ name: '', email: '', teamIds: [], role: 'viewer' })
    setShowAddUser(false)
  }

  const handleDeleteUser = (u) => {
    if (typeof window !== 'undefined' && !window.confirm(`Remove ${u.name} from the team?`)) return
    setUsers((prev) => prev.filter((x) => x.id !== u.id))
  }

  return (
    <div className="space-y-8">
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
          <button
            type="button"
            onClick={() => downloadCSV(filteredUsers, safeTeams)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
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

      {/* Add user */}
      {canManage && showAddUser && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card p-6"
        >
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Add user</h3>
          <form onSubmit={handleAddUser} className="space-y-4 max-w-sm">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Name</label>
              <input
                type="text"
                value={newUser.name}
                onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                placeholder="Full name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Email</label>
              <input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Team tags</label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                Assign one or more team tags (e.g. A/V, Athletics)
              </p>
              <div className="flex flex-wrap gap-2">
                {safeTeams.map((t) => {
                  const isSelected = newUser.teamIds.includes(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setNewUser((p) => ({
                          ...p,
                          teamIds: isSelected ? p.teamIds.filter((id) => id !== t.id) : [...p.teamIds, t.id],
                        }))
                      }
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        isSelected
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {t.name}
                    </button>
                  )
                })}
              </div>
              {newUser.teamIds.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Select at least one team</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Role</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}
                className="select-arrow-padded w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={!newUser.name.trim() || newUser.teamIds.length === 0} className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50">
                Add user
              </button>
              <button type="button" onClick={() => setShowAddUser(false)} className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm">
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {editingUser && (
        <EditUserDrawer
          user={editingUser}
          teams={teams}
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
