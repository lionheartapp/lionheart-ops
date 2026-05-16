export default function FormsLoading() {
  return (
    <div className="px-4 sm:px-8 py-6 space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-9 w-28 bg-slate-200 rounded-full animate-pulse" />
      </div>

      {/* Section skeleton */}
      <div className="space-y-3">
        <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 animate-pulse">
            <div className="w-10 h-10 rounded-lg bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 bg-slate-200 rounded" />
              <div className="h-3 w-60 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Second section skeleton */}
      <div className="space-y-3">
        <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
        {[1, 2].map((i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 animate-pulse">
            <div className="w-10 h-10 rounded-lg bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-36 bg-slate-200 rounded" />
              <div className="h-3 w-48 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
