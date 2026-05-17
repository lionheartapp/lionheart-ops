'use client'

import { use, useState, useEffect } from 'react'
import { Loader2, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

interface TicketData {
  ticketCode: string
  status: string
  ticketTypeName: string
  buyerName: string
  formTitle: string
  eventDate: string | null
  eventVenue: string | null
  checkedInAt: string | null
  qrDataUrl: string // base64 QR code image
}

export default function TicketDisplayPage({ params }: { params: Promise<{ ticketCode: string }> }) {
  const { ticketCode } = use(params)
  const [ticket, setTicket] = useState<TicketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/event-tickets/${ticketCode}`)
        const json = await res.json()
        if (json.ok) setTicket(json.data)
        else setError(json.error?.message || 'Ticket not found')
      } catch {
        setError('Failed to load ticket')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [ticketCode])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-600">{error || 'Ticket not found'}</p>
        </div>
      </div>
    )
  }

  const isUsed = ticket.status === 'USED'
  const isCancelled = ticket.status === 'CANCELLED'
  const isValid = ticket.status === 'VALID'

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-sm mx-auto">
        {/* Ticket card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 px-6 py-6 text-center">
            <h1 className="text-lg font-bold text-white">{ticket.formTitle}</h1>
            {ticket.eventDate && (
              <p className="text-sm text-white/80 mt-1">{ticket.eventDate}</p>
            )}
            {ticket.eventVenue && (
              <p className="text-sm text-white/70">{ticket.eventVenue}</p>
            )}
          </div>

          {/* QR Code */}
          <div className="px-6 py-8 flex flex-col items-center">
            {isValid && (
              <img
                src={ticket.qrDataUrl}
                alt={`QR code for ticket ${ticket.ticketCode}`}
                className="w-48 h-48 mb-4"
              />
            )}

            {isUsed && (
              <div className="w-48 h-48 mb-4 flex items-center justify-center bg-emerald-50 rounded-xl">
                <div className="text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-emerald-700">Checked in</p>
                  {ticket.checkedInAt && (
                    <p className="text-xs text-emerald-600 mt-1">
                      {new Date(ticket.checkedInAt).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>
            )}

            {isCancelled && (
              <div className="w-48 h-48 mb-4 flex items-center justify-center bg-red-50 rounded-xl">
                <div className="text-center">
                  <XCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-red-700">Cancelled</p>
                </div>
              </div>
            )}

            {/* Ticket details */}
            <div className="w-full space-y-3 mt-2">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-xs text-slate-500">Ticket Type</span>
                <span className="text-sm font-medium text-slate-900">{ticket.ticketTypeName}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-xs text-slate-500">Attendee</span>
                <span className="text-sm font-medium text-slate-900">{ticket.buyerName}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs text-slate-500">Ticket Code</span>
                <span className="text-sm font-mono font-medium text-indigo-600">{ticket.ticketCode}</span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-300 mt-6">Powered by Lionheart</p>
      </div>
    </div>
  )
}
