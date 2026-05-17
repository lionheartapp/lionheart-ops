'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ClipboardList, Plus, Link2, ExternalLink, Loader2, Unlink } from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { fadeInUp } from '@/lib/animations'

// ─── Types ─────────────────────────────────────────────────────────────────

interface LinkedForm {
  id: string
  description: string | null
  ticketTypeCount: number
  submissionCount: number
  orderCount: number
}

interface AvailableForm {
  id: string
  description: string | null
  context: string
  createdAt: string
}

// ─── Component ─────────────────────────────────────────────────────────────

interface EventFormLinkTabProps {
  eventProjectId: string
}

export function EventFormLinkTab({ eventProjectId }: EventFormLinkTabProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [showLinkPicker, setShowLinkPicker] = useState(false)

  // Check if this event already has a linked form
  const { data: linkedForm, isLoading } = useQuery<LinkedForm | null>({
    queryKey: ['event-form-link', eventProjectId],
    queryFn: () => fetchApi<LinkedForm | null>(`/api/forms/event-link/${eventProjectId}`),
    staleTime: 30_000,
  })

  // Fetch available forms to link (only when picker is open)
  const { data: availableForms = [] } = useQuery<AvailableForm[]>({
    queryKey: ['available-forms-for-link'],
    queryFn: () => fetchApi<AvailableForm[]>('/api/forms/available-for-link'),
    enabled: showLinkPicker,
    staleTime: 10_000,
  })

  // Create new form linked to this event
  const createMutation = useMutation({
    mutationFn: () =>
      fetchApi<{ formId: string }>(`/api/forms/event-link/${eventProjectId}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'create' }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['event-form-link', eventProjectId] })
      toast('Form created — opening builder', 'success')
      router.push(`/forms/${data.formId}/builder`)
    },
    onError: () => toast('Failed to create form', 'error'),
  })

  // Link existing form
  const linkMutation = useMutation({
    mutationFn: (formId: string) =>
      fetchApi(`/api/forms/event-link/${eventProjectId}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'link', formId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-form-link', eventProjectId] })
      setShowLinkPicker(false)
      toast('Form linked to this event', 'success')
    },
    onError: () => toast('Failed to link form', 'error'),
  })

  // Unlink form
  const unlinkMutation = useMutation({
    mutationFn: () =>
      fetchApi(`/api/forms/event-link/${eventProjectId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-form-link', eventProjectId] })
      toast('Form unlinked', 'success')
    },
    onError: () => toast('Failed to unlink form', 'error'),
  })

  // Loading
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4 py-4">
        <div className="h-8 bg-slate-100 rounded-xl w-56" />
        <div className="h-48 bg-slate-100 rounded-xl" />
      </div>
    )
  }

  // ─── Linked Form Exists ─────────────────────────────────────────────────
  if (linkedForm) {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {linkedForm.description || 'Registration Form'}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                  {linkedForm.ticketTypeCount > 0 && (
                    <span>{linkedForm.ticketTypeCount} ticket types</span>
                  )}
                  {linkedForm.orderCount > 0 && (
                    <span>{linkedForm.orderCount} orders</span>
                  )}
                  {linkedForm.submissionCount > 0 && (
                    <span>{linkedForm.submissionCount} responses</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/forms/${linkedForm.id}/builder`)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Builder
              </button>
              <button
                onClick={() => unlinkMutation.mutate()}
                disabled={unlinkMutation.isPending}
                className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                title="Unlink form from this event"
              >
                <Unlink className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push(`/forms/${linkedForm.id}/builder`)}
            className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <p className="text-sm font-medium text-slate-900">Edit Form & Tickets</p>
            <p className="text-xs text-slate-400 mt-0.5">Manage fields, ticket types, pricing</p>
          </button>
          <button
            onClick={() => router.push(`/check-in/${linkedForm.id}`)}
            className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <p className="text-sm font-medium text-slate-900">Check-In Scanner</p>
            <p className="text-xs text-slate-400 mt-0.5">Scan tickets at the door</p>
          </button>
        </div>
      </div>
    )
  }

  // ─── No Form Linked — Empty State ──────────────────────────────────────
  return (
    <>
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="text-center py-16"
      >
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
          <ClipboardList className="w-8 h-8 text-indigo-500" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 mb-2">No Registration Form</h3>
        <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
          Create or link a form so attendees can register and purchase tickets for this event.
        </p>
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all duration-200 cursor-pointer disabled:opacity-60"
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Create New Form
          </button>
          <button
            onClick={() => setShowLinkPicker(true)}
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <Link2 className="w-4 h-4" />
            Link an existing form
          </button>
        </div>
      </motion.div>

      {/* Form picker modal */}
      {showLinkPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowLinkPicker(false)} />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 z-10 max-h-[70vh] overflow-y-auto"
          >
            <h3 className="text-base font-semibold text-slate-900 mb-4">Link Existing Form</h3>

            {availableForms.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                No unlinked forms available. Create a new one instead.
              </p>
            ) : (
              <div className="space-y-2">
                {availableForms.map((form) => (
                  <button
                    key={form.id}
                    onClick={() => linkMutation.mutate(form.id)}
                    disabled={linkMutation.isPending}
                    className="w-full flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer text-left"
                  >
                    <ClipboardList className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {form.description || 'Untitled Form'}
                      </p>
                      <p className="text-xs text-slate-400">
                        Created {new Date(form.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowLinkPicker(false)}
              className="mt-4 w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </motion.div>
        </div>
      )}
    </>
  )
}
