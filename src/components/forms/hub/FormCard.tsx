'use client'

import { ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface FormCardProps {
  icon: LucideIcon
  label: string
  description: string
  fieldCount: number
  pageCount: number
  submissionCount: number
  isSystem?: boolean
  onClick: () => void
}

export default function FormCard({
  icon: Icon,
  label,
  description,
  fieldCount,
  pageCount,
  submissionCount,
  isSystem,
  onClick,
}: FormCardProps) {
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

        {/* Arrow */}
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0" />
      </div>
    </button>
  )
}
