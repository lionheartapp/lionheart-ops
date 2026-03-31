'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles, RefreshCw, Loader2, ThumbsUp, ThumbsDown, Minus,
} from 'lucide-react'
import { listItem } from '@/lib/animations'
import type { AIFeedbackAnalysis } from '@/lib/types/event-ai'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FeedbackAnalysisSectionProps {
  eventProjectId: string
}

// ─── Component ──────────────────────────────────────────────────────────────

const sentimentConfig: Record<string, { icon: React.ReactNode; badge: string }> = {
  positive: { icon: <ThumbsUp className="w-3 h-3" />, badge: 'bg-green-100 text-green-700' },
  negative: { icon: <ThumbsDown className="w-3 h-3" />, badge: 'bg-red-100 text-red-700' },
  neutral: { icon: <Minus className="w-3 h-3" />, badge: 'bg-slate-100 text-slate-600' },
  mixed: { icon: <Minus className="w-3 h-3" />, badge: 'bg-yellow-100 text-yellow-700' },
}

export function FeedbackAnalysisSection({ eventProjectId }: FeedbackAnalysisSectionProps) {
  const [analysis, setAnalysis] = useState<(AIFeedbackAnalysis & { responseCount: number }) | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetched, setFetched] = useState(false)

  async function fetchAnalysis() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/events/ai/analyze-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventProjectId }),
      })
      const json = (await res.json()) as { ok: boolean; data?: AIFeedbackAnalysis & { responseCount: number }; error?: { message: string } }
      setFetched(true)
      if (json.ok && json.data) {
        setAnalysis(json.data)
      } else {
        setError(json.error?.message ?? 'Failed to analyze feedback')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div variants={listItem} className="ui-glass p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          Post-Event Feedback Analysis
        </h3>
        <button
          onClick={() => { void fetchAnalysis() }}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : fetched ? (
            <RefreshCw className="w-3.5 h-3.5" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          {loading ? 'Analyzing...' : fetched ? 'Refresh Analysis' : 'Run Analysis'}
        </button>
      </div>

      {!fetched && !loading && (
        <p className="text-sm text-slate-400 text-center py-6">
          Click &quot;Run Analysis&quot; to analyze survey feedback with AI
        </p>
      )}

      {loading && (
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-slate-100 rounded-lg w-3/4" />
          <div className="h-4 bg-slate-100 rounded-lg w-full" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-16 bg-slate-100 rounded-xl" />
            <div className="h-16 bg-slate-100 rounded-xl" />
          </div>
        </div>
      )}

      {error && !loading && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {analysis && !loading && (
        <>
          <p className="text-xs text-slate-500">
            Based on{' '}
            <span className="font-semibold text-slate-700">{analysis.responseCount}</span>{' '}
            survey response{analysis.responseCount === 1 ? '' : 's'}
          </p>

          {/* Summary paragraph */}
          {analysis.summary && (
            <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/80 rounded-xl p-4 border border-indigo-100/50">
              <p className="text-sm text-slate-700 leading-relaxed">{analysis.summary}</p>
            </div>
          )}

          {/* Theme cards */}
          {analysis.themes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2">Key Themes</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {analysis.themes.map((theme, i) => {
                  const config = sentimentConfig[theme.sentiment] ?? sentimentConfig.neutral
                  return (
                    <div key={i} className="bg-white border border-slate-100 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-slate-800 truncate pr-2">
                          {theme.theme}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${config.badge}`}
                        >
                          {config.icon}
                          {theme.sentiment}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{theme.count} mentions</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Action items */}
          {analysis.actionItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">Action Items for Next Time</p>
              <div className="space-y-1.5">
                {analysis.actionItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-slate-700">
                    <div className="w-5 h-5 rounded flex items-center justify-center bg-indigo-50 border border-indigo-100 flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-indigo-500">{i + 1}</span>
                    </div>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}
