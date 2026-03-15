'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardList,
  Plus,
  ChevronDown,
  ChevronUp,
  Loader2,
  ExternalLink,
  Trash2,
  BarChart3,
  X,
} from 'lucide-react'
import {
  useSurveys,
  useCreateSurvey,
  useUpdateSurvey,
  useDeleteSurvey,
  useSurveyResults,
} from '@/lib/hooks/useEventComms'
import { useRegistrationForm } from '@/lib/hooks/useRegistrationForm'
import { useToast } from '@/components/Toast'
import { listItem, staggerContainer } from '@/lib/animations'
import type { EventSurveyWithStats, SurveyStatus } from '@/lib/types/events-phase21'
import type { SurveyResults } from '@/lib/services/eventSurveyService'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getSurveyPublicUrl(shareSlug: string, surveyId: string): string {
  if (typeof window === 'undefined') return ''
  const origin = window.location.origin
  return `${origin}/events/register/${shareSlug}?survey=${surveyId}`
}

const STATUS_STYLES: Record<SurveyStatus, { style: string; label: string }> = {
  DRAFT: { style: 'bg-gray-100 text-gray-600', label: 'Draft' },
  ACTIVE: { style: 'bg-green-100 text-green-700', label: 'Active' },
  CLOSED: { style: 'bg-red-100 text-red-600', label: 'Closed' },
}

// ─── Survey Results Panel ─────────────────────────────────────────────────────

interface ResultsPanelProps {
  surveyId: string
  eventProjectId: string
}

