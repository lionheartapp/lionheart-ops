'use client'

import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Loader2, Package } from 'lucide-react'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'
import { useCampusLocations } from '@/lib/hooks/useCampusLocations'
import type { MaintenanceAsset } from './AssetRegisterTable'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CreateAssetPayload {
  name: string
  category?: string
  make?: string
  model?: string
  serialNumber?: string
  purchaseDate?: string | null
  warrantyExpiry?: string | null
  replacementCost?: number | null
  expectedLifespanYears?: number | null
  repairThresholdPct: number
  photos: string[]
  notes?: string
  status: string
  buildingId?: string | null
  areaId?: string | null
  roomId?: string | null
}

interface AssetCreateDrawerProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (asset: MaintenanceAsset & { assetNumber: string }) => void
  editAsset?: MaintenanceAsset & { assetNumber: string }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: '', label: 'Select category...' },
  { value: 'ELECTRICAL', label: 'Electrical' },
  { value: 'PLUMBING', label: 'Plumbing' },
  { value: 'HVAC', label: 'HVAC' },
  { value: 'STRUCTURAL', label: 'Structural' },
  { value: 'CUSTODIAL_BIOHAZARD', label: 'Custodial / Biohazard' },
  { value: 'GROUNDS', label: 'Grounds' },
  { value: 'IT_AV', label: 'IT / AV' },
  { value: 'OTHER', label: 'Other' },
]

// ─── Initial form state ───────────────────────────────────────────────────────

