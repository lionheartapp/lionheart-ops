'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getAuthHeaders } from '@/lib/api-client'
import { queryKeys } from '@/lib/queries'
import { useToast } from '@/components/Toast'
import { X, Loader2 } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────

interface ITVendorRepairDialogProps {
  repairId: string | null
  isOpen: boolean
  onClose: () => void
}

interface VendorLogForm {
  vendorName: string
  sentDate: string
  receivedDate: string
  estimatedCost: string
  actualCost: string
  invoiceNumber: string
  receiptUrl: string
  notes: string
}

const INITIAL_FORM: VendorLogForm = {
  vendorName: '',
  sentDate: '',
  receivedDate: '',
  estimatedCost: '',
  actualCost: '',
  invoiceNumber: '',
  receiptUrl: '',
  notes: '',
}

// ─── Component ──────────────────────────────────────────────────────────

export default function ITVendorRepairDialog({
  repairId,
  isOpen,
  onClose,
}: ITVendorRepairDialogProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [form, setForm] = useState<VendorLogForm>(INITIAL_FORM)

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setForm(INITIAL_FORM)
    }
  }, [isOpen])

  // ── Mutation ─────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!repairId) throw new Error('No repair selected')

      const body: Record<string, unknown> = {}
      if (form.vendorName) body.vendorName = form.vendorName
      if (form.sentDate) body.sentDate = form.sentDate
      if (form.receivedDate) body.receivedDate = form.receivedDate
      if (form.estimatedCost) body.estimatedCost = Math.round(parseFloat(form.estimatedCost) * 100)
      if (form.actualCost) body.actualCost = Math.round(parseFloat(form.actualCost) * 100)
      if (form.invoiceNumber) body.invoiceNumber = form.invoiceNumber
      if (form.receiptUrl) body.receiptUrl = form.receiptUrl
      if (form.notes) body.notes = form.notes

      const res = await fetch(`/api/it/summer/repair-queue/${repairId}/vendor-log`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error?.message || 'Failed to save vendor log')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itRepairQueue.all })
      toast('Vendor log saved', 'success')
      onClose()
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const handleChange = (field: keyof VendorLogForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative ui-glass-overlay rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-[scaleIn_200ms_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200/50">
          <h3 className="text-base font-semibold text-gray-900">
            Add Vendor Repair Log
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {/* Vendor Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vendor Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.vendorName}
              onChange={(e) => handleChange('vendorName', e.target.value)}
              placeholder="e.g. TechRepairs Inc."
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-shadow"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sent Date
              </label>
              <input
                type="date"
                value={form.sentDate}
                onChange={(e) => handleChange('sentDate', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-shadow"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Received Date
              </label>
              <input
                type="date"
                value={form.receivedDate}
                onChange={(e) => handleChange('receivedDate', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-shadow"
              />
            </div>
          </div>

          {/* Costs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimated Cost
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.estimatedCost}
                  onChange={(e) => handleChange('estimatedCost', e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-shadow"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Actual Cost
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.actualCost}
                  onChange={(e) => handleChange('actualCost', e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-shadow"
                />
              </div>
            </div>
          </div>

          {/* Invoice # */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Invoice Number
            </label>
            <input
              type="text"
              value={form.invoiceNumber}
              onChange={(e) => handleChange('invoiceNumber', e.target.value)}
              placeholder="INV-12345"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-shadow"
            />
          </div>

          {/* Receipt URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Receipt URL
            </label>
            <input
              type="url"
              value={form.receiptUrl}
              onChange={(e) => handleChange('receiptUrl', e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-shadow"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Additional repair details..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-shadow resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200/50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !form.vendorName.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Vendor Log'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
