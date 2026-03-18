'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  Clock,
  DollarSign,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Receipt,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'
import { expandCollapse, fadeInUp, staggerContainer } from '@/lib/animations'
import LaborEntryForm from './LaborEntryForm'
import CostEntryForm from './CostEntryForm'
import LaborCostSummaryCards, { type CostSummary } from './LaborCostSummaryCards'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LaborEntry {
  id: string
  startTime: string
  endTime?: string | null
  durationMinutes?: number | null
  notes?: string | null
  laborCost: number | null
  technician: {
    id: string
    firstName: string
    lastName: string
    technicianProfile?: { loadedHourlyRate: number | null } | null
  }
}

interface CostEntry {
  id: string
  vendor?: string | null
  description: string
  amount: number
  receiptUrl?: string | null
  createdAt: string
  createdBy: { id: string; firstName: string; lastName: string }
}

interface LaborCostPanelProps {
  ticketId: string
  currentUserId: string
  technicians?: { id: string; firstName: string; lastName: string }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

function formatMoney(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const EMPTY_SUMMARY: CostSummary = {
  totalLaborHours: 0,
  laborCost: 0,
  materialsCost: 0,
  grandTotal: 0,
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LaborCostPanel({
  ticketId,
  currentUserId,
  technicians,
}: LaborCostPanelProps) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(true)
  const [showLaborForm, setShowLaborForm] = useState(false)
  const [showCostForm, setShowCostForm] = useState(false)
  const [deletingLaborId, setDeletingLaborId] = useState<string | null>(null)
  const [deletingCostId, setDeletingCostId] = useState<string | null>(null)

  // Labor entries query
  const { data: laborEntries = [], isLoading: laborLoading } = useQuery<LaborEntry[]>({
    queryKey: ['labor-entries', ticketId],
    queryFn: () => fetchApi<LaborEntry[]>(`/api/maintenance/tickets/${ticketId}/labor`),
    staleTime: 60 * 1000,
  })

  // Cost entries query
  const { data: costsData, isLoading: costsLoading } = useQuery<{
    entries: CostEntry[]
    summary: CostSummary | null
  }>({
    queryKey: ['cost-entries', ticketId],
    queryFn: () =>
      fetchApi(`/api/maintenance/tickets/${ticketId}/costs?summary=true`),
    staleTime: 60 * 1000,
  })

  // Summary query (derived from cost query above, but also re-fetch on labor change)
  const { data: summaryData } = useQuery<CostSummary>({
    queryKey: ['cost-summary', ticketId],
    queryFn: async () => {
      const res = await fetchApi<{ entries: CostEntry[]; summary: CostSummary | null }>(
        `/api/maintenance/tickets/${ticketId}/costs?summary=true`
      )
      return (res as any).summary ?? EMPTY_SUMMARY
    },
    staleTime: 30 * 1000,
  })

  const costEntries = costsData?.entries ?? []
  const summary = summaryData ?? costsData?.summary ?? EMPTY_SUMMARY

  // Delete mutations
  const deleteLaborMutation = useMutation({
    mutationFn: (entryId: string) =>
      fetchApi(`/api/maintenance/tickets/${ticketId}/labor/${entryId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }),
    onMutate: (entryId) => setDeletingLaborId(entryId),
    onSettled: () => {
      setDeletingLaborId(null)
      queryClient.invalidateQueries({ queryKey: ['labor-entries', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['cost-summary', ticketId] })
    },
  })

  const deleteCostMutation = useMutation({
    mutationFn: (entryId: string) =>
      fetchApi(`/api/maintenance/tickets/${ticketId}/costs/${entryId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }),
    onMutate: (entryId) => setDeletingCostId(entryId),
    onSettled: () => {
      setDeletingCostId(null)
      queryClient.invalidateQueries({ queryKey: ['cost-entries', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['cost-summary', ticketId] })
    },
  })

  function onLaborCreated() {
    setShowLaborForm(false)
    queryClient.invalidateQueries({ queryKey: ['labor-entries', ticketId] })
    queryClient.invalidateQueries({ queryKey: ['cost-summary', ticketId] })
  }

  function onCostCreated() {
    setShowCostForm(false)
    queryClient.invalidateQueries({ queryKey: ['cost-entries', ticketId] })
    queryClient.invalidateQueries({ queryKey: ['cost-summary', ticketId] })
  }

  return (
    <div className="ui-glass rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-primary-600" />
          <h3 className="text-sm font-semibold text-slate-700">Costs & Labor</h3>
          {summary.grandTotal > 0 && (
            <span className="text-xs text-primary-600 font-medium bg-primary-50 px-2 py-0.5 rounded-full">
              {formatMoney(summary.grandTotal)}
            </span>
          )}
        </div>
        <motion.div animate={{ rotate: expanded ? 0 : -90 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="panel-content"
            variants={expandCollapse}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-5">
              {/* Summary cards */}
              <LaborCostSummaryCards summary={summary} />

              {/* ─── Labor Entries ─────────────────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Labor Entries</h4>
                    {laborEntries.length > 0 && (
                      <span className="text-xs text-slate-400">({laborEntries.length})</span>
                    )}
                  </div>
                  <button
                    onClick={() => { setShowLaborForm((v) => !v); setShowCostForm(false) }}
                    className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 transition-colors cursor-pointer font-medium"
                  >
                    <Plus className="w-3 h-3" />
                    Add Manual Entry
                  </button>
                </div>

                <AnimatePresence>
                  {showLaborForm && (
                    <motion.div
                      key="labor-form"
                      variants={expandCollapse}
                      initial="collapsed"
                      animate="expanded"
                      exit="collapsed"
                      className="overflow-hidden"
                    >
                      <div className="bg-slate-50/80 border border-slate-200 rounded-xl px-4 pb-4 mb-3">
                        <LaborEntryForm
                          ticketId={ticketId}
                          currentUserId={currentUserId}
                          technicians={technicians}
                          onCreated={onLaborCreated}
                          onCancel={() => setShowLaborForm(false)}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {laborLoading ? (
                  <div className="space-y-2 animate-pulse">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-12 bg-slate-100 rounded-xl" />
                    ))}
                  </div>
                ) : laborEntries.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">No labor entries yet. Use the timer or add a manual entry.</p>
                ) : (
                  <div className="space-y-2">
                    {laborEntries.map((entry) => {
                      const isDeleting = deletingLaborId === entry.id
                      const hours = entry.durationMinutes != null ? entry.durationMinutes / 60 : null
                      return (
                        <div
                          key={entry.id}
                          className="flex items-start justify-between gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-100"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium text-slate-800">
                                {entry.technician.firstName} {entry.technician.lastName}
                              </span>
                              {entry.durationMinutes != null && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                                  {formatDuration(entry.durationMinutes)}
                                </span>
                              )}
                              {entry.laborCost != null && entry.laborCost > 0 && (
                                <span className="text-xs text-primary-600 font-medium">
                                  {formatMoney(entry.laborCost)}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {formatDate(entry.startTime)}
                              {entry.endTime && ` · ${formatTime(entry.startTime)} – ${formatTime(entry.endTime)}`}
                            </p>
                            {entry.notes && (
                              <p className="text-[11px] text-slate-500 mt-0.5 truncate">{entry.notes}</p>
                            )}
                          </div>
                          <button
                            onClick={() => deleteLaborMutation.mutate(entry.id)}
                            disabled={isDeleting}
                            className="text-slate-300 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0 p-0.5"
                            title="Delete entry"
                          >
                            {isDeleting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ─── Cost Entries ──────────────────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-slate-400" />
                    <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Cost Entries</h4>
                    {costEntries.length > 0 && (
                      <span className="text-xs text-slate-400">({costEntries.length})</span>
                    )}
                  </div>
                  <button
                    onClick={() => { setShowCostForm((v) => !v); setShowLaborForm(false) }}
                    className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 transition-colors cursor-pointer font-medium"
                  >
                    <Plus className="w-3 h-3" />
                    Add Cost
                  </button>
                </div>

                <AnimatePresence>
                  {showCostForm && (
                    <motion.div
                      key="cost-form"
                      variants={expandCollapse}
                      initial="collapsed"
                      animate="expanded"
                      exit="collapsed"
                      className="overflow-hidden"
                    >
                      <div className="bg-slate-50/80 border border-slate-200 rounded-xl px-4 pb-4 mb-3">
                        <CostEntryForm
                          ticketId={ticketId}
                          onCreated={onCostCreated}
                          onCancel={() => setShowCostForm(false)}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {costsLoading ? (
                  <div className="space-y-2 animate-pulse">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-12 bg-slate-100 rounded-xl" />
                    ))}
                  </div>
                ) : costEntries.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">No cost entries yet. Add materials, parts, or vendor expenses.</p>
                ) : (
                  <div className="space-y-2">
                    {costEntries.map((entry) => {
                      const isDeleting = deletingCostId === entry.id
                      return (
                        <div
                          key={entry.id}
                          className="flex items-start justify-between gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-100"
                        >
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            {entry.receiptUrl && (
                              <a
                                href={entry.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-shrink-0"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={entry.receiptUrl}
                                  alt="Receipt"
                                  className="w-10 h-10 rounded-lg object-cover border border-slate-200 hover:opacity-80 transition-opacity cursor-pointer"
                                />
                              </a>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {entry.vendor && (
                                  <span className="text-xs font-medium text-slate-800">{entry.vendor}</span>
                                )}
                                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                                  {formatMoney(entry.amount)}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 mt-0.5 truncate">{entry.description}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {formatDate(entry.createdAt)} · {entry.createdBy.firstName} {entry.createdBy.lastName}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => deleteCostMutation.mutate(entry.id)}
                            disabled={isDeleting}
                            className="text-slate-300 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0 p-0.5"
                            title="Delete entry"
                          >
                            {isDeleting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
