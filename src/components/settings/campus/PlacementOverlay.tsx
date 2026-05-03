'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, X, Check, RotateCcw } from 'lucide-react'
import InteractiveCampusMap from '@/components/settings/InteractiveCampusMap'
import type { MapBuilding, OutdoorSpace } from './map-types'

interface PlacementOverlayProps {
  entity: { id: string; name: string; type: 'building' | 'outdoor' }
  campusId?: string
  mapCenter: { lat: number; lng: number; name: string; address: string | null } | null
  buildings: MapBuilding[]
  outdoorSpaces: OutdoorSpace[]
  schools: { name: string; color: string; gradeLevel?: string }[]
  onPlace: (lat: number, lng: number) => void
  onCancel: () => void
}

export default function PlacementOverlay({
  entity,
  campusId,
  mapCenter,
  buildings,
  outdoorSpaces,
  schools,
  onPlace,
  onCancel,
}: PlacementOverlayProps) {
  const [pickedLocation, setPickedLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [saving, setSaving] = useState(false)

  // Lock body scroll and handle Escape
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onCancel])

  // When user clicks the map, capture the location (don't save yet)
  const handleMapClick = useCallback((lat: number, lng: number) => {
    setPickedLocation({ lat, lng })
  }, [])

  const handleSave = async () => {
    if (!pickedLocation) return
    setSaving(true)
    await onPlace(pickedLocation.lat, pickedLocation.lng)
    setSaving(false)
  }

  const handleReset = () => {
    setPickedLocation(null)
  }

  // Build a preview marker to show on the map
  const buildingsWithPreview: MapBuilding[] = pickedLocation
    ? [
        ...buildings,
        {
          id: `preview-${entity.id}`,
          name: entity.name,
          code: null,
          latitude: pickedLocation.lat,
          longitude: pickedLocation.lng,
        },
      ]
    : buildings

  const entityLabel = entity.type === 'building' ? 'building' : 'outdoor space'

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col" role="dialog" aria-modal="true" aria-label={`Place ${entity.name} on map`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

      {/* Toolbar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4 bg-slate-900 text-white shadow-xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate">
              Place &ldquo;{entity.name}&rdquo;
            </h2>
            <p className="text-xs text-white/60 mt-0.5">
              {pickedLocation
                ? `Location selected — save to confirm or click again to reposition`
                : `Click anywhere on the map to set the location for this ${entityLabel}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          {pickedLocation && (
            <>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-slate-900 bg-white rounded-full hover:bg-white/90 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Location'}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-white/15 border border-white/20 rounded-full hover:bg-white/25 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        </div>
      </div>

      {/* Map area */}
      <div className="relative z-10 flex-1 min-h-0">
        <InteractiveCampusMap
          campusId={campusId}
          mapCenter={mapCenter}
          buildings={buildingsWithPreview}
          outdoorSpaces={outdoorSpaces}
          schools={schools}
          editable={false}
          fillContainer
          hideChrome
          quickPlaceMode={entity.type}
          onAddBuildingAtPosition={entity.type === 'building' ? handleMapClick : undefined}
          onAddOutdoorSpaceAtPosition={entity.type === 'outdoor' ? handleMapClick : undefined}
          onQuickPlaceDone={undefined}
        />
      </div>
    </div>,
    document.body,
  )
}
