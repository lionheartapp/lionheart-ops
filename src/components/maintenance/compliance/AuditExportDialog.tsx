'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, Loader2, FileText } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getAuthHeaders } from '@/lib/api-client'
import { COMPLIANCE_DOMAIN_DEFAULTS, COMPLIANCE_DOMAINS } from '@/lib/types/compliance'
import type { ComplianceDomain } from '@prisma/client'

interface School {
  id: string
  name: string
}

interface AuditExportDialogProps {
  isOpen: boolean
  onClose: () => void
}

function defaultDateRange() {
  const now = new Date()
  // Current school year: Aug 1 → Jul 31
  const schoolYearStart =
    now.getMonth() >= 7
      ? new Date(now.getFullYear(), 7, 1)
      : new Date(now.getFullYear() - 1, 7, 1)
  const schoolYearEnd = new Date(schoolYearStart.getFullYear() + 1, 6, 31)
  return {
    from: schoolYearStart.toISOString().split('T')[0],
    to: schoolYearEnd.toISOString().split('T')[0],
  }
}

export function AuditExportDialog({ isOpen, onClose }: AuditExportDialogProps) {
  const defaults = defaultDateRange()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [schoolId, setSchoolId] = useState('')
  const [domain, setDomain] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // Fetch schools for multi-school filter
  const { data: schoolsData } = useQuery<{ data: School[] }>({
    queryKey: ['schools-for-export'],
    queryFn: async () => {
      const headers = getAuthHeaders()
      const res = await fetch('/api/settings/schools', { headers })
      if (!res.ok) return { data: [] }
      return res.json()
    },
    enabled: isOpen,
  })

  const schools: School[] = schoolsData?.data ?? []
  const isMultiSchool = schools.length > 1

  const handleExport = async () => {
    if (!from || !to) {
      setExportError('Please select a date range')
      return
    }
    if (new Date(from) > new Date(to)) {
      setExportError('From date must be before To date')
      return
    }

    setExportError(null)
    setIsExporting(true)

    try {
      const params = new URLSearchParams({ from, to })
      if (schoolId) params.set('schoolId', schoolId)
      if (domain) params.set('domain', domain)

      const headers = getAuthHeaders()
      const res = await fetch(`/api/maintenance/compliance/export?${params.toString()}`, {
        headers: {
          // Only pass Authorization, not Content-Type (it's a GET that returns binary)
          Authorization: (headers as Record<string, string>)['Authorization'] ?? '',
        },
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData?.error?.message || `Export failed (${res.status})`)
      }

      // Trigger browser download from blob
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const today = new Date().toISOString().split('T')[0]
      link.href = url
      link.download = `compliance-audit-${today}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      onClose()
    } catch (err) {
      console.error('[AuditExportDialog] Export error:', err)
      setExportError(err instanceof Error ? err.message : 'Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400, duration: 0.2 }}
            className="relative w-full max-w-lg ui-glass-overlay rounded-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-gray-200/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Export Compliance Audit Report</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Generate a downloadable PDF of all compliance records</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">From Date</label>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">To Date</label>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* School filter — only for multi-school orgs */}
              {isMultiSchool && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Campus / School</label>
                  <select
                    value={schoolId}
                    onChange={(e) => setSchoolId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="">All Schools</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Domain filter */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Domain</label>
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="">All Domains</option>
                  {COMPLIANCE_DOMAINS.map((d) => (
                    <option key={d} value={d}>{COMPLIANCE_DOMAIN_DEFAULTS[d as ComplianceDomain].label}</option>
                  ))}
                </select>
              </div>

              {/* Error */}
              {exportError && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {exportError}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-60"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isExporting ? 'Generating...' : 'Generate PDF'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
