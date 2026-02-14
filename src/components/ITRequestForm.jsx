import { useState } from 'react'
import { motion } from 'framer-motion'
import { Headphones } from 'lucide-react'
import ScheduleCheck from './ScheduleCheck'

export default function ITRequestForm({ onSubmit, inDrawer = false }) {
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [priority, setPriority] = useState('normal')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit?.({ title: title.trim(), details: details.trim(), priority })
    setTitle('')
    setDetails('')
    setPriority('normal')
  }

  const formEl = (
    <form onSubmit={handleSubmit} className={inDrawer ? 'space-y-4' : 'p-4 space-y-4'}>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Summary
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Projector not working in Room 204"
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Details (optional)
          </label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={2}
            placeholder="Any additional details..."
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Priority
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="select-arrow-padded w-full pl-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="normal">Normal</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <ScheduleCheck />
        <button
          type="submit"
          className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600"
        >
          Submit request
        </button>
    </form>
  )

  if (inDrawer) return formEl

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden"
    >
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 dark:border-blue-950/40">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Headphones className="w-5 h-5 text-blue-500" />
          New IT request
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Request help with tech, AV, or connectivity
        </p>
      </div>
      {formEl}
    </motion.div>
  )
}
