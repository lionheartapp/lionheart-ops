'use client'

import { useState, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Wrench,
  Package,
  Send,
  Loader2,
  AlertCircle,
  ImageOff,
  Clock,
  Sparkles,
  BookOpen,
  ExternalLink,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getAuthHeaders, fetchApi } from '@/lib/api-client'
import { expandCollapse, fadeInUp, staggerContainer } from '@/lib/animations'
import { KBArticleTypeBadge } from '@/components/maintenance/KnowledgeBaseList'
import type { AiDiagnosis, AiConversationTurn, AiAnalysisCache } from '@/lib/types/maintenance-ai'

// ─── Props ────────────────────────────────────────────────────────────────────

interface AIDiagnosticPanelProps {
  ticketId: string
  photos: string[]
  category: string
  aiAnalysis: AiAnalysisCache | null
}

// ─── Confidence Badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence, reason }: { confidence: AiDiagnosis['confidence']; reason: string }) {
  const styles: Record<AiDiagnosis['confidence'], string> = {
    HIGH: 'bg-green-100 text-green-700',
    MEDIUM: 'bg-yellow-100 text-yellow-700',
    LOW: 'bg-red-100 text-red-700',
  }

  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold w-fit ${styles[confidence]}`}>
        {confidence} Confidence
      </span>
      <p className="text-xs text-gray-500 italic">{reason}</p>
    </div>
  )
}

// ─── Conversation Thread ──────────────────────────────────────────────────────

function ConversationBubble({ turn }: { turn: AiConversationTurn }) {
  const isUser = turn.role === 'user'
  const time = new Date(turn.timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return (
    <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
          isUser
            ? 'bg-emerald-50 text-emerald-900 rounded-br-sm border border-emerald-100'
            : 'bg-gray-50 text-gray-800 rounded-bl-sm border border-gray-100'
        }`}
      >
        <p className="whitespace-pre-wrap">{turn.content}</p>
      </div>
      <span className="text-[10px] text-gray-400 px-1 flex items-center gap-1">
        <Clock className="w-2.5 h-2.5" />
        {time}
      </span>
    </div>
  )
}

// ─── Diagnosis Skeleton ───────────────────────────────────────────────────────

function DiagnosisSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="text-xs text-gray-400 flex items-center gap-1.5">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
        Analyzing photos...
      </div>
      {/* Diagnosis block */}
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded w-24" />
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
      </div>
      {/* Tools block */}
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded w-20" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="h-3 bg-gray-100 rounded w-2/5" />
      </div>
      {/* Steps block */}
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded w-20" />
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-4/5" />
        <div className="h-3 bg-gray-100 rounded w-3/4" />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AIDiagnosticPanel({
  ticketId,
  photos,
  category,
  aiAnalysis,
}: AIDiagnosticPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [diagnosis, setDiagnosis] = useState<AiDiagnosis | null>(aiAnalysis?.diagnosis ?? null)
  const [conversation, setConversation] = useState<AiConversationTurn[]>(aiAnalysis?.conversation ?? [])
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null) // null = not yet checked
  const [noPhotosReason, setNoPhotosReason] = useState(false)
  const [question, setQuestion] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isCached, setIsCached] = useState(false)
  const hasFetchedRef = useRef(false)
  const conversationEndRef = useRef<HTMLDivElement>(null)

  // Check if photos changed since last analysis (cache invalidation)
  const photosChanged = (() => {
    if (!aiAnalysis?.lastPhotoSnapshot) return photos.length > 0
    const currentSorted = [...photos].sort().join(',')
    const snapshotSorted = [...(aiAnalysis.lastPhotoSnapshot)].sort().join(',')
    return currentSorted !== snapshotSorted
  })()

  const hasCachedDiagnosis = !!aiAnalysis?.diagnosis && !photosChanged

  // ─── KB articles query (fires only when diagnosis is loaded) ──────────────

  interface KBArticleResult {
    id: string
    title: string
    type: string
  }

  const { data: kbArticles } = useQuery<KBArticleResult[]>({
    queryKey: ['kb-articles-for-ticket', ticketId, category],
    queryFn: () => {
      const params = new URLSearchParams()
      params.set('q', category)
      params.set('category', category)
      params.set('limit', '3')
      return fetchApi<KBArticleResult[]>(`/api/maintenance/knowledge-base/search?${params.toString()}`)
    },
    enabled: !!diagnosis && isExpanded,
    staleTime: 60_000,
  })

  const relevantArticles = kbArticles?.slice(0, 3) ?? []

  // ─── Expand handler ─────────────────────────────────────────────────────

  async function handleExpand() {
    if (isExpanded) {
      setIsExpanded(false)
      return
    }

    setIsExpanded(true)

    // Don't fetch if we already have a valid cached result
    if (hasCachedDiagnosis && diagnosis) {
      setIsCached(true)
      return
    }

    // Don't fetch again if we already called the API this session
    if (hasFetchedRef.current) return

    // Only fetch if there are photos
    if (!photos || photos.length === 0) {
      setNoPhotosReason(true)
      setAiAvailable(true)
      return
    }

    hasFetchedRef.current = true
    setIsLoading(true)

    try {
      const res = await fetch(`/api/maintenance/tickets/${ticketId}/ai-diagnose`, {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      const json = await res.json()

      if (!json.ok) {
        setAiAvailable(false)
        return
      }

      const { available, diagnosis: d, cached, reason } = json.data

      if (!available) {
        setAiAvailable(false)
        return
      }

      setAiAvailable(true)

      if (reason === 'no-photos') {
        setNoPhotosReason(true)
        return
      }

      if (d) {
        setDiagnosis(d)
        setIsCached(cached ?? false)
      }
    } catch (err) {
      console.error('[AIDiagnosticPanel] fetch error:', err)
      setAiAvailable(false)
    } finally {
      setIsLoading(false)
    }
  }

  // ─── Ask AI handler ──────────────────────────────────────────────────────

  async function handleAskSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = question.trim()
    if (!q || isSending) return

    setIsSending(true)
    setQuestion('')

    try {
      const res = await fetch(`/api/maintenance/tickets/${ticketId}/ai-ask`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: q }),
      })
      const json = await res.json()

      if (json.ok && json.data.conversation) {
        setConversation(json.data.conversation)
        // Scroll to bottom
        setTimeout(() => {
          conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      }
    } catch (err) {
      console.error('[AIDiagnosticPanel] ask error:', err)
    } finally {
      setIsSending(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="ui-glass rounded-2xl overflow-hidden">
      {/* ── Panel header (always visible) ── */}
      <button
        onClick={handleExpand}
        className="w-full flex items-center gap-3 p-4 hover:bg-gray-50/50 transition-colors cursor-pointer text-left"
      >
        <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">AI Diagnostics</span>
            {hasCachedDiagnosis && !isExpanded && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                Cached
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 truncate">
            {hasCachedDiagnosis
              ? 'AI diagnosis available — click to view'
              : photos.length > 0
              ? 'Click to analyze photos with AI'
              : 'Upload photos to enable AI diagnosis'}
          </p>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {/* ── Expanded content ── */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            key="ai-panel-content"
            variants={expandCollapse}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-gray-100">

              {/* AI disclaimer banner */}
              <div className="flex items-center gap-2 py-2 px-3 bg-amber-50/80 border border-amber-100 rounded-xl mt-3">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  <span className="font-semibold">AI Suggestion</span> — always verify on-site before beginning work.
                </p>
              </div>

              {/* AI not configured */}
              {aiAvailable === false && (
                <div className="text-center py-6">
                  <Bot className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 font-medium">AI diagnostics not configured</p>
                  <p className="text-xs text-gray-400 mt-1">Contact your administrator to enable AI features.</p>
                </div>
              )}

              {/* No photos */}
              {aiAvailable !== false && noPhotosReason && (
                <div className="text-center py-6">
                  <ImageOff className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 font-medium">Upload photos to enable AI diagnosis</p>
                  <p className="text-xs text-gray-400 mt-1">
                    AI analysis requires at least one photo to diagnose the issue.
                  </p>
                </div>
              )}

              {/* Loading skeleton */}
              {isLoading && <DiagnosisSkeleton />}

              {/* Diagnosis results */}
              {!isLoading && diagnosis && aiAvailable !== false && (
                <motion.div
                  variants={staggerContainer(0.05, 0)}
                  initial="hidden"
                  animate="visible"
                  className="space-y-4"
                >
                  {/* Cache indicator */}
                  {isCached && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                      <Sparkles className="w-3 h-3" />
                      <span>Results from previous analysis (no new API call)</span>
                    </div>
                  )}

                  {/* Likely diagnosis */}
                  <motion.div variants={fadeInUp} className="p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Likely Diagnosis</p>
                    <p className="text-sm font-semibold text-gray-900">{diagnosis.likelyDiagnosis}</p>
                    <ConfidenceBadge confidence={diagnosis.confidence} reason={diagnosis.confidenceReason} />
                  </motion.div>

                  {/* Suggested tools */}
                  {diagnosis.suggestedTools.length > 0 && (
                    <motion.div variants={fadeInUp}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Wrench className="w-3.5 h-3.5 text-gray-400" />
                        <p className="text-xs font-semibold text-gray-600">Suggested Tools</p>
                      </div>
                      <ul className="space-y-1">
                        {diagnosis.suggestedTools.map((tool, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 flex-shrink-0" />
                            {tool}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}

                  {/* Suggested parts */}
                  {diagnosis.suggestedParts.length > 0 && (
                    <motion.div variants={fadeInUp}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Package className="w-3.5 h-3.5 text-gray-400" />
                        <p className="text-xs font-semibold text-gray-600">Suggested Parts / Supplies</p>
                      </div>
                      <ul className="space-y-1">
                        {diagnosis.suggestedParts.map((part, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-300 mt-1.5 flex-shrink-0" />
                            {part}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}

                  {/* Step-by-step fix */}
                  {diagnosis.steps.length > 0 && (
                    <motion.div variants={fadeInUp}>
                      <p className="text-xs font-semibold text-gray-600 mb-2">Step-by-Step Fix</p>
                      <ol className="space-y-2">
                        {diagnosis.steps.map((step, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <span className="text-xs text-gray-700 leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* ── Relevant KB articles ── */}
              {relevantArticles.length > 0 && (
                <motion.div
                  variants={expandCollapse}
                  initial="collapsed"
                  animate="expanded"
                  className="overflow-hidden"
                >
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 mb-2">
                      <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                      <p className="text-xs font-semibold text-gray-600">Relevant Knowledge Base Articles</p>
                    </div>
                    <ul className="space-y-1.5">
                      {relevantArticles.map((article) => (
                        <li key={article.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-gray-50/80 hover:bg-gray-100/80 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <KBArticleTypeBadge type={article.type} />
                            <span className="text-xs text-gray-700 truncate">{article.title}</span>
                          </div>
                          <a
                            href={`/maintenance/knowledge-base/${article.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 transition-colors"
                          >
                            View
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              )}

              {/* ── Ask AI section ── */}
              {aiAvailable !== false && (
                <div className="pt-2 border-t border-gray-100 space-y-3">
                  <p className="text-xs font-semibold text-gray-500">Ask AI a Follow-up Question</p>

                  {/* Conversation thread */}
                  {conversation.length > 0 && (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {conversation.map((turn, i) => (
                        <ConversationBubble key={i} turn={turn} />
                      ))}
                      <div ref={conversationEndRef} />
                    </div>
                  )}

                  {/* Input */}
                  <form onSubmit={handleAskSubmit} className="flex items-end gap-2">
                    <textarea
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Ask a follow-up question..."
                      rows={2}
                      disabled={isSending}
                      className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-gray-400 disabled:opacity-50"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleAskSubmit(e as unknown as React.FormEvent)
                        }
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!question.trim() || isSending}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer mb-0.5"
                      title="Send question"
                    >
                      {isSending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </form>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
