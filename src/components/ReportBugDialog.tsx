'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Bug, Send, CheckCircle2, AlertCircle } from 'lucide-react'

interface ReportBugDialogProps {
  isOpen: boolean
  onClose: () => void
}

export default function ReportBugDialog({ isOpen, onClose }: ReportBugDialogProps) {
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const subjectRef = useRef<HTMLInputElement>(null)

  // Focus subject input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => subjectRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setSubject('')
        setDescription('')
        setSubmitting(false)
        setSubmitted(false)
        setError('')
      }, 200)
    }
  }, [isOpen])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !description.trim()) return

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/support-tickets/platform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          description: description.trim(),
          category: 'BUG',
          priority: 'NORMAL',
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error?.message || 'Failed to submit bug report')
      }

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
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
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-modal"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed inset-0 z-modal flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
          >
            <div className="ui-glass-overlay w-full max-w-lg rounded-2xl shadow-heavy overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                    <Bug className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Report a Bug</h2>
                    <p className="text-xs text-slate-500">Help us improve Lionheart</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors duration-200 cursor-pointer"
                  aria-label="Close dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6">
                {submitted ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-6"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-7 h-7 text-green-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">Bug Report Submitted</h3>
                    <p className="text-sm text-slate-500 mb-6">
                      Thanks for letting us know. We&apos;ll look into it and get back to you.
                    </p>
                    <button
                      onClick={onClose}
                      className="px-6 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-full hover:bg-slate-800 transition-colors duration-200 cursor-pointer active:scale-[0.97]"
                    >
                      Done
                    </button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Subject */}
                    <div>
                      <label htmlFor="bug-subject" className="block text-sm font-medium text-slate-700 mb-1.5">
                        Subject
                      </label>
                      <input
                        ref={subjectRef}
                        id="bug-subject"
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Brief summary of the issue"
                        className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus:border-primary-400 transition-colors duration-200 placeholder:text-slate-400"
                        required
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label htmlFor="bug-description" className="block text-sm font-medium text-slate-700 mb-1.5">
                        What happened?
                      </label>
                      <textarea
                        id="bug-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe the bug: what you expected vs. what happened, and any steps to reproduce it."
                        rows={4}
                        className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus:border-primary-400 transition-colors duration-200 placeholder:text-slate-400 resize-none"
                        required
                      />
                    </div>

                    {/* Error */}
                    {error && (
                      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2.5">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {error}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 text-sm font-medium text-slate-600 rounded-xl hover:bg-slate-100 transition-colors duration-200 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting || !subject.trim() || !description.trim()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-full hover:bg-slate-800 transition-colors duration-200 cursor-pointer active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submitting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Submit Report
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
