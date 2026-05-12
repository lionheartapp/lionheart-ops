/**
 * Minimal loading skeleton for hub pages.
 * Uses transparent backgrounds to blend with the warm gradient layout
 * and avoid white flashes during navigation.
 */
export default function HubPageSkeleton() {
  return (
    <div className="p-6 sm:px-10 pt-6 lg:pt-8">
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-48 bg-black/5 rounded animate-pulse" />
        <div className="h-10 w-28 bg-black/5 rounded-full animate-pulse" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-black/[0.03] border border-black/5 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  )
}