function getInitialForm() {
  return {
    name: '',
    category: '',
    make: '',
    model: '',
    serialNumber: '',
    purchaseDate: '',
    warrantyExpiry: '',
    replacementCost: '',
    expectedLifespanYears: '',
    repairThresholdPct: '50',
    notes: '',
    status: 'ACTIVE',
    locationKey: '', // composite location key from campus locations hook
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const labelClass = 'block text-xs font-medium text-gray-600 mb-1'
const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-colors'
const selectClass =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent cursor-pointer transition-colors'

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-3 mt-6 first:mt-0">
      {title}
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AssetCreateDrawer({
  isOpen,
  onClose,
  onCreated,
  editAsset,
}: AssetCreateDrawerProps) {
  const queryClient = useQueryClient()
  const { data: locationOptions = [] } = useCampusLocations()
  const isEditMode = !!editAsset
  const [form, setForm] = useState(getInitialForm())
  const [error, setError] = useState('')

  // Populate form when editAsset changes
  useState(() => {
    if (editAsset && isOpen) {
      setForm({
        name: editAsset.name || '',
        category: (editAsset as any).category || '',
        make: (editAsset as any).make || '',
        model: (editAsset as any).model || '',
        serialNumber: (editAsset as any).serialNumber || '',
        purchaseDate: (editAsset as any).purchaseDate ? new Date((editAsset as any).purchaseDate).toISOString().split('T')[0] : '',
        warrantyExpiry: (editAsset as any).warrantyExpiry ? new Date((editAsset as any).warrantyExpiry).toISOString().split('T')[0] : '',
        replacementCost: (editAsset as any).replacementCost != null ? String((editAsset as any).replacementCost) : '',
        expectedLifespanYears: (editAsset as any).expectedLifespanYears != null ? String((editAsset as any).expectedLifespanYears) : '',
        repairThresholdPct: String(Math.round(((editAsset as any).repairThresholdPct ?? 0.5) * 100)),
        notes: (editAsset as any).notes || '',
        status: (editAsset as any).status || 'ACTIVE',
        locationKey: '',
      })
    }
  })

  function updateField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // Build location options for the select
  const locationSelectOptions = locationOptions.map((loc) => ({
    value: JSON.stringify({
      buildingId: loc.buildingId,
      areaId: loc.areaId,
      roomId: loc.roomId,
    }),
    label: loc.hierarchy?.join(' > ') || loc.label,
  }))

  // Parse selected location
  function getLocationIds() {
    if (!form.locationKey) return { buildingId: null, areaId: null, roomId: null }
    try {
      return JSON.parse(form.locationKey) as {
        buildingId: string | null
        areaId: string | null
        roomId: string | null
      }
    } catch {
      return { buildingId: null, areaId: null, roomId: null }
    }
  }

  const mutation = useMutation<MaintenanceAsset, Error, CreateAssetPayload>({
    mutationFn: (payload) => {
      if (isEditMode && editAsset) {
        return fetchApi<MaintenanceAsset>(`/api/maintenance/assets/${editAsset.id}`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        })
      }
      return fetchApi<MaintenanceAsset>('/api/maintenance/assets', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      })
    },
    onSuccess: (asset) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-assets'] })
      queryClient.invalidateQueries({ queryKey: ['maintenance-asset', editAsset?.id] })
      onCreated?.(asset as MaintenanceAsset & { assetNumber: string })
      if (!isEditMode) setForm(getInitialForm())
      setError('')
      onClose()
    },
    onError: (err) => {
      setError(err.message || (isEditMode ? 'Failed to update asset' : 'Failed to create asset'))
    },
  })

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      setError('')

      if (!form.name.trim()) {
        setError('Asset name is required')
        return
      }

      const { buildingId, areaId, roomId } = getLocationIds()

      const payload: CreateAssetPayload = {
        name: form.name.trim(),
        status: form.status || 'ACTIVE',
        repairThresholdPct: parseFloat(form.repairThresholdPct || '50') / 100,
        photos: [],
      }

      if (form.category) payload.category = form.category
      if (form.make.trim()) payload.make = form.make.trim()
      if (form.model.trim()) payload.model = form.model.trim()
      if (form.serialNumber.trim()) payload.serialNumber = form.serialNumber.trim()
      if (form.purchaseDate) payload.purchaseDate = new Date(form.purchaseDate).toISOString()
      if (form.warrantyExpiry) payload.warrantyExpiry = new Date(form.warrantyExpiry).toISOString()
      if (form.replacementCost) {
        const cost = parseFloat(form.replacementCost)
        if (!isNaN(cost) && cost > 0) payload.replacementCost = cost
      }
      if (form.expectedLifespanYears) {
        const years = parseInt(form.expectedLifespanYears, 10)
        if (!isNaN(years) && years > 0) payload.expectedLifespanYears = years
      }
      if (form.notes.trim()) payload.notes = form.notes.trim()
      payload.buildingId = buildingId
      payload.areaId = areaId
      payload.roomId = roomId

      mutation.mutate(payload)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, mutation]
  )

  const handleClose = () => {
    if (mutation.isPending) return
    setForm(getInitialForm())
    setError('')
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={handleClose}
          />

          {/* Drawer panel */}
          <motion.div
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="fixed inset-y-0 right-0 w-full sm:w-[480px] z-50 flex flex-col ui-glass-overlay"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Package className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">{isEditMode ? 'Edit Asset' : 'Add Asset'}</h2>
                  <p className="text-xs text-gray-500">{isEditMode ? `Editing ${editAsset?.assetNumber}` : 'Asset number auto-assigned on creation'}</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={mutation.isPending}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable form */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <form id="asset-create-form" onSubmit={handleSubmit}>

                {/* ── Identity ─────────────────────────────────── */}
                <SectionHeader title="Identity" />

                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder="e.g. Boiler Room HVAC Unit"
                      className={inputClass}
                      maxLength={200}
                      required
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => updateField('category', e.target.value)}
                      className={selectClass}
                    >
                      {CATEGORY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Make</label>
                      <input
                        type="text"
                        value={form.make}
                        onChange={(e) => updateField('make', e.target.value)}
                        placeholder="e.g. Carrier"
                        className={inputClass}
                        maxLength={100}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Model</label>
                      <input
                        type="text"
                        value={form.model}
                        onChange={(e) => updateField('model', e.target.value)}
                        placeholder="e.g. 50XC036-A"
                        className={inputClass}
                        maxLength={100}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Serial Number</label>
                    <input
                      type="text"
                      value={form.serialNumber}
                      onChange={(e) => updateField('serialNumber', e.target.value)}
                      placeholder="e.g. SN-2024-XXXXX"
                      className={inputClass}
                      maxLength={100}
                    />
                  </div>
                </div>

                {/* ── Location ──────────────────────────────────── */}
                <SectionHeader title="Location" />

                <div>
                  <label className={labelClass}>Building / Area / Room</label>
                  <select
                    value={form.locationKey}
                    onChange={(e) => updateField('locationKey', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">No specific location</option>
                    {locationSelectOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {/* ── Financials ────────────────────────────────── */}
                <SectionHeader title="Financials" />

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Purchase Date</label>
                      <input
                        type="date"
                        value={form.purchaseDate}
                        onChange={(e) => updateField('purchaseDate', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Replacement Cost ($)</label>
                      <input
                        type="number"
                        value={form.replacementCost}
                        onChange={(e) => updateField('replacementCost', e.target.value)}
                        placeholder="0"
                        min="0"
                        step="0.01"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Warranty Expiry</label>
                      <input
                        type="date"
                        value={form.warrantyExpiry}
                        onChange={(e) => updateField('warrantyExpiry', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Expected Lifespan (years)</label>
                      <input
                        type="number"
                        value={form.expectedLifespanYears}
                        onChange={(e) => updateField('expectedLifespanYears', e.target.value)}
                        placeholder="10"
                        min="1"
                        max="100"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>
                      Repair Threshold (%) <span className="text-gray-400">— flag if repair exceeds this % of replacement cost</span>
                    </label>
                    <input
                      type="number"
                      value={form.repairThresholdPct}
                      onChange={(e) => updateField('repairThresholdPct', e.target.value)}
                      placeholder="50"
                      min="0"
                      max="100"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Initial Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => updateField('status', e.target.value)}
                      className={selectClass}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="DECOMMISSIONED">Decommissioned</option>
                      <option value="PENDING_DISPOSAL">Pending Disposal</option>
                    </select>
                  </div>
                </div>

                {/* ── Notes ─────────────────────────────────────── */}
                <SectionHeader title="Notes" />

                <div>
                  <textarea
                    value={form.notes}
                    onChange={(e) => updateField('notes', e.target.value)}
                    placeholder="Additional notes about this asset..."
                    rows={3}
                    className={`${inputClass} resize-none`}
                    maxLength={2000}
                  />
                </div>

              </form>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200/60 space-y-3">
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={mutation.isPending}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="asset-create-form"
                  disabled={mutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-70"
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    isEditMode ? 'Save Changes' : 'Create Asset'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
