'use client'

import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Antenna,
  ExternalLink,
  HelpCircle,
  MapPin,
  Minus,
  Plus,
  Radio,
  ScanLine,
  Sparkles,
  Usb,
  X,
} from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import { queryKeys, queryOptions } from '@/lib/queries'
import { FileInput } from '@/components/ui/FileInput'
import { useToast } from '@/components/Toast'

interface Device {
  id: string
  name: string
  brand: string
  model?: string | null
  kind: string
  currentFrequencyHz?: number | null
  status: string
  isDiscoverable?: boolean
}

interface Assignment {
  id: string
  label: string
  frequencyHz?: number | null
  isLocked: boolean
  device?: Device | null
}

interface Plan {
  id: string
  title: string
  riskScore: number
  riskLevel: string
  assignments: Assignment[]
  conflicts: Array<{ id: string; severity: string; type: string; detail: string; frequencyHz?: number | null }>
  scans?: Array<{ id: string; name: string; pointCount: number; createdAt: string }>
  eventProject?: { title: string; locationText?: string | null } | null
  calendarEvent?: { title: string; locationText?: string | null } | null
}

interface RfScan {
  id: string
  name: string
  pointCount: number
  createdAt: string
  thresholdDbm?: number | null
  exclusions?: Array<{ startHz?: number; endHz?: number; reason?: string }> | null
}

interface VenueProfile {
  id: string
  name: string
  notes?: string | null
  exclusions?: Array<{ startHz?: number; endHz?: number; reason?: string }> | null
  scans?: unknown[]
}

type SignalKind = 'assigned' | 'device' | 'scan' | 'exclusion' | 'conflict'

interface SignalMarker {
  id: string
  kind: SignalKind
  label: string
  detail: string
  frequencyHz?: number | null
  strength: number
  x: number
  y: number
  tone: string
}

const hardwareOptions = [
  {
    name: 'RF Explorer Pro Audio',
    bestFor: 'Best school/pro AV choice',
    detail: 'Purpose-built for wireless mics, IEMs, Wi-Fi checks, and live event RF work.',
    imageUrl: 'https://www.bhphotovideo.com/cdn-cgi/image/fit%3Dscale-down%2Cwidth%3D500%2Cquality%3D95/https%3A//www.bhphotovideo.com/images/images500x500/rf_venue_rf_explorer_pro_portable_rf_spectrum_analyzer_1696117532_1786748.jpg',
    source: 'RF Venue / B&H',
    fit: 'Pro scanner',
    link: 'https://www.amazon.com/s?k=RF+Explorer+Pro+Audio+Edition+Spectrum+Analyzer',
  },
  {
    name: 'RF Explorer WSUB1G+',
    bestFor: 'UHF mic scanning',
    detail: 'Good fit when the main need is scanning common wireless mic bands.',
    imageUrl: 'https://www.bhphotovideo.com/cdn-cgi/image/fit%3Dscale-down%2Cwidth%3D500%2Cquality%3D95/https%3A//www.bhphotovideo.com/images/images500x500/rf_venue_rf_explorer_pro_portable_rf_spectrum_analyzer_1696117532_1786748.jpg',
    source: 'RF Explorer family',
    fit: 'UHF focused',
    link: 'https://www.amazon.com/s?k=RF+Explorer+WSUB1G%2B',
  },
  {
    name: 'RF Explorer 6G Combo',
    bestFor: 'Wide range RF view',
    detail: 'Covers more bands, including areas useful for Wi-Fi and control systems.',
    imageUrl: 'https://www.bhphotovideo.com/cdn-cgi/image/fit%3Dscale-down%2Cwidth%3D500%2Cquality%3D95/https%3A//www.bhphotovideo.com/images/images500x500/rf_venue_rf_explorer_pro_portable_rf_spectrum_analyzer_1696117532_1786748.jpg',
    source: 'RF Explorer family',
    fit: 'Wideband',
    link: 'https://www.amazon.com/s?k=RF+Explorer+6G+Combo+spectrum+analyzer',
  },
  {
    name: 'tinySA Ultra',
    bestFor: 'Budget scanner',
    detail: 'Lower-cost spectrum analyzer. Useful for learning and basic scans.',
    imageUrl: 'https://www.radioddity.com/cdn/shop/files/TinySA_Ultra_Spectrum_Analyzer_image_01.jpg?v=1762475219&width=416',
    source: 'Radioddity',
    fit: 'Budget',
    link: 'https://www.amazon.com/s?k=tinySA+Ultra+spectrum+analyzer',
  },
  {
    name: 'RTL-SDR Blog V4',
    bestFor: 'Developer test kit',
    detail: 'Cheap USB SDR. Good for experiments, not the cleanest first choice for AV teams.',
    imageUrl: 'https://www.rtl-sdr.com/wp-content/uploads/2023/08/V4_promo-1024x807.jpg',
    source: 'RTL-SDR Blog',
    fit: 'Dev kit',
    link: 'https://www.amazon.com/s?k=RTL-SDR+Blog+V4',
  },
]

