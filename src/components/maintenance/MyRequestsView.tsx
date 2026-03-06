'use client'

import { motion } from 'framer-motion'
import { Wrench } from 'lucide-react'
import { staggerContainer, fadeInUp } from '@/lib/animations'

export default function MyRequestsView() {
  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer(0.08, 0.05)}
    >
      {/* Header row */}
      <motion.div variants={fadeInUp} className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">My Maintenance Requests</h2>
          <p className="text-sm text-gray-500 mt-0.5">Track and manage your submitted requests</p>
        </div>
        <div className="relative group">
          <button
            disabled
            title="Coming soon"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium opacity-50 cursor-not-allowed transition-opacity"
          >
            <Wrench className="w-4 h-4" />
            Submit Request
          </button>
          <div className="absolute right-0 top-full mt-1.5 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            Coming in Phase 2
          </div>
        </div>
      </motion.div>

      {/* Empty state */}
      <motion.div variants={fadeInUp} className="ui-glass rounded-2xl p-12">
        <div className="flex flex-col items-center justify-center text-center max-w-sm mx-auto">
          {/* Icon container */}
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
            <Wrench className="w-8 h-8 text-emerald-400" />
          </div>

          {/* Heading */}
          <h3 className="text-base font-semibold text-gray-900 mb-2">
            No maintenance requests yet
          </h3>

          {/* Description */}
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            Submit a request when you notice something that needs fixing in your building.
          </p>

          {/* CTA button */}
          <div className="relative group">
            <button
              disabled
              title="Coming soon"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium opacity-50 cursor-not-allowed transition-opacity"
            >
              <Wrench className="w-4 h-4" />
              Submit Request
            </button>
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
              Coming in Phase 2
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
