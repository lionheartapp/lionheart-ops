'use client'

import { useState } from 'react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Wrench, Monitor } from 'lucide-react'
import { staggerContainer, fadeInUp } from '@/lib/animations'
import MyRequestsGrid from '@/components/maintenance/MyRequestsGrid'
import SupportRequestDrawer from '@/components/forms/SupportRequestDrawer'

type TicketModule = 'MAINTENANCE' | 'IT'

export default function TicketsPage() {
  usePageTitle('Tickets')
  const queryClient = useQueryClient()
  const [drawerModule, setDrawerModule] = useState<TicketModule | null>(null)

  const handleComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['maintenance-my-tickets'] })
    setDrawerModule(null)
  }

  return (
    <motion.div
      className="space-y-6 pb-4"
      initial="hidden"
      animate="visible"
      variants={staggerContainer(0.08, 0.05)}
    >
      {/* Quick submit buttons */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setDrawerModule('MAINTENANCE')}
          className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Wrench className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-900">Facilities</p>
            <p className="text-xs text-slate-500">Report an issue</p>
          </div>
        </button>

        <button
          onClick={() => setDrawerModule('IT')}
          className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Monitor className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-900">IT Help</p>
            <p className="text-xs text-slate-500">Tech support</p>
          </div>
        </button>
      </motion.div>

      {/* My submitted tickets */}
      <motion.div variants={fadeInUp}>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">My Requests</h2>
        <MyRequestsGrid onSubmitRequest={() => setDrawerModule('MAINTENANCE')} />
      </motion.div>

      {/* Submit drawer */}
      <AnimatePresence>
        {drawerModule && (
          <SupportRequestDrawer
            isOpen={!!drawerModule}
            onClose={handleComplete}
            module={drawerModule}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
