'use client'

import { useEffect, useState, useCallback } from 'react'
import { ArrowLeft, RefreshCw, ListOrdered } from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'
import ConfirmDialog from '@/components/ConfirmDialog'
import MatchResultDialog from '@/components/athletics/MatchResultDialog'
import SingleEliminationBracket from '@/components/athletics/SingleEliminationBracket'
import RoundRobinGrid from '@/components/athletics/RoundRobinGrid'

interface BracketTeam {
  id: string
  name: string
  level?: string
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

interface Tournament {
  id: string
  name: string
  sportId: string
  format: string
  startDate: string
  endDate: string
  sport: { id: string; name: string; color: string }
  brackets: Bracket[]
}

interface Team {
  id: string
  name: string
  level: string
  sport: { id: string; name: string; color: string }
  season: { id: string; name: string }
}

interface TournamentDetailProps {
  tournamentId: string
  onBack: () => void
}

const FORMAT_LABELS: Record<string, string> = {
  SINGLE_ELIMINATION: 'Single Elimination',
  DOUBLE_ELIMINATION: 'Double Elimination',
  ROUND_ROBIN: 'Round Robin',
  POOL_PLAY: 'Pool Play',
}

export default function TournamentDetail({ tournamentId, onBack }: TournamentDetailProps) {
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [showRegenConfirm, setShowRegenConfirm] = useState(false)
  const [matchDialogMatch, setMatchDialogMatch] = useState<Bracket | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const fetchTournament = useCallback(async () => {
    try {
      const res = await fetch(`/api/athletics/tournaments/${tournamentId}`, { headers: { Authorization: `Bearer ${token}` } })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (data.ok) setTournament(data.data)
    } catch {
      setError('Failed to load tournament')
    } finally {
      setLoading(false)
    }
  }, [tournamentId, token])

  const fetchTeams = useCallback(async () => {
    if (!tournament?.sportId) return
    try {
      const res = await fetch(`/api/athletics/teams?sportId=${tournament.sportId}`, { headers: { Authorization: `Bearer ${token}` } })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (data.ok) setTeams(data.data)
    } catch { /* ignore */ }
  }, [tournament?.sportId, token])

  useEffect(() => { fetchTournament() }, [fetchTournament])
  useEffect(() => { fetchTeams() }, [fetchTeams])

  const hasBrackets = tournament && tournament.brackets.length > 0

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds((prev) => {
      const next = new Set(prev)
      if (next.has(teamId)) next.delete(teamId)
      else next.add(teamId)
      return next
    })
  }

  const selectAll = () => {
    if (selectedTeamIds.size === teams.length) {
      setSelectedTeamIds(new Set())
    } else {
      setSelectedTeamIds(new Set(teams.map((t) => t.id)))
    }
  }

