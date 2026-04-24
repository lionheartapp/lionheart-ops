'use client'

import React from 'react'
import DetailDrawer from '@/components/DetailDrawer'
import { FloatingInput, FloatingDropdown } from '@/components/ui/FloatingInput'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import type { Campus } from './types'

// ─── Add Campus Drawer ───────────────────────────────────────────────────

type AddCampusDrawerProps = {
  isOpen: boolean
  onClose: () => void
  form: { name: string; address: string; campusKind: string }
  onFormChange: (update: Partial<AddCampusDrawerProps['form']>) => void
  error: string
  saving: boolean
  onSubmit: (e: React.FormEvent) => void
}

export function AddCampusDrawer({ isOpen, onClose, form, onFormChange, error, saving, onSubmit }: AddCampusDrawerProps) {
  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Add Campus"
      width="md"
      footer={
        <div className="space-y-3">
          <button type="submit" form="add-campus-form" className="w-full py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2" disabled={saving}>
            {saving ? 'Adding...' : 'Add Campus'}
          </button>
          <button type="button" onClick={onClose} className="w-full text-sm text-slate-500 hover:text-slate-700 transition py-1">Cancel</button>
        </div>
      }
    >
      <form id="add-campus-form" onSubmit={onSubmit} className="py-6 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <FloatingInput id="ct-campusName" label="Campus name" value={form.name} onChange={(e) => onFormChange({ name: e.target.value })} disabled={saving} autoFocus required />
        <div className="relative">
          <AddressAutocomplete
            value={form.address}
            onChange={(val) => onFormChange({ address: val })}
            placeholder=" "
            className="peer w-full px-3.5 py-3.5 text-sm text-slate-900 placeholder-transparent outline-none border border-slate-300 rounded-lg bg-white transition-colors focus:border-slate-900 focus-visible:ring-1 focus-visible:ring-slate-900/10"
          />
          <label className="absolute left-3 -top-2.5 px-1 bg-white text-xs text-slate-500 font-medium pointer-events-none">
            Address (optional)
          </label>
        </div>
      </form>
    </DetailDrawer>
  )
}

// ─── Edit Campus Drawer ──────────────────────────────────────────────────

type EditCampusDrawerProps = {
  isOpen: boolean
  onClose: () => void
  campus: Campus | null
  form: { name: string; address: string; campusKind: string }
  onFormChange: (update: Partial<EditCampusDrawerProps['form']>) => void
  error: string
  saving: boolean
  onSubmit: (e: React.FormEvent) => void
}

export function EditCampusDrawer({ isOpen, onClose, campus, form, onFormChange, error, saving, onSubmit }: EditCampusDrawerProps) {
  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={campus ? `Edit ${campus.name}` : 'Edit Campus'}
      width="md"
      footer={
        <div className="space-y-3">
          <button type="submit" form="edit-campus-form" className="w-full py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" onClick={onClose} className="w-full text-sm text-slate-500 hover:text-slate-700 transition py-1">Cancel</button>
        </div>
      }
    >
      <form id="edit-campus-form" onSubmit={onSubmit} className="py-6 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <FloatingInput id="ct-editCampusName" label="Campus name" value={form.name} onChange={(e) => onFormChange({ name: e.target.value })} disabled={saving} autoFocus required />
        <div className="relative">
          <AddressAutocomplete
            value={form.address}
            onChange={(val) => onFormChange({ address: val })}
            placeholder=" "
            className="peer w-full px-3.5 py-3.5 text-sm text-slate-900 placeholder-transparent outline-none border border-slate-300 rounded-lg bg-white transition-colors focus:border-slate-900 focus-visible:ring-1 focus-visible:ring-slate-900/10"
          />
          <label className="absolute left-3 -top-2.5 px-1 bg-white text-xs text-slate-500 font-medium pointer-events-none">
            Address (optional)
          </label>
        </div>
        <FloatingDropdown
          id="ct-editCampusKind"
          label="Campus type"
          value={form.campusKind}
          onChange={(v) => onFormChange({ campusKind: v })}
          disabled={saving}
          options={[
            { value: 'HEADQUARTERS', label: 'Headquarters' },
            { value: 'CAMPUS', label: 'Campus' },
            { value: 'SATELLITE', label: 'Satellite' },
          ]}
        />
      </form>
    </DetailDrawer>
  )
}
