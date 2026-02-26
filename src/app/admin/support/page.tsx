'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { LifeBuoy, ChevronLeft, ChevronRight } from 'lucide-react'

export default function SupportPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const perPage = 25

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    const token = localStorage.getItem('platform-token')
    const params = new URLSearchParams({ page: String(page), perPage: String(perPage) })
    if (statusFilter) params.set('status', statusFilter)

    const res = await fetch(`/api/platform/support-tickets?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data.ok) {
      setTickets(data.data.tickets)
      setTotal(data.data.total)
    }
    setLoading(false)
  }, [page, statusFilter])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  const totalPages = Math.ceil(total / perPage)
  const priorityColor = (p: string) => {
    switch (p) {
      case 'CRITICAL': return 'bg-red-500/10 text-red-400'
      case 'HIGH': return 'bg-orange-500/10 text-orange-400'
      case 'NORMAL': return 'bg-blue-500/10 text-blue-400'
      default: return 'bg-zinc-700 text-zinc-300'
    }
  }
  const statusColor = (s: string) => {
    switch (s) {
      case 'OPEN': return 'bg-blue-500/10 text-blue-400'
      case 'IN_PROGRESS': return 'bg-yellow-500/10 text-yellow-400'
      case 'RESOLVED': return 'bg-green-500/10 text-green-400'
      case 'CLOSED': return 'bg-zinc-700 text-zinc-300'
      default: return 'bg-purple-500/10 text-purple-400'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="ui-select w-auto">
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="WAITING_ON_CUSTOMER">Waiting</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 text-left">
              <th className="px-5 py-3 font-medium">Subject</th>
              <th className="px-5 py-3 font-medium hidden sm:table-cell">School</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium hidden md:table-cell">Priority</th>
              <th className="px-5 py-3 font-medium hidden md:table-cell">Category</th>
              <th className="px-5 py-3 font-medium hidden lg:table-cell">Messages</th>
              <th className="px-5 py-3 font-medium hidden lg:table-cell">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-zinc-500">Loading...</td></tr>
            ) : tickets.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-zinc-500">
                <LifeBuoy size={24} className="mx-auto mb-2 text-zinc-600" />
                No tickets found
              </td></tr>
            ) : (
              tickets.map((t) => (
                <tr key={t.id} onClick={() => router.push(`/admin/support/${t.id}`)} className="hover:bg-zinc-800/50 cursor-pointer transition-colors">
                  <td className="px-5 py-3 font-medium">{t.subject}</td>
                  <td className="px-5 py-3 hidden sm:table-cell text-zinc-400">{t.organization?.name || '—'}</td>
                  <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(t.status)}`}>{t.status}</span></td>
                  <td className="px-5 py-3 hidden md:table-cell"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColor(t.priority)}`}>{t.priority}</span></td>
                  <td className="px-5 py-3 hidden md:table-cell text-zinc-400">{t.category}</td>
                  <td className="px-5 py-3 hidden lg:table-cell text-zinc-400">{t._count?.messages || 0}</td>
                  <td className="px-5 py-3 hidden lg:table-cell text-zinc-400">{new Date(t.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-400">
          <span>{total} ticket{total !== 1 ? 's' : ''}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg hover:bg-zinc-800 disabled:opacity-30"><ChevronLeft size={16} /></button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg hover:bg-zinc-800 disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}
    </div>
  )
}
