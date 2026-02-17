import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import SupportQueue from './SupportQueue'

export default function FacilitiesMyTicketsPage({
  supportRequests = [],
  currentUser,
  facilitiesDrawerOpen,
  setFacilitiesDrawerOpen,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Facilities tickets assigned to you.
        </p>
        <button
          type="button"
          onClick={() => setFacilitiesDrawerOpen?.(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Facilities Request
        </button>
      </div>

      <section>
        <SupportQueue
          type="Facilities"
          requests={supportRequests}
          currentUser={currentUser}
          viewMode="assigned-to-me"
          title="My Tickets"
          emptyMessage="No Facilities tickets assigned to you."
        />
      </section>
    </motion.div>
  )
}
