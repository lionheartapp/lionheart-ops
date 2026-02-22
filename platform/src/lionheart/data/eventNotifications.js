import { getTeamMemberNames } from './teamsData'
import { eventNeedsAV, eventNeedsFacilities } from './eventsData'

/**
 * When an event is scheduled, add watchers (A/V, Facilities team members) and create
 * support tickets so those teams are notified. Returns the event with watchers merged.
 * @param {Object} event - The event being saved
 * @param {Array} users - All users (for team lookup)
 * @param {Function} setSupportRequests - State setter for support requests
 * @param {Function} [createTicket] - Optional async (payload) => ticket. If provided, tickets are persisted via API and the returned ticket is added to state.
 */
export async function notifyTeamsForScheduledEvent(event, users, setSupportRequests, createTicket) {
  if (!event) return event

  const facilitiesNames = getTeamMemberNames(users, 'facilities')
  const avNames = getTeamMemberNames(users, 'av')
  const existingWatchers = event.watchers || []
  const newWatchers = [...existingWatchers]

  const needsAV = eventNeedsAV(event)
  const needsFacilities = eventNeedsFacilities(event)

  if (needsAV && avNames.length) {
    avNames.forEach((n) => {
      if (!newWatchers.includes(n)) newWatchers.push(n)
    })
  }
  if (needsFacilities && facilitiesNames.length) {
    facilitiesNames.forEach((n) => {
      if (!newWatchers.includes(n)) newWatchers.push(n)
    })
  }

  const eventWithWatchers = { ...event, watchers: newWatchers }
  const submittedBy = event.creator || event.owner || 'System'

  if (needsFacilities && setSupportRequests) {
    const facilitiesSummary = buildFacilitiesSummary(event)
    const title = `${event.name || 'Event'} — ${event.date} at ${event.location || 'TBD'}`
    const description = `Event setup: ${facilitiesSummary}`
    if (typeof createTicket === 'function') {
      try {
        const created = await createTicket({ title, description, type: 'Facilities', priority: 'normal' })
        if (created) setSupportRequests((prev) => [...(prev || []), { ...created, eventId: event.id }])
      } catch {
        const fallback = { id: `f-${Date.now()}`, type: 'Facilities', title, description, priority: 'normal', time: 'Just now', submittedBy, status: 'new', createdAt: new Date().toISOString(), order: 9999, eventId: event.id }
        setSupportRequests((prev) => [...(prev || []), fallback])
      }
    } else {
      const ticket = { id: Date.now() + 1, type: 'Facilities', title, priority: 'normal', time: 'Just now', submittedBy, status: 'new', createdAt: new Date().toISOString(), order: 9999, eventId: event.id, description }
      setSupportRequests((prev) => [...(prev || []), ticket])
    }
  }

  if (needsAV && setSupportRequests) {
    const avSummary = buildAVSummary(event)
    const title = `${event.name || 'Event'} — ${event.date} at ${event.location || 'TBD'}`
    const description = `A/V needs: ${avSummary}`
    if (typeof createTicket === 'function') {
      try {
        const created = await createTicket({ title, description, type: 'AV', priority: 'normal' })
        if (created) setSupportRequests((prev) => [...(prev || []), { ...created, eventId: event.id }])
      } catch {
        const fallback = { id: `a-${Date.now()}`, type: 'AV', title, description, priority: 'normal', time: 'Just now', submittedBy, status: 'new', createdAt: new Date().toISOString(), order: 9999, eventId: event.id }
        setSupportRequests((prev) => [...(prev || []), fallback])
      }
    } else {
      const ticket = { id: Date.now() + 2, type: 'AV', title, priority: 'normal', time: 'Just now', submittedBy, status: 'new', createdAt: new Date().toISOString(), order: 9999, eventId: event.id, description }
      setSupportRequests((prev) => [...(prev || []), ticket])
    }
  }

  return eventWithWatchers
}

function buildFacilitiesSummary(event) {
  const parts = []
  const facilities = event.facilitiesRequested || []
  if (Array.isArray(facilities) && facilities.length) {
    parts.push(facilities.map((f) => `${f.quantity || 1} ${f.item || 'item'}`).join(', '))
  }
  if (event.tablesRequested != null && event.tablesRequested > 0) {
    parts.push(`${event.tablesRequested} table(s)`)
  }
  if (event.chairsRequested != null && event.chairsRequested > 0) {
    parts.push(`${event.chairsRequested} chair(s)`)
  }
  if (event.chairsSetup) parts.push(event.chairsSetup)
  return parts.length ? parts.join('; ') : 'Setup requested'
}

function buildAVSummary(event) {
  const parts = []
  const tech = event.techRequested || []
  const resources = event.resources || []
  if (Array.isArray(tech) && tech.length) {
    parts.push(tech.map((t) => (typeof t === 'string' ? t : t?.item)).filter(Boolean).join(', '))
  }
  if (Array.isArray(resources) && resources.length) {
    const avResources = resources.filter((r) =>
      ['Projector', 'Speakers', 'Lighting', 'Stage', 'Mic', 'Mics'].includes(typeof r === 'string' ? r : r)
    )
    if (avResources.length) parts.push(avResources.join(', '))
  }
  if (event.avNotes) parts.push(event.avNotes)
  return parts.length ? parts.join('; ') : 'A/V support requested'
}
