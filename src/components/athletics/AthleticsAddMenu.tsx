'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, ChevronDown, Dribbble, CalendarDays, CalendarPlus,
  ClipboardList, Trophy, Dumbbell, Upload,
} from 'lucide-react'
import type { AthleticsTab } from '@/components/Sidebar'
import { AppEventName, emitAppEvent } from '@/lib/events/app-bus'

type AthleticsAddEvent =
  | typeof AppEventName.ATHLETICS_ADD_SPORT
  | typeof AppEventName.ATHLETICS_ADD_SEASON
  | typeof AppEventName.ATHLETICS_ADD_TEAM
  | typeof AppEventName.ATHLETICS_ADD_GAME
  | typeof AppEventName.ATHLETICS_ADD_PRACTICE
  | typeof AppEventName.ATHLETICS_ADD_PLAYER
  | typeof AppEventName.ATHLETICS_ADD_TOURNAMENT

interface AddMenuItem {
  label: string
  description: string
  icon: typeof Dribbble
  tab: string
  event: AthleticsAddEvent
}

const MENU_ITEMS: AddMenuItem[] = [
  { label: 'Schedule game', description: 'Add opponent, time, venue, and calendar link', icon: CalendarPlus, tab: 'schedule', event: AppEventName.ATHLETICS_ADD_GAME },
  { label: 'Schedule practice', description: 'Put a team practice on the athletics calendar', icon: Dumbbell, tab: 'schedule', event: AppEventName.ATHLETICS_ADD_PRACTICE },
  { label: 'Add athlete', description: 'Add a player to a roster', icon: ClipboardList, tab: 'roster', event: AppEventName.ATHLETICS_ADD_PLAYER },
  { label: 'Create tournament', description: 'Build a tournament bracket', icon: Trophy, tab: 'tournaments', event: AppEventName.ATHLETICS_ADD_TOURNAMENT },
  { label: 'Start season setup', description: 'Create sports, seasons, and teams before play starts', icon: CalendarDays, tab: 'sports', event: AppEventName.ATHLETICS_ADD_SEASON },
]

interface AthleticsAddMenuProps {
  onTabChange: (tab: string) => void
  onImportAll?: () => void
}

export default function AthleticsAddMenu({ onTabChange, onImportAll }: AthleticsAddMenuProps) {
  const [open, setOpen] = useState(false)

  const handleSelect = (item: AddMenuItem) => {
    setOpen(false)
    // Switch to the right tab first
    onTabChange(item.tab)
    // Give the tab a moment to render, then dispatch the event to open the create form
    setTimeout(() => {
      emitAppEvent(item.event)
    }, 100)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        Add
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Invisible backdrop to close dropdown */}
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl border border-stone-200 shadow-lg z-20 overflow-hidden"
            >
              <div className="p-1.5">
                {MENU_ITEMS.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.event}
                      type="button"
                      onClick={() => handleSelect(item)}
                      className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-stone-50 transition-colors cursor-pointer group"
                    >
                      <div className="mt-0.5 p-1.5 rounded-lg bg-stone-100 group-hover:bg-indigo-50 transition-colors">
                        <Icon className="w-4 h-4 text-stone-500 group-hover:text-indigo-600 transition-colors" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">{item.label}</p>
                        <p className="text-xs text-stone-500 mt-0.5">{item.description}</p>
                      </div>
                    </button>
                  )
                })}

                {onImportAll && (
                  <>
                    <div className="my-1 mx-3 border-t border-stone-100" />
                    <button
                      type="button"
                      onClick={() => { setOpen(false); onImportAll() }}
                      className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-stone-50 transition-colors cursor-pointer group"
                    >
                      <div className="mt-0.5 p-1.5 rounded-lg bg-indigo-50 group-hover:bg-indigo-100 transition-colors">
                        <Upload className="w-4 h-4 text-indigo-500 group-hover:text-indigo-700 transition-colors" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">Import season data</p>
                        <p className="text-xs text-stone-500 mt-0.5">Bring in sports, teams, and rosters from CSV</p>
                      </div>
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
