'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Save, Loader2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import type { ComplianceDomainCardData } from './ComplianceDomainCard'
import type { ComplianceDomain } from '@prisma/client'

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface ComplianceSetupWizardProps {
  domainData: ComplianceDomainCardData | null
  isOpen: boolean
  onClose: () => void
}

export function ComplianceSetupWizard({
  domainData,
  isOpen,
  onClose,
}: ComplianceSetupWizardProps) {
  const queryClient = useQueryClient()

  const [isEnabled, setIsEnabled] = useState(true)
  const [customMonth, setCustomMonth] = useState<string>('')
  const [customDay, setCustomDay] = useState<string>('')
  const [notes, setNotes] = useState('')

  // Sync form state from domainData
  useEffect(() => {
    if (domainData) {
      setIsEnabled(domainData.isEnabled)
      setCustomMonth(domainData.meta.defaultMonth.toString())
      setCustomDay(domainData.meta.defaultDay.toString())
      setNotes(domainData.notes ?? '')
    }
  }, [domainData])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!domainData) return
      const body = {
        domain: domainData.domain,
        isEnabled,
        customDeadlineMonth: customMonth ? parseInt(customMonth) : null,
        customDeadlineDay: customDay ? parseInt(customDay) : null,
        notes: notes || null,
        schoolId: domainData.schoolId ?? null,
      }
      return fetchApi('/api/maintenance/compliance/domains', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-domains'] })
      queryClient.invalidateQueries({ queryKey: ['compliance-records'] })
      onClose()
    },
  })

  const populateMutation = useMutation({
    mutationFn: async () => {
      return fetchApi('/api/maintenance/compliance/domains/populate', {
        method: 'POST',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-records'] })
    },
  })

  if (!domainData) return null

  const { meta } = domainData

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Slide-over panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 h-full w-full max-w-md ui-glass-overlay z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200/50">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{meta.label}</h2>
                <p className="text-xs text-slate-500 mt-0.5">Configure compliance settings</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Description */}
              <div className="ui-glass p-4 rounded-xl">
                <p className="text-sm text-slate-600 leading-relaxed">{meta.description}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                  <span>Frequency: {meta.frequencyYears === 1 ? 'Annual' : `Every ${meta.frequencyYears} years`}</span>
                  <span>•</span>
                  <span>Default: {MONTH_NAMES[meta.defaultMonth]} {meta.defaultDay}</span>
                </div>
              </div>

              {/* Toggle */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">
                  Apply to our school
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEnabled(!isEnabled)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                      isEnabled ? 'bg-primary-600' : 'bg-slate-200'
                    }`}
                    role="switch"
                    aria-checked={isEnabled}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
                        isEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm text-slate-600">
                    {isEnabled ? 'Enabled — tracked in calendar' : 'Disabled — not tracked'}
                  </span>
                </div>
              </div>

              {/* Custom deadline */}
              {isEnabled && (
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-2">
                    Custom Deadline (optional)
                  </label>
                  <p className="text-xs text-slate-400 mb-3">
                    Override the default deadline of {MONTH_NAMES[meta.defaultMonth]} {meta.defaultDay}.
                    Leave blank to use the default.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Month</label>
                      <select
                        value={customMonth}
                        onChange={(e) => setCustomMonth(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      >
                        {MONTH_NAMES.slice(1).map((name, i) => (
                          <option key={i + 1} value={i + 1}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Day</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={customDay}
                        onChange={(e) => setCustomDay(e.target.value)}
                        placeholder={meta.defaultDay.toString()}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Inspector contact info, local requirements, etc."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 resize-none"
                />
              </div>

              {/* Populate Calendar button */}
              {isEnabled && (
                <div className="ui-glass p-4 rounded-xl">
                  <p className="text-sm font-medium text-slate-700 mb-1">Populate Calendar</p>
                  <p className="text-xs text-slate-400 mb-3">
                    Generate compliance deadlines for the current school year (Aug 1 – Jul 31).
                  </p>
                  <button
                    type="button"
                    onClick={() => populateMutation.mutate()}
                    disabled={populateMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary-50 text-primary-700 border border-primary-200 text-sm font-medium hover:bg-primary-100 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {populateMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : null}
                    {populateMutation.isPending ? 'Populating...' : 'Populate Calendar for This Year'}
                  </button>
                  {populateMutation.isSuccess && (
                    <p className="text-xs text-primary-600 mt-2 text-center">Calendar populated successfully</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-200/50 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
