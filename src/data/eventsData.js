// Logged-in user for filtering "my" events (owner, creator, or watcher)
export const CURRENT_USER = 'Jane Smith'

function addDays(d, n) {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

function toDateStr(date) {
  return date.toISOString().slice(0, 10)
}

function getThisWeekBounds() {
  const now = new Date()
  const start = addDays(now, -now.getDay())
  return { start, end: addDays(start, 6) }
}

const { start: weekStart } = getThisWeekBounds()

export const INITIAL_EVENTS = [
  {
    id: '1',
    name: 'Spring Gala',
    date: toDateStr(addDays(weekStart, 1)),
    time: '18:00',
    endTime: '21:00',
    location: 'Main Hall',
    description: 'Annual spring gala with dinner and entertainment.',
    owner: 'Jane Smith',
    creator: 'Jane Smith',
    watchers: ['Cafeteria Manager'],
    hasTicketSales: true,
  },
  {
    id: '2',
    name: 'Tech Talk',
    date: toDateStr(addDays(weekStart, 2)),
    time: '14:00',
    endTime: '16:00',
    location: 'Auditorium',
    description: 'Presentations on AI in education and digital tools.',
    owner: 'Maria Garcia',
    creator: 'Jane Smith',
    watchers: ['IT Department Head'],
  },
  {
    id: '3',
    name: 'Pep Rally',
    date: toDateStr(addDays(weekStart, 4)),
    time: '09:00',
    endTime: '10:30',
    location: 'Gym',
    description: 'Spirit week pep rally for the upcoming games.',
    owner: 'Jane Smith',
    creator: 'Mike Johnson',
    watchers: ['Jane Smith', 'Facilities Lead'],
  },
  {
    id: '4',
    name: 'Parent Night',
    date: toDateStr(addDays(weekStart, 5)),
    time: '17:00',
    endTime: '20:00',
    location: 'Campus',
    description: 'Open house for parents to meet teachers and staff.',
    owner: 'Sarah Chen',
    creator: 'Sarah Chen',
    watchers: ['Jane Smith'],
    hasTicketSales: true,
  },
]

/** True if the user started (is owner or creator of) at least one event that has ticket sales. */
export function userStartedEventWithTicketSales(events, userName) {
  if (!userName || !events?.length) return false
  return events.some(
    (e) =>
      (e.owner === userName || e.creator === userName) &&
      e.hasTicketSales === true
  )
}

export function isEventThisWeek(dateStr) {
  if (!dateStr) return false
  const { start, end } = getThisWeekBounds()
  return dateStr >= toDateStr(start) && dateStr <= toDateStr(end)
}

/** True if the event date has passed (or, if today, event has endTime and it has passed). */
export function isEventPast(event) {
  if (!event?.date) return false
  const todayStr = toDateStr(new Date())
  if (event.date < todayStr) return true
  if (event.date === todayStr && event.endTime) {
    const now = new Date()
    const [h, m] = event.endTime.split(':').map(Number)
    const eventEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m || 0, 0)
    return now > eventEnd
  }
  return false
}

export function isUserInEvent(event, userId) {
  if (!userId) return false
  return (
    event.owner === userId ||
    event.creator === userId ||
    (event.watchers && event.watchers.includes(userId))
  )
}

export function getThisWeeksEventsForUser(events, userId) {
  return events
    .filter(
      (e) =>
        e.status !== 'cancelled' &&
        isEventThisWeek(e.date) &&
        !isEventPast(e) &&
        isUserInEvent(e, userId)
    )
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

const AV_ITEMS = ['Projector', 'Speakers', 'Lighting', 'Stage', 'Mic', 'Mics']

/** Event needs A/V (projector, mics, speakers, etc.) */
export function eventNeedsAV(event) {
  const tech = event?.techRequested || []
  const resources = event?.resources || []
  if (Array.isArray(tech) && tech.length > 0) return true
  return resources.some((r) =>
    AV_ITEMS.includes(typeof r === 'string' ? r : String(r?.item || ''))
  )
}

/** Event needs Facilities (tables, chairs, setup) */
export function eventNeedsFacilities(event) {
  const facilities = event?.facilitiesRequested || []
  if (Array.isArray(facilities) && facilities.length > 0) return true
  const t = event?.tablesRequested
  const c = event?.chairsRequested
  return (t != null && t > 0) || (c != null && c > 0)
}

/** Filter events that need A/V for team calendar view */
export function filterEventsNeedingAV(events) {
  return (events || []).filter((e) => e.status !== 'cancelled' && eventNeedsAV(e))
}

/** Filter events that need Facilities for team calendar view */
export function filterEventsNeedingFacilities(events) {
  return (events || []).filter((e) => e.status !== 'cancelled' && eventNeedsFacilities(e))
}
