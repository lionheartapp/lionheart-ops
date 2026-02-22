import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { MapPin, Calendar, CheckCircle2, X, Users } from 'lucide-react'
import { platformFetch } from '../services/platformApi'

export default function OnboardingChecklist({
  onOpenMap,
  onCreateEvent,
  onNavigateToMembers,
  isEventCreated,
  isTeamSetup, // users.length > 1
  hasVisualCampus = true,
}) {
  const [isVisible, setIsVisible] = useState(true)
  const [buildingCount, setBuildingCount] = useState(0)

  useEffect(() => {
    if (!hasVisualCampus) return
    platformFetch('/api/buildings')
      .then((r) => r.ok ? r.json() : [])
      .then((b) => setBuildingCount(Array.isArray(b) ? b.length : 0))
      .catch(() => setBuildingCount(0))
  }, [hasVisualCampus])

  const isMapSetup = buildingCount > 1
  const allDone = (!hasVisualCampus || isMapSetup) && isEventCreated && isTeamSetup

  if (!isVisible || allDone) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 mb-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 border-l-4 border-l-emerald-500 relative"
    >
      <button
        onClick={() => setIsVisible(false)}
        className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
        Welcome to Lionheart!
      </h2>
      <p className="text-sm text-zinc-500 mb-4">
        We created a default campus for you. Here are two quick wins to get started:
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        {onNavigateToMembers && (
          <div
            onClick={onNavigateToMembers}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
              isTeamSetup
                ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-900'
                : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-emerald-400 hover:shadow-md'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                isTeamSetup ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-400'
              }`}
            >
              {isTeamSetup ? <CheckCircle2 className="w-5 h-5" /> : <Users className="w-4 h-4" />}
            </div>
            <div>
              <p
                className={`text-sm font-medium ${
                  isTeamSetup
                    ? 'text-emerald-700 dark:text-emerald-400 line-through'
                    : 'text-zinc-900 dark:text-zinc-100'
                }`}
              >
                Add team members
              </p>
              <p className="text-xs text-zinc-500">Invite colleagues to collaborate</p>
            </div>
          </div>
        )}
        {hasVisualCampus && (
          <div
            onClick={onOpenMap}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
              isMapSetup
                ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-900'
                : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-emerald-400 hover:shadow-md'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                isMapSetup ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-400'
              }`}
            >
              {isMapSetup ? <CheckCircle2 className="w-5 h-5" /> : <MapPin className="w-4 h-4" />}
            </div>
            <div>
              <p
                className={`text-sm font-medium ${
                  isMapSetup
                    ? 'text-emerald-700 dark:text-emerald-400 line-through'
                    : 'text-zinc-900 dark:text-zinc-100'
                }`}
              >
                Customize your Map
              </p>
              <p className="text-xs text-zinc-500">Add address or rename buildings</p>
            </div>
          </div>
        )}

        <div
          onClick={onCreateEvent}
          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
            isEventCreated
              ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-900'
              : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-emerald-400 hover:shadow-md'
          }`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              isEventCreated ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-400'
            }`}
          >
            {isEventCreated ? <CheckCircle2 className="w-5 h-5" /> : <Calendar className="w-4 h-4" />}
          </div>
          <div>
            <p
              className={`text-sm font-medium ${
                isEventCreated
                  ? 'text-emerald-700 dark:text-emerald-400 line-through'
                  : 'text-zinc-900 dark:text-zinc-100'
              }`}
            >
              Create first Event
            </p>
            <p className="text-xs text-zinc-500">Try the AI &quot;Smart Event&quot;</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
