'use client'

export function BillingTabSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Current plan skeleton */}
      <div className="bg-gradient-to-br from-primary-50/80 to-primary-100/80 border border-primary-200/30 rounded-2xl p-6 h-36" />
      {/* Plan cards skeleton */}
      <div>
        <div className="h-6 w-40 bg-slate-200 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 h-52" />
          ))}
        </div>
      </div>
      {/* Invoice table skeleton */}
      <div>
        <div className="h-6 w-40 bg-slate-200 rounded mb-4" />
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 border-b border-slate-100 px-6 flex items-center gap-4">
              <div className="h-4 w-24 bg-slate-200 rounded" />
              <div className="h-4 flex-1 bg-slate-100 rounded" />
              <div className="h-4 w-16 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
