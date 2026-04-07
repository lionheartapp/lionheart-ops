'use client'

import { useState, useMemo, useCallback, useRef, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  ChevronDown,
  Plus,
  MoreHorizontal,
  Check,
  Pencil,
  Palette,
  Trash2,
  Trophy,
} from 'lucide-react'
import CampusShapeIndicator, { buildCampusShapeMap, getShapeIndex } from '@/components/calendar/CampusShapeIndicator'
import MeetWithSection from '@/components/calendar/MeetWithSection'
import type { MeetWithPerson } from '@/lib/hooks/useMeetWith'
import type { CalendarSidebarData } from './types'
import { COLOR_PRESETS } from './constants'

interface CalendarPanelProps {
  calendarData: CalendarSidebarData[]
  calendarDataReceived: boolean
  visibleCalendarIds: Set<string>
  athleticsVisibleCampusIds: Set<string>
  athleticsEnabledCampusIds: Set<string>
  canManageWorkspace: boolean
  meetWithPeople: MeetWithPerson[]
  onToggleVisibility: (calendarId: string) => void
  onToggleAthleticsCalendar: (campusId: string) => void
  onCreateCalendar: () => void
  onRenameSubmit: (calendarId: string, name: string) => void
  onColorSelect: (calendarId: string, color: string) => void
  onDeleteCalendar: (cal: CalendarSidebarData) => void
  onMeetWithAdd: (person: MeetWithPerson) => void
  onMeetWithRemove: (personId: string) => void
}

