'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles, AlertTriangle, ChevronRight, RefreshCw, Loader2,
} from 'lucide-react'
import { listItem } from '@/lib/animations'
import type { AIStatusSummary } from '@/lib/types/event-ai'

// ─── Types ──────────────────────────────────────────────────────────────────

interface AIStatusSectionProps {
  eventProjectId: string
  initialCompletionPercent?: number
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AIStatusSection({ eventProjectId, initialCompletionPercent = 0 }: AIStatusSectionProps) {
  const [summary, setSummary] = useState<(AIStatusSummary & { aiGenerated: boolean }) | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchSummary() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/events/ai/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventProjectId }),
      })
      const json = (await res.json()) as { ok: boolean; data?: AIStatusSummary & { aiGenerated: boolean }; error?: { message: string } }
      if (json.ok && json.data) {
        setSummary(json.data)
        if (!json.data.aiGenerated) {
          setError('AI summary requires GEMINI_API_KEY to be configured')
        }
      } else if (res.status === 503) {
        setError('AI summary requires GEMINI_API_KEY to be configured')
      } else {
        setError(json.error?.message ?? 'Failed to generate summary')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  // Auto-fetch on mount (two-phase pattern: first load comes quickly)
  useEffect(() => {
    void fetchSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventProjectId])

  const completionPercent = summary?.completionPercent ?? initialCompletionPercent

  return (
    <motion.div variants={listItem} className="ui-glass p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          AI Status Summary
        </h3>
        <button
          onClick={() => { void fetchSummary() }}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Refresh
        </button>
      </div>

      {/* Completion progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-500">Overall completion</span>
          <span className="text-xs font-semibold text-slate-800">{completionPercent}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${completionPercent}%`,
              background: 'linear-gradient(90deg, #3B82F6 0%, #6366F1 100%)',
            }}
          />
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && !summary && (
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-slate-100 rounded-lg w-3/4" />
          <div className="h-4 bg-slate-100 rounded-lg w-full" />
          <div className="h-4 bg-slate-100 rounded-lg w-5/6" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <p className="text-xs text-slate-400 italic">{error}</p>
      )}

      {/* AI summary content */}
      {summary && summary.aiGenerated && (
        <>
          {/* Natural language summary */}
          {summary.summary && (
            <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/80 rounded-xl p-4 border border-indigo-100/50">
              <p className="text-sm text-slate-700 leading-relaxed">{summary.summary}</p>
            </div>
          )}

          {/* At Risk items */}
          {summary.atRisk.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                At Risk
              </p>
              <div className="space-y-1">
                {summary.atRisk.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-amber-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next steps */}
          {summary.nextSteps.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">Next Steps</p>
              <ol className="space-y-1">
                {summary.nextSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                    <ChevronRight className="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}
