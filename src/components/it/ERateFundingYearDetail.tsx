'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import { fetchApi } from '@/lib/api-client'
import { createClient } from '@supabase/supabase-js'
import {
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  FileText,
  Trash2,
  Loader2,
  ExternalLink,
  FolderOpen,
  Plus,
  X,
  Upload,
} from 'lucide-react'
import ITErrorState from './ITErrorState'

// ─── Types ──────────────────────────────────────────────────────────────

interface ERateFundingYearDetailProps {
  fundingYear: number
  ben: string
  onBack: () => void
}

interface FRN {
  frnNumber: string
  applicationNumber: string
  ben: string
  fundingYear: number
  serviceType: string | null
  serviceCategory: string | null
  serviceProviderName: string | null
  contractNumber: string | null
  spin: string | null
  status: string | null
  preDiscountAmount: number
  discountAmount: number
  committedAmount: number
  disbursedAmount: number
  invoiceDeadline: string | null
  fcdlDate: string | null
}

interface Disbursement {
  invoiceType: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
  authorizedAmount: number
  disbursedAmount: number
  paymentDate: string | null
  serviceProviderName: string | null
  spin: string | null
}

interface ERateDocument {
  id: string
  title: string
  category: string | null
  frnNumber: string | null
  notes: string | null
  fileUrl: string
  fileName: string | null
  createdAt: string
}

interface LifecycleStep {
  key: string
  label: string
  date: string | null
  completed: boolean
  active: boolean
}

// ─── Constants ──────────────────────────────────────────────────────────

const ERATE_DOC_CATEGORIES = [
  { key: 'competitive-bidding', label: 'Competitive Bidding', description: 'RFPs, bid evaluations, 28-day posting proof' },
  { key: 'vendor-contract', label: 'Vendor Contracts', description: 'Service agreements, MSAs, amendments' },
  { key: 'board-approval', label: 'Board Approval', description: 'Meeting minutes, resolutions' },
  { key: 'technology-plan', label: 'Technology Plan', description: 'District/school technology plan' },
  { key: 'cipa-compliance', label: 'CIPA Compliance', description: 'Internet safety policy, filtering docs' },
  { key: 'c2-budget', label: 'Category 2 Budget', description: 'C2 budget worksheets, calculations' },
  { key: 'invoice-payment', label: 'Invoices & Payment', description: 'Vendor invoices, proof of payment, BEAR/SPI forms' },
  { key: 'usac-correspondence', label: 'USAC Correspondence', description: 'FCDL letters, PIA requests, RAL letters' },
  { key: 'other', label: 'Other', description: 'Miscellaneous E-Rate documentation' },
] as const

const LIFECYCLE_STEPS = [
  { key: 'form470', label: 'Form 470' },
  { key: 'bidding', label: 'Bidding' },
  { key: 'form471', label: 'Form 471' },
  { key: 'piaReview', label: 'PIA Review' },
  { key: 'fcdl', label: 'FCDL' },
  { key: 'form486', label: 'Form 486' },
  { key: 'invoicing', label: 'Invoicing' },
  { key: 'disbursed', label: 'Disbursed' },
] as const

// ─── Helpers ────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getStatusColor(status: string): string {
  const s = status.toLowerCase()
  if (s === 'funded' || s === 'disbursed' || s === 'completed') return 'bg-green-100 text-green-700'
  if (s === 'committed' || s === 'approved') return 'bg-blue-100 text-blue-700'
  if (s === 'filed' || s === 'pending' || s === 'in-review') return 'bg-amber-100 text-amber-700'
  if (s === 'denied' || s === 'rejected') return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-700'
}

function deriveLifecycleSteps(frns: FRN[]): LifecycleStep[] {
  const statuses = frns.map((f) => (f.status ?? '').toLowerCase())
  const hasAny = frns.length > 0
  const hasFcdl = frns.some((f) => f.fcdlDate)
  const hasDisbursements = frns.some((f) => f.disbursedAmount > 0)

  const stepCompletion: Record<string, boolean> = {
    form470: hasAny,
    bidding: hasAny,
    form471: hasAny,
    piaReview: hasFcdl || statuses.some((s) => ['approved', 'committed', 'funded', 'disbursed', 'completed'].includes(s)),
    fcdl: hasFcdl || statuses.some((s) => ['committed', 'funded', 'disbursed', 'completed'].includes(s)),
    form486: statuses.some((s) => ['funded', 'disbursed', 'completed'].includes(s)),
    invoicing: hasDisbursements,
    disbursed: hasDisbursements,
  }

  let foundActive = false
  return LIFECYCLE_STEPS.map(({ key, label }) => {
    const completed = stepCompletion[key]
    let active = false
    if (!completed && !foundActive) {
      active = true
      foundActive = true
    }
    return { key, label, date: null, completed, active }
  })
}

