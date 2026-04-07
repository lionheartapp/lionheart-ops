'use client'

import React from 'react'
import { createPortal } from 'react-dom'
import { Trash2, MapPin } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { Building, Campus, DeleteConfirm } from './types'

// ─── Delete Campus Dialog ────────────────────────────────────────────────

type DeleteCampusDialogProps = {
  campus: Campus | null
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteCampusDialog({ campus, loading, onConfirm, onCancel }: DeleteCampusDialogProps) {
  if (!campus) return null
  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="ui-glass-overlay rounded-2xl max-w-sm w-full p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-6 h-6 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Campus?</h3>
        <p className="text-sm text-slate-500 mb-6">
          Are you sure you want to delete <span className="font-medium text-slate-700">{campus.name}</span>? This cannot be undone. Campuses with schools or buildings cannot be deleted.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={onCancel} className="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-full hover:bg-slate-50 transition" disabled={loading}>
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-full hover:bg-red-700 transition disabled:opacity-50" disabled={loading}>
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ─── Place on Map Dialog ─────────────────────────────────────────────────

type PlaceOnMapDialogProps = {
  building: Building | null
  onSkip: () => void
  onPlace: (building: Building) => void
}

export function PlaceOnMapDialog({ building, onSkip, onPlace }: PlaceOnMapDialogProps) {
  if (!building) return null
  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-modal p-4">
      <div className="ui-glass-overlay rounded-2xl max-w-sm w-full p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
          <MapPin className="w-6 h-6 text-primary-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Place on Map?</h3>
        <p className="text-sm text-slate-500 mb-6">
          Would you like to place <span className="font-medium text-slate-700">{building.name}</span> on the campus map? You can click a spot on the map to set its location.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={onSkip} className="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-full hover:bg-slate-50 transition">
            Skip for Now
          </button>
          <button onClick={() => onPlace(building)} className="px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-full hover:bg-slate-800 transition">
            Place on Map
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ─── Delete/Deactivate Entity Dialog ─────────────────────────────────────

type EntityDeleteDialogProps = {
  confirm: DeleteConfirm | null
  loading: boolean
  onDelete: () => void
  onDeactivate: () => void
  onCancel: () => void
}

export function EntityDeleteDialog({ confirm, loading, onDelete, onDeactivate, onCancel }: EntityDeleteDialogProps) {
  if (!confirm) return null
  return (
    <ConfirmDialog
      isOpen={!!confirm}
      onClose={onCancel}
      onConfirm={confirm.action === 'delete' ? onDelete : onDeactivate}
      title={confirm.action === 'delete' ? `Delete "${confirm.name}"?` : `Deactivate "${confirm.name}"?`}
      message={confirm.action === 'delete' ? 'This action is permanent and cannot be undone.' : 'This hides it from active selections but keeps existing references intact.'}
      confirmText={confirm.action === 'delete' ? 'Delete permanently' : 'Deactivate'}
      cancelText="Cancel"
      variant="danger"
      isLoading={loading}
      loadingText={confirm.action === 'delete' ? 'Deleting...' : 'Deactivating...'}
      requireText={confirm.action === 'delete' ? confirm.name : undefined}
      extraAction={confirm.action === 'delete' ? { label: 'Deactivate instead', onClick: onDeactivate } : undefined}
    >
      {confirm.type === 'building' && confirm.roomCount > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This building has <strong>{confirm.roomCount} room{confirm.roomCount !== 1 ? 's' : ''}</strong>.
          {confirm.action === 'delete' && ' Deleting will permanently remove all associated rooms.'}
        </div>
      )}
    </ConfirmDialog>
  )
}
