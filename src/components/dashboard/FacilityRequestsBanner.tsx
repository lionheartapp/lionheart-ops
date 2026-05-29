'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Wrench, CalendarRange, ChevronRight, CheckCircle2, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { readResourceItems } from '@/lib/utils/resourceItems'
import { useToast } from '@/components/Toast'
import type { EventProject } from '@/lib/hooks/useEventProject'

interface FacilityRequestsBannerProps {
  requests: EventProject[]
}

export default function FacilityRequestsBanner({ requests }: FacilityRequestsBannerProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  if (requests.length === 0) return null

  const handleApprove = async (projectId: string) => {
    setProcessingIds((prev) => new Set(prev).add(projectId))
    try {
      const res = await fetch(`/api/events/projects/${projectId}/approve-gate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateType: 'facilities' }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error?.message || 'Failed to approve')
      }
      toast('Facility request approved', 'success')
      window.dispatchEvent(new Event('focus'))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to approve', 'error')
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(projectId)
        return next
      })
    }
  }

  return (
    <motion.div
      className="mb-6 flex-shrink-0 rounded-xl border border-amber-200 bg-amber-50 p-4"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white border border-amber-100 flex items-center justify-center">
            <Wrench className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Facility Requests</h3>
            <p className="text-xs text-amber-600">
              {requests.length} event{requests.length !== 1 ? 's' : ''} requesting facilities support
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push('/maintenance?tab=dashboard')}
          className="flex items-center gap-0.5 rounded-md px-2 py-1 text-xs font-medium text-amber-700 transition-colors duration-200 hover:bg-amber-100 hover:text-amber-950 cursor-pointer"
        >
          View in Maintenance
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-2">
        {requests.slice(0, 2).map((project) => {
          const startsAt = new Date(project.startsAt)
          const dateDisplay = format(startsAt, 'MMM d, yyyy')
          const creatorName = project.createdBy?.firstName
            ? `${project.createdBy.firstName} ${project.createdBy.lastName || ''}`.trim()
            : project.createdBy?.email
          const meta = (project.metadata ?? {}) as Record<string, unknown>
          const facilityNeeds = readResourceItems(meta, 'facilityNeeds').map((i) => i.name)

          return (
            <div key={project.id} className="flex items-center gap-3 rounded-lg border border-amber-100 bg-white p-3 transition-[background-color,border-color] duration-200 hover:border-amber-200 hover:bg-amber-50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{project.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                    <CalendarRange className="w-2.5 h-2.5" />
                    {dateDisplay}
                  </span>
                  {creatorName && (
                    <span className="text-[10px] text-slate-400">by {creatorName}</span>
                  )}
                  {facilityNeeds.slice(0, 2).map((need) => (
                    <span key={need} className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium">
                      {need}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => handleApprove(project.id)}
                  disabled={processingIds.has(project.id)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-600 text-white text-xs font-medium hover:bg-green-700 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
                >
                  {processingIds.has(project.id) ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3" />
                  )}
                  Approve
                </button>
                <button
                  onClick={() => router.push('/maintenance?tab=dashboard')}
                  className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 text-xs font-medium hover:border-slate-300 hover:bg-slate-100 active:scale-[0.97] transition-[background-color,border-color,transform] duration-200 cursor-pointer"
                >
                  Details
                </button>
              </div>
            </div>
          )
        })}
        {requests.length > 2 && (
          <button
            onClick={() => router.push('/maintenance?tab=dashboard')}
            className="w-full flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium text-amber-700 transition-colors duration-200 hover:bg-amber-100 hover:text-amber-950 cursor-pointer"
          >
            +{requests.length - 2} more request{requests.length - 2 !== 1 ? 's' : ''}
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </motion.div>
  )
}
