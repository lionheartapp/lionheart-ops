'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, UserCircle2, Check } from 'lucide-react'
import { SearchInput } from '@/components/ui/SearchInput'
import {
  FIELD_TRIGGER_CLASSES,
  FIELD_TRIGGER_DISABLED,
  FIELD_OPEN,
  PANEL_CLASSES,
  PANEL_ROW_BASE,
  PANEL_ROW_SELECTED,
  PANEL_ROW_HOVER,
} from '@/components/ui/form-tokens'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AssigneeOption {
  userId: string
  /** Display name — already formatted (first + last, falls back to email) */
  name: string
  /** Smaller line under the name — usually team or job title */
  subtitle?: string
  avatar?: string | null
  /** true = on this event's team, false = elsewhere in the org */
  onEventTeam: boolean
}

interface AssigneePickerProps {
  options: AssigneeOption[]
  value: string
  onChange: (userId: string) => void
  /** Disabled state */
  disabled?: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function colorForName(name: string): string {
  // Stable hash → one of a small palette so initials chips look consistent.
  const palette = [
    'bg-blue-100 text-blue-700',
    'bg-amber-100 text-amber-700',
    'bg-violet-100 text-violet-700',
    'bg-green-100 text-green-700',
    'bg-pink-100 text-pink-700',
    'bg-teal-100 text-teal-700',
    'bg-orange-100 text-orange-700',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return palette[hash % palette.length]
}

// ─── Avatar ─────────────────────────────────────────────────────────────────

function Avatar({ name, src, size = 'md' }: { name: string; src?: string | null; size?: 'sm' | 'md' }) {
  const dim = size === 'md' ? 'w-8 h-8 text-xs' : 'w-6 h-6 text-[10px]'
  if (src) {
    return <img src={src} alt={name} className={`${dim} rounded-full object-cover flex-shrink-0`} />
  }
  return (
    <div className={`${dim} rounded-full flex items-center justify-center font-bold flex-shrink-0 ${colorForName(name)}`}>
      {getInitials(name)}
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AssigneePicker({ options, value, onChange, disabled }: AssigneePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'team' | 'all'>('team')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = useMemo(
    () => options.find((o) => o.userId === value) ?? null,
    [options, value],
  )

  const eventTeam = useMemo(() => options.filter((o) => o.onEventTeam), [options])
  const hasEventTeam = eventTeam.length > 0

  // Default tab: if there are event-team members, show them first; otherwise jump to All.
  useEffect(() => {
    if (isOpen) setActiveTab(hasEventTeam ? 'team' : 'all')
  }, [isOpen, hasEventTeam])

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  // Focus search on open
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50)
  }, [isOpen])

  const visibleOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = activeTab === 'team' && hasEventTeam ? eventTeam : options
    if (!q) return pool
    return pool.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        (o.subtitle && o.subtitle.toLowerCase().includes(q)),
    )
  }, [options, eventTeam, hasEventTeam, activeTab, query])

  function pick(userId: string) {
    onChange(userId)
    setIsOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((v) => !v)}
        disabled={disabled}
        className={`${FIELD_TRIGGER_CLASSES} ${disabled ? FIELD_TRIGGER_DISABLED : ''} ${isOpen ? FIELD_OPEN : ''}`}
      >
        {selected ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Avatar name={selected.name} src={selected.avatar} size="sm" />
            <div className="min-w-0 flex-1 text-left leading-tight">
              <p className="text-sm text-slate-900 truncate">{selected.name}</p>
              {selected.subtitle && (
                <p className="text-[11px] text-slate-500 truncate">{selected.subtitle}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400">
            <UserCircle2 className="w-4 h-4" />
            <span>Unassigned</span>
          </div>
        )}
        <ChevronDown
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className={PANEL_CLASSES}
          >
            {/* Search */}
            <div className="px-3 py-2 border-b border-slate-100">
              <SearchInput
                ref={inputRef}
                size="sm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people…"
                onClear={query ? () => setQuery('') : undefined}
              />
            </div>

            {/* Tabs */}
            {hasEventTeam && (
              <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-100">
                <TabButton
                  isActive={activeTab === 'team'}
                  onClick={() => { setActiveTab('team'); setQuery('') }}
                  count={eventTeam.length}
                >
                  Event team
                </TabButton>
                <TabButton
                  isActive={activeTab === 'all'}
                  onClick={() => { setActiveTab('all'); setQuery('') }}
                  count={options.length}
                >
                  All people
                </TabButton>
              </div>
            )}

            {/* Unassigned shortcut */}
            {!query && (
              <button
                type="button"
                onClick={() => pick('')}
                className={`${PANEL_ROW_BASE} border-b border-slate-100 ${
                  value === '' ? PANEL_ROW_SELECTED : PANEL_ROW_HOVER
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <UserCircle2 className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700">Unassigned</p>
                  <p className="text-[11px] text-slate-400">No one assigned</p>
                </div>
                {value === '' && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
              </button>
            )}

            {/* Options */}
            <div className="max-h-72 overflow-y-auto py-1">
              {visibleOptions.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-slate-400">
                  No people match &ldquo;{query}&rdquo;
                </p>
              ) : (
                visibleOptions.map((option) => (
                  <button
                    key={option.userId}
                    type="button"
                    onClick={() => pick(option.userId)}
                    className={`${PANEL_ROW_BASE} ${
                      option.userId === value ? PANEL_ROW_SELECTED : PANEL_ROW_HOVER
                    }`}
                  >
                    <Avatar name={option.name} src={option.avatar} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{option.name}</p>
                      {option.subtitle && (
                        <p className="text-[11px] text-slate-500 truncate">{option.subtitle}</p>
                      )}
                    </div>
                    {option.userId === value ? (
                      <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    ) : (
                      <span className="text-[10px] text-slate-300 flex-shrink-0">
                        {option.onEventTeam ? 'On team' : 'Org'}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface TabButtonProps {
  isActive: boolean
  onClick: () => void
  count: number
  children: React.ReactNode
}

function TabButton({ isActive, onClick, count, children }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
        isActive
          ? 'bg-slate-900 text-white'
          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
      <span
        className={`ml-1.5 text-[10px] ${
          isActive ? 'text-slate-300' : 'text-slate-400'
        }`}
      >
        {count}
      </span>
    </button>
  )
}
