'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryOptions } from '@/lib/queries'
import { motion } from 'framer-motion'
import { staggerContainer, fadeInUp } from '@/lib/animations'
import { IllustrationCompliance } from '@/components/illustrations'
import {
  FileText,
  Download,
  Loader2,
  ChevronDown,
} from 'lucide-react'
import ITErrorState from './ITErrorState'
import { Select } from '@/components/ui/Select'

// ─── Types ──────────────────────────────────────────────────────────────

interface ITERateTabProps {
  canManage: boolean
}

interface ERateDocument {
  id: string
  title: string
  type: string
  schoolYear: string
  uploadedAt: string
  retentionUntil: string | null
  tags: string[]
}

// ─── Helpers ────────────────────────────────────────────────────────────

function getCurrentSchoolYear(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  if (month >= 7) return `${year}-${year + 1}`
  return `${year - 1}-${year}`
}

function getSchoolYearOptions(): string[] {
  const now = new Date()
  const year = now.getFullYear()
  const options: string[] = []
  for (let y = year + 1; y >= year - 3; y--) {
    options.push(`${y}-${y + 1}`)
  }
  return options
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Skeleton ───────────────────────────────────────────────────────────

function ERateSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-9 w-36 bg-slate-200 rounded-lg animate-pulse" />
        <div className="flex gap-2">
          <div className="h-10 w-40 bg-slate-200 rounded-full animate-pulse" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="ui-glass-table">
        <div className="p-4 border-b border-slate-200/30">
          <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-4 border-b border-slate-100 flex gap-4">
            <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────

export default function ITERateTab({ canManage }: ITERateTabProps) {
  const [schoolYear, setSchoolYear] = useState(getCurrentSchoolYear)

  // ── Queries ──

  const {
    data: documentsData,
    isLoading: documentsLoading,
    isError: documentsError,
    refetch: refetchDocuments,
  } = useQuery(queryOptions.itERateDocuments(schoolYear))

  const documents: ERateDocument[] = useMemo(() => {
    if (!documentsData) return []
    const raw = (documentsData as { documents?: ERateDocument[] })?.documents
    return Array.isArray(raw) ? raw : Array.isArray(documentsData) ? documentsData as ERateDocument[] : []
  }, [documentsData])

  const [generatingDoc, setGeneratingDoc] = useState(false)

  async function handleGenerateDocPackage() {
    setGeneratingDoc(true)
    try {
      const blob = await fetch('/api/it/erate/documentation-package', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ schoolYear }),
      }).then((r) => r.blob())
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `erate-documentation-${schoolYear}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setGeneratingDoc(false)
    }
  }

  // ── Loading state ──

  if (documentsError) return <ITErrorState onRetry={refetchDocuments} />
  if (documentsLoading) {
    return <ERateSkeleton />
  }

  // ── Render ──

  return (
    <motion.div
      variants={staggerContainer()}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* ── Header Row ── */}
      <motion.div variants={fadeInUp} className="flex items-center justify-between flex-wrap gap-3">
        <div className="relative">
          <Select
            value={schoolYear}
            onChange={setSchoolYear}
            options={getSchoolYearOptions().map((sy) => ({ value: sy, label: sy }))}
            size="sm"
          />
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>

        <div className="flex gap-2">
          {canManage && (
            <button
              onClick={handleGenerateDocPackage}
              disabled={generatingDoc}
              className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-colors duration-200 disabled:opacity-50"
            >
              {generatingDoc ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Generate Doc Package
                </span>
              )}
            </button>
          )}
        </div>
      </motion.div>

      {/* ── Document Archive ── */}
      <motion.div variants={fadeInUp}>
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-slate-500" />
          Document Archive
        </h3>

        {documents.length === 0 && !documentsLoading ? (
          <div className="ui-glass p-8 text-center">
            <IllustrationCompliance className="w-40 h-32 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-600 mb-1">No documents for {schoolYear}.</p>
          </div>
        ) : (
          <div className="ui-glass-table">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      School Year
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Uploaded
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Retention Until
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Tags
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors duration-200">
                      <td className="px-4 py-3 font-medium text-slate-900">{doc.title}</td>
                      <td className="px-4 py-3 text-slate-600">{doc.type}</td>
                      <td className="px-4 py-3 text-slate-600">{doc.schoolYear}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(doc.uploadedAt)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {doc.retentionUntil ? formatDate(doc.retentionUntil) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {doc.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
