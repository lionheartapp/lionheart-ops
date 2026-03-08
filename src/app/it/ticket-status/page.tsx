'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Clock, AlertTriangle, XCircle, Loader2, Ban, Pause } from 'lucide-react'

interface TicketStatusData {
  ticketNumber: string
  title: string
  status: string
  issueType: string
  createdAt: string
  updatedAt: string
  timeline: Array<{
    id: string
    type: string
    content: string | null
    fromStatus: string | null
    toStatus: string | null
    createdAt: string
  }>
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  BACKLOG: { label: 'Submitted', color: 'text-gray-700', bg: 'bg-gray-100', icon: Clock },
  IN_PROGRESS: { label: 'In Progress', color: 'text-blue-700', bg: 'bg-blue-100', icon: Loader2 },
  ON_HOLD: { label: 'On Hold', color: 'text-yellow-700', bg: 'bg-yellow-100', icon: Pause },
  DONE: { label: 'Resolved', color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-100', icon: XCircle },
}

function TicketStatusContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const token = searchParams.get('token')

  const [data, setData] = useState<TicketStatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || !token) {
      setError('Missing ticket ID or token')
      setLoading(false)
      return
    }

    fetch(`/api/it/tickets/${id}/status-public?token=${token}`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok || !json.ok) {
          setError(json.error?.message || 'Ticket not found')
        } else {
          setData(json.data)
        }
      })
      .catch(() => setError('Failed to load ticket status'))
      .finally(() => setLoading(false))
  }, [id, token])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="ui-glass p-8 rounded-2xl max-w-md w-full mx-4">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3" />
            <div className="h-8 bg-gray-200 rounded w-2/3" />
            <div className="h-10 bg-gray-200 rounded w-1/4" />
            <div className="space-y-3 mt-6">
              <div className="h-4 bg-gray-200 rounded w-full" />
              <div className="h-4 bg-gray-200 rounded w-5/6" />
              <div className="h-4 bg-gray-200 rounded w-4/6" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="ui-glass p-8 rounded-2xl max-w-md w-full mx-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Ticket Not Found</h2>
          <p className="text-sm text-gray-500">{error || 'The ticket could not be found or the link has expired.'}</p>
        </div>
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[data.status] || STATUS_CONFIG.BACKLOG
  const StatusIcon = statusConfig.icon

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-lg font-semibold text-gray-900">IT Ticket Status</h1>
          <p className="text-xs text-gray-500 mt-1">Track your support request</p>
        </div>

        {/* Status Card */}
        <div className="ui-glass p-6 rounded-2xl mb-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono text-gray-500">{data.ticketNumber}</span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {statusConfig.label}
            </span>
          </div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">{data.title}</h2>
          <p className="text-xs text-gray-500">
            Submitted {new Date(data.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>

        {/* Timeline */}
        {data.timeline.length > 0 && (
          <div className="ui-glass p-6 rounded-2xl">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Activity</h3>
            <div className="space-y-4">
              {data.timeline.map((event, i) => (
                <div key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-gray-300 mt-1.5" />
                    {i < data.timeline.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                  </div>
                  <div className="pb-4">
                    {event.type === 'STATUS_CHANGE' && event.toStatus && (
                      <p className="text-xs text-gray-700">
                        Status changed to <span className="font-medium">{STATUS_CONFIG[event.toStatus]?.label || event.toStatus}</span>
                      </p>
                    )}
                    {event.type === 'COMMENT' && event.content && (
                      <p className="text-xs text-gray-700">{event.content}</p>
                    )}
                    {event.type !== 'STATUS_CHANGE' && event.type !== 'COMMENT' && (
                      <p className="text-xs text-gray-700">{event.content || event.type.replace(/_/g, ' ')}</p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(event.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-[10px] text-gray-400 mt-6">
          Powered by Lionheart
        </p>
      </div>
    </div>
  )
}

export default function TicketStatusPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <TicketStatusContent />
    </Suspense>
  )
}
