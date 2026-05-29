'use client'

import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, ChevronDown, Building2, Headphones, Users } from 'lucide-react'
import { dropdownVariants } from '@/lib/animations'
import { EVENT_CREATE_OPTIONS, type EventCreateMode } from '@/components/events/CreateEventMenu'

interface CreateDropdownMenuProps {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  isAdmin: boolean
  onScheduleMeeting: () => void
  onCreateEvent: (mode: EventCreateMode) => void
  onCreateTicket: (category: 'MAINTENANCE' | 'IT') => void
}

export default function CreateDropdownMenu({
  isOpen,
  onToggle,
  onClose,
  isAdmin,
  onScheduleMeeting,
  onCreateEvent,
  onCreateTicket,
}: CreateDropdownMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen, onClose])

  return (
    <div ref={ref} className="relative">
      <motion.button
        onClick={onToggle}
        className="group/create relative min-h-[44px] rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 sm:px-5 flex items-center gap-2 cursor-pointer"
        aria-label="Create new request"
        aria-expanded={isOpen}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.16 }}
      >
        <Plus className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} aria-hidden="true" />
        Create
        <ChevronDown className={`w-4 h-4 text-white/75 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute right-0 pt-2 top-full w-64 z-mobilenav"
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg shadow-slate-950/5">
              {/* Meetings */}
              <div className="p-3 space-y-1">
                <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Meetings</p>
                <button
                  onClick={onScheduleMeeting}
                  className="group/item w-full flex items-start gap-3 rounded-lg border border-transparent p-3 text-left transition-[background-color,border-color,transform] duration-200 hover:-translate-y-px hover:border-slate-200 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 cursor-pointer"
                >
                  <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 transition-colors duration-200 group-hover/item:bg-primary-100">
                    <Users className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="font-medium text-slate-900">Schedule Meeting</p>
                    <p className="text-xs text-slate-600">Informal — added instantly, no approval</p>
                  </div>
                </button>
              </div>

              <div className="px-3"><div className="h-px bg-slate-200" /></div>

              {/* School Events */}
              <div className="p-3 space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-3 py-1">School Events</p>
                {EVENT_CREATE_OPTIONS.filter((o) => !o.adminOnly || isAdmin).map((opt) => {
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.mode}
                      onClick={() => onCreateEvent(opt.mode)}
                      className="group/item w-full flex items-start gap-3 rounded-lg border border-transparent p-3 text-left transition-[background-color,border-color,transform] duration-200 hover:-translate-y-px hover:border-slate-200 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 cursor-pointer"
                    >
                      <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 transition-colors duration-200 group-hover/item:bg-primary-100">
                        <Icon className="w-5 h-5" strokeWidth={1.75} />
                      </span>
                      <div>
                        <p className="font-medium text-slate-900">{opt.label}</p>
                        <p className="text-xs text-slate-600">{opt.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="px-3"><div className="h-px bg-slate-200" /></div>

              {/* Support */}
              <div className="p-3 space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-3 py-2">Support</p>
                <button
                  onClick={() => onCreateTicket('MAINTENANCE')}
                  className="group/item w-full flex items-start gap-3 rounded-lg border border-transparent p-3 text-left transition-[background-color,border-color,transform] duration-200 hover:-translate-y-px hover:border-slate-200 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 cursor-pointer"
                >
                  <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 transition-colors duration-200 group-hover/item:bg-primary-100">
                    <Building2 className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="font-medium text-slate-900">Facilities Request</p>
                    <p className="text-xs text-slate-600">Submit a facilities request</p>
                  </div>
                </button>
                <button
                  onClick={() => onCreateTicket('IT')}
                  className="group/item w-full flex items-start gap-3 rounded-lg border border-transparent p-3 text-left transition-[background-color,border-color,transform] duration-200 hover:-translate-y-px hover:border-slate-200 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 cursor-pointer"
                >
                  <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 transition-colors duration-200 group-hover/item:bg-primary-100">
                    <Headphones className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="font-medium text-slate-900">IT Request</p>
                    <p className="text-xs text-slate-600">Submit an IT support request</p>
                  </div>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
