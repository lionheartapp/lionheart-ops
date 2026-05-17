'use client'

import { use, useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Camera, Keyboard, CheckCircle2, XCircle, AlertTriangle, RotateCcw, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import { Input } from '@/components/ui/Input'

// ─── Types ─────────────────────────────────────────────────────────────────

interface VerifyResult {
  status: 'CHECKED_IN' | 'ALREADY_USED' | 'CANCELLED' | 'NOT_FOUND'
  ticketCode?: string
  buyerName?: string
  ticketType?: string
  checkedInAt?: string | null
}

interface CheckInStats {
  totalTickets: number
  checkedIn: number
}

// ─── Scan Result Flash ─────────────────────────────────────────────────────

function ScanResult({ result, onReset }: { result: VerifyResult; onReset: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onReset, 4000)
    return () => clearTimeout(timer)
  }, [onReset])

  if (result.status === 'CHECKED_IN') {
    return (
      <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 text-center animate-in fade-in zoom-in duration-200">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
        <p className="text-lg font-bold text-emerald-900">{result.buyerName}</p>
        <p className="text-sm text-emerald-700 mt-1">{result.ticketType}</p>
        <p className="text-xs text-emerald-600 mt-2 font-mono">{result.ticketCode}</p>
      </div>
    )
  }

  if (result.status === 'ALREADY_USED') {
    return (
      <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 text-center animate-in fade-in zoom-in duration-200">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <p className="text-lg font-bold text-amber-900">Already Checked In</p>
        <p className="text-sm text-amber-700 mt-1">{result.buyerName} — {result.ticketType}</p>
        {result.checkedInAt && (
          <p className="text-xs text-amber-600 mt-2">
            Checked in at {new Date(result.checkedInAt).toLocaleTimeString()}
          </p>
        )}
      </div>
    )
  }

  if (result.status === 'CANCELLED') {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 text-center animate-in fade-in zoom-in duration-200">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-lg font-bold text-red-900">Ticket Cancelled</p>
        <p className="text-sm text-red-700 mt-1">{result.buyerName}</p>
      </div>
    )
  }

  return (
    <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 text-center animate-in fade-in zoom-in duration-200">
      <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
      <p className="text-lg font-bold text-red-900">Ticket Not Found</p>
      <p className="text-sm text-red-600 mt-1">{"The scanned code doesn't match any ticket."}</p>
    </div>
  )
}

// ─── QR Scanner (Camera) ───────────────────────────────────────────────────

