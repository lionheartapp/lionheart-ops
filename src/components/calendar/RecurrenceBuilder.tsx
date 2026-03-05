'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { RRule } from 'rrule'
import { Repeat, ChevronDown } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────

type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
type EndType = 'never' | 'count' | 'until'
type MonthlyMode = 'dayOfMonth' | 'nthWeekday'

interface RecurrenceConfig {
  frequency: Frequency
  interval: number
  weekdays: number[] // 0=Mon … 6=Sun (RRule convention)
  monthlyMode: MonthlyMode
  endType: EndType
  count: number
  until: string // YYYY-MM-DD
}

interface RecurrenceBuilderProps {
  value: string | null // current RRULE string or null
  onChange: (rrule: string | null) => void
  eventStartDate: string // YYYY-MM-DD — used for monthly "nth weekday" label
}

// ── Constants ────────────────────────────────────────────────────────

const FREQ_OPTIONS: { value: Frequency; label: string; plural: string }[] = [
  { value: 'DAILY', label: 'Day', plural: 'days' },
  { value: 'WEEKLY', label: 'Week', plural: 'weeks' },
  { value: 'MONTHLY', label: 'Month', plural: 'months' },
  { value: 'YEARLY', label: 'Year', plural: 'years' },
]

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const RRULE_WEEKDAYS = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU]

const FREQ_MAP: Record<Frequency, number> = {
  DAILY: RRule.DAILY,
  WEEKLY: RRule.WEEKLY,
  MONTHLY: RRule.MONTHLY,
  YEARLY: RRule.YEARLY,
}

// ── Helpers ──────────────────────────────────────────────────────────

function getDefaultConfig(eventStartDate: string): RecurrenceConfig {
  const dayOfWeek = getDayOfWeek(eventStartDate)
  return {
    frequency: 'WEEKLY',
    interval: 1,
    weekdays: [dayOfWeek],
    monthlyMode: 'dayOfMonth',
    endType: 'never',
    count: 10,
    until: getFutureDate(eventStartDate, 90),
  }
}

function getDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  // JS: 0=Sun, convert to RRule: 0=Mon
  const jsDay = date.getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

function getFutureDate(dateStr: string, daysAhead: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + daysAhead)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function getNthWeekdayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
  const nth = Math.ceil(d / 7)
  const ordinal = ['first', 'second', 'third', 'fourth', 'fifth'][nth - 1] || `${nth}th`
  return `${ordinal} ${dayName}`
}

function configToRRule(config: RecurrenceConfig, eventStartDate: string): string {
  const [y, m, d] = eventStartDate.split('-').map(Number)
  const dtstart = new Date(Date.UTC(y, m - 1, d))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: Record<string, any> = {
    freq: FREQ_MAP[config.frequency],
    interval: config.interval,
    dtstart,
    wkst: RRule.SU,
  }

  if (config.frequency === 'WEEKLY' && config.weekdays.length > 0) {
    options.byweekday = config.weekdays.map((i) => RRULE_WEEKDAYS[i])
  }

  if (config.frequency === 'MONTHLY' && config.monthlyMode === 'nthWeekday') {
    const dayOfWeek = getDayOfWeek(eventStartDate)
    const nth = Math.ceil(d / 7)
    options.byweekday = [RRULE_WEEKDAYS[dayOfWeek].nth(nth)]
  }

  if (config.endType === 'count') {
    options.count = config.count
  } else if (config.endType === 'until') {
    const [uy, um, ud] = config.until.split('-').map(Number)
    options.until = new Date(Date.UTC(uy, um - 1, ud, 23, 59, 59))
  }

  const rule = new RRule(options)
  return rule.toString()
}

