'use client'

import Script from 'next/script'
import { apiFetch } from '@/lib/apiFetch'
import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { TicketPinPanel } from './TicketPinPanel'
import { RoomDetailPanel } from './RoomDetailPanel'

type Room = {
  id: string
  name: string
  panoramaImageUrl: string | null
  pinYaw: number | null
  pinPitch: number | null
  tickets: Array<{
    id: string
    title: string
    status: string
    roomId: string
    submittedBy?: { id: string; name: string | null; imageUrl: string | null } | null
  }>
  teacherSchedules: Array<{
    id: string
    user: { id: string; name: string | null; imageUrl: string | null }
    subject: string | null
  }>
}

type Building = {
  id: string
  name: string
  rooms: Room[]
}

type PinInfo = {
  roomId: string
  roomName: string
  ticketIds: string[]
  ticketTitles: string[]
  yaw: number
  pitch: number
}

declare global {
  interface Window {
    pannellum?: {
      viewer: (id: string, config: Record<string, unknown>) => { addHotSpot: (config: Record<string, unknown>) => void; destroy: () => void }
    }
  }
}

const DEFAULT_PANORAMA = 'https://pannellum.org/images/cerro-toco-0.jpg'

type Props = { initialRoomId?: string }

type CampusApiResponse = {
  buildings: Building[]
  address: string | null
  hasPanoramaContent: boolean
}

function buildGoogleMapEmbedUrl(address: string): string {
  const encoded = encodeURIComponent(address)
  return `https://www.google.com/maps?q=${encoded}&z=17&output=embed`
}

export function CampusMapViewer({ initialRoomId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<{ addHotSpot: (c: Record<string, unknown>) => void; destroy: () => void } | null>(null)
  const [pins, setPins] = useState<PinInfo[]>([])
  const [selectedPin, setSelectedPin] = useState<PinInfo | null>(null)
  const [urlRoomId, setUrlRoomId] = useState<string | null>(initialRoomId ?? null)
  const [pannellumReady, setPannellumReady] = useState(false)
  const [address, setAddress] = useState<string | null>(null)
  const [hasPanoramaContent, setHasPanoramaContent] = useState(false)

  useEffect(() => {
    apiFetch('/api/campus')
      .then((r) => r.json())
      .then((data: CampusApiResponse | Building[]) => {
        const buildings = Array.isArray(data) ? data : (data as CampusApiResponse).buildings ?? []
        const resp = data as CampusApiResponse
        setAddress((resp?.address as string)?.trim() || null)
        setHasPanoramaContent(Boolean(resp?.hasPanoramaContent))
        const allPins: PinInfo[] = []
        for (const b of buildings) {
          for (const r of b.rooms ?? []) {
            const maintenanceTickets = r.tickets?.filter((t) => t && t.id) ?? []
            if (maintenanceTickets.length === 0) continue
            const yaw = r.pinYaw ?? 0
            const pitch = r.pinPitch ?? 0
            allPins.push({
              roomId: r.id,
              roomName: r.name,
              ticketIds: maintenanceTickets.map((t) => t.id),
              ticketTitles: maintenanceTickets.map((t) => t.title),
              yaw,
              pitch,
            })
          }
        }
        setPins(allPins)
      })
      .catch(() => setPins([]))
  }, [])

  const showGoogleMap = Boolean(address)
  const showPanorama = !address && hasPanoramaContent

  useEffect(() => {
    if (!showPanorama || !pannellumReady || !containerRef.current || !window.pannellum) return

    const panorama = DEFAULT_PANORAMA

    const config: Record<string, unknown> = {
      type: 'equirectangular',
      panorama,
      autoLoad: true,
      showControls: true,
      compass: true,
      hotSpots: [],
    }

    viewerRef.current = window.pannellum!.viewer('pannellum-container', config)

    pins.forEach((pin) => {
      viewerRef.current?.addHotSpot({
        pitch: pin.pitch,
        yaw: pin.yaw,
        cssClass: 'maintenance-pin',
        clickHandlerFunc: () => setSelectedPin(pin),
        createTooltipFunc: (_hotSpotDiv: HTMLElement, _wrapper: HTMLElement) => {
          // Tooltip content handled by CSS class
        },
      })
    })

    return () => {
      viewerRef.current?.destroy()
      viewerRef.current = null
    }
  }, [showPanorama, pannellumReady, pins])

  useEffect(() => {
    if (initialRoomId) setUrlRoomId(initialRoomId)
  }, [initialRoomId])

  return (
    <>
      {showPanorama && (
        <>
          <Script
            src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"
            strategy="beforeInteractive"
            onLoad={() => setPannellumReady(true)}
          />
          <link
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css"
          />
        </>
      )}
      <div className="relative flex-1 flex min-h-0">
        {showGoogleMap && (
          <iframe
            src={buildGoogleMapEmbedUrl(address!)}
            title="Campus Map"
            className="w-full h-[calc(100vh-72px)] min-h-[400px] border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        )}
        {showPanorama && (
          <div
            id="pannellum-container"
            ref={containerRef}
            className="w-full h-[calc(100vh-72px)] min-h-[400px]"
          />
        )}
        {!showGoogleMap && !showPanorama && (
          <div className="w-full h-[calc(100vh-72px)] min-h-[400px] bg-zinc-200 dark:bg-zinc-900 flex items-center justify-center">
            <div className="text-center p-8 max-w-md">
              <MapPin className="w-12 h-12 text-zinc-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-zinc-600 dark:text-zinc-300 mb-2">No campus address yet</h3>
              <p className="text-sm text-zinc-500">
                Add your campus address in Settings → Workspace so we can show a map of your campus here.
              </p>
            </div>
          </div>
        )}
        {selectedPin && (
          <TicketPinPanel
            pin={selectedPin}
            onClose={() => setSelectedPin(null)}
          />
        )}
        {urlRoomId && !selectedPin && (
          <RoomDetailPanel
            roomId={urlRoomId}
            onClose={() => setUrlRoomId(null)}
          />
        )}
      </div>
      <style jsx global>{`
        .maintenance-pin {
          width: 32px !important;
          height: 32px !important;
          background: #ef4444 !important;
          border: 2px solid white !important;
          border-radius: 50% !important;
          cursor: pointer !important;
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.4);
          animation: pulse-pin 1.5s ease-in-out infinite;
        }
        @keyframes pulse-pin {
          0%, 100% {
            box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.4);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 0 12px rgba(239, 68, 68, 0.2);
            transform: scale(1.1);
          }
        }
      `}</style>
    </>
  )
}
