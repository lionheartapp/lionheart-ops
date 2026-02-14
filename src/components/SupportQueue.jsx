import { motion } from 'framer-motion'
import { Headphones, Building2, AlertCircle } from 'lucide-react'
import { filterRequestsByType, filterRequestsBySubmitter, filterRequestsByAssignee } from '../data/supportTicketsData'

const priorityStyles = {
  critical: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  normal: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
}

export default function SupportQueue({
  type = 'IT',
  requests = [],
  currentUser,
  viewMode = 'queue',
  title,
  emptyMessage,
}) {
  const safeRequests = requests ?? []
  const byType = type === 'all' ? safeRequests : filterRequestsByType(safeRequests, type)
  let list = byType
  if (viewMode === 'my-tickets' && currentUser?.name) {
    list = filterRequestsBySubmitter(byType, currentUser.name)
  } else if (viewMode === 'assigned-to-me' && currentUser?.name) {
    list = filterRequestsByAssignee(safeRequests, currentUser.name, type)
  }

  const Icon = type === 'IT' ? Headphones : Building2
  const displayTitle = title ?? (type === 'all' ? 'My support requests' : viewMode === 'my-tickets' ? `My ${type} requests` : viewMode === 'assigned-to-me' ? 'My assigned tickets' : `${type} support queue`)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden"
    >
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 dark:border-blue-950/40">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-blue-500" />
          {displayTitle}
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          {viewMode === 'queue'
            ? (type === 'all' ? 'Tickets you submitted' : `All ${type} requests — assign and respond`)
            : viewMode === 'assigned-to-me'
              ? 'Tickets assigned to you'
              : type === 'all'
                ? 'Tickets you submitted (IT & Facilities)'
                : `Tickets you submitted to ${type}`}
        </p>
      </div>
      {list.length === 0 ? (
        <div className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {emptyMessage ?? (viewMode === 'my-tickets' ? "You haven't submitted any requests yet." : 'No requests right now.')}
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-700 dark:divide-blue-950/30">
          {list.map((req) => {
            const priorityClass = priorityStyles[req.priority] || priorityStyles.normal
            const RowIcon = type === 'all' ? (req.type === 'IT' ? Headphones : Building2) : Icon
            return (
              <motion.li
                key={req.id}
                layout
                className="flex items-center gap-4 p-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="shrink-0 w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                  <RowIcon className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {req.title}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {req.time}
                    {(viewMode === 'queue' || viewMode === 'assigned-to-me') && req.submittedBy && (
                      <span> · {req.submittedBy}</span>
                    )}
                  </p>
                </div>
                <span
                  className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium border ${priorityClass}`}
                >
                  {req.priority === 'critical' ? 'Critical' : 'Normal'}
                </span>
              </motion.li>
            )
          })}
        </ul>
      )}
    </motion.div>
  )
}