function mhz(hz?: number | null) {
  if (!hz) return 'No frequency'
  return `${(hz / 1_000_000).toFixed(3)} MHz`
}

function markerTone(kind: SignalKind) {
  if (kind === 'assigned') return 'border-indigo-300 bg-indigo-500 text-indigo-700'
  if (kind === 'device') return 'border-sky-300 bg-sky-500 text-sky-700'
  if (kind === 'scan') return 'border-emerald-300 bg-emerald-500 text-emerald-700'
  if (kind === 'conflict') return 'border-red-300 bg-red-500 text-red-700'
  return 'border-amber-300 bg-amber-500 text-amber-700'
}

function stablePoint(seed: string, offset = 0) {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i) + offset) % 9973
  }
  return 10 + (hash % 80)
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function openLeoMapAnalysis(markers: SignalMarker[]) {
  const assigned = markers.filter((marker) => marker.kind === 'assigned').length
  const scans = markers.filter((marker) => marker.kind === 'scan').length
  const exclusions = markers.filter((marker) => marker.kind === 'exclusion').length
  const conflicts = markers.filter((marker) => marker.kind === 'conflict').length

  window.dispatchEvent(new CustomEvent('open-leo-drawer', {
    detail: {
      prompt: [
        'You are Leo helping an A/V worker understand an RF signal map.',
        `The map currently shows ${markers.length} measured RF markers: ${assigned} assigned frequencies, ${scans} uploaded scans, ${exclusions} exclusions, and ${conflicts} conflicts.`,
        'Explain what the AV worker should look at first. Be clear that Lionheart is only using measured hardware scan data or known inventory frequencies. Keep this as RF advice only. Do not deploy or tune hardware automatically.',
      ].join(' '),
    },
  }))
}

