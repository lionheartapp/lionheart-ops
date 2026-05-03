/**
 * F-005 + F-006: work orders loading shell prevents the blank-page flash
 * (and the wrong-scroll-position symptom that came with it).
 */
export default function WorkOrdersLoading() {
  return (
    <div className="p-6 space-y-4">
      <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
      <div className="h-4 w-72 bg-slate-100 rounded animate-pulse" />
      <div className="space-y-2 mt-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 bg-white border border-slate-200 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  )
}
