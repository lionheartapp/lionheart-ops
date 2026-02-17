import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import SupportQueue from './SupportQueue'
import { isITTeam } from '../data/teamsData'

export default function ITSupportPage({
  supportRequests = [],
  setSupportRequests,
  currentUser,
  teams,
  itDrawerOpen,
  setITDrawerOpen,
  mode = 'default',
}) {
  const isStaff = isITTeam(currentUser, teams)
  const requests = supportRequests ?? []
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
            {isTeamMode ? 'All IT tickets for the team.' : 'Incoming IT requests.'}
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
            requests={requests}
            currentUser={currentUser}
            viewMode="queue"
            title={isTeamMode ? 'Team Tickets' : 'Incoming IT requests'}
            emptyMessage="No IT requests right now."
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
          Submit an IT request or check status of tickets you submitted.
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
          requests={requests}
          currentUser={currentUser}
          viewMode="my-tickets"
          title="My IT requests"
          emptyMessage="You haven't submitted any IT requests yet."
        />
      </section>
    </motion.div>
  )
}
