/**
 * F-005 + F-019: maintenance module loading shell.
 */
export default function MaintenanceLoading() {
  return (
    <div className="p-6 space-y-4">
      <div className="h-8 w-40 bg-slate-200 rounded animate-pulse" />
      <div className="h-4 w-72 bg-slate-100 rounded animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  )
}