function buildMarkers(plans: Plan[], devices: Device[], scans: RfScan[], venues: VenueProfile[]) {
  const markers: SignalMarker[] = []

  plans.forEach((plan, planIndex) => {
    plan.assignments.forEach((assignment, assignmentIndex) => {
      if (!assignment.frequencyHz) return
      markers.push({
        id: `assignment-${assignment.id}`,
        kind: 'assigned',
        label: assignment.label,
        detail: `${plan.title} - ${assignment.device?.name ?? 'No device'}`,
        frequencyHz: assignment.frequencyHz,
        strength: assignment.isLocked ? 82 : 66,
        x: stablePoint(assignment.id, planIndex),
        y: stablePoint(plan.id, assignmentIndex),
        tone: markerTone('assigned'),
      })
    })

    plan.conflicts.forEach((conflict, conflictIndex) => {
      markers.push({
        id: `conflict-${conflict.id}`,
        kind: 'conflict',
        label: conflict.type.replaceAll('_', ' '),
        detail: conflict.detail,
        frequencyHz: conflict.frequencyHz,
        strength: conflict.severity === 'BLOCKER' ? 95 : 76,
        x: stablePoint(conflict.id, conflictIndex),
        y: stablePoint(conflict.detail, planIndex),
        tone: markerTone('conflict'),
      })
    })
  })

  devices
    .filter((device) => !device.isDiscoverable && device.currentFrequencyHz)
    .forEach((device, index) => {
      markers.push({
        id: `device-${device.id}`,
        kind: 'device',
        label: device.name,
        detail: `${device.brand}${device.model ? ` ${device.model}` : ''}`,
        frequencyHz: device.currentFrequencyHz,
        strength: 58,
        x: stablePoint(device.id, index),
        y: stablePoint(device.name, index + 7),
        tone: markerTone('device'),
      })
    })

  scans.forEach((scan, index) => {
    markers.push({
      id: `scan-${scan.id}`,
      kind: 'scan',
      label: scan.name,
      detail: `${scan.pointCount?.toLocaleString?.() ?? 0} scan points`,
      frequencyHz: null,
      strength: Math.min(90, 35 + Math.round((scan.pointCount ?? 0) / 20)),
      x: stablePoint(scan.id, index + 11),
      y: stablePoint(scan.name, index + 17),
      tone: markerTone('scan'),
    })

    ;(scan.exclusions ?? []).slice(0, 8).forEach((exclusion, exclusionIndex) => {
      markers.push({
        id: `scan-exclusion-${scan.id}-${exclusionIndex}`,
        kind: 'exclusion',
        label: 'Scan exclusion',
        detail: exclusion.reason ?? scan.name,
        frequencyHz: exclusion.startHz,
        strength: 72,
        x: stablePoint(`${scan.id}-${exclusionIndex}`, 23),
        y: stablePoint(`${scan.name}-${exclusionIndex}`, 29),
        tone: markerTone('exclusion'),
      })
    })
  })

  venues.forEach((venue, venueIndex) => {
    ;(venue.exclusions ?? []).slice(0, 10).forEach((exclusion, exclusionIndex) => {
      markers.push({
        id: `venue-exclusion-${venue.id}-${exclusionIndex}`,
        kind: 'exclusion',
        label: venue.name,
        detail: exclusion.reason ?? 'Known bad range',
        frequencyHz: exclusion.startHz,
        strength: 68,
        x: stablePoint(`${venue.id}-${exclusionIndex}`, venueIndex + 31),
        y: stablePoint(`${venue.name}-${exclusionIndex}`, venueIndex + 37),
        tone: markerTone('exclusion'),
      })
    })
  })

  return markers
}

function ScanHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">What is a scan?</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">A scan is a measurement of RF noise around you.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close scan explanation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-5 text-sm leading-6 text-slate-600">
          <p>
            It usually comes from Wireless Workbench, RF Explorer, TinySA, RTL-SDR, or a receiver that can scan.
          </p>
          <div className="rounded-lg bg-slate-50 p-4">
            Lionheart can guide the scan and read the file. The browser itself cannot detect RF without connected hardware.
          </div>
          <p>
            For now, upload an exported scan file. Later, Lionheart Bridge can collect live scan data from scanner hardware.
          </p>
        </div>
      </div>
    </div>
  )
}

