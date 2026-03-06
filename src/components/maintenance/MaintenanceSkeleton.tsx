'use client'

/**
 * Loading skeleton for the Maintenance command center dashboard.
 * Mimics the full dashboard layout with animated shimmer effect.
 */
export default function MaintenanceSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-56 bg-gray-200 rounded-lg" />
        <div className="h-4 w-80 bg-gray-100 rounded" />
      </div>

      {/* Stat cards row — 4 across on lg, 2 on md, 1 on sm */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="ui-glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-gray-200" />
              <div className="h-5 w-12 bg-gray-100 rounded-full" />
            </div>
            <div className="h-8 w-16 bg-gray-200 rounded mb-1" />
            <div className="h-3.5 w-24 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Two-column panels grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-4">
          {/* Tickets by Status panel */}
          <div className="ui-glass rounded-2xl p-5">
            <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
            <div className="space-y-2.5">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-3 w-20 bg-gray-100 rounded flex-shrink-0" />
                  <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gray-200 rounded-full" style={{ width: '0%' }} />
                  </div>
                  <div className="h-3 w-4 bg-gray-100 rounded flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity panel */}
          <div className="ui-glass rounded-2xl p-5">
            <div className="h-5 w-36 bg-gray-200 rounded mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-4/5 bg-gray-100 rounded" />
                    <div className="h-3 w-2/5 bg-gray-50 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Campus Breakdown panel */}
          <div className="ui-glass rounded-2xl p-5">
            <div className="h-5 w-44 bg-gray-200 rounded mb-4" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 py-1.5">
                  <div className="h-4 w-32 bg-gray-100 rounded" />
                  <div className="ml-auto h-4 w-8 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Urgent/Overdue Alerts panel */}
          <div className="bg-gradient-to-br from-red-50/80 to-red-100/80 backdrop-blur-sm border border-red-200/30 rounded-2xl p-5">
            <div className="h-5 w-48 bg-red-200/50 rounded mb-4" />
            <div className="flex flex-col items-center justify-center py-6">
              <div className="w-12 h-12 rounded-full bg-red-100/70 mb-3" />
              <div className="h-4 w-36 bg-red-100/70 rounded mb-2" />
              <div className="h-3 w-24 bg-red-100/50 rounded" />
            </div>
          </div>

          {/* Technician Workload panel */}
          <div className="ui-glass rounded-2xl p-5">
            <div className="h-5 w-44 bg-gray-200 rounded mb-4" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 py-1.5">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex-shrink-0" />
                  <div className="h-4 w-28 bg-gray-100 rounded" />
                  <div className="ml-auto h-4 w-6 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* PM Calendar Preview panel */}
          <div className="ui-glass rounded-2xl p-5">
            <div className="h-5 w-44 bg-gray-200 rounded mb-4" />
            <div className="flex flex-col items-center justify-center py-6">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 mb-3" />
              <div className="h-4 w-48 bg-gray-100 rounded mb-2" />
              <div className="h-3 w-32 bg-gray-50 rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* Full-width bottom row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Cost Summary */}
        <div className="ui-glass rounded-2xl p-5">
          <div className="h-5 w-36 bg-gray-200 rounded mb-4" />
          <div className="flex flex-col items-center justify-center py-6">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 mb-3" />
            <div className="h-4 w-32 bg-gray-100 rounded mb-2" />
            <div className="h-3 w-24 bg-gray-50 rounded" />
          </div>
        </div>

        {/* Compliance Status */}
        <div className="ui-glass rounded-2xl p-5">
          <div className="h-5 w-44 bg-gray-200 rounded mb-4" />
          <div className="flex flex-col items-center justify-center py-6">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 mb-3" />
            <div className="h-4 w-48 bg-gray-100 rounded mb-2" />
            <div className="h-3 w-36 bg-gray-50 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}
