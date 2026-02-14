// Support requests with type (IT | Facilities), submittedBy (requester name), status, and recurring
// status: 'new' | 'in-progress' | 'resolved' — for IT/Facilities workflow
// recurring: true for requests that repeat (e.g. weekly A/V checks)
// createdAt: ISO date string for "this week" filtering
function hoursAgo(h) {
  const d = new Date()
  d.setHours(d.getHours() - h)
  return d.toISOString()
}
function daysAgo(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

// order: used for display order within each column (to-do / in-progress)
export const INITIAL_SUPPORT_REQUESTS = [
  { id: 1, type: 'IT', title: 'Projector not turning on — Room 204', priority: 'critical', time: '10 min ago', submittedBy: 'Jane Smith', status: 'new', createdAt: hoursAgo(0.17), order: 0 },
  { id: 2, type: 'Facilities', title: 'Extra tables for Spring Gala setup', priority: 'normal', time: '25 min ago', submittedBy: 'Maria Garcia', status: 'in-progress', assignedTo: 'Mike Johnson', createdAt: hoursAgo(0.42), order: 100 },
  { id: 3, type: 'IT', title: 'Microphone check — Auditorium', priority: 'normal', time: '1 hr ago', submittedBy: 'Sarah Chen', status: 'in-progress', assignedTo: 'Alex Rivera', createdAt: hoursAgo(1), order: 100 },
  { id: 4, type: 'Facilities', title: 'HVAC noise in Gym', priority: 'critical', time: '2 hrs ago', submittedBy: 'Jane Smith', status: 'new', assignedTo: 'Mike Johnson', createdAt: hoursAgo(2), order: 0 },
  { id: 5, type: 'Facilities', title: 'Chairs for Parent Night', priority: 'normal', time: '3 hrs ago', submittedBy: 'Sarah Chen', status: 'in-progress', assignedTo: 'Mike Johnson', createdAt: hoursAgo(3), order: 101 },
  { id: 6, type: 'IT', title: 'Wi‑Fi dead zone — Library', priority: 'critical', time: '4 hrs ago', submittedBy: 'Mike Johnson', status: 'in-progress', assignedTo: 'Alex Rivera', createdAt: hoursAgo(4), order: 102 },
  { id: 7, type: 'IT', title: 'Laptop not connecting to projector', priority: 'normal', time: '5 hrs ago', submittedBy: 'Jane Smith', status: 'resolved', createdAt: hoursAgo(5), order: 103 },
  { id: 8, type: 'IT', title: 'Weekly projector bulb check — PAC', priority: 'normal', time: '1 day ago', submittedBy: 'Maria Garcia', status: 'in-progress', recurring: true, assignedTo: 'Alex Rivera', createdAt: daysAgo(1), order: 104 },
  { id: 9, type: 'IT', title: 'Monthly Wi‑Fi audit — All buildings', priority: 'normal', time: '3 days ago', submittedBy: 'IT System', status: 'new', recurring: true, createdAt: daysAgo(3), order: 3 },
  { id: 10, type: 'IT', title: 'Chromebook cart — Room 102 not charging', priority: 'critical', time: '2 hrs ago', submittedBy: 'Jane Smith', status: 'in-progress', assignedTo: 'Jordan Lee', createdAt: hoursAgo(2), order: 105 },
  { id: 11, type: 'IT', title: 'Smartboard calibration — Science Lab', priority: 'normal', time: '6 hrs ago', submittedBy: 'Sarah Chen', status: 'in-progress', assignedTo: 'Chris Park', createdAt: hoursAgo(6), order: 106 },
  { id: 12, type: 'IT', title: 'Password reset — Parent portal', priority: 'normal', time: '1 day ago', submittedBy: 'Mike Johnson', status: 'new', createdAt: daysAgo(1), order: 4 },
  { id: 13, type: 'IT', title: 'Printer setup — Admin office', priority: 'normal', time: '4 hrs ago', submittedBy: 'Maria Garcia', status: 'new', assignedTo: 'Alex Rivera', createdAt: hoursAgo(4), order: 5 },
  { id: 14, type: 'IT', title: 'iPad cart sync — Room 301', priority: 'normal', time: '5 hrs ago', submittedBy: 'Sarah Chen', status: 'new', assignedTo: 'Alex Rivera', createdAt: hoursAgo(5), order: 6 },
  { id: 15, type: 'IT', title: 'Document camera replacement — Math 205', priority: 'normal', time: '1 day ago', submittedBy: 'Jane Smith', status: 'new', assignedTo: 'Alex Rivera', createdAt: daysAgo(1), order: 7 },
  { id: 16, type: 'IT', title: 'Student device enrollment — New classroom set', priority: 'critical', time: '2 days ago', submittedBy: 'Maria Garcia', status: 'new', assignedTo: 'Alex Rivera', createdAt: daysAgo(2), order: 8 },
  { id: 17, type: 'IT', title: 'Zoom license renewal follow-up', priority: 'normal', time: '3 hrs ago', submittedBy: 'Mike Johnson', status: 'new', assignedTo: 'Alex Rivera', createdAt: hoursAgo(3), order: 9 },
  { id: 18, type: 'Facilities', title: 'Room setup for Board meeting', priority: 'normal', time: '4 hrs ago', submittedBy: 'Maria Garcia', status: 'new', assignedTo: 'Mike Johnson', createdAt: hoursAgo(4), order: 1 },
  { id: 19, type: 'Facilities', title: 'Custodial request — Vomit cleanup in Cafeteria', priority: 'critical', time: '1 hr ago', submittedBy: 'Jane Smith', status: 'new', assignedTo: 'Mike Johnson', createdAt: hoursAgo(1), order: 2 },
  { id: 20, type: 'Facilities', title: 'Moving boxes — Science dept relocation', priority: 'normal', time: '2 days ago', submittedBy: 'Sarah Chen', status: 'in-progress', assignedTo: 'Mike Johnson', createdAt: daysAgo(2), order: 102 },
  { id: 21, type: 'Facilities', title: 'Stopped up toilet — Boys restroom Room 105', priority: 'critical', time: '30 min ago', submittedBy: 'Jane Smith', status: 'new', assignedTo: 'Mike Johnson', createdAt: hoursAgo(0.5), order: 3 },
]

export function filterRequestsByType(requests, type) {
  if (!requests?.length) return []
  if (type === 'all') return requests.filter((r) => ['IT', 'Facilities', 'AV'].includes(r.type))
  return requests.filter((r) => r.type === type)
}

export function filterRequestsBySubmitter(requests, userName) {
  return (requests || []).filter((r) => r.submittedBy === userName)
}

/** Tickets assigned to the given user (optionally filter by type: 'IT' | 'Facilities' | 'AV' | 'all') */
export function filterRequestsByAssignee(requests, userName, type = 'IT') {
  return (requests || []).filter((r) => {
    if (!r.assignedTo || r.assignedTo !== userName) return false
    if (type === 'all') return ['IT', 'Facilities', 'AV'].includes(r.type)
    return r.type === type
  })
}

/** IT tickets with status 'new' or no status */
export function filterNewITRequests(requests) {
  return (requests || [])
    .filter((r) => r.type === 'IT' && (!r.status || r.status === 'new'))
    .sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id))
}

