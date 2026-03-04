'use client'

import { useState, useEffect } from 'react'
import { RRule, Weekday } from 'rrule'
import { FloatingInput } from '@/components/ui/FloatingInput'

const DAYS: { label: string; short: string; rruleDay: Weekday }[] = [
  { label: 'Monday', short: 'M', rruleDay: RRule.MO },
  { label: 'Tuesday', short: 'T', rruleDay: RRule.TU },
  { label: 'Wednesday', short: 'W', rruleDay: RRule.WE },
  { label: 'Thursday', short: 'Th', rruleDay: RRule.TH },
  { label: 'Friday', short: 'F', rruleDay: RRule.FR },
  { label: 'Saturday', short: 'Sa', rruleDay: RRule.SA },
  { label: 'Sunday', short: 'Su', rruleDay: RRule.SU },
]

interface RRuleBuilderProps {
  value: string
  onChange: (rrule: string) => void
}

export default function RRuleBuilder({ value, onChange }: RRuleBuilderProps) {
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [untilDate, setUntilDate] = useState('')

  // Parse incoming value to hydrate state
  useEffect(() => {
    if (!value) return
    try {
      const rule = RRule.fromString(value)
      if (rule.options.byweekday) {
        setSelectedDays(rule.options.byweekday.map((d) => (typeof d === 'number' ? d : d)))
      }
      if (rule.options.until) {
        const d = rule.options.until
        setUntilDate(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        )
      }
    } catch {
      // invalid rrule string — ignore
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleDay = (dayIdx: number) => {
    const next = selectedDays.includes(dayIdx)
      ? selectedDays.filter((d) => d !== dayIdx)
      : [...selectedDays, dayIdx].sort((a, b) => a - b)
    setSelectedDays(next)
    buildRule(next, untilDate)
  }

  const handleUntilChange = (dateStr: string) => {
    setUntilDate(dateStr)
    buildRule(selectedDays, dateStr)
  }

  const buildRule = (days: number[], until: string) => {
    if (days.length === 0) {
      onChange('')
      return
    }
    const byweekday = days.map((i) => DAYS[i].rruleDay)
    const opts: Partial<ConstructorParameters<typeof RRule>[0]> = {
      freq: RRule.WEEKLY,
      byweekday,
    }
    if (until) {
      const [y, m, d] = until.split('-').map(Number)
      opts.until = new Date(Date.UTC(y, m - 1, d, 23, 59, 59))
    }
    const rule = new RRule(opts as any)
    onChange(rule.toString())
  }

  // Human-readable preview
  let previewText = ''
  if (selectedDays.length > 0) {
    try {
      const byweekday = selectedDays.map((i) => DAYS[i].rruleDay)
      const opts: any = { freq: RRule.WEEKLY, byweekday }
      if (untilDate) {
        const [y, m, d] = untilDate.split('-').map(Number)
        opts.until = new Date(Date.UTC(y, m - 1, d, 23, 59, 59))
      }
      const rule = new RRule(opts)
      previewText = rule.toText()
    } catch {
      previewText = ''
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Repeat on</label>
        <div className="flex gap-1.5">
          {DAYS.map((day, idx) => (
            <button
              key={day.label}
              type="button"
              onClick={() => toggleDay(idx)}
              className={`w-9 h-9 rounded-full text-xs font-semibold transition-colors ${
                selectedDays.includes(idx)
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              title={day.label}
            >
              {day.short}
            </button>
          ))}
        </div>
      </div>

      <FloatingInput
        id="rrule-until"
        label="Repeat until"
        type="date"
        value={untilDate}
        onChange={(e) => handleUntilChange(e.target.value)}
      />

      {previewText && (
        <p className="text-xs text-gray-500 italic">
          {previewText.charAt(0).toUpperCase() + previewText.slice(1)}
        </p>
      )}
    </div>
  )
}
