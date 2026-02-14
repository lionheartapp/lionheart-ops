/**
 * Division-based colors for calendar events. Parses event name prefix (MS |, ES |, HS |, All School)
 * and returns Tailwind class sets for consistent styling.
 */
export const DIVISION_COLORS = {
  ms: {
    pill: 'bg-blue-500/90 hover:bg-blue-500 text-white focus:ring-blue-400',
    block: 'border-blue-500/50 bg-blue-500/25 dark:bg-blue-500/30 hover:bg-blue-500/35 dark:hover:bg-blue-500/40',
    allDay: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 hover:bg-blue-500/30',
  },
  es: {
    pill: 'bg-amber-500/90 hover:bg-amber-500 text-white focus:ring-amber-400',
    block: 'border-amber-500/50 bg-amber-500/25 dark:bg-amber-500/30 hover:bg-amber-500/35 dark:hover:bg-amber-500/40',
    allDay: 'bg-amber-500/20 text-amber-800 dark:text-amber-300 hover:bg-amber-500/30',
  },
  hs: {
    pill: 'bg-purple-500/90 hover:bg-purple-500 text-white focus:ring-purple-400',
    block: 'border-purple-500/50 bg-purple-500/25 dark:bg-purple-500/30 hover:bg-purple-500/35 dark:hover:bg-purple-500/40',
    allDay: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 hover:bg-purple-500/30',
  },
  allSchool: {
    pill: 'bg-emerald-500/90 hover:bg-emerald-500 text-white focus:ring-emerald-400',
    block: 'border-emerald-500/50 bg-emerald-500/25 dark:bg-emerald-500/30 hover:bg-emerald-500/35 dark:hover:bg-emerald-500/40',
    allDay: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/30',
  },
  default: {
    pill: 'bg-blue-500/90 hover:bg-blue-500 text-white focus:ring-blue-400',
    block: 'border-blue-500/50 bg-blue-500/25 dark:bg-blue-500/30 hover:bg-blue-500/35 dark:hover:bg-blue-500/40',
    allDay: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 hover:bg-blue-500/30',
  },
}

export function getDivisionFromEvent(event) {
  const name = (event?.name || '').toUpperCase()
  if (name.startsWith('MS |') || name.startsWith('MS ')) return 'ms'
  if (name.startsWith('ES |') || name.startsWith('ES ')) return 'es'
  if (name.startsWith('HS |') || name.startsWith('HS ')) return 'hs'
  if (name.startsWith('ALL SCHOOL') || name.includes('ALL SCHOOL')) return 'allSchool'
  return 'default'
}

export function getEventBlockClasses(event) {
  return DIVISION_COLORS[getDivisionFromEvent(event)].block
}

export function getEventPillClasses(event) {
  return DIVISION_COLORS[getDivisionFromEvent(event)].pill
}

export function getEventAllDayClasses(event) {
  return DIVISION_COLORS[getDivisionFromEvent(event)].allDay
}
