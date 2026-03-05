'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'

interface Game {
  id: string
  opponentName: string
  homeAway: string
  startTime: string
  endTime: string
  venue: string | null
  homeScore: number | null
  awayScore: number | null
  isFinal: boolean
  athleticTeamId: string
  athleticTeam?: { id: string; name: string; sport: { name: string; color: string } }
}

interface ScoreDialogProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  game: Game | null
  onOpenPlayerStats?: (game: Game) => void
}

export default function ScoreDialog({ isOpen, onClose, onSaved, game, onOpenPlayerStats }: ScoreDialogProps) {
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [isFinal, setIsFinal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const focusTrapRef = useFocusTrap(isOpen)

  useEffect(() => {
    if (isOpen && game) {
      setHomeScore(game.homeScore != null ? String(game.homeScore) : '')
      setAwayScore(game.awayScore != null ? String(game.awayScore) : '')
      setIsFinal(game.isFinal || false)
      setError('')
    }
  }, [isOpen, game])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen || !game) return null

  const handleSave = async () => {
    const h = parseInt(homeScore, 10)
    const a = parseInt(awayScore, 10)
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      setError('Enter valid scores (0 or greater)')
      return
    }

    setSaving(true)
    setError('')

    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch(`/api/athletics/games/${game.id}/score`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ homeScore: h, awayScore: a, isFinal }),
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!data.ok) { setError(data.error?.message || 'Failed to save score'); return }
      onSaved()
      onClose()
    } catch {
      setError('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-modal overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity cursor-pointer"
        onClick={onClose}
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={focusTrapRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="score-dialog-title"
          className="relative w-full max-w-sm transform overflow-hidden rounded-xl border border-gray-200 bg-white shadow-heavy transition-all"
        >
          <button
            onClick={onClose}
            className="absolute right-3 top-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6">
            <h3 id="score-dialog-title" className="text-lg font-semibold text-gray-900 mb-1">
              Enter Score
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              {game.athleticTeam?.name} vs {game.opponentName}
            </p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Home Score</label>
                <input
                  type="number"
                  min="0"
                  value={homeScore}
                  onChange={(e) => setHomeScore(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900/10 text-center text-lg font-semibold"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Away Score</label>
                <input
                  type="number"
                  min="0"
                  value={awayScore}
                  onChange={(e) => setAwayScore(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900/10 text-center text-lg font-semibold"
                  placeholder="0"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 mb-5 cursor-pointer">
              <input
                type="checkbox"
                checked={isFinal}
                onChange={(e) => setIsFinal(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Mark as final</span>
            </label>

            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-full hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-gray-900 rounded-full hover:bg-gray-800 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Score'}
              </button>
            </div>

            {onOpenPlayerStats && game && (
              <button
                type="button"
                onClick={() => { onClose(); onOpenPlayerStats(game) }}
                className="w-full mt-2 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition text-center"
              >
                Enter Player Stats
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
