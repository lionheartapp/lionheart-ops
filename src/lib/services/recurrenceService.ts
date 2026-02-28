import { RRule, RRuleSet, rrulestr } from 'rrule'

interface EventInstance {
  id: string
  parentEventId: string | null
  title: string
  startTime: Date
  endTime: Date
  isAllDay: boolean
  isException: boolean
  originalStart?: Date
  [key: string]: unknown
}

interface ParentEvent {
  id: string
  title: string
  startTime: Date
  endTime: Date
  isAllDay: boolean
  rrule: string | null
  timezone: string
  exceptions?: Array<{
    id: string
    originalStart: Date | null
    startTime: Date
    endTime: Date
    [key: string]: unknown
  }>
  [key: string]: unknown
}

/**
 * Expand a recurring event into individual instances within a date range.
 * Merges stored exceptions (modified/cancelled instances) with virtual instances.
 */
export function expandRecurrence(
  event: ParentEvent,
  rangeStart: Date,
  rangeEnd: Date
): EventInstance[] {
  if (!event.rrule) {
    return [{
      ...event,
      id: event.id,
      parentEventId: null,
      isException: false,
    }]
  }

  const duration = event.endTime.getTime() - event.startTime.getTime()

  // Parse the RRULE
  const ruleSet = new RRuleSet()
  const rule = rrulestr(event.rrule, { dtstart: event.startTime })
  ruleSet.rrule(rule)

  // Exclude dates that have stored exceptions
  const exceptionDates = new Set<number>()
  if (event.exceptions) {
    for (const exc of event.exceptions) {
      if (exc.originalStart) {
        exceptionDates.add(exc.originalStart.getTime())
        ruleSet.exdate(exc.originalStart)
      }
    }
  }

  // Generate virtual instances
  const occurrences = ruleSet.between(rangeStart, rangeEnd, true)
  const instances: EventInstance[] = occurrences.map((dt) => ({
    ...event,
    id: `${event.id}_${dt.toISOString()}`,
    parentEventId: event.id,
    title: event.title,
    startTime: dt,
    endTime: new Date(dt.getTime() + duration),
    isAllDay: event.isAllDay,
    isException: false,
    originalStart: dt,
  }))

  // Merge stored exceptions
  if (event.exceptions) {
    for (const exc of event.exceptions) {
      if (exc.startTime >= rangeStart && exc.startTime <= rangeEnd) {
        instances.push({
          ...exc,
          id: exc.id,
          parentEventId: event.id,
          title: (exc.title as string) || event.title,
          startTime: exc.startTime,
          endTime: exc.endTime,
          isAllDay: (exc.isAllDay as boolean) ?? event.isAllDay,
          isException: true,
          originalStart: exc.originalStart ?? undefined,
        })
      }
    }
  }

  // Sort by start time
  instances.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
  return instances
}

/**
 * Convert an RRULE string to human-readable text.
 */
export function toHumanReadable(rruleString: string): string {
  try {
    const rule = rrulestr(rruleString)
    return rule.toText()
  } catch {
    return rruleString
  }
}

/**
 * Create a split point for "this and following" edits on a recurring event.
 * Returns the modified RRULE for the original (with UNTIL) and
 * the new RRULE for the split-off series.
 */
export function splitSeries(
  originalRrule: string,
  splitDate: Date,
  originalDtstart: Date
): { originalRrule: string; newRrule: string } {
  const rule = rrulestr(originalRrule, { dtstart: originalDtstart })
  const options = rule.origOptions

  // Set UNTIL on the original to the day before the split
  const untilDate = new Date(splitDate)
  untilDate.setDate(untilDate.getDate() - 1)

  const originalModified = new RRule({
    ...options,
    until: untilDate,
    count: undefined, // Remove count if it was set
  })

  // New series starts at splitDate with the same recurrence pattern
  const newRule = new RRule({
    ...options,
    dtstart: splitDate,
    until: options.until, // Keep original until if it existed
  })

  return {
    originalRrule: originalModified.toString(),
    newRrule: newRule.toString(),
  }
}
