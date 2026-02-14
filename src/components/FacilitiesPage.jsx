import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import SupportQueue from './SupportQueue'
import { isFacilitiesTeam } from '../data/teamsData'

export default function FacilitiesPage({
  supportRequests,
  setSupportRequests,
  currentUser,
  teams,
  inventoryItems,
  inventoryStock,
  onInventoryCheck,
  facilitiesDrawerOpen,
  setFacilitiesDrawerOpen,
  mode = 'default',
}) {
  const isStaff = isFacilitiesTeam(currentUser, teams)
  const isTeamMode = mode === 'team'

  if (isStaff) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {isTeamMode ? 'All Facilities tickets for the team.' : 'Incoming Facilities requests.'}
          </p>
          <button
            type="button"
            onClick={() => setFacilitiesDrawerOpen?.(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Create Facilities Request
          </button>
        </div>

        <section>
          <SupportQueue
            type="Facilities"
            requests={supportRequests ?? []}
            currentUser={currentUser}
            viewMode="queue"
            title={isTeamMode ? 'Team Tickets' : 'Incoming Facilities requests'}
            emptyMessage="No Facilities requests right now."
          />
        </section>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Submit a Facilities request or check status of tickets you submitted.
        </p>
        <button
          type="button"
          onClick={() => setFacilitiesDrawerOpen?.(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create Facilities Request
        </button>
      </div>

      <section>
        <SupportQueue
          type="Facilities"
          requests={supportRequests ?? []}
          currentUser={currentUser}
          viewMode="my-tickets"
          title="My Facilities requests"
          emptyMessage="You haven't submitted any Facilities requests yet."
        />
      </section>
    </motion.div>
  )
}