function buildSummary(config: RecurrenceConfig, eventStartDate: string): string {
  const freq = FREQ_OPTIONS.find((f) => f.value === config.frequency)!

  // Interval
  let base: string
  if (config.interval === 1) {
    base = config.frequency === 'DAILY' ? 'Every day'
      : config.frequency === 'WEEKLY' ? 'Every week'
      : config.frequency === 'MONTHLY' ? 'Every month'
      : 'Every year'
  } else {
    base = `Every ${config.interval} ${freq.plural}`
  }

  // Weekday detail for weekly
  if (config.frequency === 'WEEKLY' && config.weekdays.length > 0) {
    // Check for weekdays preset
    const weekdaySet = new Set(config.weekdays)
    const isWeekdays = weekdaySet.size === 5 &&
      [0, 1, 2, 3, 4].every((d) => weekdaySet.has(d))

    if (isWeekdays && config.interval === 1) {
      base = 'Every weekday'
    } else {
      const dayNames = config.weekdays
        .sort((a, b) => a - b)
        .map((i) => WEEKDAY_NAMES[i])
      base += ` on ${dayNames.join(', ')}`
    }
  }

  // Monthly detail
  if (config.frequency === 'MONTHLY' && config.monthlyMode === 'nthWeekday') {
    base += ` on the ${getNthWeekdayLabel(eventStartDate)}`
  }

  // End condition
  if (config.endType === 'count') {
    base += `, ${config.count} times`
  } else if (config.endType === 'until') {
    const [uy, um, ud] = config.until.split('-').map(Number)
    const untilDate = new Date(uy, um - 1, ud)
    base += `, until ${untilDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }

  return base
}

// Try to parse an existing RRULE string back into a config
function parseRRuleToConfig(rruleStr: string, eventStartDate: string): RecurrenceConfig | null {
  try {
    const rule = RRule.fromString(rruleStr)
    const opts = rule.origOptions

    let frequency: Frequency = 'WEEKLY'
    if (opts.freq === RRule.DAILY) frequency = 'DAILY'
    else if (opts.freq === RRule.WEEKLY) frequency = 'WEEKLY'
    else if (opts.freq === RRule.MONTHLY) frequency = 'MONTHLY'
    else if (opts.freq === RRule.YEARLY) frequency = 'YEARLY'

    let weekdays: number[] = []
    let monthlyMode: MonthlyMode = 'dayOfMonth'

    if (opts.byweekday) {
      const bwd = Array.isArray(opts.byweekday) ? opts.byweekday : [opts.byweekday]
      weekdays = bwd.map((wd) => {
        if (typeof wd === 'number') return wd
        if (typeof wd === 'string') {
          // WeekdayStr like 'MO', 'TU', etc.
          const strMap: Record<string, number> = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 }
          return strMap[wd] ?? 0
        }
        // RRule Weekday object
        const wdObj = wd as unknown as { weekday: number; n?: number }
        if (wdObj.n && frequency === 'MONTHLY') {
          monthlyMode = 'nthWeekday'
        }
        return wdObj.weekday
      })
    }

    if (weekdays.length === 0 && frequency === 'WEEKLY') {
      weekdays = [getDayOfWeek(eventStartDate)]
    }

    let endType: EndType = 'never'
    let count = 10
    let until = getFutureDate(eventStartDate, 90)

    if (opts.count) {
      endType = 'count'
      count = opts.count
    } else if (opts.until) {
      endType = 'until'
      const d = opts.until
      const pad = (n: number) => n.toString().padStart(2, '0')
      until = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    }

    return {
      frequency,
      interval: opts.interval || 1,
      weekdays,
      monthlyMode,
      endType,
      count,
      until,
    }
  } catch {
    return null
  }
}

// ── Component ────────────────────────────────────────────────────────

export default function RecurrenceBuilder({ value, onChange, eventStartDate }: RecurrenceBuilderProps) {
  const [isEnabled, setIsEnabled] = useState(!!value)
  const [config, setConfig] = useState<RecurrenceConfig>(() => {
    if (value) {
      return parseRRuleToConfig(value, eventStartDate) || getDefaultConfig(eventStartDate)
    }
    return getDefaultConfig(eventStartDate)
  })

  // When the event start date changes, update weekday defaults if user hasn't customized
  useEffect(() => {
    if (!isEnabled) return
    const dayOfWeek = getDayOfWeek(eventStartDate)
    setConfig((prev) => {
      // Only auto-update weekday if it was a single default day
      if (prev.frequency === 'WEEKLY' && prev.weekdays.length === 1) {
        return { ...prev, weekdays: [dayOfWeek] }
      }
      return prev
    })
  }, [eventStartDate, isEnabled])

  // Sync RRULE output when config changes
  useEffect(() => {
    if (!isEnabled) {
      if (value !== null) onChange(null)
      return
    }
    const rrule = configToRRule(config, eventStartDate)
    if (rrule !== value) {
      onChange(rrule)
    }
  }, [config, isEnabled, eventStartDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const summary = useMemo(
    () => isEnabled ? buildSummary(config, eventStartDate) : '',
    [config, isEnabled, eventStartDate]
  )

  const toggleEnabled = useCallback(() => {
    setIsEnabled((prev) => {
      if (prev) {
        onChange(null)
        return false
      }
      setConfig(getDefaultConfig(eventStartDate))
      return true
    })
  }, [eventStartDate, onChange])

  const updateConfig = useCallback(<K extends keyof RecurrenceConfig>(key: K, val: RecurrenceConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: val }))
  }, [])

  const toggleWeekday = useCallback((day: number) => {
    setConfig((prev) => {
      const next = prev.weekdays.includes(day)
        ? prev.weekdays.filter((d) => d !== day)
        : [...prev.weekdays, day]
      // Must have at least one day
      if (next.length === 0) return prev
      return { ...prev, weekdays: next }
    })
  }, [])

  const [showEndDropdown, setShowEndDropdown] = useState(false)

  return (
    <div className="space-y-3">
      {/* Toggle row */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={toggleEnabled}
          className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 transition-colors cursor-pointer"
        >
          <Repeat className={`w-4 h-4 ${isEnabled ? 'text-primary-600' : 'text-gray-400'}`} />
          <span className={isEnabled ? 'font-medium' : ''}>
            {isEnabled ? 'Repeats' : 'Does not repeat'}
          </span>
        </button>

        <div className="relative">
          <input
            type="checkbox"
            id="recurrence-toggle"
            checked={isEnabled}
            onChange={toggleEnabled}
            className="sr-only peer"
            aria-label="Enable recurrence"
          />
          <label
            htmlFor="recurrence-toggle"
            className="block w-9 h-5 bg-gray-200 rounded-full peer-checked:bg-primary-600 transition-colors cursor-pointer"
          />
          <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-subtle transition-transform peer-checked:translate-x-4 pointer-events-none" />
        </div>
      </div>

      {/* Config panel */}
      {isEnabled && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-xl">
          {/* Frequency + Interval */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 flex-shrink-0">Every</span>
            <input
              type="number"
              min={1}
              max={99}
              value={config.interval}
              onChange={(e) => updateConfig('interval', Math.max(1, parseInt(e.target.value) || 1))}
              className="w-14 px-2 py-1.5 text-sm text-center text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              aria-label="Repeat interval"
            />
            <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
              {FREQ_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateConfig('frequency', opt.value)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset ${
                    config.frequency === opt.value
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {config.interval === 1
                    ? opt.label
                    : opt.plural.charAt(0).toUpperCase() + opt.plural.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Weekly: day-of-week chips */}
          {config.frequency === 'WEEKLY' && (
            <div>
              <span className="text-xs font-medium text-gray-500 mb-2 block">Repeat on</span>
              <div className="flex gap-1.5">
                {WEEKDAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleWeekday(i)}
                    aria-label={WEEKDAY_NAMES[i]}
                    aria-pressed={config.weekdays.includes(i)}
                    className={`w-11 h-11 rounded-full text-sm font-medium transition-all cursor-pointer ${
                      config.weekdays.includes(i)
                        ? 'bg-primary-600 text-white shadow-subtle'
                        : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Monthly: mode selector */}
          {config.frequency === 'MONTHLY' && (
            <div>
              <span className="text-xs font-medium text-gray-500 mb-2 block">Repeat by</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => updateConfig('monthlyMode', 'dayOfMonth')}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg font-medium transition-all cursor-pointer ${
                    config.monthlyMode === 'dayOfMonth'
                      ? 'bg-primary-600 text-white shadow-subtle'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  Day of month
                </button>
                <button
                  type="button"
                  onClick={() => updateConfig('monthlyMode', 'nthWeekday')}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg font-medium transition-all cursor-pointer ${
                    config.monthlyMode === 'nthWeekday'
                      ? 'bg-primary-600 text-white shadow-subtle'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {getNthWeekdayLabel(eventStartDate)}
                </button>
              </div>
            </div>
          )}

          {/* End condition */}
          <div>
            <span className="text-xs font-medium text-gray-500 mb-2 block">Ends</span>
            <div className="space-y-2">
              {/* End type selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEndDropdown((p) => !p)}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors cursor-pointer"
                >
                  <span className="text-gray-700">
                    {config.endType === 'never' && 'Never'}
                    {config.endType === 'count' && `After ${config.count} occurrences`}
                    {config.endType === 'until' && 'On date'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showEndDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showEndDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 ui-glass-dropdown z-20 py-1">
                    {(['never', 'count', 'until'] as EndType[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          updateConfig('endType', type)
                          setShowEndDropdown(false)
                        }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${
                          config.endType === type
                            ? 'bg-primary-50 text-primary-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {type === 'never' && 'Never'}
                        {type === 'count' && 'After number of occurrences'}
                        {type === 'until' && 'On a specific date'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Count input */}
              {config.endType === 'count' && (
                <div className="flex items-center gap-2 pl-1">
                  <span className="text-sm text-gray-500">After</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={config.count}
                    onChange={(e) => updateConfig('count', Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 px-2 py-1.5 text-sm text-center text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                    aria-label="Number of occurrences"
                  />
                  <span className="text-sm text-gray-500">occurrences</span>
                </div>
              )}

              {/* Until date picker */}
              {config.endType === 'until' && (
                <div className="flex items-center gap-2 pl-1">
                  <span className="text-sm text-gray-500">Until</span>
                  <input
                    type="date"
                    value={config.until}
                    min={eventStartDate}
                    onChange={(e) => updateConfig('until', e.target.value)}
                    className="px-3 py-1.5 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 cursor-pointer"
                    aria-label="End date"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Human-readable summary */}
          <div className="pt-2 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-800">{summary}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
