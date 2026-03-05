'use client'

import SportIcon from '@/components/athletics/SportIcon'

interface BracketTeam {
  id: string
  name: string
  sport: { name: string; color: string }
}

interface Bracket {
  id: string
  tournamentId: string
  round: number
  matchNumber: number
  team1Id: string | null
  team2Id: string | null
  winnerId: string | null
  team1: BracketTeam | null
  team2: BracketTeam | null
  winner: BracketTeam | null
}

interface RoundRobinGridProps {
  brackets: Bracket[]
  onMatchClick: (bracket: Bracket) => void
}

export default function RoundRobinGrid({ brackets, onMatchClick }: RoundRobinGridProps) {
  if (brackets.length === 0) return null

  // Collect unique teams
  const teamMap = new Map<string, BracketTeam>()
  for (const b of brackets) {
    if (b.team1) teamMap.set(b.team1.id, b.team1)
    if (b.team2) teamMap.set(b.team2.id, b.team2)
  }
  const teams = Array.from(teamMap.values())

  // Build lookup: pair key → bracket
  const matchLookup = new Map<string, Bracket>()
  for (const b of brackets) {
    if (b.team1Id && b.team2Id) {
      matchLookup.set(`${b.team1Id}-${b.team2Id}`, b)
      matchLookup.set(`${b.team2Id}-${b.team1Id}`, b)
    }
  }

  // Calculate standings
  const standings: Record<string, { wins: number; losses: number; played: number }> = {}
  for (const t of teams) {
    standings[t.id] = { wins: 0, losses: 0, played: 0 }
  }
  for (const b of brackets) {
    if (!b.winnerId) continue
    if (b.team1Id) standings[b.team1Id].played++
    if (b.team2Id) standings[b.team2Id].played++
    standings[b.winnerId].wins++
    const loserId = b.winnerId === b.team1Id ? b.team2Id : b.team1Id
    if (loserId) standings[loserId].losses++
  }

  const sortedTeams = [...teams].sort((a, b) => {
    const sa = standings[a.id]
    const sb = standings[b.id]
    if (sb.wins !== sa.wins) return sb.wins - sa.wins
    return sa.losses - sb.losses
  })

  return (
    <div className="space-y-6">
      {/* Mobile: per-team card list */}
      <div className="sm:hidden space-y-3">
        {sortedTeams.map((team) => {
          const s = standings[team.id]
          return (
            <div key={team.id} className="ui-glass p-4 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <SportIcon sport={team.sport?.name || ''} size={14} style={{ color: team.sport?.color || '#6b7280' }} className="flex-shrink-0" />
                  <span className="font-medium text-gray-900 text-sm">{team.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-green-700 font-semibold">{s.wins}W</span>
                  <span className="text-red-600">{s.losses}L</span>
                </div>
              </div>
              <div className="space-y-1">
                {teams.filter((t) => t.id !== team.id).map((opponent) => {
                  const match = matchLookup.get(`${team.id}-${opponent.id}`)
                  if (!match) return null
                  const isWinner = match.winnerId === team.id
                  const isLoser = match.winnerId && match.winnerId !== team.id
                  const hasResult = Boolean(match.winnerId)
                  return (
                    <div
                      key={opponent.id}
                      className="flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => onMatchClick(match)}
                    >
                      <span className="text-sm text-gray-600">vs {opponent.name}</span>
                      {hasResult ? (
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${isWinner ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {isWinner ? 'W' : 'L'}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop: Grid */}
      <div className="overflow-x-auto -mx-4 px-4 hidden sm:block">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 sticky left-0 z-10">
                Team
              </th>
              {teams.map((t) => (
                <th
                  key={t.id}
                  className="px-3 py-2 text-center text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 min-w-[100px]"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <SportIcon sport={t.sport?.name || ''} size={12} style={{ color: t.sport?.color || '#6b7280' }} className="flex-shrink-0" />
                    <span className="truncate">{t.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map((rowTeam) => (
              <tr key={rowTeam.id}>
                <td className="px-3 py-2.5 font-medium text-gray-900 bg-white border border-gray-200 sticky left-0 z-10 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <SportIcon sport={rowTeam.sport?.name || ''} size={14} style={{ color: rowTeam.sport?.color || '#6b7280' }} className="flex-shrink-0" />
                    {rowTeam.name}
                  </div>
                </td>
                {teams.map((colTeam) => {
                  if (rowTeam.id === colTeam.id) {
                    return (
                      <td key={colTeam.id} className="px-3 py-2.5 text-center bg-gray-100 border border-gray-200">
                        <span className="text-gray-300">&mdash;</span>
                      </td>
                    )
                  }

                  const match = matchLookup.get(`${rowTeam.id}-${colTeam.id}`)
                  if (!match) {
                    return (
                      <td key={colTeam.id} className="px-3 py-2.5 text-center border border-gray-200 text-gray-300">
                        &mdash;
                      </td>
                    )
                  }

                  const isWinner = match.winnerId === rowTeam.id
                  const isLoser = match.winnerId && match.winnerId !== rowTeam.id
                  const hasResult = Boolean(match.winnerId)

                  return (
                    <td
                      key={colTeam.id}
                      onClick={() => onMatchClick(match)}
                      className={`px-3 py-2.5 text-center border border-gray-200 cursor-pointer transition-colors ${
                        isWinner
                          ? 'bg-green-50 text-green-700 font-semibold hover:bg-green-100'
                          : isLoser
                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                            : 'hover:bg-gray-50 text-gray-400'
                      }`}
                    >
                      {hasResult ? (isWinner ? 'W' : 'L') : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Standings */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Standings</h4>
        <div className="ui-glass-table">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Team</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">W</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">L</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">GP</th>
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map((team, idx) => {
                const s = standings[team.id]
                return (
                  <tr key={team.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-400 font-medium">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <SportIcon sport={team.sport?.name || ''} size={14} style={{ color: team.sport?.color || '#6b7280' }} className="flex-shrink-0" />
                        {team.name}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center text-green-700 font-semibold">{s.wins}</td>
                    <td className="px-3 py-2 text-center text-red-600">{s.losses}</td>
                    <td className="px-3 py-2 text-center text-gray-500">{s.played}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
