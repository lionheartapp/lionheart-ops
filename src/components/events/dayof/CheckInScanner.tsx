'use client'

/**
 * CheckInScanner — full-screen QR scanner for day-of check-in.
 *
 * Layout: top 50% = camera viewfinder, bottom 50% = ParticipantFlashCard or
 * waiting state. Auto-resets after 3 seconds for back-to-back scanning.
 * Provides audio (Web Audio API tone) and haptic (navigator.vibrate) feedback.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { List, WifiOff, Loader2, QrCode } from 'lucide-react'
import ParticipantFlashCard, { type ParticipantFlashCardData } from './ParticipantFlashCard'
import type { UseCheckInReturn } from '@/lib/hooks/useCheckIn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckInScannerProps {
  eventProjectId: string
  useCheckInData: UseCheckInReturn
  hasMedicalPermission: boolean
  onSwitchToList: () => void
}

// ─── URL pattern ──────────────────────────────────────────────────────────────

const CHECKIN_URL_PATTERN = /\/events\/check-in\/([a-z0-9]+)/i

// ─── Audio feedback ───────────────────────────────────────────────────────────

function playSuccessBeep() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  } catch {
    // Audio not available — fail silently
  }
}

function triggerHaptic() {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(200)
    }
  } catch {
    // Haptic not available — fail silently
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CheckInScanner({
  eventProjectId,
  useCheckInData,
  hasMedicalPermission,
  onSwitchToList,
}: CheckInScannerProps) {
  const { counter, isOnline, pendingSync, checkIn } = useCheckInData

  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const [scannedParticipant, setScannedParticipant] = useState<ParticipantFlashCardData | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const autoResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Scanner lifecycle ───────────────────────────────────────────────

  const resetToScanning = useCallback(() => {
    setScannedParticipant(null)
    setScanError(null)
  }, [])

  const handleSuccessfulScan = useCallback(
    async (decodedText: string) => {
      // Prevent re-processing while showing result
      if (scannedParticipant) return

      const match = decodedText.match(CHECKIN_URL_PATTERN)
      if (!match) {
        setScanError('Not a valid check-in QR code.')
        return
      }

      const registrationId = match[1]
      setScanError(null)
      setIsScanning(true)

      try {
        playSuccessBeep()
        triggerHaptic()

        const result = await checkIn(registrationId, 'QR_SCAN')

        if (result.participant) {
          setScannedParticipant({
            registrationId: result.participant.registrationId,
            firstName: result.participant.firstName,
            lastName: result.participant.lastName,
            photoUrl: result.participant.photoUrl,
            grade: result.participant.grade,
            groups: result.participant.groups,
            medical: result.participant.medical,
            checkInStatus: {
              isCheckedIn: result.participant.checkInStatus.isCheckedIn,
              checkedInAt: result.participant.checkInStatus.checkedInAt,
            },
            alreadyCheckedIn: result.alreadyCheckedIn,
            fromCache: result.fromCache,
          })

          // Auto-reset to scanning after 3 seconds
          autoResetRef.current = setTimeout(() => {
            resetToScanning()
          }, 3_000)
        } else {
          setScanError('Participant not found in this event.')
        }
      } catch {
        setScanError('Check-in failed. Try again.')
      } finally {
        setIsScanning(false)
      }
    },
    [scannedParticipant, checkIn, resetToScanning]
  )

  useEffect(() => {
    const containerId = 'checkin-scanner-viewport'

    const scanner = new Html5QrcodeScanner(
      containerId,
      {
        fps: 15,
        qrbox: { width: 240, height: 240 },
        rememberLastUsedCamera: true,
        showTorchButtonIfSupported: true,
        aspectRatio: 1.0,
      },
      false
    )

    scannerRef.current = scanner

    scanner.render(
      (decodedText) => {
        void handleSuccessfulScan(decodedText)
      },
      (errMsg) => {
        // Suppress routine scan-miss errors
        if (errMsg.includes('NotFoundException') || errMsg.includes('No MultiFormat Readers')) return
      }
    )

    return () => {
      scanner.clear().catch(() => {})
      if (autoResetRef.current) clearTimeout(autoResetRef.current)
    }
  }, [handleSuccessfulScan])

  // ─── Progress bar ────────────────────────────────────────────────────

  const progressPct = counter.total > 0 ? Math.round((counter.checkedIn / counter.total) * 100) : 0

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* ── Header bar ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold">
            {counter.checkedIn} / {counter.total} checked in
          </div>
          {/* Mini progress bar */}
          <div className="w-24 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, #3B82F6, #6366F1)',
              }}
            />
          </div>
        </div>

        {/* Switch to list */}
        <button
          onClick={onSwitchToList}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors text-xs font-medium cursor-pointer"
        >
          <List className="w-3.5 h-3.5" />
          List
        </button>
      </div>

      {/* ── Offline banner ── */}
      {!isOnline && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium flex-shrink-0">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span>Offline mode — check-ins will sync when connected</span>
          {pendingSync > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-amber-800 rounded-full text-xs">
              {pendingSync} pending
            </span>
          )}
        </div>
      )}

      {/* ── Camera viewfinder (top half) ── */}
      <div className="flex-1 relative min-h-0 bg-black">
        <div id="checkin-scanner-viewport" className="w-full h-full" />

        {/* Loading overlay */}
        {isScanning && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          </div>
        )}
      </div>

      {/* ── Bottom half: flash card or waiting state ── */}
      <div className="flex-1 relative overflow-hidden flex flex-col justify-end min-h-0">
        <AnimatePresence mode="wait">
          {scannedParticipant ? (
            <ParticipantFlashCard
              key={scannedParticipant.registrationId}
              participant={scannedParticipant}
              hasMedicalPermission={hasMedicalPermission}
            />
          ) : (
            <div key="waiting" className="flex flex-col items-center justify-center h-full gap-3 py-6 px-4">
              {scanError ? (
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-red-900/30 flex items-center justify-center mx-auto mb-2">
                    <QrCode className="w-6 h-6 text-red-400" />
                  </div>
                  <p className="text-red-400 text-sm font-medium">{scanError}</p>
                  <button
                    onClick={resetToScanning}
                    className="mt-2 text-xs text-gray-400 hover:text-gray-200 cursor-pointer"
                  >
                    Tap to try again
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-2">
                    <QrCode className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-gray-400 text-sm">Point camera at participant QR code</p>
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
