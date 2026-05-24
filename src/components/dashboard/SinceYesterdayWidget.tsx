'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Ticket,
  UserCheck,
  CalendarCheck,
  X,
} from 'lucide-react'
import { useSinceYesterday, type DiffItem } from '@/lib/hooks/useSinceYesterday'

// ─── Design tokens (matched to UpcomingEventsPanel) ──────────────────────────

const SURFACE = '#fdfcfb'
const BORDER = 'rgba(17, 15, 10, 0.06)'
const TEXT_PRIMARY = '#1a1915'
const TEXT_SECONDARY = '#6a6864'
const TEXT_MUTED = '#a8a49d'
const WARM_CHIP = '#f6f4f0'
const WARM_CHIP_HOVER = '#ede9e0'
const HAIRLINE = 'rgba(17, 15, 10, 0.05)'
const CARD_SHADOW =
  '0 0.8px 2.9px rgba(0,0,0,0.02), 0 2px 7.8px rgba(0,0,0,0.027), 0 4px 18px rgba(0,0,0,0.04)'

// ─── Severity → visual config ────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<
  string,
  { bg: string; dot: string; text: string }
> = {
  critical: { bg: 'rgba(220, 38, 38, 0.06)', dot: '#dc2626', text: '#991b1b' },
  high: { bg: 'rgba(234, 88, 12, 0.06)', dot: '#ea580c', text: '#9a3412' },
  normal: { bg: 'rgba(17, 15, 10, 0.03)', dot: '#6a6864', text: TEXT_PRIMARY },
  good: { bg: 'rgba(22, 163, 74, 0.06)', dot: '#16a34a', text: '#166534' },
}

