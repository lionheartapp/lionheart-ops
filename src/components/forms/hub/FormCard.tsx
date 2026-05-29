'use client'

import { ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { OptimizedImage } from '@/components/ui/OptimizedImage'

interface FormCardProps {
  icon: LucideIcon
  label: string
  description: string
  fieldCount: number
  pageCount: number
  submissionCount: number
  isSystem?: boolean
  updatedAt?: string
  updatedBy?: { firstName: string | null; lastName: string | null; avatar: string | null } | null
  onClick: () => void
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function FormCard({
  icon: Icon,
  label,
  description,
  fieldCount,
  pageCount,
  submissionCount,
  isSystem,
  updatedAt,
  updatedBy,
  onClick,
}: FormCardProps) {
  const editorName = updatedBy
    ? `${updatedBy.firstName ?? ''} ${updatedBy.lastName ?? ''}`.trim()
    : null

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-sm transition-all duration-200 cursor-pointer text-left"
    >
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isSystem ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
        }`}>
          <Icon className="w-5 h-5" strokeWidth={1.5} />
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{label}</p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{description}</p>
        </div>

        {/* Meta */}
        <div className="hidden sm:flex items-center gap-3 text-[10px] text-slate-400 flex-shrink-0">
          {pageCount > 1 && (
            <span>{pageCount} pages</span>
          )}
          <span>{fieldCount} fields</span>
          {submissionCount > 0 && (
            <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full font-medium">
              {submissionCount} response{submissionCount === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {/* Last edited */}
        {updatedAt && (
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            {updatedBy?.avatar ? (
              <OptimizedImage src={updatedBy.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
            ) : editorName ? (
              <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-medium text-slate-500">
                {editorName.charAt(0)}
              </div>
            ) : null}
            <div className="flex flex-col items-end">
              {editorName && <span className="text-[10px] text-slate-500 font-medium leading-tight">{editorName}</span>}
              <span className="text-[10px] text-slate-400 leading-tight">{timeAgo(updatedAt)}</span>
            </div>
          </div>
        )}

        {/* Arrow */}
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0" />
      </div>
    </button>
  )
}
