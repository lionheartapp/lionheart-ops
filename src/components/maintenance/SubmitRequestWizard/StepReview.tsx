'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin,
  Camera,
  Tag,
  AlertTriangle,
  ChevronRight,
  Calendar,
  MessageSquare,
  Clock,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { fadeInUp } from '@/lib/animations'
import type { UploadedPhoto } from './StepPhotos'

const CATEGORY_LABELS: Record<string, string> = {
  ELECTRICAL: 'Electrical',
  PLUMBING: 'Plumbing',
  HVAC: 'HVAC',
  STRUCTURAL: 'Structural',
  CUSTODIAL_BIOHAZARD: 'Custodial / Biohazard',
  IT_AV: 'IT / A/V',
  GROUNDS: 'Grounds',
  OTHER: 'Other',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
}

interface MultiIssueData {
  hasMultipleIssues: boolean
  secondIssue?: { title: string; suggestedCategory: string }
}

export interface StepReviewFormData {
  locationLabel: string
  buildingId: string | null
  areaId: string | null
  roomId: string | null
  assetId?: string | null
  assetLabel?: string
  photos: UploadedPhoto[]
  title: string
  description: string
  category: string
  priority: string
  availabilityNote: string
  scheduledDate: string
}

interface StepReviewProps {
  formData: StepReviewFormData
  onSubmit: () => Promise<void>
  onSplitSubmit: () => Promise<{ ticketNumber: string }>
  onPreloadSecondTicket: (data: { title: string; category: string }) => void
  isSubmitting: boolean
  submitError: string
}

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  if (token) return { Authorization: `Bearer ${token}` }
  return {}
}

export default function StepReview({
  formData,
  onSubmit,
  onSplitSubmit,
  onPreloadSecondTicket,
  isSubmitting,
  submitError,
}: StepReviewProps) {
  const [multiIssue, setMultiIssue] = useState<MultiIssueData | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [checkingMultiIssue, setCheckingMultiIssue] = useState(false)
  const [splitState, setSplitState] = useState<{ submitting: boolean; firstTicketNumber: string | null }>({
    submitting: false,
    firstTicketNumber: null,
  })
  const hasFiredRef = useRef(false)

  // Fire multi-issue detection on mount
  useEffect(() => {
    if (hasFiredRef.current) return
    if (!formData.title || !formData.category) return
    hasFiredRef.current = true
    setCheckingMultiIssue(true)

    fetch('/api/maintenance/tickets/ai-detect-multi-issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        title: formData.title,
        description: formData.description,
        category: formData.category,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.data?.hasMultipleIssues) {
          setMultiIssue(data.data)
          if (data.data.secondIssue) {
            onPreloadSecondTicket(data.data.secondIssue)
          }
        }
      })
      .catch(() => {
        // silently ignore
      })
      .finally(() => setCheckingMultiIssue(false))
  }, [formData.title, formData.description, formData.category, onPreloadSecondTicket])

  const handleSplitSubmit = async () => {
    setSplitState({ submitting: true, firstTicketNumber: null })
    try {
      const result = await onSplitSubmit()
      setSplitState({ submitting: false, firstTicketNumber: result.ticketNumber })
      setBannerDismissed(true)
    } catch {
      setSplitState({ submitting: false, firstTicketNumber: null })
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Review Your Request</h3>
        <p className="text-sm text-gray-500">Confirm details before submitting</p>
      </div>

      {/* Multi-issue AI banner */}
      <AnimatePresence>
        {multiIssue?.hasMultipleIssues && !bannerDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
            transition={{ duration: 0.25 }}
            className="rounded-xl border border-amber-200 bg-amber-50 p-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-900 mb-1">
                  Looks like this might describe two separate issues
                </p>
                <p className="text-xs text-amber-700 mb-3">
                  Splitting into separate tickets helps the maintenance team address each one faster and track them independently.
                </p>
                {splitState.firstTicketNumber && (
                  <p className="text-xs text-emerald-700 font-medium mb-2">
                    First ticket {splitState.firstTicketNumber} created. Complete the second ticket below.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSplitSubmit}
                    disabled={splitState.submitting || isSubmitting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {splitState.submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                    Split into 2 tickets
                  </button>
                  <button
                    type="button"
                    onClick={() => setBannerDismissed(true)}
                    className="px-3 py-1.5 bg-white text-amber-700 text-xs font-medium rounded-lg border border-amber-200 hover:bg-amber-50 transition-colors cursor-pointer"
                  >
                    Submit as one ticket anyway
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI checking indicator */}
      {checkingMultiIssue && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          AI is reviewing your request...
        </div>
      )}

      {/* Summary card */}
      <div className="ui-glass rounded-xl overflow-hidden">
        {/* Location */}
        <div className="px-4 py-3 border-b border-gray-100/50">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</span>
          </div>
          <p className="text-sm text-gray-900 font-medium">{formData.locationLabel || 'Not specified'}</p>
        </div>

        {/* Title */}
        <div className="px-4 py-3 border-b border-gray-100/50">
          <div className="flex items-start gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Issue</span>
              <p className="text-sm font-medium text-gray-900">{formData.title}</p>
              {formData.description && (
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">{formData.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Category & Priority */}
        <div className="px-4 py-3 border-b border-gray-100/50">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Details</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.category && (
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-lg">
                {CATEGORY_LABELS[formData.category] || formData.category}
              </span>
            )}
            {formData.priority && (
              <span className={`px-2.5 py-1 text-xs font-medium rounded-lg ${PRIORITY_COLORS[formData.priority] || 'bg-gray-100 text-gray-700'}`}>
                {formData.priority} priority
              </span>
            )}
          </div>
        </div>

        {/* Photos */}
        {formData.photos.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-100/50">
            <div className="flex items-center gap-2 mb-2">
              <Camera className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Photos ({formData.photos.length})
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {formData.photos.map((photo, i) => (
                <div key={photo.url} className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.localPreview || photo.url}
                    alt={`Photo ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Availability note */}
        {formData.availabilityNote && (
          <div className="px-4 py-3 border-b border-gray-100/50">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Access Note</span>
            </div>
            <p className="text-sm text-gray-700">{formData.availabilityNote}</p>
          </div>
        )}

        {/* Scheduled date */}
        {formData.scheduledDate && (
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Scheduled For</span>
            </div>
            <p className="text-sm text-blue-700 font-medium">
              {new Date(formData.scheduledDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
              })}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Ticket will be activated on this date</p>
          </div>
        )}
      </div>

      {/* Submit error */}
      <AnimatePresence>
        {submitError && (
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100"
          >
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{submitError}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit button */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting}
        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-sm shadow-emerald-200"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            Submit Request
            <ChevronRight className="w-4 h-4" />
          </>
        )}
      </button>
    </div>
  )
}
