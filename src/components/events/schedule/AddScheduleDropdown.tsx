'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  ChevronDown,
  FolderOpen,
  LayoutGrid,
} from 'lucide-react'
import { BlockIllustration, SectionIllustration, BreakoutIllustration } from './ScheduleIllustrations'
import { Input } from '@/components/ui/Input'

// ─── Types ───────────────────────────────────────────────────────────────────

type AddMenuChoice = 'block' | 'section' | 'breakout'

interface AddScheduleDropdownProps {
  onAddBlock: () => void
  onAddSection: (title: string) => void
  onAddBreakout: (title: string) => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AddScheduleDropdown({ onAddBlock, onAddSection, onAddBreakout }: AddScheduleDropdownProps) {
  const [open, setOpen] = useState(false)
  const [naming, setNaming] = useState<AddMenuChoice | null>(null)
  const [title, setTitle] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setNaming(null)
        setTitle('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Auto-focus the input when naming mode activates
  useEffect(() => {
    if (naming && inputRef.current) {
      inputRef.current.focus()
    }
  }, [naming])

  function handleSelect(choice: AddMenuChoice) {
    if (choice === 'block') {
      onAddBlock()
      setOpen(false)
      setNaming(null)
    } else {
      setNaming(choice)
      setTitle('')
    }
  }

  function handleSubmitName() {
    const trimmed = title.trim()
    if (!trimmed || !naming) return
    if (naming === 'section') onAddSection(trimmed)
    else onAddBreakout(trimmed)
    setTitle('')
    setNaming(null)
    setOpen(false)
  }

  const options: { key: AddMenuChoice; label: string; description: string; illustration: React.ReactNode }[] = [
    {
      key: 'block',
      label: 'Item',
      description: 'A single time slot — session, meal, activity',
      illustration: <BlockIllustration />,
    },
    {
      key: 'section',
      label: 'Section',
      description: 'Group items that run one after another',
      illustration: <SectionIllustration />,
    },
    {
      key: 'breakout',
      label: 'Breakout',
      description: 'Parallel sessions happening at the same time',
      illustration: <BreakoutIllustration />,
    },
  ]

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => { setOpen((prev) => !prev); setNaming(null); setTitle('') }}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        Add
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden"
          >
            {/* Inline name input — slides in when section/breakout chosen */}
            {naming ? (
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  {naming === 'breakout' ? (
                    <LayoutGrid className="w-4 h-4 text-indigo-500" />
                  ) : (
                    <FolderOpen className="w-4 h-4 text-slate-500" />
                  )}
                  <span className="text-sm font-medium text-slate-900">
                    {naming === 'breakout' ? 'New Breakout' : 'New Section'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    size="sm"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSubmitName()
                      if (e.key === 'Escape') { setNaming(null); setTitle('') }
                    }}
                    placeholder={naming === 'breakout' ? 'Breakout name...' : 'Section name...'}
                    className="flex-1"
                  />
                  <button
                    onClick={handleSubmitName}
                    disabled={!title.trim()}
                    className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-40 transition-all cursor-pointer"
                  >
                    Add
                  </button>
                </div>
                <button
                  onClick={() => { setNaming(null); setTitle('') }}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  &larr; Back
                </button>
              </div>
            ) : (
              <div className="py-1">
                {options.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => handleSelect(opt.key)}
                    className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                  >
                    {/* Mini illustration */}
                    <div className="flex-shrink-0 w-14 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
                      {opt.illustration}
                    </div>
                    {/* Label + description */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="text-sm font-medium text-slate-900">{opt.label}</div>
                      <div className="text-xs text-slate-400 leading-snug mt-0.5">{opt.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
