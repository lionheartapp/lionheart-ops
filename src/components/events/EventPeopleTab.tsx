'use client'

import { motion } from 'framer-motion'
import { Users } from 'lucide-react'
import { fadeInUp } from '@/lib/animations'

interface EventPeopleTabProps {
  eventProjectId: string
}

export function EventPeopleTab({ eventProjectId: _eventProjectId }: EventPeopleTabProps) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="text-center py-16"
    >
      <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
        <Users className="w-7 h-7 text-indigo-500" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-2">People and Registration</h3>
      <p className="text-sm text-slate-500 max-w-sm mx-auto mb-4">
        Registration forms, participant lists, and team assignments will appear here.
      </p>
      <span className="inline-flex items-center text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full">
        Set up in Registration phase
      </span>
    </motion.div>
  )
}
