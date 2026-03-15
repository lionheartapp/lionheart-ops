'use client'

import { motion } from 'framer-motion'
import { MessageSquare } from 'lucide-react'
import { fadeInUp } from '@/lib/animations'

interface EventCommsTabProps {
  eventProjectId: string
}

export function EventCommsTab({ eventProjectId: _eventProjectId }: EventCommsTabProps) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="text-center py-16"
    >
      <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
        <MessageSquare className="w-7 h-7 text-indigo-500" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-2">Communications</h3>
      <p className="text-sm text-gray-500 max-w-sm mx-auto mb-4">
        Announcements, email campaigns, notification timelines, and surveys.
      </p>
      <span className="inline-flex items-center text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full">
        Set up in Communications phase
      </span>
    </motion.div>
  )
}