function ResultsPanel({ surveyId, eventProjectId }: ResultsPanelProps) {
  const { data: results, isLoading } = useSurveyResults(surveyId, eventProjectId)

  if (isLoading) {
    return (
      <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
        {[1, 2].map(i => (
          <div key={i} className="animate-pulse h-10 bg-gray-100 rounded-lg" />
        ))}
      </div>
    )
  }

  if (!results || results.totalResponses === 0) {
    return (
      <div className="mt-3 pt-3 border-t border-gray-100 text-center py-4">
        <BarChart3 className="w-8 h-8 text-gray-200 mx-auto mb-1.5" />
        <p className="text-xs text-gray-500">No responses yet.</p>
      </div>
    )
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-4">
      <p className="text-xs font-medium text-gray-500">
        {results.totalResponses} response{results.totalResponses !== 1 ? 's' : ''}
      </p>

      {Object.entries(results.aggregation).map(([fieldKey, agg]) => (
        <div key={fieldKey}>
          <p className="text-xs font-semibold text-gray-700 mb-1.5 capitalize">
            {fieldKey.replace(/_/g, ' ')}
          </p>

          {agg.type === 'choices' && agg.counts && (
            <div className="space-y-1.5">
              {Object.entries(agg.counts)
                .sort(([, a], [, b]) => b - a)
                .map(([choice, count]) => {
                  const pct = results.totalResponses > 0
                    ? Math.round((count / results.totalResponses) * 100)
                    : 0
                  return (
                    <div key={choice} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-xs text-gray-600 truncate">{choice}</span>
                          <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{count} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: 'linear-gradient(90deg, #3B82F6 0%, #6366F1 100%)',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}

          {agg.type === 'text' && agg.textValues && (
            <div className="space-y-1">
              {agg.textValues.slice(0, 5).map((text, idx) => (
                <p key={idx} className="text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5 italic">
                  &ldquo;{text.length > 120 ? text.slice(0, 120) + '…' : text}&rdquo;
                </p>
              ))}
              {agg.textValues.length > 5 && (
                <p className="text-xs text-gray-400">+{agg.textValues.length - 5} more responses</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Survey Card ──────────────────────────────────────────────────────────────

interface SurveyCardProps {
  survey: EventSurveyWithStats
  eventProjectId: string
  shareSlug: string | null
  onUpdateStatus: (surveyId: string, status: SurveyStatus) => void
  onDelete: (surveyId: string) => void
  isUpdating: boolean
  isDeleting: boolean
}

function SurveyCard({
  survey,
  eventProjectId,
  shareSlug,
  onUpdateStatus,
  onDelete,
  isUpdating,
  isDeleting,
}: SurveyCardProps) {
  const [showResults, setShowResults] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const statusInfo = STATUS_STYLES[survey.status as SurveyStatus]
  const publicUrl = shareSlug ? getSurveyPublicUrl(shareSlug, survey.id) : null

  return (
    <motion.div
      variants={listItem}
      className="bg-white border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition-colors"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-gray-900 truncate">
              {survey.formTitle ?? 'Untitled Survey'}
            </h4>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.style}`}>
              {statusInfo.label}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
            <span className="text-xs text-gray-500">
              {survey.responseCount} response{survey.responseCount !== 1 ? 's' : ''}
            </span>
            {survey.opensAt && (
              <span className="text-xs text-gray-400">Opens {formatDate(survey.opensAt)}</span>
            )}
            {survey.closesAt && (
              <span className="text-xs text-gray-400">Closes {formatDate(survey.closesAt)}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Status toggle */}
          {survey.status === 'DRAFT' && (
            <button
              type="button"
              onClick={() => onUpdateStatus(survey.id, 'ACTIVE')}
              disabled={isUpdating || isDeleting}
              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Activate'}
            </button>
          )}
          {survey.status === 'ACTIVE' && (
            <button
              type="button"
              onClick={() => onUpdateStatus(survey.id, 'CLOSED')}
              disabled={isUpdating || isDeleting}
              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Close'}
            </button>
          )}

          {/* View Results */}
          <button
            type="button"
            onClick={() => setShowResults(prev => !prev)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors cursor-pointer"
            aria-label="View results"
            title="View Results"
          >
            {showResults ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <BarChart3 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
            aria-label="Delete survey"
          >
            {isDeleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Public survey URL */}
      {publicUrl && survey.status === 'ACTIVE' && (
        <div className="mt-2">
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{publicUrl}</span>
          </a>
        </div>
      )}

      {/* Results panel */}
      <AnimatePresence>
        {showResults && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <ResultsPanel surveyId={survey.id} eventProjectId={eventProjectId} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-500">Delete this survey?</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(survey.id)
                    setShowDeleteConfirm(false)
                  }}
                  disabled={isDeleting}
                  className="text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Create Survey Modal ──────────────────────────────────────────────────────

interface CreateSurveyModalProps {
  formId: string | null  // the event's registration form ID, if available
  formTitle: string | null
  onSubmit: (formId: string, opensAt?: string | null, closesAt?: string | null) => void
  onClose: () => void
  isPending: boolean
}

function CreateSurveyModal({ formId, formTitle, onSubmit, onClose, isPending }: CreateSurveyModalProps) {
  const [selectedFormId] = useState(formId ?? '')
  const [opensAt, setOpensAt] = useState('')
  const [closesAt, setClosesAt] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFormId) return
    onSubmit(
      selectedFormId,
      opensAt ? new Date(opensAt).toISOString() : null,
      closesAt ? new Date(closesAt).toISOString() : null,
    )
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Create Survey</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Form selector */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
              Survey Form
            </label>
            {formId ? (
              <div className="px-3.5 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700">
                {formTitle ?? 'Registration Form'}
              </div>
            ) : (
              <div className="px-3.5 py-2.5 bg-amber-50 rounded-xl border border-amber-200 text-sm text-amber-700">
                No registration form found. Create a form on the Registration tab first.
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1.5">
              Surveys use the existing registration form as their question template.
            </p>
          </div>

          {/* Optional date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                Opens (optional)
              </label>
              <input
                type="datetime-local"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                Closes (optional)
              </label>
              <input
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-colors"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formId || isPending}
              className="flex-1 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Survey'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────────

interface SurveyManagerProps {
  eventProjectId: string
}

export function SurveyManager({ eventProjectId }: SurveyManagerProps) {
  const { toast } = useToast()
  const { data: surveys = [], isLoading } = useSurveys(eventProjectId)
  const { data: formData } = useRegistrationForm(eventProjectId)
  const createMutation = useCreateSurvey(eventProjectId)
  const updateMutation = useUpdateSurvey(eventProjectId)
  const deleteMutation = useDeleteSurvey(eventProjectId)

  const [showCreateModal, setShowCreateModal] = useState(false)

  const registrationForm = formData?.form ?? null

  function handleCreate(formId: string, opensAt?: string | null, closesAt?: string | null) {
    createMutation.mutate(
      { formId, opensAt, closesAt },
      {
        onSuccess: () => {
          toast('Survey created', 'success')
          setShowCreateModal(false)
        },
        onError: (err) => {
          toast(err instanceof Error ? err.message : 'Failed to create survey', 'error')
        },
      },
    )
  }

  function handleUpdateStatus(surveyId: string, status: SurveyStatus) {
    updateMutation.mutate(
      { surveyId, status },
      {
        onError: (err) => {
          toast(err instanceof Error ? err.message : 'Failed to update survey', 'error')
        },
      },
    )
  }

  function handleDelete(surveyId: string) {
    deleteMutation.mutate(surveyId, {
      onError: (err) => {
        toast(err instanceof Error ? err.message : 'Failed to delete survey', 'error')
      },
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="animate-pulse h-16 bg-gray-100 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <>
      <AnimatePresence>
        {showCreateModal && (
          <CreateSurveyModal
            formId={registrationForm?.id ?? null}
            formTitle={registrationForm?.title ?? null}
            onSubmit={handleCreate}
            onClose={() => setShowCreateModal(false)}
            isPending={createMutation.isPending}
          />
        )}
      </AnimatePresence>

      {/* Header with Create button */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">
          {surveys.length === 0 ? 'No surveys yet' : `${surveys.length} survey${surveys.length !== 1 ? 's' : ''}`}
        </p>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 active:scale-[0.97] transition-all duration-200 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Survey
        </button>
      </div>

      {surveys.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
            <ClipboardList className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500">No surveys yet</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
            Create a survey to collect post-event feedback from participants using your registration form.
          </p>
        </div>
      ) : (
        <motion.div
          className="space-y-3"
          variants={staggerContainer()}
          initial="hidden"
          animate="visible"
        >
          {surveys.map((survey) => (
            <SurveyCard
              key={survey.id}
              survey={survey}
              eventProjectId={eventProjectId}
              shareSlug={registrationForm?.shareSlug ?? null}
              onUpdateStatus={handleUpdateStatus}
              onDelete={handleDelete}
              isUpdating={updateMutation.isPending && updateMutation.variables?.surveyId === survey.id}
              isDeleting={deleteMutation.isPending && deleteMutation.variables === survey.id}
            />
          ))}
        </motion.div>
      )}
    </>
  )
}
