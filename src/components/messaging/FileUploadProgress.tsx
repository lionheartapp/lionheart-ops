'use client'

import { X, File } from 'lucide-react'

interface FileUploadProgressProps {
  fileName: string
  progress: number
  onCancel: () => void
}

export default function FileUploadProgress({ fileName, progress, onCancel }: FileUploadProgressProps) {
  return (
    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-2">
      <File className="w-4 h-4 text-slate-400 flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-600 truncate">{fileName}</p>
        <div className="mt-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <span className="text-xs text-slate-400 flex-shrink-0 tabular-nums">
        {progress}%
      </span>

      <button
        type="button"
        onClick={onCancel}
        className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        aria-label="Cancel upload"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
