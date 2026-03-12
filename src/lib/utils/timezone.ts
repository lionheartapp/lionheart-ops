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
