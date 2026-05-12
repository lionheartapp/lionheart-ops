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
        className="group/create relative px-4 sm:px-6 py-3 min-h-[44px] font-medium rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 flex items-center gap-2 cursor-pointer overflow-hidden"
        style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgb(167, 202, 241)' }}
        aria-label="Create new request"
        aria-expanded={isOpen}
        animate={isOpen
          ? { background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#ffffff', borderColor: 'transparent', boxShadow: '0 4px 20px rgba(99, 102, 241, 0.35), 0 0 40px rgba(59, 130, 246, 0.15)' }
          : { background: 'rgba(255, 255, 255, 0.5)', color: '#1e293b', borderColor: 'rgb(167, 202, 241)', boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.5)' }
        }
        whileHover={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#ffffff', borderColor: 'transparent', boxShadow: '0 4px 20px rgba(99, 102, 241, 0.35), 0 0 40px rgba(59, 130, 246, 0.15)' }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        <Plus className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''} group-hover/create:rotate-90`} aria-hidden="true" />
        Create
        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
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
            <div className="ui-glass-dropdown">
              {/* Meetings */}
              <div className="p-3 space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-3 py-1">Meetings</p>
                <button
                  onClick={onScheduleMeeting}
                  className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-primary-50 transition text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  <Users className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
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
                      className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-primary-50 transition text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                    >
                      <Icon className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" strokeWidth={1.75} />
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
                  className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-primary-50 transition text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  <Building2 className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-slate-900">Facilities Request</p>
                    <p className="text-xs text-slate-600">Submit a facilities request</p>
                  </div>
                </button>
                <button
                  onClick={() => onCreateTicket('IT')}
                  className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-primary-50 transition text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  <Headphones className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
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
