'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Square } from 'lucide-react'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimerState {
  ticketId: string
  startTime: string // ISO string
  technicianId: string
}

interface LaborTimerButtonProps {
  ticketId: string
  currentUserId: string
  /** Called after a successful timer stop (labor entry created). */
  onEntryCreated?: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStorageKey(ticketId: string) {
  return `labor-timer:${ticketId}`
}

function loadTimerState(ticketId: string): TimerState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(getStorageKey(ticketId))
    if (!raw) return null
    return JSON.parse(raw) as TimerState
  } catch {
    return null
  }
}

function saveTimerState(state: TimerState) {
  localStorage.setItem(getStorageKey(state.ticketId), JSON.stringify(state))
}

function clearTimerState(ticketId: string) {
  localStorage.removeItem(getStorageKey(ticketId))
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LaborTimerButton({
  ticketId,
  currentUserId,
  onEntryCreated,
}: LaborTimerButtonProps) {
  const [timerState, setTimerState] = useState<TimerState | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isStopping, setIsStopping] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load persisted timer on mount
  useEffect(() => {
    const persisted = loadTimerState(ticketId)
    if (persisted) {
      setTimerState(persisted)
      const elapsed = Math.floor(
        (Date.now() - new Date(persisted.startTime).getTime()) / 1000
      )
      setElapsedSeconds(Math.max(0, elapsed))
    }
  }, [ticketId])

  // Tick interval while timer is running
  useEffect(() => {
    if (timerState) {
      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor(
          (Date.now() - new Date(timerState.startTime).getTime()) / 1000
        )
        setElapsedSeconds(Math.max(0, elapsed))
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [timerState])

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const handleStart = useCallback(() => {
    const state: TimerState = {
      ticketId,
      startTime: new Date().toISOString(),
      technicianId: currentUserId,
    }
    saveTimerState(state)
    setTimerState(state)
    setElapsedSeconds(0)
  }, [ticketId, currentUserId])

  const handleStop = useCallback(async () => {
    if (!timerState || isStopping) return
    setIsStopping(true)

    const endTime = new Date().toISOString()
    const startDate = new Date(timerState.startTime)
    const endDate = new Date(endTime)
    const minutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60))

    try {
      await fetchApi(`/api/maintenance/tickets/${ticketId}/labor`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          technicianId: timerState.technicianId,
          startTime: timerState.startTime,
          endTime,
        }),
      })

      clearTimerState(ticketId)
      setTimerState(null)
      setElapsedSeconds(0)

      const hrs = Math.floor(minutes / 60)
      const mins = minutes % 60
      const durationLabel = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
      setToast(`Labor entry created — ${durationLabel}`)
      onEntryCreated?.()
    } catch (err) {
      console.error('[LaborTimerButton] Failed to create labor entry:', err)
      setToast('Failed to save entry — please try again')
    } finally {
      setIsStopping(false)
    }
  }, [timerState, isStopping, ticketId, onEntryCreated])

  const isRunning = timerState !== null

  return (
    <div className="relative">
      {/* Toast notification */}
      {toast && (
        <div className="absolute bottom-full mb-2 left-0 right-0 z-10 flex justify-center pointer-events-none">
          <div className="bg-gray-900/90 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
            {toast}
          </div>
        </div>
      )}

      <button
        onClick={isRunning ? handleStop : handleStart}
        disabled={isStopping}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.97] ${
          isRunning
            ? 'bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 hover:border-red-300'
            : 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm'
        }`}
        title={isRunning ? 'Stop timer and save labor entry' : 'Start tracking time on this ticket'}
      >
        {isRunning ? (
          <>
            <Square className="w-3.5 h-3.5 fill-red-600 text-red-600" />
            <span>Stop Timer</span>
            <span className={`ml-1 font-mono text-xs tabular-nums ${isStopping ? '' : 'animate-pulse'}`}>
              {formatElapsed(elapsedSeconds)}
            </span>
          </>
        ) : (
          <>
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Start Timer</span>
          </>
        )}
      </button>
    </div>
  )
}