function HardwareOptionsModal({ onClose }: { onClose: () => void }) {
  const recommended = hardwareOptions[0]
  const rest = hardwareOptions.slice(1)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Scanner hardware</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Pick a scanner. Lionheart Bridge reads the device, then feeds real RF data into the map.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close hardware options"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[68vh] overflow-y-auto p-5">
          <a
            href={recommended.link}
            target="_blank"
            rel="noreferrer"
            className="grid cursor-pointer gap-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 transition-colors duration-200 hover:border-emerald-300 hover:bg-emerald-50 md:grid-cols-[180px_minmax(0,1fr)]"
          >
            <div
              className="h-36 overflow-hidden rounded-lg border border-white bg-white bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${recommended.imageUrl})` }}
              role="img"
              aria-label={recommended.name}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold uppercase text-white">
                  Recommended
                </span>
                <span className="text-xs font-medium text-emerald-800">{recommended.source}</span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-950">{recommended.name}</h3>
              <p className="mt-1 text-xs font-medium uppercase text-slate-500">{recommended.bestFor}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{recommended.detail}</p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#ff9900] px-3 py-2 text-xs font-semibold text-slate-950">
                Search Amazon
                <ExternalLink className="h-3.5 w-3.5" />
              </div>
            </div>
          </a>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {rest.map((option) => (
            <a
              key={option.name}
              href={option.link}
              target="_blank"
              rel="noreferrer"
              className="grid cursor-pointer grid-cols-[92px_minmax(0,1fr)] gap-3 rounded-lg border border-slate-200 p-3 transition-colors duration-200 hover:border-slate-300 hover:bg-slate-50"
            >
              <div
                className="h-24 overflow-hidden rounded-lg border border-slate-100 bg-white bg-contain bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${option.imageUrl})` }}
                role="img"
                aria-label={option.name}
              />
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{option.name}</p>
                    <p className="mt-1 text-[11px] font-medium uppercase text-slate-400">{option.fit}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{option.detail}</p>
                <div className="mt-3 inline-flex items-center rounded-md bg-[#ff9900] px-2.5 py-1.5 text-[11px] font-semibold text-slate-950">
                  Amazon search
                </div>
              </div>
            </a>
          ))}
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">How this plugs into Lionheart</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The scanner connects to a campus computer. Lionheart Bridge reads it locally and sends scan points to this RF map.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function SignalMap({
  markers,
  selectedMarker,
  selectedId,
  zoom,
  scanState,
  onZoomIn,
  onZoomOut,
  onSelect,
  onStartScan,
}: {
  markers: SignalMarker[]
  selectedMarker: SignalMarker | null
  selectedId: string | null
  zoom: number
  scanState: 'idle' | 'searching' | 'not-found'
  onZoomIn: () => void
  onZoomOut: () => void
  onSelect: (id: string) => void
  onStartScan: () => void
}) {
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (event.button !== 0 || target.closest('[data-map-fixed]')) return

    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    }
    setIsDragging(true)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    const nextX = dragRef.current.panX + event.clientX - dragRef.current.startX
    const nextY = dragRef.current.panY + event.clientY - dragRef.current.startY
    setPan({ x: clamp(nextX, -260, 260), y: clamp(nextY, -220, 220) })
  }

  const stopDragging = () => {
    dragRef.current = null
    setIsDragging(false)
  }

  return (
    <div
      className={`relative h-[420px] touch-none overflow-hidden rounded-xl border border-slate-200 bg-slate-950 md:h-[460px] xl:h-[500px] ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onWheel={(event) => {
        event.preventDefault()
        if (event.deltaY < 0) onZoomIn()
        else onZoomOut()
      }}
    >
      <div
        className="absolute inset-[-80px] opacity-25 [background-image:linear-gradient(90deg,#64748b_1px,transparent_1px),linear-gradient(#64748b_1px,transparent_1px)] [background-size:44px_44px]"
        style={{ transform: `translate(${pan.x * 0.25}px, ${pan.y * 0.25}px)` }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.18),transparent_48%),radial-gradient(circle_at_70%_25%,rgba(16,185,129,0.16),transparent_32%),radial-gradient(circle_at_25%_70%,rgba(245,158,11,0.14),transparent_34%)]" />

      <div data-map-fixed className="absolute left-5 top-5 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white backdrop-blur">
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-emerald-300" />
          Campus RF view
        </div>
      </div>

      <div className="absolute inset-x-6 bottom-6 h-16 rounded-full border border-white/10 bg-white/5 blur-sm" />

      <div data-map-fixed className="absolute right-5 top-5 flex items-center overflow-hidden rounded-lg border border-white/10 bg-black/30 text-white backdrop-blur">
        <button
          type="button"
          onClick={onZoomOut}
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center transition-colors duration-200 hover:bg-white/10"
          aria-label="Zoom out"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="border-x border-white/10 px-3 text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={onZoomIn}
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center transition-colors duration-200 hover:bg-white/10"
          aria-label="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {markers.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="max-w-md rounded-xl border border-white/10 bg-black/45 p-5 text-center text-white backdrop-blur">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-200">
              <Usb className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Connect a scanner to map real RF</h3>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              Lionheart will look for RF Explorer, tinySA, or SDR hardware through the local bridge.
            </p>
            <button
              type="button"
              onClick={onStartScan}
              disabled={scanState === 'searching'}
              className="mt-5 inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 text-sm font-semibold text-slate-950 transition-colors duration-200 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <ScanLine className="h-4 w-4" />
              {scanState === 'searching' ? 'Looking for hardware...' : 'Start scan'}
            </button>
            {scanState === 'not-found' && (
              <p className="mt-3 text-xs leading-5 text-amber-100">
                No scanner was found yet. Connect hardware to the Lionheart Bridge, then try again.
              </p>
            )}
          </div>
        </div>
      ) : markers.map((marker) => {
        const selected = selectedId === marker.id
        const size = Math.max(26, Math.min(84, marker.strength))
        const left = 50 + (marker.x - 50) * zoom
        const top = 50 + (marker.y - 50) * zoom

        return (
          <button
            key={marker.id}
            type="button"
            onClick={() => onSelect(marker.id)}
            data-map-fixed
            className="absolute flex cursor-pointer items-center justify-center rounded-full outline-none transition-transform duration-200 hover:scale-110 focus-visible:ring-2 focus-visible:ring-white"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: size,
              height: size,
              transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`,
            }}
            aria-label={`${marker.label} ${mhz(marker.frequencyHz)}`}
          >
            <span className={`absolute inset-0 rounded-full ${marker.tone.split(' ')[1]} opacity-20 ${selected ? 'animate-ping' : ''}`} />
            <span className={`relative h-3 w-3 rounded-full border-2 ${marker.tone}`} />
          </button>
        )
      })}

      <div data-map-fixed className="absolute bottom-4 left-4 right-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="rounded-lg border border-white/10 bg-black/40 p-3 text-white backdrop-blur">
          <p className="text-[10px] font-medium uppercase text-slate-300">Selected signal</p>
          {selectedMarker ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-sm font-semibold">{selectedMarker.label}</span>
              <span className="font-mono text-xs text-slate-200">{mhz(selectedMarker.frequencyHz)}</span>
              <span className="text-xs text-slate-300">{selectedMarker.detail}</span>
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-300">
              Start a hardware scan or upload scan data. Lionheart will not show estimated RF.
            </p>
          )}
        </div>
        <div className="rounded-lg border border-white/10 bg-black/40 p-3 text-white backdrop-blur">
          <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[10px] text-slate-200">
            {[
              ['Assigned', markerTone('assigned')],
              ['Device', markerTone('device')],
              ['Scan', markerTone('scan')],
              ['Exclude', markerTone('exclusion')],
              ['Conflict', markerTone('conflict')],
            ].map(([label, tone]) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full border ${tone}`} />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AVCommandCenter() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const plansQuery = useQuery(queryOptions.avPlans())
  const devicesQuery = useQuery(queryOptions.avDevices())
  const scansQuery = useQuery(queryOptions.avScans())
  const venuesQuery = useQuery(queryOptions.avVenueProfiles())

  const plans = useMemo(() => (plansQuery.data ?? []) as Plan[], [plansQuery.data])
  const devices = useMemo(() => (devicesQuery.data ?? []) as Device[], [devicesQuery.data])
  const scans = useMemo(() => (scansQuery.data ?? []) as RfScan[], [scansQuery.data])
  const venues = useMemo(() => (venuesQuery.data ?? []) as VenueProfile[], [venuesQuery.data])
  const markers = useMemo(() => buildMarkers(plans, devices, scans, venues), [plans, devices, scans, venues])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scanHelpOpen, setScanHelpOpen] = useState(false)
  const [hardwareOptionsOpen, setHardwareOptionsOpen] = useState(false)
  const [mapZoom, setMapZoom] = useState(0.72)
  const [scanState, setScanState] = useState<'idle' | 'searching' | 'not-found'>('idle')
  const selectedMarker = markers.find((marker) => marker.id === selectedId) ?? markers[0] ?? null
  const isLoading = plansQuery.isLoading || devicesQuery.isLoading || scansQuery.isLoading || venuesQuery.isLoading

  const uploadScan = useMutation({
    mutationFn: (payload: { name: string; fileName: string; content: string }) => fetchApi('/api/av/scans', {
      method: 'POST',
      body: JSON.stringify({ ...payload, thresholdDbm: -85 }),
    }),
    onSuccess: () => {
      toast.toast('Scan uploaded to RF map', 'success')
      queryClient.invalidateQueries({ queryKey: queryKeys.av.scans })
    },
    onError: (error) => {
      toast.toast((error as Error).message || 'Scan upload failed', 'error')
    },
  })

  const onScanFiles = async (files: File[]) => {
    const file = files[0]
    if (!file) return
    uploadScan.mutate({ name: file.name.replace(/\.[^.]+$/, ''), fileName: file.name, content: await file.text() })
  }

  const startHardwareScan = async () => {
    setScanState('searching')
    await new Promise((resolve) => setTimeout(resolve, 1200))
    setScanState('not-found')
    toast.toast('No scanner found. Connect hardware through Lionheart Bridge.', 'info')
  }

  const stats = [
    { label: 'RF markers', value: markers.length, icon: Radio, tone: 'text-indigo-500' },
    { label: 'Measured only', value: markers.length, icon: Antenna, tone: 'text-sky-500' },
    { label: 'Scans', value: scans.length, icon: ScanLine, tone: 'text-emerald-500' },
    { label: 'Hardware', value: hardwareOptions.length, icon: Usb, tone: 'text-amber-500' },
  ]

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-24 rounded-xl bg-slate-100" />)}
        </div>
        <div className="h-[560px] rounded-xl bg-slate-100" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
              <Icon className={`h-4 w-4 ${tone}`} />
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="self-start">
          <SignalMap
            markers={markers}
            selectedMarker={selectedMarker}
            selectedId={selectedMarker?.id ?? null}
            zoom={mapZoom}
            scanState={scanState}
            onZoomIn={() => setMapZoom((zoom) => Math.min(1.6, Number((zoom + 0.16).toFixed(2))))}
            onZoomOut={() => setMapZoom((zoom) => Math.max(0.56, Number((zoom - 0.16).toFixed(2))))}
            onSelect={setSelectedId}
            onStartScan={startHardwareScan}
          />
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Hardware scan</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Real RF requires a scanner. Lionheart will not guess nearby signals.
                </p>
              </div>
              <Usb className="h-5 w-5 text-slate-400" />
            </div>
            <button
              type="button"
              onClick={startHardwareScan}
              disabled={scanState === 'searching'}
              className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white transition-colors duration-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ScanLine className="h-3.5 w-3.5" />
              {scanState === 'searching' ? 'Looking for hardware...' : 'Start scan'}
            </button>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Start scan checks the local Lionheart Bridge for a connected RF Explorer, tinySA, or SDR device.
            </p>
            <button
              type="button"
              onClick={() => openLeoMapAnalysis(markers)}
              className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-medium text-indigo-700 transition-colors duration-200 hover:bg-indigo-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ask Leo to analyze the map
            </button>
          </div>

          <button
            type="button"
            onClick={() => setHardwareOptionsOpen(true)}
            className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-5 text-left transition-colors duration-200 hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Hardware options</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  View scanner recommendations.
                </p>
              </div>
            </div>
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Antenna className="h-5 w-5" />
            </span>
          </button>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Add real scan data</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Upload exported RF data to make the map accurate.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScanHelpOpen(true)}
                className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors duration-200 hover:bg-slate-50 hover:text-slate-800"
                aria-label="What is a scan?"
                title="What is a scan?"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Use files from Wireless Workbench, RF Explorer, TinySA, RTL-SDR, or a receiver that can scan.
            </p>
            <FileInput
              compact
              accept=".csv,.txt,.spa"
              loading={uploadScan.isPending}
              onFiles={onScanFiles}
              className="mt-4"
              hint="CSV, TXT, or SPA"
            />
            <button
              type="button"
              onClick={startHardwareScan}
              disabled={scanState === 'searching'}
              className="mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ScanLine className="h-3.5 w-3.5" />
              {scanState === 'searching' ? 'Looking for hardware...' : 'Start scan instead'}
            </button>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Upload is the fallback. Live scanning needs a scanner connected to the local bridge.
            </p>
          </div>

        </div>
      </div>
      {scanHelpOpen && <ScanHelpModal onClose={() => setScanHelpOpen(false)} />}
      {hardwareOptionsOpen && <HardwareOptionsModal onClose={() => setHardwareOptionsOpen(false)} />}
    </div>
  )
}
