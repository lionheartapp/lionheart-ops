import { motion } from 'framer-motion'
import { filterNewAVRequests } from '../data/supportTicketsData'

export default function AVEventNotifications({
  requests = [],
  currentUser,
  onNavigateToEvents,
}) {
  const avTickets = filterNewAVRequests(requests)
  if (avTickets.length === 0) return null

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden"
    >
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 dark:border-blue-950/40">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Events needing A/V
          </h2>
          <button
            type="button"
            onClick={onNavigateToEvents}
            className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium shrink-0"
          >
            View calendar →
          </button>
        </div>
      </div>
      <div className="p-4 space-y-2">
        {avTickets.slice(0, 5).map((req) => (
          <div
            key={req.id}
            className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700"
          >
            <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">
              {req.title}
            </p>
            {req.description && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                {req.description}
              </p>
            )}
          </div>
        ))}
        {avTickets.length > 5 && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 pt-2">
            +{avTickets.length - 5} more
          </p>
        )}
      </div>
    </motion.section>
  )
}
