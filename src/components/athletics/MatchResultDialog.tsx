'use client'

import { useState, useEffect } from 'react'
import { X, Trophy, RotateCcw } from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import { GlassSportTile } from '@/components/athletics/SportIcon'

interface BracketMatch {
  id: string
  tournamentId: string
  round: number
  matchNumber: number
  team1Id: string | null
  team2Id: string | null
  winnerId: string | null
  team1: { id: string; name: string; sport: { color: string; name?: string } } | null
  team2: { id: string; name: string; sport: { color: string; name?: string } } | null
  winner: { id: string; name: string } | null
}

interface MatchResultDialogProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  match: BracketMatch | null
}

export default function MatchResultDialog({ isOpen, onClose, onSaved, match }: MatchResultDialogProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const focusTrapRef = useFocusTrap(isOpen)

  useEffect(() => {
    if (isOpen) setError('')
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen || !match) return null

  const canPickWinner = match.team1Id && match.team2Id

  const handleSelectWinner = async (winnerId: string) => {
    setSaving(true)
    setError('')
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch(`/api/athletics/tournaments/${match.tournamentId}/brackets/${match.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ winnerId }),
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!data.ok) { setError(data.error?.message || 'Failed to set winner'); return }
      onSaved()
      onClose()
    } catch {
      setError('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    setSaving(true)
    setError('')
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch(`/api/athletics/tournaments/${match.tournamentId}/brackets/${match.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clear: true }),
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!data.ok) { setError(data.error?.message || 'Failed to clear result'); return }
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
          aria-labelledby="match-result-title"
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
            <h3 id="match-result-title" className="text-lg font-semibold text-gray-900 mb-1">
              Select Winner
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              Round {match.round}, Match {match.matchNumber}
            </p>

            {!canPickWinner ? (
              <p className="text-sm text-gray-400 italic">
                Both teams must be set before picking a winner.
              </p>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => handleSelectWinner(match.team1Id!)}
                  disabled={saving}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition ${
                    match.winnerId === match.team1Id
                      ? 'border-green-300 bg-green-50 ring-1 ring-green-200'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  } disabled:opacity-50`}
                >
                  <GlassSportTile sport={match.team1?.sport?.name || ''} color={match.team1?.sport?.color || '#6b7280'} size="sm" />
                  <span className="text-sm font-medium text-gray-900 flex-1">{match.team1?.name || 'TBD'}</span>
                  {match.winnerId === match.team1Id && <Trophy className="w-4 h-4 text-green-600" />}
                </button>

                <div className="text-center text-xs font-medium text-gray-400">vs</div>

                <button
                  onClick={() => handleSelectWinner(match.team2Id!)}
                  disabled={saving}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition ${
                    match.winnerId === match.team2Id
                      ? 'border-green-300 bg-green-50 ring-1 ring-green-200'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  } disabled:opacity-50`}
                >
                  <GlassSportTile sport={match.team2?.sport?.name || ''} color={match.team2?.sport?.color || '#6b7280'} size="sm" />
                  <span className="text-sm font-medium text-gray-900 flex-1">{match.team2?.name || 'TBD'}</span>
                  {match.winnerId === match.team2Id && <Trophy className="w-4 h-4 text-green-600" />}
                </button>
              </div>
            )}

            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              {match.winnerId && (
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
