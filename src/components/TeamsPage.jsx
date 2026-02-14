import { useState } from 'react'
import { Building2, Plus } from 'lucide-react'
import { canManageTeams } from '../data/teamsData'

export default function TeamsPage({ teams = [], setTeams, currentUser }) {
  const [newTeamName, setNewTeamName] = useState('')

  const canManage = canManageTeams(currentUser)
  const safeTeams = Array.isArray(teams) ? teams : []

  const handleAddTeam = (e) => {
    e.preventDefault()
    const name = newTeamName.trim()
    if (!name) return
    const id = name.toLowerCase().replace(/\s+/g, '-')
    if (safeTeams.some((t) => t.id === id)) return
    setTeams((prev) => [...prev, { id, name }])
    setNewTeamName('')
  }

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Teams
      </h2>

      {/* Teams */}
      <section className="glass-card overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 dark:border-blue-950/40 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-500" />
            Teams
          </h3>
          {canManage && (
            <form onSubmit={handleAddTeam} className="flex gap-2">
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="New team name"
                className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm w-40 focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="p-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-700 dark:divide-blue-950/30">
          {safeTeams.map((t) => (
            <li key={t.id} className="px-4 py-3 text-zinc-800 dark:text-zinc-200">
              {t.name}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
