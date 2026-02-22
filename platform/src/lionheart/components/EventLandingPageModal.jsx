import { motion, AnimatePresence } from 'framer-motion'
import { X, Calendar, MapPin, Ticket } from 'lucide-react'

export default function EventLandingPageModal({ isOpen, onClose, event: eventData }) {
  const name = eventData?.name || 'Event Name'
  const description = eventData?.description || 'Join us for an unforgettable experience. More details coming soon.'
  const date = eventData?.date || 'Date TBD'
  const location = eventData?.location || 'Main Campus'

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[70] flex flex-col bg-zinc-50 dark:bg-zinc-950"
        >
          {/* Close button - top right */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors shadow-lg"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Public-facing event page content - scrollable */}
          <div className="flex-1 overflow-y-auto">
            {/* Hero */}
            <section className="relative min-h-[70vh] flex flex-col justify-end px-6 pb-16 pt-20 sm:px-12 sm:pb-24 lg:px-24">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900" />
              <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.04\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-80" />
              <div className="relative max-w-4xl">
                <motion.span
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="inline-block text-blue-200 text-sm font-medium tracking-wider uppercase mb-3"
                >
                  Event
                </motion.span>
                <motion.h1
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-tight"
                >
                  {name}
                </motion.h1>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="flex flex-wrap gap-6 mt-6 text-white/90"
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-200" />
                    {date}
                  </span>
                  <span className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-200" />
                    {location}
                  </span>
                </motion.div>
              </div>
            </section>

            {/* Content block */}
            <section className="px-6 py-16 sm:px-12 lg:px-24 bg-white dark:bg-zinc-900">
              <div className="max-w-3xl mx-auto">
                <h2 className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-4">
                  About this event
                </h2>
                <p className="text-lg text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                  {description}
                </p>

                {/* CTA */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="mt-14 pt-14 border-t border-zinc-200 dark:border-zinc-700"
                >
                  <button
                    type="button"
                    className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-blue-500 text-white text-lg font-semibold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40"
                  >
                    <Ticket className="w-6 h-6" />
                    Buy Tickets
                  </button>
                  <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                    Secure your spot — tickets are limited.
                  </p>
                </motion.div>
              </div>
            </section>

            {/* Footer strip */}
            <footer className="px-6 py-6 sm:px-12 lg:px-24 bg-zinc-100 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-800">
              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                Lionheart Operations & Event Management
              </p>
            </footer>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
