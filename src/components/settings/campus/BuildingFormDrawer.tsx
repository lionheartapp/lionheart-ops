'use client'

import React from 'react'
import DetailDrawer from '@/components/DetailDrawer'
import { FloatingInput, FloatingDropdown } from '@/components/ui/FloatingInput'
import ImageUpload from '@/components/settings/ImageUpload'
import type { Building } from './types'

type BuildingFormDrawerProps = {
  isOpen: boolean
  onClose: () => void
  editingBuilding: Building | null
  form: { name: string; code: string; schoolDivision: string; buildingType: string }
  onFormChange: (update: Partial<BuildingFormDrawerProps['form']>) => void
  error: string
  saving: boolean
  onSubmit: (e: React.FormEvent) => void
  onImagesChange?: (imgs: string[]) => void
  onImageClick?: (images: string[], index: number) => void
  onNameChangeWithCoords?: (name: string) => void
}

export default function BuildingFormDrawer({
  isOpen,
  onClose,
  editingBuilding,
  form,
  onFormChange,
  error,
  saving,
  onSubmit,
  onImagesChange,
  onImageClick,
  onNameChangeWithCoords,
}: BuildingFormDrawerProps) {
  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={editingBuilding ? `Edit ${editingBuilding.name}` : 'Add Building'}
      width="lg"
      footer={
        <div className="space-y-3">
          <button type="submit" form="building-form" className="w-full py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2" disabled={saving}>
            {saving ? 'Saving...' : editingBuilding ? 'Save Changes' : 'Add Building'}
          </button>
          <button type="button" onClick={onClose} className="w-full text-sm text-slate-500 hover:text-slate-700 transition py-1" disabled={saving}>Cancel</button>
        </div>
      }
    >
      <form id="building-form" onSubmit={onSubmit} className="p-8 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <section className="space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Building Details</h3>
          </div>
          <FloatingInput
            id="ct-buildingName"
            label="Building name"
            value={form.name}
            onChange={(e) => {
              onFormChange({ name: e.target.value })
              onNameChangeWithCoords?.(e.target.value)
            }}
            disabled={saving}
            autoFocus
            required
          />
          <FloatingInput
            id="ct-buildingCode"
            label="Short code (optional)"
            value={form.code}
            onChange={(e) => onFormChange({ code: e.target.value })}
            disabled={saving}
          />
          <FloatingDropdown
            id="ct-buildingDivision"
            label="School division"
            value={form.schoolDivision}
            onChange={(v) => onFormChange({ schoolDivision: v })}
            disabled={saving}
            options={[
              { value: 'GLOBAL', label: 'Global (all divisions)' },
              { value: 'ELEMENTARY', label: 'Elementary' },
              { value: 'MIDDLE_SCHOOL', label: 'Middle School' },
              { value: 'HIGH_SCHOOL', label: 'High School' },
            ]}
          />
          <FloatingDropdown
            id="ct-buildingType"
            label="Building type"
            value={form.buildingType}
            onChange={(v) => onFormChange({ buildingType: v })}
            disabled={saving}
            options={[
              { value: 'GENERAL', label: 'General' },
              { value: 'ARTS_CULTURE', label: 'Arts & Culture' },
              { value: 'ATHLETICS', label: 'Athletics' },
              { value: 'ADMINISTRATION', label: 'Administration' },
              { value: 'SUPPORT_SERVICES', label: 'Support Services' },
            ]}
          />
        </section>

        {editingBuilding && onImagesChange && (
          <section className="border-t border-slate-200 pt-4">
            <ImageUpload
              entityType="building"
              entityId={editingBuilding.id}
              images={editingBuilding.images || []}
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
