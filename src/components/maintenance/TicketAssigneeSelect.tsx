'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Loader2, UserX, Check } from 'lucide-react'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'

interface User {
  id: string
  firstName: string
  lastName: string
}

interface TicketAssigneeSelectProps {
  ticketId: string
  currentAssignee: User | null
  canAssign: boolean
}

export default function TicketAssigneeSelect({
  ticketId,
  currentAssignee,
  canAssign,
}: TicketAssigneeSelectProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Fetch maintenance team members
  const { data: technicians = [] } = useQuery({
    queryKey: ['maintenance-technicians'],
    queryFn: () =>
      fetchApi<User[]>('/api/settings/users?teamSlug=maintenance').then((members) =>
        members.map((m) => ({ id: m.id, firstName: m.firstName, lastName: m.lastName }))
      ),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  })

  const assignMutation = useMutation({
    mutationFn: (assignedToId: string) =>
      fetchApi(`/api/maintenance/tickets/${ticketId}/assign`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ assignedToId }),
      }),
    onSuccess: () => {
      setOpen(false)
      queryClient.invalidateQueries({ queryKey: ['maintenance-ticket', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['maintenance-ticket-activities', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['maintenance-tickets'] })
    },
  })

  const initials = currentAssignee
    ? `${currentAssignee.firstName[0]}${currentAssignee.lastName[0]}`.toUpperCase()
    : null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => canAssign && setOpen((v) => !v)}
        disabled={!canAssign}
        className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl border transition-colors text-left ${
          canAssign
            ? 'hover:bg-slate-50 border-slate-200 cursor-pointer'
            : 'border-transparent cursor-default'
        } ${open ? 'bg-slate-50 border-slate-300' : ''}`}
      >
        {currentAssignee ? (
          <>
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700 flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {currentAssignee.firstName} {currentAssignee.lastName}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <UserX className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <span className="text-sm text-slate-400">Unassigned</span>
          </>
        )}
        {canAssign && (
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-20 ui-glass-dropdown py-1 max-h-48 overflow-y-auto">
          {technicians.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <Loader2 className="w-4 h-4 text-slate-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-400 mt-1">Loading team...</p>
            </div>
          ) : (
            technicians.map((tech) => {
              const selected = tech.id === currentAssignee?.id
              return (
                <button
                  key={tech.id}
                  onClick={() => !selected && assignMutation.mutate(tech.id)}
                  disabled={assignMutation.isPending}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors cursor-pointer ${
                    selected ? 'bg-primary-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-semibold text-blue-700 flex-shrink-0">
                    {tech.firstName[0]}{tech.lastName[0]}
                  </div>
                  <span className="text-sm text-slate-700 flex-1 truncate">
                    {tech.firstName} {tech.lastName}
                  </span>
                  {selected && <Check className="w-3.5 h-3.5 text-primary-600 flex-shrink-0" />}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
