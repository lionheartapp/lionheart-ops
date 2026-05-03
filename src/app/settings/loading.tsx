/**
 * F-005 + F-019: Settings page loading shell.
 *
 * Next.js App Router automatically renders this during the server-rendered
 * suspense boundary so the user never sees a blank page during navigation
 * to /settings or any of its sub-tabs.
 *
 * The shape mirrors the final layout: header strip + sidebar nav + content
 * card. animate-pulse provides the standard skeleton shimmer.
 */
export default function SettingsLoading() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar placeholder */}
      <aside className="hidden md:flex w-60 flex-col gap-2 p-4 border-r border-slate-200 bg-white">
        <div className="h-8 w-32 bg-slate-100 rounded animate-pulse" />
        <div className="space-y-1.5 mt-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </aside>

      {/* Main content placeholder */}
      <main className="flex-1 p-6 max-w-4xl">
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="h-7 w-48 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-72 bg-slate-100 rounded animate-pulse" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-white border border-slate-200 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
