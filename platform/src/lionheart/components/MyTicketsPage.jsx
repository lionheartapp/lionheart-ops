import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import SupportQueue from './SupportQueue'

export default function MyTicketsPage({
  supportRequests = [],
  currentUser,
  itDrawerOpen,
  setITDrawerOpen,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Tickets assigned to you.
        </p>
        <button
          type="button"
          onClick={() => setITDrawerOpen?.(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create IT Request
        </button>
      </div>

      <section>
        <SupportQueue
          type="IT"
          requests={supportRequests}
          currentUser={currentUser}
          viewMode="assigned-to-me"
          title="My Tickets"
          emptyMessage="No tickets assigned to you."
        />
      </section>
    </motion.div>
  )
}
