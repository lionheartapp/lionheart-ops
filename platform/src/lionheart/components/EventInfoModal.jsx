import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Calendar,
  MapPin,
  Pencil,
  Trash2,
  Ban,
  Clock,
  User,
  Users,
  Package,
  Monitor,
  Send,
  Repeat,
} from 'lucide-react'

function formatTime(t) {
  if (!t || typeof t !== 'string') return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${h12}:${m || '00'} ${ampm}`
}

function formatDuration(start, end) {
  if (!start || !end) return ''
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) return ''
  if (mins < 60) return `${mins} minutes`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} hr ${m} min` : `${h} hour${h !== 1 ? 's' : ''}`
}

const REPEAT_LABELS = {
  none: 'Does not repeat',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Annually',
  weekdays: 'Every weekday',
  custom: 'Custom',
}

export default function EventInfoModal({
  isOpen,
  onClose,
  event: ev,
  onEdit,
  onDelete,
  onCancel,
  onEventUpdate,
  currentUser,
}) {
  const [commInput, setCommInput] = useState('')
  const commEndRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    commEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [ev?.communications?.length])

  if (!ev) return null

  const isCancelled = ev.status === 'cancelled'
  const name = ev.name || 'Event'
  const description = ev.description || 'No description.'
  const date = ev.date || 'TBD'
  const location = ev.location || 'Main Campus'
  const time = ev.time
  const endTime = ev.endTime
  const allDay = ev.allDay
  const owner = ev.owner || ev.creator || '—'
  const watchers = ev.watchers || []
  const category = ev.category
  const facilities = ev.facilitiesRequested || []
  const tech = ev.techRequested || []
  const communications = ev.communications || []
  const repeatLabel = ev.repeatEnabled && ev.repeatRule ? (REPEAT_LABELS[ev.repeatRule] || ev.repeatRule) : null
  const schoolLevel = ev.schoolLevel
  const includeSetupTime = ev.includeSetupTime
  const userName = currentUser?.name || 'You'

  const handleSendMessage = () => {
    const text = commInput.trim()
    if (!text || !onEventUpdate) return
    const newMsg = {
      id: `comm-${Date.now()}`,
      author: userName,
      text,
      at: new Date().toISOString(),
    }
    onEventUpdate({ ...ev, communications: [...communications, newMsg] })
    setCommInput('')
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-0 sm:inset-[5%] z-[70] flex flex-col rounded-t-2xl sm:rounded-2xl bg-zinc-50 dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between shrink-0 p-4 border-b border-zinc-200 dark:border-zinc-700">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Event details
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto p-6 space-y-6">
              {isCancelled && (
                <div className="px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm font-medium">
                  This event is cancelled.
                </div>
              )}

              <div>
                <h3 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                  {name}
                </h3>
                <div className="flex flex-wrap gap-2 mt-1">
                  {category && (
                    <span className="text-sm text-violet-600 dark:text-violet-400">{category}</span>
                  )}
                  {schoolLevel && (
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">{schoolLevel}</span>
                  )}
                  {includeSetupTime && (
                    <span className="text-xs px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">
                      Setup time included
                    </span>
                  )}
                </div>
              </div>

              {/* Scheduled by & Participants */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                    <User className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Scheduled by</p>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{owner}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                    <Users className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Participants</p>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {watchers.length ? `${watchers.length} people` : '—'}
                    </p>
                    {watchers.length > 0 && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[200px]">
                        {watchers.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Date, Time, Duration */}
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <Calendar className="w-4 h-4" />
                  {date}
                </span>
                {!allDay && (time || endTime) && (
                  <span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                    <Clock className="w-4 h-4" />
                    {time && formatTime(time)}
                    {endTime && ` – ${formatTime(endTime)}`}
                  </span>
                )}
                {allDay && (
                  <span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                    <Clock className="w-4 h-4" />
                    All day
                  </span>
                )}
                {!allDay && time && endTime && (
                  <span className="text-zinc-500 dark:text-zinc-400">
                    Duration: {formatDuration(time, endTime)}
                  </span>
                )}
                <span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <MapPin className="w-4 h-4" />
                  {location}
                </span>
                {repeatLabel && (
                  <span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                    <Repeat className="w-4 h-4" />
                    {repeatLabel}
                  </span>
                )}
              </div>

              <div>
                <h4 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Description
                </h4>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
                  {description}
                </p>
              </div>

              {(facilities.length > 0 || tech.length > 0) && (
                <div className="space-y-3">
                  {facilities.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2 flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Facilities
                      </h4>
                      <ul className="text-sm text-zinc-700 dark:text-zinc-300 space-y-1">
                        {facilities.map((f, i) => (
                          <li key={i}>
                            {typeof f === 'object' && f?.item
                              ? `${f.item} × ${f.quantity ?? 1}`
                              : String(f)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {tech.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2 flex items-center gap-2">
                        <Monitor className="w-4 h-4" />
                        Tech / A/V
                      </h4>
                      <ul className="text-sm text-zinc-700 dark:text-zinc-300 space-y-1">
                        {tech.map((t, i) => (
                          <li key={i}>
                            {typeof t === 'object' && t?.item
                              ? `${t.item} × ${t.quantity ?? 1}`
                              : String(t)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Communications */}
              <div className="border-t border-zinc-200 dark:border-zinc-700 pt-6">
                <h4 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-3">
                  Communications
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                  Discussion for this event. Everything stays here.
                </p>
                <div className="space-y-3 max-h-[280px] overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 p-3">
                  {communications.length === 0 ? (
                    <p className="text-sm text-zinc-400 dark:text-zinc-500 italic py-4 text-center">
                      No messages yet. Start the conversation.
                    </p>
                  ) : (
                    communications.map((msg) => (
                      <div
                        key={msg.id}
                        className="flex flex-col gap-0.5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            {msg.author}
                          </span>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                            {msg.at ? new Date(msg.at).toLocaleString() : ''}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap pl-0">
                          {msg.text}
                        </p>
                      </div>
                    ))
                  )}
                  <div ref={commEndRef} />
                </div>
                {onEventUpdate && (
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleSendMessage() }}
                    className="flex gap-2 mt-3"
                  >
                    <input
                      type="text"
                      value={commInput}
                      onChange={(e) => setCommInput(e.target.value)}
                      placeholder="Add a message…"
                      className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={!commInput.trim()}
                      className="p-2.5 rounded-xl bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                      aria-label="Send"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                )}
              </div>
            </div>

            {(onEdit || onCancel || onDelete) && (
              <div className="shrink-0 p-4 border-t border-zinc-200 dark:border-zinc-700 flex flex-wrap gap-2">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(ev)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                )}
                {!isCancelled && onCancel && (
                  <button
                    type="button"
                    onClick={() => onCancel(ev)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-amber-500/50 text-amber-600 dark:text-amber-400 text-sm font-medium hover:bg-amber-500/10 transition-colors"
                  >
                    <Ban className="w-4 h-4" />
                    Cancel event
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(ev)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-500/50 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors ml-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
