'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader2, DollarSign, Upload, X, Check } from 'lucide-react'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'
import { useQuery, useQueryClient } from '@tanstack/react-query'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CostEntryFormProps {
  ticketId: string
  onCreated?: () => void
  onCancel?: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CostEntryForm({ ticketId, onCreated, onCancel }: CostEntryFormProps) {
  const queryClient = useQueryClient()

  const [vendor, setVendor] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showVendorDropdown, setShowVendorDropdown] = useState(false)
  const vendorInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch vendor list for autocomplete
  const { data: vendorData } = useQuery<string[]>({
    queryKey: ['vendors', vendor],
    queryFn: async () => {
      const res = await fetchApi<string[]>(
        `/api/maintenance/vendors${vendor.trim() ? `?q=${encodeURIComponent(vendor.trim())}` : ''}`
      )
      return Array.isArray(res) ? res : []
    },
    enabled: showVendorDropdown,
    staleTime: 30 * 1000,
  })

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (vendorInputRef.current && !vendorInputRef.current.parentElement?.contains(e.target as Node)) {
        setShowVendorDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadError('')

    try {
      // Get signed URL
      const uploadUrlRes = await fetchApi<{ signedUrl: string; publicUrl: string }>(
        `/api/maintenance/tickets/${ticketId}/cost-upload-url`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type || 'application/octet-stream',
          }),
        }
      )

      // Upload directly to Supabase Storage
      const uploadRes = await fetch(uploadUrlRes.signedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      })

      if (!uploadRes.ok) {
        throw new Error(`Upload failed: ${uploadRes.status}`)
      }

      setReceiptUrl(uploadUrlRes.publicUrl)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!vendor.trim() || !description.trim() || !amount) return

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      await fetchApi(`/api/maintenance/tickets/${ticketId}/costs`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          vendor: vendor.trim(),
          description: description.trim(),
          amount: amountNum,
          receiptUrl: receiptUrl ?? undefined,
        }),
      })

      queryClient.invalidateQueries({ queryKey: ['cost-entries', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['cost-summary', ticketId] })
      onCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create entry')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredVendors = (vendorData ?? []).filter((v) =>
    v.toLowerCase().includes(vendor.toLowerCase())
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-3">
      {/* Vendor with autocomplete */}
      <div className="relative">
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Vendor <span className="text-red-500">*</span>
        </label>
        <input
          ref={vendorInputRef}
          type="text"
          value={vendor}
          onChange={(e) => {
            setVendor(e.target.value)
            setShowVendorDropdown(true)
          }}
          onFocus={() => setShowVendorDropdown(true)}
          placeholder="e.g. Home Depot, Grainger..."
          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 placeholder:text-slate-400"
          autoComplete="off"
        />
        {showVendorDropdown && filteredVendors.length > 0 && (
          <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
            {filteredVendors.slice(0, 6).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setVendor(v)
                  setShowVendorDropdown(false)
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Description <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. PVC fittings, replacement belt..."
          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 placeholder:text-slate-400"
        />
      </div>

      {/* Amount */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Amount ($) <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full pl-7 pr-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Receipt photo */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Receipt Photo (optional)</label>
        {receiptUrl ? (
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={receiptUrl} alt="Receipt" className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-primary-600">
              <Check className="w-3 h-3" />
              Receipt uploaded
            </div>
            <button
              type="button"
              onClick={() => setReceiptUrl(null)}
              className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer ml-auto"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors cursor-pointer disabled:opacity-50 w-full justify-center"
            >
              {isUploading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Upload className="w-3 h-3" />
              )}
              {isUploading ? 'Uploading...' : 'Upload receipt photo'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {uploadError && <p className="text-xs text-red-600 mt-1">{uploadError}</p>}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isSubmitting || !vendor.trim() || !description.trim() || !amount}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />}
          Add Cost
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
