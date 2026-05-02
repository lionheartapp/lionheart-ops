'use client'

import React from 'react'
import DetailDrawer from '@/components/DetailDrawer'
import { FloatingInput, FloatingDropdown } from '@/components/ui/FloatingInput'
import ImageUpload from '@/components/settings/ImageUpload'
import SchoolAccessSelector from './SchoolAccessSelector'
import NameCombobox, { type ComboboxOption } from './NameCombobox'
import type { Area, SchoolInfo } from './types'

type OutdoorFormDrawerProps = {
  isOpen: boolean
  onClose: () => void
  editingOutdoor: Area | null
  form: { name: string; areaType: string; schoolIds: string[] }
  onFormChange: (update: Partial<OutdoorFormDrawerProps['form']>) => void
  error: string
  saving: boolean
  onSubmit: (e: React.FormEvent) => void
  onImagesChange?: (imgs: string[]) => void
  onImageClick?: (images: string[], index: number) => void
  onNameChangeWithCoords?: (name: string) => void
  schools: SchoolInfo[]
  /** All existing outdoor spaces — powers the search+add combobox when creating. */
  existingOutdoorSpaces?: Area[]
  onSelectExistingOutdoor?: (a: Area) => void
  hasPendingCoords?: boolean
  /** When true, hides the school access selector (single-campus context) */
  embedded?: boolean
}

export default function OutdoorFormDrawer({
  isOpen,
  onClose,
  editingOutdoor,
  form,
  onFormChange,
  error,
  saving,
  onSubmit,
  onImagesChange,
  onImageClick,
  onNameChangeWithCoords,
  schools,
  existingOutdoorSpaces,
  onSelectExistingOutdoor,
  hasPendingCoords,
  embedded = false,
}: OutdoorFormDrawerProps) {
  const comboboxOptions: ComboboxOption[] = React.useMemo(() => {
    if (!existingOutdoorSpaces) return []
    return existingOutdoorSpaces.map((a) => ({
      id: a.id,
      name: a.name,
      notPlaced: a.latitude == null || a.longitude == null,
    }))
  }, [existingOutdoorSpaces])

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={editingOutdoor ? `Edit ${editingOutdoor.name}` : 'Add Outdoor Space'}
      width="lg"
      footer={
        <div className="space-y-3">
          <button type="submit" form="outdoor-form" className="w-full py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2" disabled={saving}>
            {saving ? 'Saving...' : editingOutdoor ? 'Save Changes' : 'Add Space'}
          </button>
          <button type="button" onClick={onClose} className="w-full text-sm text-slate-500 hover:text-slate-700 transition py-1" disabled={saving}>Cancel</button>
        </div>
      }
    >
      <form id="outdoor-form" onSubmit={onSubmit} className="p-8 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <section className="space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Space Details</h3>
            <p className="mt-1 text-sm text-slate-500">Name it the way your staff and students already know it.</p>
          </div>
          {!editingOutdoor && existingOutdoorSpaces && onSelectExistingOutdoor ? (
            <NameCombobox
              id="ct-areaName"
              label="Name"
              value={form.name}
              onChange={(v) => {
                onFormChange({ name: v })
                onNameChangeWithCoords?.(v)
              }}
              options={comboboxOptions}
              onSelectExisting={(opt) => {
                const match = existingOutdoorSpaces.find((a) => a.id === opt.id)
                if (match) onSelectExistingOutdoor(match)
              }}
              disabled={saving}
              autoFocus
              required
              contextHint={
                hasPendingCoords
                  ? 'Have you already added this space? Pick it below to place it at this location.'
                  : undefined
              }
            />
          ) : (
            <FloatingInput
              id="ct-areaName"
              label="Name"
              value={form.name}
              onChange={(e) => {
                onFormChange({ name: e.target.value })
                onNameChangeWithCoords?.(e.target.value)
              }}
              disabled={saving}
              autoFocus
              required
            />
          )}
          <FloatingDropdown
            id="ct-areaType"
            label="Type"
            value={form.areaType}
            onChange={(v) => onFormChange({ areaType: v })}
            disabled={saving}
            options={[
              { value: 'FIELD', label: 'Athletic Field' },
              { value: 'COURT', label: 'Court' },
              { value: 'GYM', label: 'Gymnasium' },
              { value: 'COMMON', label: 'Gathering Area' },
              { value: 'PARKING', label: 'Parking' },
              { value: 'OTHER', label: 'Other' },
            ]}
          />
        </section>

        {!embedded && (
          <section className="space-y-4 border-t border-slate-200 pt-6">
            <SchoolAccessSelector
              selectedIds={form.schoolIds}
              schools={schools}
              onChange={(ids) => onFormChange({ schoolIds: ids })}
              disabled={saving}
            />
          </section>
        )}

        {editingOutdoor && onImagesChange && (
          <section className="border-t border-slate-200 pt-4">
            <ImageUpload
              entityType="area"
              entityId={editingOutdoor.id}
              images={editingOutdoor.images || []}
              onImagesChange={onImagesChange}
              disabled={saving}
              onImageClick={onImageClick}
            />
          </section>
        )}
      </form>
    </DetailDrawer>
  )
}
