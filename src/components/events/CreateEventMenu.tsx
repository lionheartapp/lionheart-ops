'use client'

/**
 * CreateEventMenu — the single "+ Event" dropdown used everywhere in the
 * product. Previously this menu was inlined in the Events Hub page and a
 * simpler single-action "+ Event" button lived on the dashboard's
 * UpcomingEventsPanel; that divergence led to users discovering the AI
 * event planner only on one surface. Consolidating here keeps the 5
 * create paths (AI / Single / Recurring / Multi-day / Template) reachable
 * from every event-creation entry point.
 *
 * The trigger button is visually identical to the original Events Hub
 * header button so there is no regression there. Callers control visual
 * context via `align` (left/right) and `size` (sm/md).
 */

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Calendar,
  CalendarDays,
  ChevronDown,
  Plus,
  RefreshCw,
} from 'lucide-react'

// ─── Tokens (warm editorial palette; kept inline to stay self-contained) ────

const SURFACE = '#fdfcfb'
const BORDER = 'rgba(17, 15, 10, 0.06)'
const TEXT_PRIMARY = '#1a1915'
const TEXT_SECONDARY = '#6a6864'
const WARM_CHIP = '#f6f4f0'

const CARD_SHADOW =
  '0 0.8px 2.9px rgba(0,0,0,0.02), 0 2px 7.8px rgba(0,0,0,0.027), 0 4px 18px rgba(0,0,0,0.04)'

// ─── Public types ───────────────────────────────────────────────────────────

export type EventCreateMode =
  | 'single'
  | 'recurring'
  | 'multiday'

export interface EventCreateOption {
  mode: EventCreateMode
  label: string
  description: string
  icon: React.ElementType
  adminOnly?: boolean
  highlight?: boolean
}

/**
 * Single source of truth for what the menu offers. Exported so other
 * surfaces (e.g. command palette, onboarding checklist) can render the
 * same options without round-tripping through the dropdown UI.
 */
export const EVENT_CREATE_OPTIONS: ReadonlyArray<EventCreateOption> = [
  {
    mode: 'single',
    label: 'Single Event',
    description: 'A one-time event on a specific date',
    icon: Calendar,
  },
  {
    mode: 'recurring',
    label: 'Recurring Event',
    description: 'Repeats on a schedule (weekly, monthly, etc.)',
    icon: RefreshCw,
    adminOnly: true,
  },
  {
    mode: 'multiday',
    label: 'Multi-day Event',
    description: 'Spans across multiple days',
    icon: CalendarDays,
  },
]

export interface CreateEventMenuTriggerArgs {
  open: boolean
  toggle: () => void
}

interface CreateEventMenuProps {
  isAdmin: boolean
  onSelect: (mode: EventCreateMode) => void
  /** Which edge of the trigger the panel opens from. Default: 'right'. */
  align?: 'left' | 'right'
  /** Button scale. 'md' matches the Events Hub header, 'sm' is tighter. */
  size?: 'sm' | 'md'
  /** Trigger text; defaults to 'Event' to match the standard "+ Event" pattern. */
  label?: string
  /** Optional class applied to the wrapper (for positioning). */
  className?: string
  /**
   * Render-prop override for the trigger. When provided, the default pill
   * button is replaced with whatever the caller renders — useful for tight
   * header slots (e.g. the board's draft-column "+" icon) that need their
   * own visual treatment but still want the same menu panel.
   */
  renderTrigger?: (args: CreateEventMenuTriggerArgs) => React.ReactNode
}

export default function CreateEventMenu({
  isAdmin,
  onSelect,
  align = 'right',
  size = 'md',
  label = 'Event',
  className,
  renderTrigger,
}: CreateEventMenuProps) {
  const [open, setOpen] = useState(false)
  const toggle = () => setOpen((v) => !v)

  const visibleOptions = isAdmin
    ? EVENT_CREATE_OPTIONS
    : EVENT_CREATE_OPTIONS.filter((o) => !o.adminOnly)

  const handleSelect = (mode: EventCreateMode) => {
    setOpen(false)
    onSelect(mode)
  }

  const buttonPadding = size === 'sm' ? 'px-4 py-2' : 'px-4 py-2.5'
  const panelSideClass = align === 'right' ? 'right-0' : 'left-0'

  return (
    <div className={`relative ${className ?? ''}`}>
      {renderTrigger ? (
        renderTrigger({ open, toggle })
      ) : (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          className={`flex items-center gap-1.5 ${buttonPadding} rounded-full text-[13px] font-semibold transition-all duration-200 cursor-pointer hover:-translate-y-px`}
          style={{
            backgroundColor: TEXT_PRIMARY,
            color: '#ffffff',
            boxShadow:
              '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.04)',
          }}
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          {label}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>
      )}

      <AnimatePresence>
        {open && (
          <>
            {/* Invisible backdrop: a click anywhere outside closes the menu */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />

            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={`absolute ${panelSideClass} top-full mt-2 w-72 rounded-xl z-20 overflow-hidden`}
              style={{
                backgroundColor: SURFACE,
                border: `1px solid ${BORDER}`,
                boxShadow: CARD_SHADOW,
              }}
            >
              <div className="p-1.5">
                {visibleOptions.map((opt) => {
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.mode}
                      type="button"
                      role="menuitem"
                      onClick={() => handleSelect(opt.mode)}
                      className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer group"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = WARM_CHIP
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                    >
                      <div
                        className="mt-0.5 p-1.5 rounded-lg transition-colors"
                        style={{ backgroundColor: WARM_CHIP }}
                      >
                        <Icon
                          className="w-4 h-4"
                          strokeWidth={1.75}
                          style={{ color: TEXT_PRIMARY }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-[13.5px] font-semibold"
                          style={{
                            color: TEXT_PRIMARY,
                            letterSpacing: '-0.005em',
                          }}
                        >
                          {opt.label}
                        </p>
                        <p
                          className="text-[12px] mt-0.5"
                          style={{ color: TEXT_SECONDARY }}
                        >
                          {opt.description}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
