'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { getAuthHeaders } from '@/lib/api-client'
import {
  Brain,
  Sparkles,
  Loader2,
  AlertCircle,
  Clock,
  Shield,
  ChevronRight,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────

interface ITAIDiagnosticPanelProps {
  type: 'ticket' | 'device'
  targetId: string
}

interface TicketDiagnostic {
  category: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  steps: string[]
  estimatedTimeMinutes: number
  confidence: number
  summary: string
}

interface DeviceDiagnostic {
  healthScore: number
  issues: string[]
  recommendations: string[]
  summary: string
}

type DiagnosticResult =
  | { type: 'ticket'; data: TicketDiagnostic }
  | { type: 'device'; data: DeviceDiagnostic }

// ─── Constants ──────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  low: { bg: 'bg-green-100', text: 'text-green-700', label: 'Low' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Medium' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'High' },
  critical: { bg: 'bg-red-100', text: 'text-red-700', label: 'Critical' },
}

// ─── Health Score Gauge ─────────────────────────────────────────────────

function HealthScoreBar({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score))
  let colorClass = 'from-red-500 to-red-400'
  if (clamped >= 75) colorClass = 'from-green-500 to-emerald-400'
  else if (clamped >= 50) colorClass = 'from-yellow-500 to-amber-400'
  else if (clamped >= 25) colorClass = 'from-orange-500 to-amber-500'

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-xs font-medium text-slate-600">Health Score</span>
        <span className="text-2xl font-bold text-slate-900">{clamped}</span>
      </div>
      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${colorClass} transition-all duration-700 ease-out`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>Critical</span>
        <span>Fair</span>
        <span>Good</span>
        <span>Excellent</span>
      </div>
    </div>
  )
}

// ─── Confidence Meter ───────────────────────────────────────────────────

function ConfidenceMeter({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  let color = 'bg-red-500'
  if (pct >= 80) color = 'bg-green-500'
  else if (pct >= 60) color = 'bg-yellow-500'
  else if (pct >= 40) color = 'bg-orange-500'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-slate-600 w-10 text-right">{pct}%</span>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────

export default function ITAIDiagnosticPanel({ type, targetId }: ITAIDiagnosticPanelProps) {
  const [result, setResult] = useState<DiagnosticResult | null>(null)

  const diagnoseMutation = useMutation({
    mutationFn: async (): Promise<DiagnosticResult> => {
      const endpoint =
        type === 'ticket'
          ? `/api/it/intelligence/diagnose/ticket/${targetId}`
          : `/api/it/intelligence/diagnose/device/${targetId}`

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error?.message || 'Diagnosis failed')
      }
      const json = await res.json()
      const data = json.data ?? json

      if (type === 'ticket') {
        return {
          type: 'ticket',
          data: {
            category: data.category ?? 'General',
            severity: data.severity ?? 'medium',
            steps: data.steps ?? data.recommendations ?? [],
            estimatedTimeMinutes: data.estimatedTimeMinutes ?? data.estimatedTime ?? 30,
            confidence: data.confidence ?? 0.7,
            summary: data.summary ?? data.reasoning ?? '',
          },
        }
      } else {
        return {
          type: 'device',
          data: {
            healthScore: data.healthScore ?? 50,
            issues: data.issues ?? [],
            recommendations: data.recommendations ?? [],
            summary: data.summary ?? data.reasoning ?? '',
          },
        }
      }
    },
    onSuccess: (data) => setResult(data),
  })

  // ── Not yet analyzed ─────────────────────────────────────────────────
  if (!result && !diagnoseMutation.isPending) {
    return (
      <div className="ui-glass p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">AI Diagnostics</h4>
              <p className="text-xs text-slate-400">
                Powered by Gemini
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500 mb-3">
          {type === 'ticket'
            ? 'Analyze this ticket to get category, severity assessment, resolution steps, and time estimate.'
            : 'Run a health check on this device to identify issues and get maintenance recommendations.'}
        </p>

        <button
          onClick={() => diagnoseMutation.mutate()}
          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium hover:from-violet-700 hover:to-indigo-700 active:scale-[0.97] transition-all cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          AI Diagnose
        </button>

        {diagnoseMutation.isError && (
          <div className="mt-3 flex items-center gap-2 text-xs text-red-600">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{diagnoseMutation.error?.message || 'Diagnosis failed'}</span>
          </div>
        )}
      </div>
    )
  }

  // ── Loading state ────────────────────────────────────────────────────
  if (diagnoseMutation.isPending) {
    return (
      <div className="ui-glass p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Brain className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Analyzing...</h4>
            <p className="text-xs text-slate-400">AI is reviewing the data</p>
          </div>
        </div>

        <div className="space-y-3 animate-pulse">
          <div className="h-3 bg-slate-200 rounded w-3/4" />
          <div className="h-3 bg-slate-100 rounded w-full" />
          <div className="h-3 bg-slate-100 rounded w-5/6" />
          <div className="h-3 bg-slate-100 rounded w-2/3" />
          <div className="mt-4 flex gap-3">
            <div className="h-6 w-20 bg-slate-200 rounded-md" />
            <div className="h-6 w-16 bg-slate-200 rounded-md" />
          </div>
        </div>
      </div>
    )
  }

  // ── Ticket results ───────────────────────────────────────────────────
  if (result?.type === 'ticket') {
    const { category, severity, steps, estimatedTimeMinutes, confidence, summary } = result.data
    const sevStyle = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.medium

    return (
      <div className="ui-glass p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900">AI Diagnosis</h4>
          </div>
          <button
            onClick={() => diagnoseMutation.mutate()}
            disabled={diagnoseMutation.isPending}
            className="text-xs text-violet-600 hover:text-violet-700 font-medium cursor-pointer"
          >
            Re-analyze
          </button>
        </div>

        {/* Summary */}
        {summary && (
          <p className="text-sm text-slate-600 leading-relaxed">{summary}</p>
        )}

        {/* Meta badges */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Category */}
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-medium text-slate-700">{category}</span>
          </div>

          {/* Severity */}
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${sevStyle.bg} ${sevStyle.text}`}>
            {sevStyle.label}
          </span>

          {/* Time estimate */}
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-600">
              ~{estimatedTimeMinutes < 60
                ? `${estimatedTimeMinutes}m`
                : `${Math.round(estimatedTimeMinutes / 60)}h ${estimatedTimeMinutes % 60}m`}
            </span>
          </div>
        </div>

        {/* Steps */}
        {steps.length > 0 && (
          <div>
            <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Resolution Steps
            </h5>
            <ol className="space-y-2">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-slate-700 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Confidence */}
        <div>
          <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
            Confidence
          </h5>
          <ConfidenceMeter confidence={confidence} />
        </div>
      </div>
    )
  }

  // ── Device results ───────────────────────────────────────────────────
  if (result?.type === 'device') {
    const { healthScore, issues, recommendations, summary } = result.data

    return (
      <div className="ui-glass p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900">Device Health Report</h4>
          </div>
          <button
            onClick={() => diagnoseMutation.mutate()}
            disabled={diagnoseMutation.isPending}
            className="text-xs text-violet-600 hover:text-violet-700 font-medium cursor-pointer"
          >
            Re-analyze
          </button>
        </div>

        {/* Health score gauge */}
        <HealthScoreBar score={healthScore} />

        {/* Summary */}
        {summary && (
          <p className="text-sm text-slate-600 leading-relaxed">{summary}</p>
        )}

        {/* Issues */}
        {issues.length > 0 && (
          <div>
            <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Issues Found
            </h5>
            <ul className="space-y-1.5">
              {issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-700">{issue}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div>
            <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Recommendations
            </h5>
            <ul className="space-y-1.5">
              {recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2">
                  <ChevronRight className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-700">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return null
}
