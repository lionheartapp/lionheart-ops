/**
 * Fetch and parse iCal (.ics) feed into app event shape.
 * Event shape: { id, name, date, time?, endTime?, location?, description?, owner?, creator?, watchers? }
 * Assigns a default owner so events show in "This week's events" for the demo.
 */
const DEFAULT_OWNER = 'Michael Kerley'

// Use proxy in dev to avoid CORS; direct URL may work if the server allows CORS
const ICAL_URL = typeof import.meta.env !== 'undefined' && import.meta.env.DEV
  ? '/api/ical'
  : 'https://extbus.schooldude.com/ical/fsdevent.ics?qs=lGqBfbQokjU%2FitNZTrekyTvxV5Tpn1mZp43BXgGUqYYYmuSypNh3BnRH%2BatHZf9y'

function unescapeIcalValue(str) {
  if (!str || typeof str !== 'string') return ''
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim()
}

function parseIcalDate(value, isDateOnly) {
  if (!value) return null
  const s = value.replace(/\s/g, '')
  if (isDateOnly || s.length === 8) {
    const y = parseInt(s.slice(0, 4), 10)
    const m = parseInt(s.slice(4, 6), 10) - 1
    const d = parseInt(s.slice(6, 8), 10)
    return new Date(y, m, d)
  }
  if (s.length >= 15) {
    const y = parseInt(s.slice(0, 4), 10)
    const m = parseInt(s.slice(4, 6), 10) - 1
    const d = parseInt(s.slice(6, 8), 10)
    const h = parseInt(s.slice(9, 11), 10) || 0
    const min = parseInt(s.slice(11, 13), 10) || 0
    const sec = parseInt(s.slice(13, 15), 10) || 0
    return new Date(y, m, d, h, min, sec)
  }
  return null
}

function toDateStr(date) {
  if (!date || !(date instanceof Date)) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toTimeStr(date) {
  if (!date || !(date instanceof Date)) return ''
  const h = date.getHours()
  const m = date.getMinutes()
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Parse raw ICS text into array of app-style events.
 */
export function parseIcalToEvents(icsText) {
  const events = []
  if (!icsText || typeof icsText !== 'string') return events

  // Unfold lines (continuation lines start with space or tab)
  const unfolded = icsText.replace(/\r\n[\s\t]/g, '').replace(/\r?\n[\s\t]/g, '')
  const lines = unfolded.split(/\r?\n/)

  let current = null
  let currentKey = null
  let currentValue = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue
    const keyPart = line.slice(0, colonIndex)
    const value = line.slice(colonIndex + 1)

    if (line.startsWith('BEGIN:VEVENT')) {
      current = {}
      continue
    }
    if (line.startsWith('END:VEVENT')) {
      if (current) {
        const ev = mapIcalEventToApp(current)
        if (ev) events.push(ev)
      }
      current = null
      continue
    }

    if (!current) continue

    const keyUpper = keyPart.split(';')[0].toUpperCase()
    if (keyUpper === 'SUMMARY') current.SUMMARY = unescapeIcalValue(value)
    else if (keyUpper === 'LOCATION') current.LOCATION = unescapeIcalValue(value)
    else if (keyUpper === 'DESCRIPTION') current.DESCRIPTION = unescapeIcalValue(value)
    else if (keyUpper === 'UID') current.UID = value.trim()
    else if (keyUpper === 'DTSTART') {
      current.DTSTART = value.trim()
      current.DTSTART_DATEONLY = keyPart.toUpperCase().includes('VALUE=DATE')
    } else if (keyUpper === 'DTEND') {
      current.DTEND = value.trim()
      current.DTEND_DATEONLY = keyPart.toUpperCase().includes('VALUE=DATE')
    }
  }

  return events
}

function mapIcalEventToApp(ical) {
  const uid = ical.UID || `ical-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const start = parseIcalDate(ical.DTSTART, ical.DTSTART_DATEONLY)
  const end = parseIcalDate(ical.DTEND, ical.DTEND_DATEONLY)
  if (!start) return null

  const dateStr = toDateStr(start)
  const name = ical.SUMMARY || 'Untitled event'
  const location = ical.LOCATION || 'TBD'
  const description = ical.DESCRIPTION || ''

  const event = {
    id: uid.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 80),
    name,
    date: dateStr,
    location,
    description,
    owner: DEFAULT_OWNER,
    creator: DEFAULT_OWNER,
    watchers: [],
  }

  if (!ical.DTSTART_DATEONLY && start) {
    event.time = toTimeStr(start)
    if (end) event.endTime = toTimeStr(end)
  }

  return event
}

/**
 * Fetch ICS from the configured URL and return app events.
 * On network/CORS error returns empty array (caller can keep existing events).
 */
export async function fetchIcalEvents() {
  try {
    const res = await fetch(ICAL_URL, {
      method: 'GET',
      headers: { Accept: 'text/calendar, text/plain, */*' },
      mode: 'cors',
    })
    if (!res.ok) return []
    const text = await res.text()
    return parseIcalToEvents(text)
  } catch (err) {
    console.warn('Failed to fetch iCal feed:', err)
    return []
  }
}

export { ICAL_URL }
