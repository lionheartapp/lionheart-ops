'use client'

import Script from 'next/script'
import { apiFetch } from '@/lib/apiFetch'
import { useEffect, useRef, useState } from 'react'
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

export function CampusMapViewer({ initialRoomId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<{ addHotSpot: (c: Record<string, unknown>) => void; destroy: () => void } | null>(null)
  const [pins, setPins] = useState<PinInfo[]>([])
  const [selectedPin, setSelectedPin] = useState<PinInfo | null>(null)
  const [urlRoomId, setUrlRoomId] = useState<string | null>(initialRoomId ?? null)
  const [pannellumReady, setPannellumReady] = useState(false)

  useEffect(() => {
    apiFetch('/api/campus')
      .then((r) => r.json())
      .then((buildings: Building[]) => {
        const allPins: PinInfo[] = []
        for (const b of buildings) {
          for (const r of b.rooms) {
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

  useEffect(() => {
    if (!pannellumReady || !containerRef.current || !window.pannellum) return

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
  }, [pannellumReady, pins])

  useEffect(() => {
    if (initialRoomId) setUrlRoomId(initialRoomId)
  }, [initialRoomId])

  return (
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
      <div className="relative flex-1 flex min-h-0">
        <div
          id="pannellum-container"
          ref={containerRef}
          className="w-full h-[calc(100vh-72px)] min-h-[400px]"
        />
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
