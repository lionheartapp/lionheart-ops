'use client'

import { MapPin, Loader2, Plus, Save, Maximize2, X, Check, RotateCcw } from 'lucide-react'
import type { LatLng } from './map-types'

/* ------------------------------------------------------------------ */
/*  Props                                                               */
/* ------------------------------------------------------------------ */

export interface MapToolbarProps {
  mapAddress: string | null
  editable: boolean
  /* Drawing mode */
  drawingMode: { buildingId: string; points: LatLng[] } | null
  onFinishDrawing: () => void
  onUndoDrawingPoint: () => void
  onClearDrawingMode: () => void
  /* Editing polygon */
  editingPolygon: { buildingId: string; coordinates: LatLng[] } | null
  onSavePolygon: () => void
  onCancelPolygon: () => void
  /* AI detection */
  detectingId: string | null
  /* Pending moves */
  pendingMovesCount: number
  onSavePositions: () => void
  /* Placing */
  placingMode: 'unified' | null
  onTogglePlacingMode: () => void
  canPlace: boolean
  /* Fit all */
  onFitAllMarkers: () => void
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export default function MapToolbar({
  mapAddress,
  editable,
  drawingMode,
  onFinishDrawing,
  onUndoDrawingPoint,
  onClearDrawingMode,
  editingPolygon,
  onSavePolygon,
  onCancelPolygon,
  detectingId,
  pendingMovesCount,
  onSavePositions,
  placingMode,
  onTogglePlacingMode,
  canPlace,
  onFitAllMarkers,
}: MapToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-primary-600" />
        <span className="text-sm font-medium text-slate-700">Campus Map</span>
        {mapAddress && (
          <span className="text-xs text-slate-500 ml-2 hidden sm:inline">{mapAddress}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Drawing mode controls */}
        {drawingMode && (
          <>
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-primary-100 text-primary-800 rounded-lg border border-primary-200">
              <span>{drawingMode.points.length} / 3+ points</span>
            </div>
            <button
              onClick={onFinishDrawing}
              disabled={drawingMode.points.length < 3}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                drawingMode.points.length < 3
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              Done
            </button>
            <button
              onClick={onUndoDrawingPoint}
              disabled={drawingMode.points.length === 0}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                drawingMode.points.length === 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Undo
            </button>
            <button
              onClick={onClearDrawingMode}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          </>
        )}

        {/* Editing polygon controls */}
        {editingPolygon && !drawingMode && (
          <>
            <button
              onClick={onSavePolygon}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Save Outline
            </button>
            <button
              onClick={onCancelPolygon}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          </>
        )}

        {/* Detecting indicator */}
        {detectingId && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-100 text-purple-800 rounded-lg border border-purple-200">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            AI detecting outline...
          </div>
        )}

        {!editingPolygon && !detectingId && (
          <>
            {editable && pendingMovesCount > 0 && (
              <button
                onClick={onSavePositions}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                Save {pendingMovesCount} change{pendingMovesCount > 1 ? 's' : ''}
              </button>
            )}

            {editable && canPlace && (
              <button
                disabled={!!drawingMode || !!editingPolygon}
                onClick={onTogglePlacingMode}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full border transition-all duration-200 ${
                  drawingMode || editingPolygon
                    ? 'bg-slate-200 text-slate-400 border-slate-200 cursor-not-allowed'
                    : placingMode
                      ? 'bg-primary-100 text-primary-800 border-primary-300'
                      : 'bg-primary-600 text-white border-primary-600 hover:bg-primary-700 hover:border-primary-700'
                }`}
              >
                <Plus className="w-4 h-4" style={{ transition: 'transform 200ms', transform: placingMode ? 'rotate(45deg)' : 'rotate(0deg)' }} />
                {placingMode ? 'Cancel Placement' : 'Add to Map'}
              </button>
            )}

            <button
              onClick={onFitAllMarkers}
              className="flex items-center justify-center w-11 h-11 text-sm font-medium bg-white text-slate-600 border border-slate-300 rounded-full hover:bg-slate-50 transition-colors"
              title="Fit all buildings"
              aria-label="Fit all buildings"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
