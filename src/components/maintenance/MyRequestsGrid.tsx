'use client'

import { useQuery } from '@tanstack/react-query'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { Wrench, WifiOff } from 'lucide-react'
import StaggerList, { StaggerItem } from '@/components/motion/StaggerList'
import TicketCard from './TicketCard'
import { staggerContainer, fadeInUp } from '@/lib/animations'
import { useConnectivity } from '@/hooks/useConnectivity'
import { db } from '@/lib/offline/db'
import { getQueueCount } from '@/lib/offline/queue'

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

// Suppress unused import warning
void getQueueCount

export default function MyRequestsGrid({ onSubmitRequest }: MyRequestsGridProps) {
  const isOnline = useConnectivity()

  const { data: tickets, isLoading, error } = useQuery({
    queryKey: ['maintenance-my-tickets'],
    queryFn: fetchMyTickets,
    // When offline, don't retry — fall back to IndexedDB
    retry: isOnline ? 3 : 0,
    retryDelay: 1000,
  })

  // IndexedDB fallback data for offline mode
  const offlineTickets = useLiveQuery(
    () => db.offlineTickets.orderBy('cachedAt').reverse().toArray(),
    []
  )
  const offlineQueueCount = useLiveQuery<number, number>(
    () => db.mutationQueue.count(),
    [],
    0
  )

  // Use offline tickets when: network is down OR query errored
  const showOfflineFallback = !isOnline || (!!error && !isLoading)

  if (isLoading && !showOfflineFallback) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-2xl bg-gray-100 h-40" />
        ))}
      </div>
    )
  }

  if (showOfflineFallback) {
    const cachedCount = offlineTickets?.length ?? 0
    const queuedCount = offlineQueueCount ?? 0

    return (
      <div className="space-y-4">
        {/* Offline banner */}
        <div className="ui-glass p-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50/80 border-amber-200/50 rounded-xl">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span>
            Showing {cachedCount} cached ticket{cachedCount !== 1 ? 's' : ''}
            {queuedCount > 0 && (
              <span className="ml-1 text-orange-700">
                — {queuedCount} mutation{queuedCount !== 1 ? 's' : ''} queued for sync
              </span>
            )}
          </span>
        </div>

        {cachedCount === 0 ? (
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="ui-glass rounded-2xl p-12"
          >
            <div className="flex flex-col items-center justify-center text-center max-w-sm mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
                <WifiOff className="w-8 h-8 text-amber-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">No cached tickets</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Connect to the network to load your tickets. They&apos;ll be available offline after first load.
              </p>
            </div>
          </motion.div>
        ) : (
          <StaggerList
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            animationKey={`offline-tickets-${cachedCount}`}
          >
            {(offlineTickets ?? []).map((ticket) => (
              <StaggerItem key={ticket.id}>
                <TicketCard
                  ticket={{
                    id: ticket.ticketId,
                    ticketNumber: ticket.ticketNumber,
                    title: ticket.title,
                    status: ticket.status,
                    category: ticket.category,
                    priority: ticket.priority,
                    createdAt: ticket.cachedAt.toISOString(),
                    // Mark local-only tickets visually
                    _isLocalOnly: ticket.isLocalOnly,
                  }}
                />
              </StaggerItem>
            ))}
          </StaggerList>
        )}
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
          <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mb-4">
            <Wrench className="w-8 h-8 text-primary-400" />
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
            className="ui-btn-md ui-btn-primary"
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
