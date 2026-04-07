'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Send } from 'lucide-react'

export default function TicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [ticket, setTicket] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchTicket = async () => {
    const token = localStorage.getItem('platform-token')
    const res = await fetch(`/api/platform/support-tickets/${params.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data.ok) setTicket(data.data)
    setLoading(false)
  }

  useEffect(() => { fetchTicket() }, [params.id])

  const sendMessage = async () => {
    if (!message.trim()) return
    setSending(true)
    const token = localStorage.getItem('platform-token')
    await fetch(`/api/platform/support-tickets/${params.id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
    setMessage('')
    setSending(false)
    fetchTicket()
  }

  const updateTicket = async (data: Record<string, string>) => {
    const token = localStorage.getItem('platform-token')
    const res = await fetch(`/api/platform/support-tickets/${params.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const result = await res.json()
    if (result.ok) fetchTicket()
  }

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" /></div>
  if (!ticket) return <div className="text-slate-500 text-center py-12">Ticket not found</div>

  return (
    <div className="space-y-6 max-w-4xl">
      <button onClick={() => router.push('/admin/support')} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100">
        <ArrowLeft size={16} /> Back to tickets
      </button>

      <div className="flex flex-wrap gap-4 items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">{ticket.subject}</h2>
          <p className="text-sm text-slate-400">{ticket.organization?.name || 'Internal'} &middot; {ticket.category}</p>
        </div>
        <div className="flex gap-2">
          <select aria-label="Ticket status" value={ticket.status} onChange={(e) => updateTicket({ status: e.target.value })} className="ui-select w-auto text-sm">
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="WAITING_ON_CUSTOMER">Waiting</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
          <select aria-label="Ticket priority" value={ticket.priority} onChange={(e) => updateTicket({ priority: e.target.value })} className="ui-select w-auto text-sm">
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <p className="text-slate-300 whitespace-pre-wrap">{ticket.description}</p>
        <p className="text-xs text-slate-500 mt-3">{new Date(ticket.createdAt).toLocaleString()}</p>
      </div>

      <div className="space-y-3">
        {ticket.messages?.map((m: any) => (
          <div key={m.id} className={`p-4 rounded-xl ${m.senderType === 'PLATFORM_ADMIN' ? 'bg-primary-500/10 border border-primary-500/20 ml-8' : 'bg-slate-900 border border-slate-800 mr-8'}`}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-slate-400">{m.senderType === 'PLATFORM_ADMIN' ? 'Admin' : 'School'}</span>
              <span className="text-xs text-slate-500">{new Date(m.createdAt).toLocaleString()}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{m.message}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your reply..."
          aria-label="Reply message"
          className="ui-input-bordered flex-1 min-h-[80px] resize-y"
          onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) sendMessage() }}
        />
        <button
          onClick={sendMessage}
          disabled={sending || !message.trim()}
          className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors disabled:opacity-50 self-end"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}
