'use client'

export function TeamSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 animate-pulse" />
          <div>
            <div className="w-32 h-4 bg-slate-100 animate-pulse rounded" />
            <div className="w-48 h-3 bg-slate-100 animate-pulse rounded mt-1" />
          </div>
        </div>
        <div className="w-32 h-10 bg-slate-100 animate-pulse rounded-full" />
      </div>
      <div className="ui-glass-table">
        <div className="px-4 py-3 border-b border-gray-200 flex gap-8">
          <div className="w-40 h-3 bg-slate-100 animate-pulse rounded" />
          <div className="w-16 h-3 bg-slate-100 animate-pulse rounded" />
          <div className="w-20 h-3 bg-slate-100 animate-pulse rounded hidden sm:block" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-3 border-b border-gray-50">
            <div className="w-9 h-9 rounded-full bg-slate-100 animate-pulse flex-shrink-0" />
            <div className="flex-1">
              <div className="w-28 h-4 bg-slate-100 animate-pulse rounded" />
              <div className="w-40 h-3 bg-slate-100 animate-pulse rounded mt-1" />
            </div>
            <div className="w-20 h-5 bg-slate-100 animate-pulse rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
