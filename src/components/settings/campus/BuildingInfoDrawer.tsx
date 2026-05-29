'use client'

import React from 'react'
import DetailDrawer from '@/components/DetailDrawer'
import { type Building, type Room, DIVISION_LABELS } from './types'
import { OptimizedImage } from '@/components/ui/OptimizedImage'

type BuildingInfoDrawerProps = {
  buildingId: string | null
  buildings: Building[]
  rooms: Room[]
  onClose: () => void
  onEditBuilding: (b: Building) => void
  onImageClick: (images: string[], index: number) => void
}

export default function BuildingInfoDrawer({
  buildingId,
  buildings,
  rooms,
  onClose,
  onEditBuilding,
  onImageClick,
}: BuildingInfoDrawerProps) {
  const building = buildingId ? buildings.find((b) => b.id === buildingId) : null
  const buildingRooms = buildingId ? rooms.filter((r) => r.buildingId === buildingId) : []

  return (
    <DetailDrawer
      isOpen={!!buildingId}
      onClose={onClose}
      title={building?.name || 'Building'}
    >
      {building && (
        <div className="space-y-6">
          <div className="space-y-2">
            {building.code && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">Code:</span>
                <span className="font-medium text-slate-900">{building.code}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Division:</span>
              <span className="font-medium text-slate-900">{DIVISION_LABELS[building.schoolDivision] || building.schoolDivision}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Status:</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${building.isActive ? 'bg-green-50 text-green-600 ring-1 ring-green-200' : 'bg-slate-50 text-slate-400 ring-1 ring-slate-200'}`}>
                {building.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {building.images && building.images.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Photos</h4>
              <div className="grid grid-cols-2 gap-2">
                {building.images.map((url: string, idx: number) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => onImageClick(building.images!, idx)}
                    className="aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 border border-slate-200 hover:ring-2 hover:ring-primary-400 transition cursor-pointer"
                    style={{ minHeight: 'auto' }}
                  >
                    <OptimizedImage src={url} alt={`Building photo ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-3">
              Rooms ({buildingRooms.length})
            </h4>
            {buildingRooms.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No rooms added to this building yet.</p>
            ) : (
              <div className="space-y-2">
                {buildingRooms.map((room) => (
                  <div key={room.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                    <div>
                      <span className="text-sm font-medium text-slate-900">
                        {room.displayName || `Room ${room.roomNumber}`}
                      </span>
                      {room.displayName && (
                        <span className="text-xs text-slate-500 ml-2">#{room.roomNumber}</span>
                      )}
                    </div>
                    {room.floor && (
                      <span className="text-xs text-slate-500">Floor {room.floor}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => onEditBuilding(building)}
            className="w-full px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-full hover:bg-slate-800 transition"
          >
            Edit Building
          </button>
        </div>
      )}
    </DetailDrawer>
  )
}
