'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { LifeBuoy, ChevronLeft, ChevronRight } from 'lucide-react'
import { FloatingDropdown } from '@/components/ui/FloatingInput'

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
      case 'NORMAL': return 'bg-primary-500/10 text-primary-400'
      default: return 'bg-slate-700 text-slate-300'
    }
  }
  const statusColor = (s: string) => {
    switch (s) {
      case 'OPEN': return 'bg-primary-500/10 text-primary-400'
      case 'IN_PROGRESS': return 'bg-yellow-500/10 text-yellow-400'
      case 'RESOLVED': return 'bg-green-500/10 text-green-400'
      case 'CLOSED': return 'bg-slate-700 text-slate-300'
      default: return 'bg-purple-500/10 text-purple-400'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <FloatingDropdown
          label="Status"
          value={statusFilter}
          onChange={(value) => { setStatusFilter(value); setPage(1) }}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'OPEN', label: 'Open' },
            { value: 'IN_PROGRESS', label: 'In Progress' },
            { value: 'WAITING_ON_CUSTOMER', label: 'Waiting' },
            { value: 'RESOLVED', label: 'Resolved' },
            { value: 'CLOSED', label: 'Closed' },
          ]}
          className="w-auto"
        />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-left">
              <th className="px-5 py-3 font-medium">Subject</th>
              <th className="px-5 py-3 font-medium hidden sm:table-cell">School</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium hidden md:table-cell">Priority</th>
              <th className="px-5 py-3 font-medium hidden md:table-cell">Category</th>
              <th className="px-5 py-3 font-medium hidden lg:table-cell">Messages</th>
              <th className="px-5 py-3 font-medium hidden lg:table-cell">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-500"><div className="w-6 h-6 mx-auto rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" /></td></tr>
            ) : tickets.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                <LifeBuoy size={24} className="mx-auto mb-2 text-slate-600" />
                No tickets found
              </td></tr>
            ) : (
              tickets.map((t) => (
                <tr key={t.id} onClick={() => router.push(`/admin/support/${t.id}`)} className="hover:bg-slate-800/50 cursor-pointer transition-colors">
                  <td className="px-5 py-3 font-medium">{t.subject}</td>
                  <td className="px-5 py-3 hidden sm:table-cell text-slate-400">{t.organization?.name || '—'}</td>
                  <td className="px-5 py-3"><span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(t.status)}`}>{t.status}</span></td>
                  <td className="px-5 py-3 hidden md:table-cell"><span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityColor(t.priority)}`}>{t.priority}</span></td>
                  <td className="px-5 py-3 hidden md:table-cell text-slate-400">{t.category}</td>
                  <td className="px-5 py-3 hidden lg:table-cell text-slate-400">{t._count?.messages || 0}</td>
                  <td className="px-5 py-3 hidden lg:table-cell text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>{total} ticket{total !== 1 ? 's' : ''}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg hover:bg-slate-800 disabled:opacity-30"><ChevronLeft size={16} /></button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg hover:bg-slate-800 disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}
    </div>
  )
}
