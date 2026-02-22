import { motion } from 'framer-motion'
import { Calendar, MapPin } from 'lucide-react'
import { getThisWeeksEventsForUser } from '../data/eventsData'

function formatDate(dateStr) {
  if (!dateStr) return 'TBD'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function roleLabel(event, userId) {
  if (event.owner === userId) return 'Owner'
  if (event.creator === userId) return 'Creator'
  if (event.watchers && event.watchers.includes(userId)) return 'Watcher'
  return ''
}

export default function DashboardEventsList({ events, currentUser, onEventClick }) {
  const list = getThisWeeksEventsForUser(events || [], currentUser)

  return (
    <section className="glass-card overflow-hidden">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 dark:border-blue-950/40">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          This week’s events
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          Events where you’re owner, creator, or watcher
        </p>
      </div>
      {list.length === 0 ? (
        <div className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No events this week for you.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-700 dark:divide-blue-950/30">
          {list.map((ev) => (
            <motion.li
              key={ev.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-4 p-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <button
                type="button"
                onClick={() => onEventClick?.(ev)}
                className="flex-1 min-w-0 text-left group"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-blue-500 truncate">
                    {ev.name}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0">
                    {roleLabel(ev, currentUser)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    {formatDate(ev.date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {ev.location}
                  </span>
                </div>
              </button>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  )
}