  const handleGenerate = async () => {
    if (selectedTeamIds.size < 2) return
    setGenerating(true)
    setError('')
    try {
      const res = await fetch(`/api/athletics/tournaments/${tournamentId}/brackets`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ teamIds: Array.from(selectedTeamIds) }),
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!data.ok) { setError(data.error?.message || 'Failed to generate'); return }
      await fetchTournament()
    } catch {
      setError('Something went wrong')
    } finally {
      setGenerating(false)
    }
  }

  const handleRegenerate = async () => {
    setShowRegenConfirm(false)
    await handleGenerate()
  }

  const handleMatchSaved = () => {
    fetchTournament()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-500">Tournament not found</p>
        <button onClick={onBack} className="mt-2 text-sm text-primary-600 hover:text-primary-700">
          Go back
        </button>
      </div>
    )
  }

  const startDate = new Date(tournament.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endDate = new Date(tournament.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div>
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <button
          onClick={onBack}
          className="mt-0.5 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-semibold text-gray-900">{tournament.name}</h2>
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor: `${tournament.sport.color}15`,
                color: tournament.sport.color,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tournament.sport.color }} />
              {tournament.sport.name}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              {FORMAT_LABELS[tournament.format] || tournament.format}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{startDate} – {endDate}</p>
        </div>

        {hasBrackets && (
          <button
            onClick={() => setShowRegenConfirm(true)}
            disabled={generating || selectedTeamIds.size < 2}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Regenerate
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>
      )}

      {/* Team picker (show when no brackets OR for regeneration) */}
      {!hasBrackets && (
        <div className="mb-6">
          {/* Setup steps guide */}
          <div className="flex items-center gap-6 mb-5 text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                teams.length > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>1</span>
              <span className={teams.length > 0 ? 'text-green-700 font-medium' : ''}>Teams available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                selectedTeamIds.size >= 2 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>2</span>
              <span className={selectedTeamIds.size >= 2 ? 'text-green-700 font-medium' : ''}>Select 2+ teams</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-[10px] font-bold">3</span>
              <span>Generate bracket</span>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Select Teams</h3>
            {teams.length > 0 && (
              <button onClick={selectAll} className="text-xs text-primary-600 hover:text-primary-700">
                {selectedTeamIds.size === teams.length ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>

          {teams.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
              <p className="text-sm text-gray-500 mb-1">No teams found for this sport</p>
              <p className="text-xs text-gray-400">
                Create teams in the <span className="font-medium text-gray-600">Teams</span> tab first, then come back to set up the bracket.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                {teams.map((team) => {
                  const checked = selectedTeamIds.has(team.id)
                  return (
                    <label
                      key={team.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition ${
                        checked
                          ? 'border-primary-300 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTeam(team.id)}
                        className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                      />
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: team.sport?.color || '#6b7280' }}
                        />
                        <span className="text-sm text-gray-900 truncate">{team.name}</span>
                        <span className="text-xs text-gray-400">{team.season?.name}</span>
                      </div>
                    </label>
                  )
                })}
              </div>

              <button
                onClick={handleGenerate}
                disabled={generating || selectedTeamIds.size < 2}
                className="px-4 py-2.5 text-sm font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
              >
                {generating ? 'Generating...' : `Generate Bracket (${selectedTeamIds.size} teams)`}
              </button>
            </>
          )}
        </div>
      )}

      {/* Bracket visualization */}
      {hasBrackets && (
        <div>
          {tournament.format === 'SINGLE_ELIMINATION' && (
            <SingleEliminationBracket
              brackets={tournament.brackets}
              onMatchClick={setMatchDialogMatch}
            />
          )}

          {tournament.format === 'ROUND_ROBIN' && (
            <RoundRobinGrid
              brackets={tournament.brackets}
              onMatchClick={setMatchDialogMatch}
            />
          )}

          {(tournament.format === 'DOUBLE_ELIMINATION' || tournament.format === 'POOL_PLAY') && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 italic flex items-center gap-1.5">
                <ListOrdered className="w-4 h-4" />
                Grouped match list view
              </p>
              {/* Group by round */}
              {Array.from(new Set(tournament.brackets.map((b) => b.round)))
                .sort((a, b) => a - b)
                .map((round) => {
                  const roundMatches = tournament.brackets.filter((b) => b.round === round)
                  return (
                    <div key={round}>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Round {round}
                      </h4>
                      <div className="space-y-1">
                        {roundMatches.map((match) => (
                          <button
                            key={match.id}
                            onClick={() => setMatchDialogMatch(match)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition ${
                              match.winnerId
                                ? 'border-green-200 bg-green-50'
                                : 'border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-3 text-sm">
                              <span className={match.winnerId === match.team1Id ? 'font-semibold text-green-700' : 'text-gray-700'}>
                                {match.team1?.name || 'TBD'}
                              </span>
                              <span className="text-xs text-gray-400">vs</span>
                              <span className={match.winnerId === match.team2Id ? 'font-semibold text-green-700' : 'text-gray-700'}>
                                {match.team2?.name || 'TBD'}
                              </span>
                            </div>
                            {match.winner && (
                              <span className="text-xs text-green-600 font-medium">
                                Winner: {match.winner.name}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {/* Regenerate confirm */}
      <ConfirmDialog
        isOpen={showRegenConfirm}
        onClose={() => setShowRegenConfirm(false)}
        onConfirm={handleRegenerate}
        title="Regenerate Bracket"
        message="This will delete the current bracket and all results. This cannot be undone."
        confirmText="Regenerate"
        variant="warning"
        isLoading={generating}
        loadingText="Regenerating..."
      />

      {/* Match result dialog */}
      <MatchResultDialog
        isOpen={matchDialogMatch !== null}
        onClose={() => setMatchDialogMatch(null)}
        onSaved={handleMatchSaved}
        match={matchDialogMatch}
      />
    </div>
  )
}
