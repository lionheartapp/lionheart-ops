'use client'

/**
 * OnboardingChecklistWidget
 *
 * Dashboard "Get Started" card. Surfaces derived first-time-user setup
 * tasks from GET /api/onboarding/checklist and renders them as a
 * clickable list with a progress bar. Hides itself in three cases:
 *
 *   1. Admin has dismissed the widget (widgetDismissed flag) — only
 *      possible once required tasks are complete.
 *   2. There are zero items to show (new user has nothing to do).
 *   3. All items are complete AND widget is dismissed.
 *
 * Per-module tasks are filtered client-side based on localStorage
 * `visitedModules` — if the user has never opened /maintenance then
 * the maintenance tasks are hidden even though the server returns them.
 * Visited modules are stamped by a separate `useTrackModuleVisit` hook
 * that each module layout calls on mount.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'

// ─── Types (mirror the service) ──────────────────────────────────────────────

type ChecklistCategory =
  | 'workspace'
  | 'module'
  | 'integration'
  | 'billing'
  | 'profile'

type Module = 'maintenance' | 'it' | 'events' | 'athletics' | 'academic'

interface ChecklistItem {
  id: string
  title: string
  description: string
  required: boolean
  category: ChecklistCategory
  module?: Module
  href: string
  completed: boolean
  dismissed: boolean
  dismissable: boolean
}

interface ChecklistSection {
  items: ChecklistItem[]
  essentialComplete: boolean
  totalCount: number
  completedCount: number
  requiredCount: number
  requiredCompleted: number
  widgetDismissed: boolean
}

interface ChecklistData {
  org: ChecklistSection
  user: ChecklistSection
  canManageWorkspace: boolean
}

// ─── Module visit tracking ───────────────────────────────────────────────────

const VISITED_MODULES_KEY = 'lionheart:visited-modules'

function readVisitedModules(): Module[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(VISITED_MODULES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Module[]) : []
  } catch {
    return []
  }
}

/**
 * Hook for module layouts to stamp their key into localStorage on mount.
 * Used by /maintenance, /it, /events, /athletics, /academic pages.
 */
export function useTrackModuleVisit(moduleKey: Module) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const visited = readVisitedModules()
    if (visited.includes(moduleKey)) return
    const next = [...visited, moduleKey]
    window.localStorage.setItem(VISITED_MODULES_KEY, JSON.stringify(next))
  }, [moduleKey])
}

// ─── Widget ─────────────────────────────────────────────────────────────────

const CHECKLIST_QUERY_KEY = ['onboarding-checklist'] as const