export default function CalendarPanel({
  calendarData,
  calendarDataReceived,
  visibleCalendarIds,
  athleticsVisibleCampusIds,
  athleticsEnabledCampusIds,
  canManageWorkspace,
  meetWithPeople,
  onToggleVisibility,
  onToggleAthleticsCalendar,
  onCreateCalendar,
  onRenameSubmit,
  onColorSelect,
  onDeleteCalendar,
  onMeetWithAdd,
  onMeetWithRemove,
}: CalendarPanelProps) {
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(
    new Set(['MASTER', 'MY SCHEDULE'])
  )
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameCancelledRef = useRef(false)
  const [colorEditId, setColorEditId] = useState<string | null>(null)

  const campusShapeMap = useMemo(() => buildCampusShapeMap(calendarData), [calendarData])

  const toggleCalendarType = (type: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const handleRenameStart = useCallback((cal: CalendarSidebarData) => {
    setMenuOpenId(null)
    renameCancelledRef.current = false
    setRenamingId(cal.id)
    setRenameValue(cal.name)
  }, [])

  const handleRenameSubmit = useCallback((calendarId: string) => {
    if (renameCancelledRef.current) return
    const trimmed = renameValue.trim()
    if (trimmed) {
      onRenameSubmit(calendarId, trimmed)
    }
    setRenamingId(null)
    setRenameValue('')
  }, [renameValue, onRenameSubmit])

  const handleRenameCancel = useCallback(() => {
    renameCancelledRef.current = true
    setRenamingId(null)
    setRenameValue('')
  }, [])

  const handleColorChangeStart = useCallback((calendarId: string) => {
    setMenuOpenId(null)
    setColorEditId(calendarId)
  }, [])

  const handleDeleteCalendar = useCallback((cal: CalendarSidebarData) => {
    setMenuOpenId(null)
    onDeleteCalendar(cal)
  }, [onDeleteCalendar])

  // Group calendars into MASTER (non-personal) and MY SCHEDULE (personal)
  const masterCalendars = calendarData.filter((c) => c.calendarType !== 'PERSONAL')
  const personalCalendars = calendarData.filter((c) => c.calendarType === 'PERSONAL')

  const calendarSections = [
    { key: 'MASTER', label: 'Master', cals: masterCalendars },
    { key: 'MY SCHEDULE', label: 'My Schedule', cals: personalCalendars },
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-10 pb-4 border-b border-white/30 flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Calendars</h2>
        {canManageWorkspace && (
          <button
            onClick={onCreateCalendar}
            className="p-1 rounded-md hover:bg-white/50 text-slate-400 hover:text-primary-600 transition-colors"
            title="Create calendar"
            aria-label="Create calendar"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="px-3 pt-4 flex-1 overflow-y-auto">
        {!calendarDataReceived && calendarData.length === 0 && (
          <div className="space-y-3 px-2 animate-pulse">
            <div className="h-3 w-16 bg-slate-200 rounded" />
            <div className="space-y-2 pl-2">
              <div className="h-4 w-32 bg-slate-200 rounded" />
              <div className="h-4 w-28 bg-slate-200 rounded" />
            </div>
            <div className="h-3 w-20 bg-slate-200 rounded mt-4" />
            <div className="space-y-2 pl-2">
              <div className="h-4 w-24 bg-slate-200 rounded" />
            </div>
          </div>
        )}
        {calendarSections.map(({ key, label, cals }) => {
          if (cals.length === 0 && key !== 'MY SCHEDULE') return null
          const isMySchedule = key === 'MY SCHEDULE'
          const isExpanded = isMySchedule || expandedTypes.has(key)
          return (
            <div key={key} className="mb-1">
              {isMySchedule ? (
                <div className="flex items-center gap-1.5 w-full px-2 py-2 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
                  {label}
                </div>
              ) : (
                <button
                  onClick={() => toggleCalendarType(key)}
                  className="flex items-center gap-1.5 w-full px-2 py-2 text-[10px] font-semibold tracking-widest text-slate-500 uppercase hover:text-slate-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  <motion.span
                    animate={{ rotate: isExpanded ? 0 : -90 }}
                    transition={{ duration: 0.15 }}
                    className="inline-flex"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </motion.span>
                  {label}
                  <span className="ml-auto text-slate-300 normal-case tracking-normal font-normal text-xs">
                    {cals.length}
                  </span>
                </button>
              )}
              <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  className="space-y-0.5 overflow-hidden"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  {cals.length === 0 && isMySchedule && (
                    <div className="px-3 py-4 text-center">
                      <p className="text-xs text-slate-400">Your personal calendar will appear here</p>
                    </div>
                  )}
                  {cals.map((cal, calIdx) => {
                    const campusId = cal.campus?.id
                    const hasAthletics = !isMySchedule && campusId && athleticsEnabledCampusIds.has(campusId)
                    const isLastCalForCampus = hasAthletics && !cals.slice(calIdx + 1).some((c) => c.campus?.id === campusId)
                    const isAthVisible = campusId ? athleticsVisibleCampusIds.has(campusId) : false
                    const isVisible = visibleCalendarIds.has(cal.id)
                    const isRenaming = renamingId === cal.id
                    const isColorEditing = colorEditId === cal.id
                    const isMenuOpen = menuOpenId === cal.id
                    const canEditCal = canManageWorkspace || cal.calendarType === 'PERSONAL'

                    return (
                      <Fragment key={cal.id}>
                      <div className="relative group">
                        {isRenaming ? (
                          <div className="flex items-center gap-2 px-3 py-2">
                            <div
                              className="w-3 h-3 rounded-sm flex-shrink-0"
                              style={{ backgroundColor: cal.color }}
                            />
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameSubmit(cal.id)
                                if (e.key === 'Escape') handleRenameCancel()
                              }}
                              onBlur={() => handleRenameSubmit(cal.id)}
                              className="flex-1 min-w-0 px-2 py-0.5 text-sm border border-primary-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-200 bg-white text-slate-700"
                              autoFocus
                            />
                          </div>
                        ) : isColorEditing ? (
                          <div className="px-3 py-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <div
                                className="w-3 h-3 rounded-sm flex-shrink-0"
                                style={{ backgroundColor: cal.color }}
                              />
                              <span className="truncate">{cal.calendarType === 'PERSONAL' ? 'My Calendar' : cal.name}</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {COLOR_PRESETS.map((c) => (
                                <button
                                  key={c.value}
                                  type="button"
                                  onClick={() => {
                                    onColorSelect(cal.id, c.value)
                                    setColorEditId(null)
                                  }}
                                  className="w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary-400"
                                  style={{ backgroundColor: c.value }}
                                  title={c.name}
                                >
                                  {cal.color === c.value && (
                                    <Check className="w-3 h-3 text-white" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => onToggleVisibility(cal.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                onToggleVisibility(cal.id)
                              }
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition cursor-pointer ${
                              isVisible
                                ? 'text-slate-700 hover:bg-white/30'
                                : 'text-slate-400 hover:bg-white/30'
                            }`}
                            title={cal.calendarType === 'PERSONAL' ? 'My Calendar' : cal.name}
                          >
                            <div
                              className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-colors"
                              style={{
                                backgroundColor: isVisible ? cal.color : 'transparent',
                                border: isVisible ? 'none' : `2px solid ${cal.color}`,
                              }}
                            >
                              {isVisible && <Check className="w-3 h-3 text-white" />}
                            </div>
                            {cal.campus && (
                              <CampusShapeIndicator
                                shapeIndex={getShapeIndex(campusShapeMap, cal.campus.id)}
                                color={cal.color}
                                size={12}
                              />
                            )}
                            <span className="truncate">{cal.calendarType === 'PERSONAL' ? 'My Calendar' : cal.name}</span>
                            {canEditCal && (
                              <button
                                type="button"
                                tabIndex={0}
                                aria-label={`Calendar options for ${cal.name}`}
                                aria-haspopup="menu"
                                aria-expanded={isMenuOpen}
                                className="ml-auto opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition-opacity p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 rounded hover:bg-slate-200/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setColorEditId(null)
                                  if (renamingId) handleRenameCancel()
                                  setMenuOpenId(isMenuOpen ? null : cal.id)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setColorEditId(null)
                                    if (renamingId) handleRenameCancel()
                                    setMenuOpenId(isMenuOpen ? null : cal.id)
                                  }
                                }}
                              >
                                <MoreHorizontal className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                              </button>
                            )}
                          </div>
                        )}

                        {isMenuOpen && (
                          <div
                            role="menu"
                            aria-label={`Options for ${cal.name}`}
                            className="absolute right-2 bottom-0 translate-y-full z-modal w-40 bg-white rounded-lg shadow-medium border border-slate-200 py-1"
                            style={{ maxHeight: '200px' }}
                            ref={(el) => {
                              if (el) {
                                const rect = el.getBoundingClientRect()
                                if (rect.bottom > window.innerHeight - 8) {
                                  el.style.bottom = 'auto'
                                  el.style.top = '0'
                                  el.style.transform = 'translateY(-100%)'
                                }
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              role="menuitem"
                              onClick={() => handleRenameStart(cal)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5 text-slate-400" />
                              Rename
                            </button>
                            <button
                              role="menuitem"
                              onClick={() => handleColorChangeStart(cal.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <Palette className="w-3.5 h-3.5 text-slate-400" />
                              Change Color
                            </button>
                            {canManageWorkspace && (
                              <button
                                role="menuitem"
                                onClick={() => handleDeleteCalendar(cal)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {isLastCalForCampus && campusId && (
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => onToggleAthleticsCalendar(campusId)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              onToggleAthleticsCalendar(campusId)
                            }
                          }}
                          className={`flex items-center gap-2.5 pr-3 py-2 rounded-xl text-sm transition cursor-pointer ${
                            isAthVisible
                              ? 'text-slate-700 hover:bg-white/30'
                              : 'text-slate-400 hover:bg-white/30'
                          }`}
                          title={`Athletics — ${cal.campus?.name || 'Campus'}`}
                        >
                          <div className="flex items-center ml-5">
                            <div className="w-3.5 h-5 border-l-2 border-b-2 border-slate-300/60 rounded-bl-sm -mt-3" />
                          </div>
                          <div
                            className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-colors ml-0.5"
                            style={{
                              backgroundColor: isAthVisible ? '#f59e0b' : 'transparent',
                              border: isAthVisible ? 'none' : '2px solid #f59e0b',
                            }}
                          >
                            {isAthVisible && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <Trophy className="w-3.5 h-3.5 flex-shrink-0 text-amber-500 ml-1" />
                          <span className="truncate">Athletics</span>
                        </div>
                      )}
                      </Fragment>
                    )
                  })}
                </motion.div>
              )}
              </AnimatePresence>
            </div>
          )
        })}
        {calendarData.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-xs">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p>No calendars yet</p>
          </div>
        )}

        {calendarDataReceived && (
          <div className="border-t border-slate-200 mt-2 pt-2">
            <MeetWithSection
              people={meetWithPeople}
              onAdd={onMeetWithAdd}
              onRemove={onMeetWithRemove}
            />
          </div>
        )}
      </div>
    </div>
  )
}
