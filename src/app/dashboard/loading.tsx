/**
 * F-005 + F-019: dashboard loading shell so the first paint is never blank.
 */
export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden md:flex w-60 flex-col gap-2 p-4 border-r border-slate-200 bg-white">
        <div className="h-8 w-32 bg-slate-100 rounded animate-pulse" />
        <div className="space-y-1.5 mt-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-9 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </aside>
      <main className="flex-1 p-6">
        <div className="h-8 w-40 bg-slate-200 rounded mb-2 animate-pulse" />
        <div className="h-4 w-56 bg-slate-100 rounded mb-6 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  )
}