function QRScanner({ onScan, active }: { onScan: (code: string) => void; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)
  const [hasCamera, setHasCamera] = useState(true)
  const [loading, setLoading] = useState(true)

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setLoading(false)
    } catch {
      setHasCamera(false)
      setLoading(false)
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }, [])

  // Scan loop using BarcodeDetector API (available in Chrome, Edge, Safari)
  const scanLoop = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !active) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationRef.current = requestAnimationFrame(scanLoop)
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    try {
      // Use BarcodeDetector if available
      if ('BarcodeDetector' in window) {
        // BarcodeDetector is not yet in TypeScript's lib.dom — access via indexing
        const BarcodeDetectorCtor = (window as unknown as Record<string, new (opts: { formats: string[] }) => { detect: (source: HTMLCanvasElement) => Promise<Array<{ rawValue: string }>> }>).BarcodeDetector
        const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] })
        const barcodes = await detector.detect(canvas)
        if (barcodes.length > 0) {
          const url = barcodes[0].rawValue
          // Extract ticket code from URL: .../verify or .../tickets/TKT-XXXX-YYYY
          const match = url.match(/TKT-[A-Z0-9]{4}-[A-Z0-9]{4}/) || url.match(/tickets\/([^/]+)/)
          if (match) {
            const code = match[0].startsWith('TKT-') ? match[0] : match[1]
            onScan(code)
            return // stop scanning after a hit
          }
        }
      }
    } catch {
      // BarcodeDetector not supported or failed — fall through
    }

    animationRef.current = requestAnimationFrame(scanLoop)
  }, [active, onScan])

  useEffect(() => {
    if (active) {
      startCamera()
    }
    return () => stopCamera()
  }, [active, startCamera, stopCamera])

  useEffect(() => {
    if (active && !loading && hasCamera) {
      animationRef.current = requestAnimationFrame(scanLoop)
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [active, loading, hasCamera, scanLoop])

  if (!hasCamera) {
    return (
      <div className="bg-slate-100 rounded-xl p-8 text-center">
        <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-600">Camera not available</p>
        <p className="text-xs text-slate-400 mt-1">Use manual entry below instead</p>
      </div>
    )
  }

  return (
    <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
          <Loader2 className="w-6 h-6 text-white animate-spin" />
        </div>
      )}
      <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />
      {/* Scan target overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-48 h-48 border-2 border-white/50 rounded-2xl" />
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function CheckInPage({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = use(params)
  const [mode, setMode] = useState<'camera' | 'manual'>('camera')
  const [manualCode, setManualCode] = useState('')
  const [scanResult, setScanResult] = useState<VerifyResult | null>(null)
  const [scanning, setScanning] = useState(false)

  // Fetch check-in stats
  const { data: stats, refetch: refetchStats } = useQuery<CheckInStats>({
    queryKey: ['check-in-stats', formId],
    queryFn: async () => {
      const data = await fetchApi<{ summary: { totalTicketsSold: number; checkedIn: number } }>(`/api/forms/${formId}/orders`)
      return { totalTickets: data.summary.totalTicketsSold, checkedIn: data.summary.checkedIn }
    },
    refetchInterval: 10_000,
  })

  async function verifyTicket(code: string) {
    if (scanning) return
    setScanning(true)
    setScanResult(null)

    try {
      const res = await fetch(`/api/event-tickets/${code}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const json = await res.json()

      if (!json.ok) {
        setScanResult({ status: 'NOT_FOUND' })
      } else {
        setScanResult(json.data as VerifyResult)
        refetchStats()
      }
    } catch {
      setScanResult({ status: 'NOT_FOUND' })
    } finally {
      setScanning(false)
      setManualCode('')
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!manualCode.trim()) return
    verifyTicket(manualCode.trim())
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-md mx-auto px-4 py-6 space-y-5">

        {/* Header + stats */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">Check-In</h1>
          {stats && (
            <div className="text-right">
              <p className="text-lg font-bold text-slate-900">{stats.checkedIn} / {stats.totalTickets}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Checked in</p>
            </div>
          )}
        </div>

        {/* Mode toggle */}
        <div className="flex bg-slate-100 rounded-full p-1">
          <button
            type="button"
            onClick={() => setMode('camera')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-full transition-colors cursor-pointer ${
              mode === 'camera' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            <Camera className="w-3.5 h-3.5" /> Scan QR
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-full transition-colors cursor-pointer ${
              mode === 'manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" /> Manual Entry
          </button>
        </div>

        {/* Scan result flash */}
        {scanResult && (
          <ScanResult result={scanResult} onReset={() => setScanResult(null)} />
        )}

        {/* Camera scanner */}
        {mode === 'camera' && !scanResult && (
          <QRScanner onScan={verifyTicket} active={mode === 'camera' && !scanResult} />
        )}

        {/* Manual entry */}
        {mode === 'manual' && !scanResult && (
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              placeholder="TKT-XXXX-YYYY"
              autoFocus
            />
            <button
              type="submit"
              disabled={!manualCode.trim() || scanning}
              className="w-full py-3 text-sm font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
            >
              {scanning ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Check In'}
            </button>
          </form>
        )}

        {/* Reset after scan result */}
        {scanResult && (
          <button
            type="button"
            onClick={() => setScanResult(null)}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> Scan Next Ticket
          </button>
        )}
      </div>
    </div>
  )
}
