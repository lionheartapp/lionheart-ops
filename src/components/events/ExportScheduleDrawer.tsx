'use client'

import { useState, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { ClipboardList, Users, FileDown, Loader2 } from 'lucide-react'
import DetailDrawer from '@/components/DetailDrawer'
import { fetchApi } from '@/lib/api-client'
import { useToast } from '@/components/Toast'
import { generateScheduleHTML } from '@/lib/utils/scheduleExportHtml'
import type { DayScheduleData, ExportOptions } from '@/lib/utils/scheduleExportHtml'
import type { BlockTypeConfig } from '@/lib/types/event-project'
import type { EventScheduleBlock } from '@/lib/hooks/useEventProject'
import type { EventScheduleSection } from '@/lib/hooks/useEventSchedule'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExportScheduleDrawerProps {
  isOpen: boolean
  onClose: () => void
  eventProjectId: string
  allBlocks: EventScheduleBlock[]
  allTypes: BlockTypeConfig[]
  eventDates: Date[] | null
  selectedDateStr: string
}

// Types that are unchecked by default in attendee mode
const ATTENDEE_DEFAULT_EXCLUDED = ['SETUP', 'FREE_TIME']

// ─── Component ───────────────────────────────────────────────────────────────

export function ExportScheduleDrawer({
  isOpen,
  onClose,
  eventProjectId,
  allBlocks,
  allTypes,
  eventDates,
  selectedDateStr,
}: ExportScheduleDrawerProps) {
  const { toast } = useToast()

  // Day selection — default to current selected date
  const [selectedDays, setSelectedDays] = useState<Set<string>>(() => new Set([selectedDateStr]))
  const [allDaysSelected, setAllDaysSelected] = useState(false)

  // Audience
  const [audience, setAudience] = useState<'staff' | 'attendee'>('staff')

  // Attendee customization
  const [excludedTypes, setExcludedTypes] = useState<Set<string>>(() => new Set(ATTENDEE_DEFAULT_EXCLUDED))
  const [showDescriptions, setShowDescriptions] = useState(true)
  const [showLocations, setShowLocations] = useState(true)
  const [showLeadNames, setShowLeadNames] = useState(false)

  // Export state
  const [isExporting, setIsExporting] = useState(false)

  // Available day chips
  const dayChips = useMemo(() => {
    if (!eventDates || eventDates.length === 0) return []
    return eventDates.map((d) => ({
      dateStr: format(d, 'yyyy-MM-dd'),
      label: format(d, 'EEE, MMM d'),
    }))
  }, [eventDates])

  // Which block types are actually used in the selected blocks
  const usedTypes = useMemo(() => {
    const typeValues = new Set<string>()
    for (const block of allBlocks) {
      const customType = (block.metadata as Record<string, unknown>)?.customType as string | undefined
      typeValues.add(customType || block.type)
    }
    return allTypes.filter((t) => typeValues.has(t.value))
  }, [allBlocks, allTypes])

  // ─── Day selection handlers ─────────────────────────────────────────

  const handleToggleAllDays = useCallback(() => {
    if (allDaysSelected) {
      setAllDaysSelected(false)
      setSelectedDays(new Set([selectedDateStr]))
    } else {
      setAllDaysSelected(true)
      setSelectedDays(new Set(dayChips.map((d) => d.dateStr)))
    }
  }, [allDaysSelected, dayChips, selectedDateStr])

  const handleToggleDay = useCallback((dateStr: string) => {
    setSelectedDays((prev) => {
      const next = new Set(prev)
      if (next.has(dateStr)) {
        // Don't allow deselecting the last day
        if (next.size <= 1) return prev
        next.delete(dateStr)
      } else {
        next.add(dateStr)
      }
      // Sync "All Days" state
      setAllDaysSelected(dayChips.length > 0 && next.size === dayChips.length)
      return next
    })
  }, [dayChips])

  // ─── Type toggle handler ────────────────────────────────────────────

  const handleToggleType = useCallback((typeValue: string) => {
    setExcludedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(typeValue)) {
        next.delete(typeValue)
      } else {
        next.add(typeValue)
      }
      return next
    })
  }, [])

  // ─── Export handler ─────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    const selectedDayStrs = Array.from(selectedDays).sort()
    if (selectedDayStrs.length === 0) return

    setIsExporting(true)

    try {
      // Filter blocks by selected days
      const blocksByDay = new Map<string, EventScheduleBlock[]>()
      for (const dayStr of selectedDayStrs) {
        blocksByDay.set(dayStr, [])
      }
      for (const block of allBlocks) {
        const blockDate = block.startsAt.slice(0, 10)
        if (blocksByDay.has(blockDate)) {
          blocksByDay.get(blockDate)!.push(block)
        }
      }

      // Fetch sections for each selected day in parallel
      const sectionResults = await Promise.all(
        selectedDayStrs.map((dateStr) =>
          fetchApi<EventScheduleSection[]>(
            `/api/events/projects/${eventProjectId}/schedule/sections?date=${dateStr}`,
          ).catch(() => [] as EventScheduleSection[]),
        ),
      )

      const days: DayScheduleData[] = selectedDayStrs.map((dateStr, i) => ({
        dateStr,
        blocks: blocksByDay.get(dateStr) || [],
        sections: sectionResults[i],
      }))

      const options: ExportOptions = {
        audience,
        excludedTypes: audience === 'attendee' ? Array.from(excludedTypes) : [],
        showDescriptions: audience === 'staff' || showDescriptions,
        showLocations: audience === 'staff' || showLocations,
        showLeadNames: audience === 'staff' || showLeadNames,
      }

      const html = generateScheduleHTML(days, allTypes, options)

      const printWindow = window.open('', '_blank', 'width=800,height=1100')
      if (!printWindow) {
        toast('Please allow pop-ups for this site to export the schedule.', 'error')
        return
      }

      printWindow.document.write(html)
      printWindow.document.close()

      // Wait for fonts to load, then trigger print
      setTimeout(() => {
        printWindow.print()
      }, 500)
    } catch {
      toast('Something went wrong generating the schedule. Please try again.', 'error')
    } finally {
      setIsExporting(false)
    }
  }, [selectedDays, allBlocks, eventProjectId, audience, excludedTypes, showDescriptions, showLocations, showLeadNames, allTypes, toast])

  // ─── Render ─────────────────────────────────────────────────────────

  const footer = (
    <button
      onClick={handleExport}
      disabled={isExporting || selectedDays.size === 0}
      className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer active:scale-[0.97]"
    >
      {isExporting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <FileDown className="w-4 h-4" />
      )}
      {isExporting ? 'Generating...' : 'Export PDF'}
    </button>
  )

  return (
    <DetailDrawer isOpen={isOpen} onClose={onClose} title="Export Schedule" footer={footer} width="md">
      <div className="space-y-6">
        {/* ── Days ─────────────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-3">Days</label>
          <div className="flex flex-wrap gap-2">
            {dayChips.length > 1 && (
              <button
                onClick={handleToggleAllDays}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                  allDaysSelected
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                All Days
              </button>
            )}
            {dayChips.map((chip) => (
              <button
                key={chip.dateStr}
                onClick={() => handleToggleDay(chip.dateStr)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                  selectedDays.has(chip.dateStr)
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {chip.label}
              </button>
            ))}
            {dayChips.length === 0 && (
              <div className="px-3 py-1.5 rounded-full text-sm font-medium bg-slate-900 text-white">
                {format(new Date(selectedDateStr + 'T12:00:00'), 'EEE, MMM d')}
              </div>
            )}
          </div>
        </div>

        {/* ── Audience ────────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-3">Audience</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setAudience('staff')}
              className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all cursor-pointer text-left ${
                audience === 'staff'
                  ? 'ring-2 ring-blue-500 border-blue-200 bg-blue-50/50'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <ClipboardList className={`w-5 h-5 mb-2 ${audience === 'staff' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="text-sm font-semibold text-slate-900">Staff</span>
              <span className="text-xs text-slate-500 mt-0.5">Locations, leaders, notes, full detail</span>
            </button>
            <button
              onClick={() => setAudience('attendee')}
              className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all cursor-pointer text-left ${
                audience === 'attendee'
                  ? 'ring-2 ring-blue-500 border-blue-200 bg-blue-50/50'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <Users className={`w-5 h-5 mb-2 ${audience === 'attendee' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="text-sm font-semibold text-slate-900">Attendee</span>
              <span className="text-xs text-slate-500 mt-0.5">Clean agenda for distribution</span>
            </button>
          </div>
        </div>

        {/* ── Customize (attendee only) ───────────────────────────── */}
        <AnimatePresence mode="wait">
          {audience === 'attendee' && (
            <motion.div
              key="attendee-options"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="overflow-hidden"
            >
              <div className="space-y-5">
                {/* Include block types */}
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-3">Include block types</label>
                  <div className="space-y-2">
                    {usedTypes.map((type) => {
                      const isIncluded = !excludedTypes.has(type.value)
                      return (
                        <label
                          key={type.value}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isIncluded}
                            onChange={() => handleToggleType(type.value)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <span
                            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${type.dotColor}`}
                            style={type.hexColor ? { backgroundColor: type.hexColor } : undefined}
                          />
                          <span className="text-sm text-slate-700">{type.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Show details */}
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-3">Show details</label>
                  <div className="space-y-3">
                    <ToggleRow
                      label="Descriptions"
                      checked={showDescriptions}
                      onChange={setShowDescriptions}
                    />
                    <ToggleRow
                      label="Locations"
                      checked={showLocations}
                      onChange={setShowLocations}
                    />
                    <ToggleRow
                      label="Lead names"
                      checked={showLeadNames}
                      onChange={setShowLeadNames}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DetailDrawer>
  )
}

// ─── Toggle Switch ───────────────────────────────────────────────────────────

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
      <span className="text-sm text-slate-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out cursor-pointer ${
          checked ? 'bg-blue-600' : 'bg-slate-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  )
}
