'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, X, ChevronDown, Loader2, RotateCcw, FileText, Image, DollarSign, Clock } from 'lucide-react'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'
import { expandCollapse } from '@/lib/animations'

// ─── Types ───────────────────────────────────────────────────────────────────

interface LaborEntry {
  id: string
  hoursWorked: number
  hourlyRate?: number | null
}

interface CostEntry {
  id: string
  amount: number
  description?: string | null
}

export interface QATicketData {
  id: string
  completionPhotos?: string[]
  completionNote?: string | null
  laborEntries?: LaborEntry[]
  costEntries?: CostEntry[]
}

interface QAReviewPanelProps {
  ticket: QATicketData
  onComplete: () => void
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Completion photo"
        className="max-w-full max-h-full object-contain rounded-xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function QAReviewPanel({ ticket, onComplete }: QAReviewPanelProps) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [showSendBack, setShowSendBack] = useState(false)
  const [rejectionNote, setRejectionNote] = useState('')
  const [isApproving, setIsApproving] = useState(false)
  const [isSendingBack, setIsSendingBack] = useState(false)
  const [approveError, setApproveError] = useState('')
  const [sendBackError, setSendBackError] = useState('')

  const completionPhotos = ticket.completionPhotos ?? []
  const completionNote = ticket.completionNote ?? ''
  const laborEntries = ticket.laborEntries ?? []
  const costEntries = ticket.costEntries ?? []

  // Calculate totals
  const totalHours = laborEntries.reduce((sum, e) => sum + e.hoursWorked, 0)
  const totalLaborCost = laborEntries.reduce((sum, e) => sum + e.hoursWorked * (e.hourlyRate ?? 0), 0)
  const totalMaterialsCost = costEntries.reduce((sum, e) => sum + e.amount, 0)
  const totalCost = totalLaborCost + totalMaterialsCost

  const canSendBack = rejectionNote.trim().length > 0

  async function handleApprove() {
    setIsApproving(true)
    setApproveError('')
    try {
      await fetchApi(`/api/maintenance/tickets/${ticket.id}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: 'DONE' }),
      })
      onComplete()
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : 'Failed to approve. Please try again.')
      setIsApproving(false)
    }
  }

  async function handleSendBack() {
    if (!canSendBack) return
    setIsSendingBack(true)
    setSendBackError('')
    try {
      await fetchApi(`/api/maintenance/tickets/${ticket.id}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: 'IN_PROGRESS',
          rejectionNote: rejectionNote.trim(),
        }),
      })
      onComplete()
    } catch (err) {
      setSendBackError(err instanceof Error ? err.message : 'Failed to send back. Please try again.')
      setIsSendingBack(false)
    }
  }

  return (
    <>
      {lightboxUrl && (
        <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}

      <div className="ui-glass p-5 rounded-2xl space-y-5 border-l-4 border-l-slate-900">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center">
            <Check className="w-4 h-4 text-primary-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">QA Review</h3>
            <p className="text-xs text-slate-500">Review completion evidence before approving</p>
          </div>
        </div>

        {/* Completion photos */}
        {completionPhotos.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Image className="w-3.5 h-3.5 text-slate-500" />
              <p className="text-xs font-semibold text-slate-700">
                Completion Photos ({completionPhotos.length})
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {completionPhotos.map((url, i) => (
                <button
                  key={url}
                  onClick={() => setLightboxUrl(url)}
                  className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 cursor-pointer hover:opacity-90 transition-opacity"
                  title="Click to view full size"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Completion photo ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/50 text-white text-[9px] rounded">
                    {i + 1}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Completion note */}
        {completionNote && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <p className="text-xs font-semibold text-slate-700">Completion Note</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{completionNote}</p>
            </div>
          </div>
        )}

        {/* Labor & cost summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-xs text-slate-500">Labor</p>
            </div>
            {laborEntries.length > 0 ? (
              <div>
                <p className="text-sm font-semibold text-slate-900">{totalHours.toFixed(1)}h</p>
                {totalLaborCost > 0 && (
                  <p className="text-xs text-slate-500">${totalLaborCost.toFixed(2)}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Not tracked</p>
            )}
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-xs text-slate-500">Materials</p>
            </div>
            {costEntries.length > 0 ? (
              <div>
                <p className="text-sm font-semibold text-slate-900">${totalMaterialsCost.toFixed(2)}</p>
                <p className="text-xs text-slate-500">{costEntries.length} item{costEntries.length !== 1 ? 's' : ''}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Not tracked</p>
            )}
          </div>
        </div>

        {totalCost > 0 && (
          <div className="bg-primary-50 border border-primary-100 rounded-xl px-3 py-2 flex items-center justify-between">
            <p className="text-xs font-medium text-primary-700">Total Cost</p>
            <p className="text-sm font-semibold text-primary-800">${totalCost.toFixed(2)}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-3">
          {approveError && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{approveError}</p>
          )}

          <div className="flex gap-2">
            {/* Approve & Close */}
            <button
              onClick={handleApprove}
              disabled={isApproving || isSendingBack}
              className="ui-btn-md ui-btn-primary flex-1"
            >
              {isApproving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Approve & Close
            </button>

            {/* Send Back toggle */}
            <button
              onClick={() => setShowSendBack((v) => !v)}
              disabled={isApproving || isSendingBack}
              className={`
                flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border-2 transition-colors cursor-pointer
                ${showSendBack
                  ? 'bg-red-50 border-red-400 text-red-700'
                  : 'bg-white border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400'
                }
              `}
            >
              <RotateCcw className="w-4 h-4" />
              Send Back
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSendBack ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Send Back inline textarea */}
          <AnimatePresence>
            {showSendBack && (
              <motion.div
                key="send-back-form"
                variants={expandCollapse}
                initial="collapsed"
                animate="expanded"
                exit="collapsed"
                className="overflow-hidden"
              >
                <div className="space-y-2 pt-1">
                  <label className="block text-xs font-medium text-red-700">
                    Rejection Note <span className="text-red-500">*</span>
                    <span className="text-slate-400 font-normal ml-1">— explain what needs to be corrected</span>
                  </label>
                  <textarea
                    value={rejectionNote}
                    onChange={(e) => setRejectionNote(e.target.value)}
                    placeholder="Describe what needs to be fixed or completed before approval..."
                    rows={3}
                    className="w-full px-3 py-2.5 border border-red-200 rounded-xl text-sm bg-white resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus:border-red-400 placeholder:text-slate-400"
                  />
                  {sendBackError && (
                    <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{sendBackError}</p>
                  )}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSendBack}
                      disabled={!canSendBack || isSendingBack}
                      className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      {isSendingBack ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                      Confirm Rejection
                    </button>
                    <button
                      onClick={() => { setShowSendBack(false); setRejectionNote('') }}
                      className="text-sm text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  )
}