/** IT tickets with status 'in-progress' */
export function filterInProgressITRequests(requests) {
  return (requests || [])
    .filter((r) => r.type === 'IT' && r.status === 'in-progress')
    .sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id))
}

/** IT tickets marked as recurring */
export function filterRecurringITRequests(requests) {
  return (requests || []).filter((r) => r.type === 'IT' && r.recurring)
}

/** Start of current calendar week (Sunday) */
function getWeekStart() {
  const now = new Date()
  const d = new Date(now)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

/** Filter IT requests to this calendar week only */
export function filterThisWeeksITRequests(requests) {
  return filterThisWeeksRequestsByType(requests, 'IT')
}

/** Filter Facilities requests to this calendar week only */
export function filterThisWeeksFacilitiesRequests(requests) {
  return filterThisWeeksRequestsByType(requests, 'Facilities')
}

function filterThisWeeksRequestsByType(requests, type) {
  const weekStart = getWeekStart()
  return (requests || []).filter((r) => {
    if (r.type !== type) return false
    const created = r.createdAt ? new Date(r.createdAt) : new Date()
    return created >= weekStart
  })
}

/** Facilities tickets with status 'new' or no status */
export function filterNewFacilitiesRequests(requests) {
  return (requests || [])
    .filter((r) => r.type === 'Facilities' && (!r.status || r.status === 'new'))
    .sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id))
}

/** Facilities tickets with status 'in-progress' */
export function filterInProgressFacilitiesRequests(requests) {
  return (requests || [])
    .filter((r) => r.type === 'Facilities' && r.status === 'in-progress')
    .sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id))
}

/** AV tickets (event notifications) */
export function filterAVRequests(requests) {
  return (requests || []).filter((r) => r.type === 'AV')
}

export function filterNewAVRequests(requests) {
  return (requests || [])
    .filter((r) => r.type === 'AV' && (!r.status || r.status === 'new'))
    .sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id))
}
