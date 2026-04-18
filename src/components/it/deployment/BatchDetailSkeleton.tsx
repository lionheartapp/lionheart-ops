'use client'

export function BatchDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 bg-slate-200 rounded-lg" />
        <div className="h-6 w-48 bg-slate-200 rounded" />
        <div className="h-6 w-20 bg-slate-200 rounded-full" />
      </div>
      {/* Progress bar */}
      <div className="ui-glass p-5 rounded-2xl space-y-3">
        <div className="h-4 w-32 bg-slate-100 rounded" />
        <div className="h-2 w-full bg-slate-100 rounded-full" />
        <div className="flex gap-4">
          <div className="h-4 w-20 bg-slate-100 rounded" />
          <div className="h-4 w-20 bg-slate-100 rounded" />
          <div className="h-4 w-20 bg-slate-100 rounded" />
        </div>
      </div>
      {/* Actions */}
      <div className="flex gap-3">
        <div className="h-10 w-28 bg-slate-200 rounded-full" />
        <div className="h-10 w-28 bg-slate-200 rounded-full" />
      </div>
      {/* Table */}
      <div className="ui-glass-table">
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <div className="h-4 w-20 bg-slate-100 rounded" />
              <div className="h-4 w-16 bg-slate-100 rounded" />
              <div className="h-4 flex-1 bg-slate-100 rounded" />
              <div className="h-4 w-24 bg-slate-100 rounded" />
              <div className="h-8 w-20 bg-slate-100 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
