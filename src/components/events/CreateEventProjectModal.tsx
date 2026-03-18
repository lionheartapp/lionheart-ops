'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, CalendarDays, MapPin, Users } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { scaleIn } from '@/lib/animations'
import { useCreateEventProject } from '@/lib/hooks/useEventProject'
import { useToast } from '@/components/Toast'
import type { CreateEventProjectInput } from '@/lib/types/event-project'

interface CreateEventProjectModalProps {
  isOpen: boolean
  onClose: () => void
}

interface FormData {
  title: string
  description: string
  startsAt: string
  startsAtTime: string
  endsAt: string
  endsAtTime: string
  isMultiDay: boolean
  locationText: string
  expectedAttendance: string
}

const defaultForm: FormData = {
  title: '',
  description: '',
  startsAt: '',
  startsAtTime: '',
  endsAt: '',
  endsAtTime: '',
  isMultiDay: false,
  locationText: '',
  expectedAttendance: '',
}

export function CreateEventProjectModal({ isOpen, onClose }: CreateEventProjectModalProps) {
  const router = useRouter()
  const createProject = useCreateEventProject()
  const { toast } = useToast()
  const [form, setForm] = useState<FormData>(defaultForm)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function handleClose() {
    setForm(defaultForm)
    setErrors({})
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const newErrors: Partial<Record<keyof FormData, string>> = {}
    if (!form.title.trim()) newErrors.title = 'Title is required'
    if (!form.startsAt) newErrors.startsAt = 'Start date is required'
    if (!form.endsAt) newErrors.endsAt = 'End date is required'
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const startDateTime = form.startsAtTime
      ? `${form.startsAt}T${form.startsAtTime}:00`
      : `${form.startsAt}T00:00:00`
    const endDateTime = form.endsAtTime
      ? `${form.endsAt}T${form.endsAtTime}:00`
      : form.isMultiDay
      ? `${form.endsAt}T23:59:59`
      : `${form.startsAt}T${form.endsAtTime || form.startsAtTime || '23:59'}:59`

    const payload: CreateEventProjectInput = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      startsAt: new Date(startDateTime),
      endsAt: new Date(endDateTime),
      isMultiDay: form.isMultiDay,
      requiresAV: false,
      requiresFacilities: false,
      locationText: form.locationText.trim() || undefined,
      expectedAttendance: form.expectedAttendance
        ? parseInt(form.expectedAttendance, 10)
        : undefined,
    }

    try {
      const project = await createProject.mutateAsync(payload)
      toast('Event project created', 'success')
      handleClose()
      router.push(`/events/${project.id}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create event', 'error')
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-modal"
            onClick={handleClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
            <motion.div
              variants={scaleIn}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="w-full max-w-lg ui-glass-overlay rounded-2xl flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0">
                <h2 className="text-lg font-semibold text-gray-900">New Event Project</h2>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} id="create-event-form" className="flex-1 overflow-y-auto px-6 pb-2">
                <div className="space-y-5">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => update('title', e.target.value)}
                      placeholder="e.g. Spring Retreat 2026"
                      autoFocus
                      className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 ${
                        errors.title ? 'border-red-300' : 'border-gray-200'
                      }`}
                    />
                    {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Description
                    </label>
                    <textarea
                      value={form.description}
                      onChange={(e) => update('description', e.target.value)}
                      rows={3}
                      placeholder="Brief overview of this event..."
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 resize-none"
                    />
                  </div>

                  {/* Multi-day toggle */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => update('isMultiDay', !form.isMultiDay)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                        form.isMultiDay ? 'bg-indigo-500' : 'bg-gray-200'
                      }`}
                      aria-checked={form.isMultiDay}
                      role="switch"
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          form.isMultiDay ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                    <label
                      className="text-sm font-medium text-gray-700 cursor-pointer"
                      onClick={() => update('isMultiDay', !form.isMultiDay)}
                    >
                      Multi-day event
                    </label>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        <CalendarDays className="inline w-3.5 h-3.5 mr-1 text-gray-400" />
                        Start Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={form.startsAt}
                        onChange={(e) => {
                          update('startsAt', e.target.value)
                          if (!form.isMultiDay) update('endsAt', e.target.value)
                        }}
                        className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:border-indigo-400 ${
                          errors.startsAt ? 'border-red-300' : 'border-gray-200'
                        }`}
                      />
                    </div>
                    {form.isMultiDay ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          End Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={form.endsAt}
                          onChange={(e) => update('endsAt', e.target.value)}
                          min={form.startsAt}
                          className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:border-indigo-400 ${
                            errors.endsAt ? 'border-red-300' : 'border-gray-200'
                          }`}
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Start Time
                        </label>
                        <input
                          type="time"
                          value={form.startsAtTime}
                          onChange={(e) => update('startsAtTime', e.target.value)}
                          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                    )}
                  </div>

                  {/* End time (single-day only) */}
                  {!form.isMultiDay && (
                    <div className="grid grid-cols-2 gap-3">
                      <div />
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">End Time</label>
                        <input
                          type="time"
                          value={form.endsAtTime}
                          onChange={(e) => update('endsAtTime', e.target.value)}
                          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                    </div>
                  )}

                  {/* Location */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      <MapPin className="inline w-3.5 h-3.5 mr-1 text-gray-400" />
                      Location
                    </label>
                    <input
                      type="text"
                      value={form.locationText}
                      onChange={(e) => update('locationText', e.target.value)}
                      placeholder="e.g. Camp Linfield, Main Campus"
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400"
                    />
                  </div>

                  {/* Expected Attendance */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      <Users className="inline w-3.5 h-3.5 mr-1 text-gray-400" />
                      Expected Attendance
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={form.expectedAttendance}
                      onChange={(e) => update('expectedAttendance', e.target.value)}
                      placeholder="e.g. 120"
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>
              </form>

              {/* Footer */}
              <div className="flex-shrink-0 border-t border-gray-200 px-6 py-4 flex gap-3">
                <button
                  type="submit"
                  form="create-event-form"
                  disabled={createProject.isPending}
                  className="flex-1 py-2.5 rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-60 active:scale-[0.97] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {createProject.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Event Project
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2.5 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