export default function OnboardingChecklistWidget() {
  const queryClient = useQueryClient()
  const [dismissingItem, setDismissingItem] = useState<string | null>(null)
  const [dismissingWidget, setDismissingWidget] = useState(false)
  const [visitedModules, setVisitedModules] = useState<Module[]>([])

  // Load visited modules from localStorage on mount.
  useEffect(() => {
    setVisitedModules(readVisitedModules())
  }, [])

  // TanStack Query — caches across dashboard navigations so the widget
  // renders instantly from cache instead of popping in after a fresh
  // fetch on every visit. Stale after 60s, refetches in the background.
  const { data, isLoading, isError } = useQuery<ChecklistData | null>({
    queryKey: CHECKLIST_QUERY_KEY,
    queryFn: async () => {
      try {
        return await fetchApi<ChecklistData>('/api/onboarding/checklist')
      } catch {
        return null
      }
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  })

  const refetchChecklist = () => {
    queryClient.invalidateQueries({ queryKey: CHECKLIST_QUERY_KEY })
  }

  // Filter org items: drop per-module items for modules the user hasn't
  // opened yet, so the checklist stays focused on the parts of the
  // platform the admin cares about.
  const visibleOrgItems = useMemo(() => {
    if (!data) return []
    return data.org.items.filter((item) => {
      if (item.category !== 'module' || !item.module) return true
      return visitedModules.includes(item.module)
    })
  }, [data, visitedModules])

  const visibleUserItems = useMemo(() => {
    if (!data) return []
    return data.user.items
  }, [data])

  // Aggregate progress across both sections.
  const { totalVisible, completedVisible, requiredAllComplete } = useMemo(() => {
    const all = [...visibleOrgItems, ...visibleUserItems]
    const required = all.filter((i) => i.required)
    return {
      totalVisible: all.length,
      completedVisible: all.filter((i) => i.completed).length,
      requiredAllComplete:
        required.length > 0 && required.every((i) => i.completed),
    }
  }, [visibleOrgItems, visibleUserItems])

  const handleDismissItem = async (
    itemId: string,
    scope: 'org' | 'user'
  ) => {
    setDismissingItem(itemId)
    try {
      const res = await fetch('/api/onboarding/checklist/dismiss', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({ scope, itemId }),
      })
      if (res.ok) {
        refetchChecklist()
      }
    } finally {
      setDismissingItem(null)
    }
  }

  const handleDismissWidget = async () => {
    setDismissingWidget(true)
    try {
      const res = await fetch('/api/onboarding/checklist/dismiss', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({ scope: 'widget' }),
      })
      if (res.ok) {
        // Optimistically mark the widget as dismissed in the cache so
        // the component unmounts immediately.
        queryClient.setQueryData<ChecklistData | null>(
          CHECKLIST_QUERY_KEY,
          (prev) => (prev ? { ...prev, org: { ...prev.org, widgetDismissed: true } } : prev)
        )
      }
    } finally {
      setDismissingWidget(false)
    }
  }

  // ─── Skeleton while first load is in flight ───────────────────────────
  if (isLoading && !data) {
    return <ChecklistSkeleton />
  }

  // ─── Hide conditions after data arrives ───────────────────────────────
  if (isError) return null
  if (!data) return null
  if (data.org.widgetDismissed) return null
  if (totalVisible === 0) return null

  // Hide when everything the admin cares about is done.
  if (completedVisible === totalVisible) return null

  const progressPct = totalVisible === 0 ? 0 : (completedVisible / totalVisible) * 100
  const canDismissWidget = requiredAllComplete && data.canManageWorkspace

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className="ui-glass p-6 mb-6"
      aria-label="Getting started checklist"
    >
      {/* Header + progress */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">
              Get started
            </h2>
            <p className="text-sm text-slate-500">
              {completedVisible} of {totalVisible} complete
              {requiredAllComplete && (
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium">
                  <Check className="w-3 h-3" />
                  Essentials done
                </span>
              )}
            </p>
          </div>
        </div>

        {canDismissWidget && (
          <button
            type="button"
            onClick={handleDismissWidget}
            disabled={dismissingWidget}
            className="text-slate-400 hover:text-slate-600 transition-colors duration-200 cursor-pointer disabled:opacity-50"
            aria-label="Dismiss setup checklist"
          >
            {dismissingWidget ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <X className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-5">
        <motion.div
          className="h-full bg-gradient-to-r from-primary-500 to-indigo-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        />
      </div>

      {/* Items */}
      <ul className="space-y-1.5">
        <AnimatePresence initial={false}>
          {visibleOrgItems.map((item) => (
            <ChecklistRow
              key={item.id}
              item={item}
              scope="org"
              dismissing={dismissingItem === item.id}
              onDismiss={handleDismissItem}
            />
          ))}
          {visibleUserItems.map((item) => (
            <ChecklistRow
              key={item.id}
              item={item}
              scope="user"
              dismissing={dismissingItem === item.id}
              onDismiss={handleDismissItem}
            />
          ))}
        </AnimatePresence>
      </ul>
    </motion.section>
  )
}

// ─── Skeleton (instant first paint while data is in flight) ─────────────────

function ChecklistSkeleton() {
  return (
    <section
      className="ui-glass p-6 mb-6 animate-pulse"
      aria-label="Loading getting started checklist"
      aria-busy="true"
    >
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-slate-200 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="h-4 w-28 bg-slate-200 rounded mb-2" />
          <div className="h-3 w-40 bg-slate-100 rounded" />
        </div>
      </div>
      <div className="h-2 bg-slate-100 rounded-full mb-5" />
      <ul className="space-y-1.5">
        {[0, 1, 2, 3].map((i) => (
          <li
            key={i}
            className="flex items-center gap-3 p-3 rounded-xl"
          >
            <div className="w-6 h-6 rounded-full border-2 border-slate-200 bg-white flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div
                className="h-3 bg-slate-200 rounded mb-1.5"
                style={{ width: `${60 + i * 8}%` }}
              />
              <div
                className="h-2.5 bg-slate-100 rounded"
                style={{ width: `${40 + i * 10}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ─── Row ────────────────────────────────────────────────────────────────────

interface ChecklistRowProps {
  item: ChecklistItem
  scope: 'org' | 'user'
  dismissing: boolean
  onDismiss: (itemId: string, scope: 'org' | 'user') => void
}

function ChecklistRow({ item, scope, dismissing, onDismiss }: ChecklistRowProps) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className={`group flex items-center gap-3 p-3 rounded-xl transition-colors duration-200 ${
          item.completed
            ? 'bg-emerald-50/50'
            : 'hover:bg-slate-50'
        }`}
      >
        {/* Status icon */}
        <div
          className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-200 ${
            item.completed
              ? 'bg-emerald-500 text-white'
              : item.required
                ? 'border-2 border-slate-300 bg-white'
                : 'border-2 border-slate-200 bg-white'
          }`}
          aria-hidden="true"
        >
          {item.completed && <CheckCircle2 className="w-4 h-4" />}
        </div>

        {/* Label + description (clickable link to the task) */}
        <Link
          href={item.href}
          className="flex-1 min-w-0 cursor-pointer"
        >
          <p
            className={`text-sm font-medium truncate ${
              item.completed
                ? 'text-slate-500 line-through decoration-slate-400'
                : 'text-slate-900'
            }`}
          >
            {item.title}
            {item.required && !item.completed && (
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-rose-600">
                Required
              </span>
            )}
          </p>
          <p
            className={`text-xs truncate ${
              item.completed ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {item.description}
          </p>
        </Link>

        {/* Action: dismiss (non-essential only) or go-to arrow */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {!item.completed && (
            <Link
              href={item.href}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors duration-200 cursor-pointer"
              aria-label={`Go to ${item.title}`}
            >
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
          {item.dismissable && !item.completed && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                onDismiss(item.id, scope)
              }}
              disabled={dismissing}
              className="p-1.5 rounded-full text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors duration-200 cursor-pointer opacity-0 group-hover:opacity-100 disabled:opacity-50"
              aria-label={`Dismiss ${item.title}`}
            >
              {dismissing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <X className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>
    </motion.li>
  )
}