const CATEGORY_ICONS: Record<string, typeof Ticket> = {
  new_tickets: Ticket,
  assignments: UserCheck,
  completions: CheckCircle2,
  approvals_waiting: CalendarCheck,
  event_changes: CalendarCheck,
  ticket_updates: Ticket,
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SinceYesterdayWidget() {
  const router = useRouter()
  const { data, isLoading, isError, refetch, dismiss } = useSinceYesterday()
  const [showHandled, setShowHandled] = useState(false)

  const items = data?.items ?? []
  const visibleItems = showHandled
    ? items
    : items.filter((i) => !i.handled)
  const unhandledCount = data?.totals.unhandled ?? 0
  const handledCount = data?.totals.handled ?? 0

  // Format the anchor time for display
  const anchorLabel = data?.anchorTime
    ? formatAnchorLabel(data.anchorTime, data.orgTimezone)
    : null

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="rounded-3xl overflow-hidden"
      style={{
        backgroundColor: SURFACE,
        border: `1px solid ${BORDER}`,
        boxShadow: CARD_SHADOW,
      }}
      aria-label="Since yesterday"
    >
      {/* Header */}
      <header className="px-5 sm:px-7 pt-5 sm:pt-6 pb-3 sm:pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              className="text-lg font-semibold leading-tight"
              style={{ color: TEXT_PRIMARY, letterSpacing: '-0.02em' }}
            >
              Since yesterday
            </h2>
            {anchorLabel && (
              <p
                className="text-[12px] font-medium mt-0.5"
                style={{ color: TEXT_MUTED }}
              >
                {anchorLabel}
              </p>
            )}
          </div>

          {/* Show/hide handled toggle */}
          {handledCount > 0 && (
            <button
              onClick={() => setShowHandled(!showHandled)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition-colors cursor-pointer"
              style={{
                backgroundColor: showHandled ? TEXT_PRIMARY : WARM_CHIP,
                color: showHandled ? '#fff' : TEXT_SECONDARY,
              }}
            >
              {showHandled ? (
                <EyeOff className="w-3 h-3" />
              ) : (
                <Eye className="w-3 h-3" />
              )}
              {showHandled ? 'Hide handled' : `${handledCount} handled`}
            </button>
          )}
        </div>
      </header>

      {/* Divider */}
      <div
        className="mx-5 sm:mx-7"
        style={{ borderTop: `1px solid ${HAIRLINE}` }}
      />

      {/* Content */}
      <div className="px-5 sm:px-7 py-3 sm:py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: TEXT_MUTED }} />
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : visibleItems.length === 0 ? (
          <AllClearState anchorLabel={anchorLabel} />
        ) : (
          <ul className="space-y-1" role="list">
            <AnimatePresence mode="popLayout">
              {visibleItems.map((item, idx) => (
                <DiffRow
                  key={item.id}
                  item={item}
                  index={idx}
                  onDismiss={() => dismiss(item.diffEventIds)}
                  onNavigate={() => {
                    if (item.deepLinkPath) router.push(item.deepLinkPath)
                  }}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </motion.section>
  )
}

// ─── Diff row ────────────────────────────────────────────────────────────────

function DiffRow({
  item,
  index,
  onDismiss,
  onNavigate,
}: {
  item: DiffItem
  index: number
  onDismiss: () => void
  onNavigate: () => void
}) {
  const sev = SEVERITY_CONFIG[item.severity] ?? SEVERITY_CONFIG.normal
  const Icon = CATEGORY_ICONS[item.category] ?? Ticket
  const hasLink = !!item.deepLinkPath

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: item.handled ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
      transition={{ duration: 0.25, delay: index * 0.03, ease: [0.25, 0.1, 0.25, 1] }}
      className="group relative"
    >
      <div
        className={`flex items-start gap-3 py-3 px-3 -mx-3 rounded-xl transition-colors duration-150 ${
          hasLink ? 'cursor-pointer' : ''
        }`}
        style={{ borderBottom: `1px solid ${HAIRLINE}` }}
        onClick={hasLink ? onNavigate : undefined}
        onMouseEnter={(e) => {
          if (hasLink) e.currentTarget.style.backgroundColor = '#f8f6f2'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
      >
        {/* Severity dot + icon */}
        <div
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
          style={{ backgroundColor: sev.bg }}
        >
          <Icon className="w-4 h-4" style={{ color: sev.dot }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className="text-[13.5px] font-medium leading-snug"
            style={{ color: item.handled ? TEXT_MUTED : sev.text }}
          >
            {item.handled && (
              <Check
                className="inline w-3.5 h-3.5 mr-1 -mt-0.5"
                style={{ color: TEXT_MUTED }}
              />
            )}
            {item.summary}
          </p>
          <p
            className="text-[11px] mt-0.5"
            style={{ color: TEXT_MUTED }}
          >
            {formatRelativeTime(item.occurredAt)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          {!item.handled && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDismiss()
              }}
              className="p-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ color: TEXT_MUTED }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = WARM_CHIP_HOVER
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
              title="Mark as handled"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {hasLink && (
            <ChevronRight
              className="w-3.5 h-3.5"
              style={{ color: TEXT_MUTED }}
            />
          )}
        </div>
      </div>
    </motion.li>
  )
}

// ─── All clear state ─────────────────────────────────────────────────────────

function AllClearState({ anchorLabel }: { anchorLabel: string | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex flex-col items-center text-center py-6"
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
        style={{ backgroundColor: 'rgba(22, 163, 74, 0.08)' }}
      >
        <CheckCircle2 className="w-5 h-5" style={{ color: '#16a34a' }} />
      </div>
      <p
        className="text-[14px] font-semibold"
        style={{ color: TEXT_PRIMARY }}
      >
        {anchorLabel ? `Nothing new ${anchorLabel.toLowerCase()}` : 'Nothing new'}
      </p>
      <p
        className="mt-1 text-[12.5px] max-w-xs"
        style={{ color: TEXT_SECONDARY }}
      >
        No new tickets, events, or updates. You&rsquo;re all caught up.
      </p>
    </motion.div>
  )
}

// ─── Error state ─────────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-6">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
        style={{ backgroundColor: 'rgba(220, 38, 38, 0.08)' }}
      >
        <AlertTriangle className="w-5 h-5" style={{ color: '#b91c1c' }} />
      </div>
      <p className="text-[14px] font-semibold" style={{ color: TEXT_PRIMARY }}>
        Couldn&rsquo;t load updates
      </p>
      <button
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-semibold transition-colors cursor-pointer"
        style={{ backgroundColor: WARM_CHIP, color: TEXT_PRIMARY }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = WARM_CHIP_HOVER
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = WARM_CHIP
        }}
      >
        <RefreshCw className="w-3 h-3" />
        Try again
      </button>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAnchorLabel(anchorIso: string, tz: string): string {
  const d = new Date(anchorIso)
  const now = new Date()
  const diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60)

  // "Since yesterday 4:30 PM" or "Since today 4:30 PM"
  const dayLabel = diffHours > 20 ? 'yesterday' : 'today'
  const timeLabel = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: tz,
  })
  return `Since ${dayLabel} ${timeLabel}`
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - d.getTime()) / (1000 * 60))

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
