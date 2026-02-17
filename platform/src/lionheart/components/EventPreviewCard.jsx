import { motion } from 'framer-motion'
import { Calendar, MapPin } from 'lucide-react'

export default function EventPreviewCard({ event: eventData }) {
  const name = eventData?.name || 'Event name'
  const description = eventData?.description || 'Add a description or use AI Suggest in the Event Creator.'
  const date = eventData?.date || 'TBD'
  const location = eventData?.location || 'Main Campus'

  return (
    <motion.div
      layout
      className="glass-card overflow-hidden"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="aspect-[16/9] bg-gradient-to-br from-blue-500/20 via-zinc-100 dark:via-zinc-800 to-zinc-200 dark:to-zinc-700 flex items-center justify-center">
        <span className="text-4xl font-bold text-zinc-300 dark:text-zinc-500 tracking-tight">
          {name.slice(0, 2).toUpperCase() || 'EV'}
        </span>
      </div>
      <div className="p-4 space-y-3">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
          {name || 'Untitled Event'}
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
          {description}
        </p>
        <div className="flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {date}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {location}
          </span>
        </div>
      </div>
    </motion.div>
  )
}
