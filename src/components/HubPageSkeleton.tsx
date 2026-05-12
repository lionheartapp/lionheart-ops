/**
 * Reusable loading skeleton for hub pages (events, maintenance, IT, etc.)
 * Renders a sidebar placeholder + content area with card placeholders.
 */
export default function HubPageSkeleton() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden md:flex w-60 flex-col gap-2 p-4 border-r border-slate-200 bg-white">
        <div className="h-8 w-32 bg-slate-100 rounded animate-pulse" />
        <div className="space-y-1.5 mt-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </aside>
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
          <div className="h-10 w-28 bg-slate-100 rounded-full animate-pulse" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  )
}
