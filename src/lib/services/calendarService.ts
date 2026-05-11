/**
 * Calendar Service — Public API Barrel
 *
 * Re-exports all calendar functionality from sub-modules:
 *   - calendar-core.ts    — Calendar CRUD, location conflict detection
 *   - calendar-events.ts  — CalendarEvent CRUD, approval workflow, range queries
 *   - calendar-users.ts   — Categories, user schedule, attendees, subscriptions
 */

// ── Calendar CRUD & Conflict Detection ──────────────────────────────────
export {
  getCalendars,
  getCalendarById,
  createCalendar,
  updateCalendar,
  deleteCalendar,
  LocationConflictError,
  checkLocationConflict,
} from './calendar-core'

// ── CalendarEvent CRUD ──────────────────────────────────────────────────
export {
  createEvent,
  countEventsInRange,
  getEventsInRange,
  getEventsForAttendee,
  updateEvent,
  deleteEvent,
  getEventById,
} from './calendar-events'

// ── Categories, User Schedule, Attendees & Subscriptions ────────────────
export {
  getCategories,
  createCategory,
  getEventsForUser,
  getEventAttendees,
  addAttendees,
  removeAttendee,
  updateRsvpStatus,
  getUserSubscriptions,
  toggleSubscription,
  toggleNotifyOnNew,
  getCalendarNotifySubscribers,
} from './calendar-users'
