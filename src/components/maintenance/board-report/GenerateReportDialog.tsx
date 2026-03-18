'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FileText, Loader2, Sparkles } from 'lucide-react'
import { scaleIn } from '@/lib/animations'

interface GenerateReportDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  token: string | null
}

function getMonthYear(offset = 0): { year: number; month: number } {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

function formatMonthYear(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

function padMonth(n: number) {
  return String(n).padStart(2, '0')
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function GenerateReportDialog({
  isOpen,
  onClose,
  onSuccess,
  token,
}: GenerateReportDialogProps) {
  const { year: defaultYear, month: defaultMonth } = getMonthYear()

  const [selectedYear, setSelectedYear] = useState(defaultYear)
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth)
  const [includeAI, setIncludeAI] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)

    const from = `${selectedYear}-${padMonth(selectedMonth)}-01`
    const to = `${selectedYear}-${padMonth(selectedMonth)}-${lastDayOfMonth(selectedYear, selectedMonth)}`

    try {
      const resp = await fetch('/api/maintenance/board-report/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ from, to }),
      })

      if (!resp.ok) {
        const data = await resp.json().catch(() => null)
        throw new Error(data?.error?.message ?? 'Failed to generate report')
      }

      // Trigger download
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `board-report-${selectedYear}-${padMonth(selectedMonth)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      onSuccess?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // Month picker options
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2024, i, 1).toLocaleDateString('en-US', { month: 'long' }),
  }))
  const years = [defaultYear - 1, defaultYear, defaultYear + 1]

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Dialog */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="ui-glass-overlay w-full max-w-[540px] rounded-2xl overflow-hidden"
              variants={scaleIn}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              {/* Header */}
              <div className="flex items-start justify-between p-6 pb-4 border-b border-slate-100/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Generate Board Report</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure and download your PDF report
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                {/* Period picker */}
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Report Period
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      disabled={loading}
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-60"
                    >
                      {months.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      disabled={loading}
                      className="w-28 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-60"
                    >
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">
                    {formatMonthYear(selectedYear, selectedMonth)} — full month
                  </p>
                </div>

                {/* AI narrative toggle */}
                <div className="flex items-start gap-3 p-4 bg-primary-50/60 border border-primary-100 rounded-xl">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Sparkles className="w-4 h-4 text-primary-600" />
                      <span className="text-sm font-semibold text-slate-800">
                        AI Executive Summary
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Powered by Gemini — analyzes your facility data and writes a 3-paragraph
                      narrative for board members
                    </p>
                  </div>
                  <button
                    onClick={() => setIncludeAI(!includeAI)}
                    disabled={loading}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-60 ${
                      includeAI ? 'bg-primary-600' : 'bg-slate-300'
                    }`}
                    role="switch"
                    aria-checked={includeAI}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${
                        includeAI ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Loading state description */}
                {loading && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl"
                  >
                    <Loader2 className="w-4 h-4 text-amber-600 animate-spin flex-shrink-0" />
                    <p className="text-xs text-amber-700">
                      Generating report{includeAI ? ' with AI narrative' : ''}... This may take 10–30 seconds.
                    </p>
                  </motion.div>
                )}

                {/* Error */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-red-50 border border-red-100 rounded-xl"
                  >
                    <p className="text-xs text-red-600">{error}</p>
                  </motion.div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100/60">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      Generate PDF
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
