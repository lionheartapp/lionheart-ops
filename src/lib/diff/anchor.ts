/**
 * Compute the "since yesterday" anchor time.
 *
 * The anchor is the most recent 4:30 PM in the org's timezone prior to "now."
 * - Before 4:30 PM today → anchor = yesterday 4:30 PM
 * - At or after 4:30 PM today → anchor = today 4:30 PM
 *
 * Returns a UTC Date.
 */

const ANCHOR_HOUR = 16 // 4 PM
const ANCHOR_MINUTE = 30

export function computeAnchorTime(orgTimezone: string): Date {
  const now = new Date()

  // Get current time in the org's timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: orgTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'

  const localHour = parseInt(get('hour'), 10)
  const localMinute = parseInt(get('minute'), 10)
  const localYear = parseInt(get('year'), 10)
  const localMonth = parseInt(get('month'), 10)
  const localDay = parseInt(get('day'), 10)

  const isAfterAnchor =
    localHour > ANCHOR_HOUR ||
    (localHour === ANCHOR_HOUR && localMinute >= ANCHOR_MINUTE)

  // Target date: today if past anchor, yesterday if before
  let targetDay = localDay
  let targetMonth = localMonth
  let targetYear = localYear

  if (!isAfterAnchor) {
    const yesterday = new Date(localYear, localMonth - 1, localDay - 1)
    targetYear = yesterday.getFullYear()
    targetMonth = yesterday.getMonth() + 1
    targetDay = yesterday.getDate()
  }

  const pad = (n: number) => String(n).padStart(2, '0')
  const anchorLocalStr = `${targetYear}-${pad(targetMonth)}-${pad(targetDay)}T${pad(ANCHOR_HOUR)}:${pad(ANCHOR_MINUTE)}:00`

  return localToUtc(anchorLocalStr, orgTimezone)
}

/**
 * Convert a local datetime string (ISO without Z) in a given timezone to UTC.
 *
 * Uses Intl to compute the timezone offset by comparing how the same UTC
 * instant renders in UTC vs the target timezone.
 */
function localToUtc(localIso: string, tz: string): Date {
  // Treat the string as UTC to get a numeric timestamp
  const asUtc = new Date(localIso + 'Z')

  // Render this UTC instant in both UTC and target tz
  const utcRendered = new Date(asUtc.toLocaleString('en-US', { timeZone: 'UTC' }))
  const tzRendered = new Date(asUtc.toLocaleString('en-US', { timeZone: tz }))

  // Offset = how far ahead/behind tz is from UTC
  // (system timezone cancels out because both are parsed in system tz)
  const offsetMs = tzRendered.getTime() - utcRendered.getTime()

  // Real UTC = the local time value minus the tz offset
  return new Date(asUtc.getTime() - offsetMs)
}
