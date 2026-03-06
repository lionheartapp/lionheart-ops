'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Wrench } from 'lucide-react'
import StaggerList, { StaggerItem } from '@/components/motion/StaggerList'
import TicketCard from './TicketCard'
import { staggerContainer, fadeInUp } from '@/lib/animations'

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  if (token) return { Authorization: `Bearer ${token}` }
  return {}
}

async function fetchMyTickets() {
  const res = await fetch('/api/maintenance/tickets', {
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw new Error('Failed to fetch tickets')
  const data = await res.json()
  if (!data.ok) throw new Error(data.error?.message || 'Failed to fetch tickets')
  return data.data
}

interface MyRequestsGridProps {
  onSubmitRequest: () => void
}

export default function MyRequestsGrid({ onSubmitRequest }: MyRequestsGridProps) {
  const { data: tickets, isLoading, error } = useQuery({
    queryKey: ['maintenance-my-tickets'],
    queryFn: fetchMyTickets,
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-2xl bg-gray-100 h-40" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="ui-glass rounded-2xl p-8 text-center">
        <p className="text-sm text-red-600">Failed to load tickets. Please try refreshing.</p>
      </div>
    )
  }

  // Sort by most recent first
  const sorted = [...(tickets || [])].sort(
    (a: { createdAt: string }, b: { createdAt: string }) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  if (sorted.length === 0) {
    return (
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="ui-glass rounded-2xl p-12"
      >
        <div className="flex flex-col items-center justify-center text-center max-w-sm mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
            <Wrench className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">
            No maintenance requests yet
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            Submit a request when you notice something that needs fixing in your building.
          </p>
          <button
            type="button"
            onClick={onSubmitRequest}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 active:scale-[0.97] transition-all cursor-pointer"
          >
            <Wrench className="w-4 h-4" />
            Submit Your First Request
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <StaggerList
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      animationKey={`tickets-${sorted.length}`}
    >
      {sorted.map((ticket: Parameters<typeof TicketCard>[0]['ticket']) => (
        <StaggerItem key={ticket.id}>
          <TicketCard ticket={ticket} />
        </StaggerItem>
      ))}
    </StaggerList>
  )
}
