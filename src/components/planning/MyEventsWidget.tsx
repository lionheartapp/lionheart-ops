'use client'

import { useSubmissions } from '@/lib/hooks/usePlanningSeason'
import { CheckCircle, Clock, XCircle } from 'lucide-react'

interface MyEventsWidgetProps {
  seasonId: string
}

export default function MyEventsWidget({ seasonId }: MyEventsWidgetProps) {
  const { data: submissions = [] } = useSubmissions(seasonId)

  const approved = submissions.filter((s) => s.submissionStatus === 'APPROVED').length
  const pending = submissions.filter((s) => s.submissionStatus === 'DRAFT' || s.submissionStatus === 'SUBMITTED' || s.submissionStatus === 'IN_REVIEW').length
  const rejected = submissions.filter((s) => s.submissionStatus === 'REJECTED' || s.submissionStatus === 'REVISION_REQUESTED').length

  return (
    <div className="ui-glass p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">My Event Submissions</h3>
      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <span className="text-xl font-bold text-green-600">{approved}</span>
          <span className="text-xs text-slate-500">Approved</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <span className="text-xl font-bold text-amber-600">{pending}</span>
          <span className="text-xs text-slate-500">Awaiting</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
            <XCircle className="w-5 h-5 text-red-600" />
          </div>
          <span className="text-xl font-bold text-red-600">{rejected}</span>
          <span className="text-xs text-slate-500">Rejected</span>
        </div>
      </div>
    </div>
  )
}
