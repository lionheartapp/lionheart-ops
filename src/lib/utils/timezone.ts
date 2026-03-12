/**
 * Timezone detection from US physical addresses.
 * Parses state abbreviation from address and maps to IANA timezone.
 * Covers all 50 US states + DC + territories.
 * For states spanning multiple zones (e.g., IN, AZ), uses the most common zone.
 */

const STATE_TIMEZONE: Record<string, string> = {
  AL: 'America/Chicago',
  AK: 'America/Anchorage',
  AZ: 'America/Phoenix', // No DST
  AR: 'America/Chicago',
  CA: 'America/Los_Angeles',
  CO: 'America/Denver',
  CT: 'America/New_York',
  DE: 'America/New_York',
  DC: 'America/New_York',
  FL: 'America/New_York', // Panhandle is Central, but majority Eastern
  GA: 'America/New_York',
  HI: 'Pacific/Honolulu',
  ID: 'America/Boise',
  IL: 'America/Chicago',
  IN: 'America/Indiana/Indianapolis', // Most of IN is Eastern
  IA: 'America/Chicago',
  KS: 'America/Chicago',
  KY: 'America/New_York', // Eastern half majority
  LA: 'America/Chicago',
  ME: 'America/New_York',
  MD: 'America/New_York',
  MA: 'America/New_York',
  MI: 'America/Detroit',
  MN: 'America/Chicago',
  MS: 'America/Chicago',
  MO: 'America/Chicago',
  MT: 'America/Denver',
  NE: 'America/Chicago',
  NV: 'America/Los_Angeles',
  NH: 'America/New_York',
  NJ: 'America/New_York',
  NM: 'America/Denver',
  NY: 'America/New_York',
  NC: 'America/New_York',
  ND: 'America/Chicago',
  OH: 'America/New_York',
  OK: 'America/Chicago',
  OR: 'America/Los_Angeles',
  PA: 'America/New_York',
  RI: 'America/New_York',
  SC: 'America/New_York',
  SD: 'America/Chicago',
  TN: 'America/Chicago', // Eastern half exists, but majority Central
  TX: 'America/Chicago',
  UT: 'America/Denver',
  VT: 'America/New_York',
  VA: 'America/New_York',
  WA: 'America/Los_Angeles',
  WV: 'America/New_York',
  WI: 'America/Chicago',
  WY: 'America/Denver',
  // Territories
  PR: 'America/Puerto_Rico',
  VI: 'America/Virgin',
  GU: 'Pacific/Guam',
  AS: 'Pacific/Pago_Pago',
  MP: 'Pacific/Guam',
}

// Full state names → abbreviation for addresses that spell out the state
const STATE_NAMES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI',
  wyoming: 'WY', 'district of columbia': 'DC', 'puerto rico': 'PR',
}

/**
 * Extract IANA timezone from a US physical address string.
 * Tries: "City, ST ZIP" pattern first, then full state name match.
 * Returns null if no US state can be identified.
 */
export function timezoneFromAddress(address: string | null | undefined): string | null {
  if (!address) return null

  // Pattern 1: "City, ST 12345" or "City, ST"
  const stateAbbrMatch = address.match(/,\s*([A-Z]{2})\s*\d{0,5}/)
  if (stateAbbrMatch) {
    const tz = STATE_TIMEZONE[stateAbbrMatch[1]]
    if (tz) return tz
  }

  // Pattern 2: Full state name anywhere in address
  const lower = address.toLowerCase()
  for (const [name, abbr] of Object.entries(STATE_NAMES)) {
    if (lower.includes(name)) {
      return STATE_TIMEZONE[abbr] || null
    }
  }

  return null
}

// ── Shared Timezone Helpers ─────────────────────────────────────────────────

const DEFAULT_TIMEZONE = 'America/Chicago'

/**
 * Compute the UTC offset string (e.g., "-05:00") for a given IANA timezone at a given instant.
 * Falls back to "-06:00" (CST) on error.
 */
export function getTimezoneOffset(timezone: string, date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' })
    const parts = formatter.formatToParts(date)
    const tzPart = parts.find(p => p.type === 'timeZoneName')
    if (tzPart?.value) {
      const match = tzPart.value.match(/GMT([+-])(\d+)(?::(\d+))?/)
      if (match) {
        return `${match[1]}${match[2].padStart(2, '0')}:${(match[3] || '0').padStart(2, '0')}`
      }
    }
  } catch { /* fall through */ }
  return '-06:00'
}

/**
 * Get "today" as { year, month, day } in the given IANA timezone.
 * Prevents the off-by-one bug when UTC has crossed midnight but local hasn't.
 */
export function getOrgToday(timezone: string = DEFAULT_TIMEZONE, refDate: Date = new Date()): { year: number; month: number; day: number; dateStr: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(refDate)
  const y = Number(parts.find(p => p.type === 'year')!.value)
  const m = Number(parts.find(p => p.type === 'month')!.value)
  const d = Number(parts.find(p => p.type === 'day')!.value)
  return { year: y, month: m, day: d, dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` }
}

/**
 * Get a Date object pinned to noon on today's date in the org's timezone.
 * Useful for relative date math (adding days, etc.) without TZ drift.
 */
export function getOrgNow(timezone: string = DEFAULT_TIMEZONE, refDate: Date = new Date()): Date {
  const { year, month, day } = getOrgToday(timezone, refDate)
  return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00`)
}

/**
 * Format a Date as a localized display string in the given IANA timezone.
 * Wraps toLocaleString with the timezone parameter to ensure org-local display.
 */
export function formatInTimezone(date: Date, timezone: string, options: Intl.DateTimeFormatOptions = {}): string {
  return date.toLocaleString('en-US', { timeZone: timezone, ...options })
}

/**
 * Format a Date as "YYYY-MM-DD" in the given IANA timezone.
 */
export function toOrgDateString(date: Date, timezone: string): string {
  const { dateStr } = getOrgToday(timezone, date)
  return dateStr
}

/**
 * Convert a datetime-local input value (e.g., "2026-03-15T14:30") to a proper ISO string
 * with the correct timezone offset for the given org timezone.
 * This ensures events are stored at the intended local time regardless of browser timezone.
 */
export function localDatetimeToISO(localStr: string, timezone: string): string {
  const offset = getTimezoneOffset(timezone, new Date(localStr))
  return `${localStr}:00${offset}`
}

/**
 * Convert an ISO datetime string to a "YYYY-MM-DDTHH:mm" string for datetime-local inputs,
 * displayed in the org's timezone (not the browser's timezone).
 */
export function isoToLocalDatetime(isoStr: string, timezone: string): string {
  const d = new Date(isoStr)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (type: string) => parts.find(p => p.type === type)?.value || '00'
  const hour = get('hour') === '24' ? '00' : get('hour')
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`
}

/**
 * Fetch the org's IANA timezone from the database.
 * Server-side only — uses rawPrisma.
 */
export async function getOrgTimezone(organizationId: string): Promise<string> {
  try {
    const { rawPrisma } = await import('@/lib/db')
    const org = await rawPrisma.organization.findUnique({
      where: { id: organizationId },
      select: { timezone: true },
    })
    return org?.timezone || DEFAULT_TIMEZONE
  } catch {
    return DEFAULT_TIMEZONE
  }
}