// ─── Skeleton Components ────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="flex items-center gap-3 overflow-x-auto py-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2 min-w-[80px]">
          <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
          <div className="w-16 h-3 bg-gray-200 rounded animate-pulse" />
        </div>
      ))}
    </div>
  )
}

function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
      ))}
    </div>
  )
}

// ─── Upload Modal ───────────────────────────────────────────────────────

interface UploadModalProps {
  open: boolean
  onClose: () => void
  fundingYear: number
  ben: string
  frns: FRN[]
  onUploaded: () => void
}

function UploadDocumentModal({ open, onClose, fundingYear, ben, frns, onUploaded }: UploadModalProps) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [frnNumber, setFrnNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetForm = useCallback(() => {
    setTitle('')
    setCategory('')
    setFrnNumber('')
    setNotes('')
    setFile(null)
    setError(null)
    setDragOver(false)
  }, [])

  const handleClose = useCallback(() => {
    resetForm()
    onClose()
  }, [onClose, resetForm])

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile)
    if (!title) {
      setTitle(selectedFile.name.replace(/\.[^.]+$/, ''))
    }
  }, [title])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const dropped = e.dataTransfer.files[0]
      if (dropped) handleFileSelect(dropped)
    },
    [handleFileSelect],
  )

  const handleUpload = useCallback(async () => {
    if (!file || !category || !title.trim()) {
      setError('Title, category, and file are required.')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Storage configuration is missing.')
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey)
      const filePath = `erate/${fundingYear}/${Date.now()}_${file.name}`

      const { error: uploadError } = await supabase.storage
        .from('erate-documents')
        .upload(filePath, file)

      if (uploadError) throw new Error(uploadError.message)

      const { data: urlData } = supabase.storage
        .from('erate-documents')
        .getPublicUrl(filePath)

      await fetchApi('/api/it/erate/documents', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          category,
          frnNumber: frnNumber || null,
          notes: notes.trim() || null,
          fileUrl: urlData.publicUrl,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          fundingYear,
          ben,
        }),
      })

      handleClose()
      onUploaded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }, [file, category, title, notes, frnNumber, fundingYear, ben, handleClose, onUploaded])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Upload E-Rate Document"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Upload Document</h3>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
            aria-label="Close upload dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors duration-200
              ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'}
            `}
            role="button"
            aria-label="Select or drop a file"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
          >
            <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            {file ? (
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-700">Drop a file here or click to browse</p>
                <p className="text-xs text-gray-500 mt-1">PDF, DOC, XLSX, or image files</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]) }}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg"
            />
          </div>

          {/* Title */}
          <div>
            <label htmlFor="doc-title" className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="doc-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors duration-200"
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="doc-category" className="block text-sm font-medium text-gray-700 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              id="doc-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white cursor-pointer transition-colors duration-200"
            >
              <option value="">Select a category</option>
              {ERATE_DOC_CATEGORIES.map((cat) => (
                <option key={cat.key} value={cat.key}>{cat.label}</option>
              ))}
            </select>
          </div>

          {/* FRN (optional) */}
          <div>
            <label htmlFor="doc-frn" className="block text-sm font-medium text-gray-700 mb-1">
              FRN <span className="text-gray-400">(optional)</span>
            </label>
            <select
              id="doc-frn"
              value={frnNumber}
              onChange={(e) => setFrnNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white cursor-pointer transition-colors duration-200"
            >
              <option value="">No specific FRN</option>
              {frns.map((frn) => (
                <option key={frn.frnNumber} value={frn.frnNumber}>
                  {frn.frnNumber} — {frn.serviceType}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="doc-notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              id="doc-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any additional context..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none transition-colors duration-200"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-2">
          <button
            onClick={handleClose}
            disabled={uploading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition-colors duration-200 cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || !file || !category || !title.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-full hover:bg-gray-800 transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── FRN Accordion Row ──────────────────────────────────────────────────

interface FRNRowProps {
  frn: FRN
}

function FRNRow({ frn }: FRNRowProps) {
  const [expanded, setExpanded] = useState(false)

  const { data: disbursements, isLoading: loadingDisbursements } = useQuery({
    queryKey: ['erate-disbursements', frn.frnNumber],
    queryFn: () => fetchApi<Disbursement[]>(`/api/it/erate/frns/${frn.frnNumber}/disbursements`),
    enabled: expanded,
  })

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
        aria-expanded={expanded}
        aria-label={`FRN ${frn.frnNumber} details`}
      >
        <motion.div
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </motion.div>

        <span className="text-sm font-mono font-medium text-gray-900 w-28 flex-shrink-0">
          {frn.frnNumber}
        </span>
        <span className="text-sm text-gray-600 flex-1 truncate">
          {frn.serviceType ?? frn.serviceCategory ?? '—'}
        </span>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${getStatusColor(frn.status ?? 'pending')}`}>
          {frn.status ?? 'Pending'}
        </span>
        <span className="text-sm text-gray-600 w-32 text-right flex-shrink-0 hidden sm:block">
          {frn.serviceProviderName ?? '—'}
        </span>
        <span className="text-sm font-medium text-gray-900 w-28 text-right flex-shrink-0">
          {formatCurrency(frn.committedAmount)}
        </span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-6 mb-3 text-xs text-gray-500 flex-wrap">
                <span>Provider: <span className="text-gray-700 font-medium">{frn.serviceProviderName ?? '—'}</span></span>
                <span>Requested: <span className="text-gray-700 font-medium">{formatCurrency(frn.preDiscountAmount)}</span></span>
                <span>Disbursed: <span className="text-gray-700 font-medium">{formatCurrency(frn.disbursedAmount)}</span></span>
                {frn.invoiceDeadline && <span>Invoice deadline: <span className="text-gray-700 font-medium">{formatDate(frn.invoiceDeadline)}</span></span>}
              </div>

              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Disbursements
              </h4>

              {loadingDisbursements ? (
                <div className="flex items-center gap-2 py-3 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading disbursements...
                </div>
              ) : !disbursements?.length ? (
                <p className="text-sm text-gray-500 py-2">No disbursements recorded yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {disbursements.map((d, idx) => (
                    <div
                      key={`${d.invoiceNumber ?? idx}`}
                      className="flex items-center gap-4 text-sm bg-white rounded-lg px-3 py-2 border border-gray-100"
                    >
                      <span className="text-gray-500 w-24">{d.invoiceDate ? formatDate(d.invoiceDate) : '—'}</span>
                      <span className="font-medium text-gray-900 w-24">{formatCurrency(d.disbursedAmount)}</span>
                      <span className="text-gray-600 flex-1">{d.invoiceType ?? '—'}</span>
                      {d.invoiceNumber && (
                        <span className="text-xs text-gray-400 font-mono">#{d.invoiceNumber}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────

export default function ERateFundingYearDetail({
  fundingYear,
  ben,
  onBack,
}: ERateFundingYearDetailProps) {
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  // ── Fetch FRNs ──
  const {
    data: frns,
    isLoading: loadingFrns,
    error: frnsError,
    refetch: refetchFrns,
  } = useQuery({
    queryKey: ['erate-frns', fundingYear, ben],
    queryFn: () =>
      fetchApi<FRN[]>(`/api/it/erate/frns?fundingYear=${fundingYear}&ben=${encodeURIComponent(ben)}`),
  })

  // ── Fetch Documents ──
  const {
    data: documents,
    isLoading: loadingDocs,
    error: docsError,
    refetch: refetchDocs,
  } = useQuery({
    queryKey: ['erate-documents', fundingYear, ben],
    queryFn: () =>
      fetchApi<ERateDocument[]>(
        `/api/it/erate/documents?fundingYear=${fundingYear}&ben=${encodeURIComponent(ben)}`,
      ),
  })

  // ── Derived data ──
  const lifecycleSteps = useMemo(() => deriveLifecycleSteps(frns ?? []), [frns])

  const summaryStats = useMemo(() => {
    const frnList = frns ?? []
    const requested = frnList.reduce((sum, f) => sum + f.preDiscountAmount, 0)
    const committed = frnList.reduce((sum, f) => sum + f.committedAmount, 0)
    const disbursed = frnList.reduce((sum, f) => sum + f.disbursedAmount, 0)
    const utilization = committed > 0 ? Math.round((disbursed / committed) * 100) : 0
    return { requested, committed, disbursed, utilization }
  }, [frns])

  const docCountsByCategory = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const cat of ERATE_DOC_CATEGORIES) {
      counts[cat.key] = 0
    }
    for (const doc of documents ?? []) {
      const cat = doc.category ?? 'other'
      if (counts[cat] !== undefined) {
        counts[cat] += 1
      }
    }
    return counts
  }, [documents])

  const overallStatus = useMemo(() => {
    if (!frns?.length) return 'Pending'
    const statuses = frns.map((f) => (f.status ?? '').toLowerCase())
    if (statuses.some((s) => s.includes('funded') || s.includes('disbursed'))) return 'Funded'
    if (statuses.some((s) => s.includes('committed') || s.includes('approved'))) return 'Committed'
    return 'Filed'
  }, [frns])

  const handleDocUploaded = useCallback(() => {
    refetchDocs()
  }, [refetchDocs])

  const handleDeleteDocument = useCallback(
    async (docId: string) => {
      try {
        await fetchApi(`/api/it/erate/documents/${docId}`, { method: 'DELETE' })
        refetchDocs()
      } catch {
        // Error is handled silently — the UI won't change if delete fails
      }
    },
    [refetchDocs],
  )

  // ── Error state ──
  if (frnsError) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors duration-200 cursor-pointer"
          aria-label="Back to overview"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Overview
        </button>
        <ITErrorState
          message="Failed to load funding year data."
          onRetry={() => refetchFrns()}
        />
      </div>
    )
  }

  return (
    <motion.div
      variants={staggerContainer(0.08)}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* ── Back link ── */}
      <motion.button
        variants={fadeInUp}
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors duration-200 cursor-pointer"
        aria-label="Back to overview"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Overview
      </motion.button>

      {/* ── Header ── */}
      <motion.div variants={fadeInUp} className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <h2 className="text-xl font-bold text-gray-900">FY{fundingYear}</h2>
          <span className={`text-xs font-medium px-3 py-1 rounded-full ${getStatusColor(overallStatus)}`}>
            {overallStatus}
          </span>
          <span className="text-sm text-gray-500">BEN: {ben}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Requested', value: formatCurrency(summaryStats.requested) },
            { label: 'Committed', value: formatCurrency(summaryStats.committed) },
            { label: 'Disbursed', value: formatCurrency(summaryStats.disbursed) },
            { label: 'Utilization', value: `${summaryStats.utilization}%` },
          ].map((stat) => (
            <div key={stat.label} className="text-center sm:text-left">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{stat.label}</p>
              <p className="text-lg font-semibold text-gray-900 mt-0.5">{loadingFrns ? '—' : stat.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Lifecycle Timeline ── */}
      <motion.div variants={fadeInUp} className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Lifecycle Timeline</h3>

        {loadingFrns ? (
          <TimelineSkeleton />
        ) : (
          <div className="overflow-x-auto">
            <div className="flex items-start min-w-[600px]" role="list" aria-label="E-Rate lifecycle steps">
              {lifecycleSteps.map((step, i) => (
                <div
                  key={step.key}
                  className="flex-1 flex flex-col items-center relative"
                  role="listitem"
                  aria-label={`${step.label}: ${step.completed ? 'completed' : step.active ? 'in progress' : 'pending'}`}
                >
                  {/* Connector line */}
                  {i > 0 && (
                    <div
                      className={`absolute top-4 right-1/2 w-full h-0.5 -translate-y-1/2 ${
                        step.completed ? 'bg-emerald-400' : 'bg-gray-200'
                      }`}
                      style={{ zIndex: 0 }}
                    />
                  )}

                  {/* Circle */}
                  <div className="relative z-10">
                    {step.completed ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      </div>
                    ) : step.active ? (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{
                          background: 'linear-gradient(90deg, #3B82F6 0%, #6366F1 100%)',
                          padding: '2px',
                        }}
                      >
                        <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ background: 'linear-gradient(90deg, #3B82F6 0%, #6366F1 100%)' }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full border-2 border-gray-300 bg-white flex items-center justify-center">
                        <Circle className="w-3 h-3 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={`text-xs mt-2 text-center leading-tight ${
                      step.completed
                        ? 'text-emerald-700 font-medium'
                        : step.active
                          ? 'text-blue-600 font-medium'
                          : 'text-gray-400'
                    }`}
                  >
                    {step.label}
                  </span>

                  {step.date && (
                    <span className="text-[10px] text-gray-400 mt-0.5">{step.date}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* ── FRN Table ── */}
      <motion.div variants={fadeInUp} className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Funding Request Numbers (FRNs)
          </h3>
          {!loadingFrns && (
            <span className="text-xs text-gray-500">
              {frns?.length ?? 0} FRN{(frns?.length ?? 0) !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {loadingFrns ? (
          <TableSkeleton rows={3} />
        ) : !frns?.length ? (
          <div className="text-center py-10 text-gray-500">
            <FolderOpen className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm font-medium">No FRNs found for FY{fundingYear}</p>
            <p className="text-xs text-gray-400 mt-1">FRNs will appear here once Form 471 is filed.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Table header — desktop only */}
            <div className="hidden sm:flex items-center gap-4 px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <span className="w-4" />
              <span className="w-28">FRN #</span>
              <span className="flex-1">Service Type</span>
              <span className="w-20">Status</span>
              <span className="w-32 text-right">Provider</span>
              <span className="w-28 text-right">Committed</span>
            </div>

            {frns.map((frn) => (
              <FRNRow key={frn.frnNumber} frn={frn} />
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Documents Section ── */}
      <motion.div variants={fadeInUp} className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Document Checklist</h3>
          <button
            onClick={() => setUploadModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-full hover:bg-gray-800 transition-colors duration-200 cursor-pointer"
            aria-label="Upload a document"
          >
            <Plus className="w-4 h-4" />
            Upload
          </button>
        </div>

        {loadingDocs ? (
          <TableSkeleton rows={5} />
        ) : docsError ? (
          <div className="text-center py-6 text-sm text-red-600">
            Failed to load documents.{' '}
            <button onClick={() => refetchDocs()} className="underline cursor-pointer">
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {ERATE_DOC_CATEGORIES.map((cat) => {
              const count = docCountsByCategory[cat.key] ?? 0
              const catDocs = (documents ?? []).filter((d) => (d.category ?? 'other') === cat.key)

              return (
                <CategoryRow
                  key={cat.key}
                  category={cat}
                  count={count}
                  documents={catDocs}
                  onDelete={handleDeleteDocument}
                />
              )
            })}
          </div>
        )}
      </motion.div>

      {/* ── Upload Modal ── */}
      <AnimatePresence>
        {uploadModalOpen && (
          <UploadDocumentModal
            open={uploadModalOpen}
            onClose={() => setUploadModalOpen(false)}
            fundingYear={fundingYear}
            ben={ben}
            frns={frns ?? []}
            onUploaded={handleDocUploaded}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Category Row (accordion for docs section) ─────────────────────────

interface CategoryRowProps {
  category: (typeof ERATE_DOC_CATEGORIES)[number]
  count: number
  documents: ERateDocument[]
  onDelete: (id: string) => void
}

function CategoryRow({ category, count, documents, onDelete }: CategoryRowProps) {
  const [expanded, setExpanded] = useState(false)
  const hasDocs = count > 0

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
        aria-expanded={expanded}
        aria-label={`${category.label}: ${count} document${count !== 1 ? 's' : ''}`}
      >
        <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </motion.div>

        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-900">{category.label}</span>
          <span className="text-xs text-gray-500 ml-2 hidden sm:inline">{category.description}</span>
        </div>

        {hasDocs ? (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700 flex-shrink-0">
            {count} doc{count !== 1 ? 's' : ''}
          </span>
        ) : (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
            Missing
          </span>
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1 border-t border-gray-100 bg-gray-50/50">
              {!hasDocs ? (
                <p className="text-sm text-gray-500 py-2">No documents uploaded for this category.</p>
              ) : (
                <div className="space-y-1.5">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 text-sm bg-white rounded-lg px-3 py-2 border border-gray-100"
                    >
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                        <p className="text-xs text-gray-500">
                          {formatDate(doc.createdAt)}
                          {doc.frnNumber && <span className="ml-2">FRN: {doc.frnNumber}</span>}
                        </p>
                      </div>
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors duration-200 cursor-pointer"
                        aria-label={`Open ${doc.title}`}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(doc.id)
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 transition-colors duration-200 cursor-pointer"
                        aria-label={`Delete ${doc.title}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
