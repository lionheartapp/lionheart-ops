'use client'

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stats row — 6 cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="ui-glass p-5 rounded-2xl">
            <div className="w-9 h-9 rounded-xl bg-gray-100 mb-3" />
            <div className="h-8 bg-gray-100 rounded w-16 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-20" />
          </div>
        ))}
      </div>
      {/* Two-column panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className="ui-glass p-5 rounded-2xl h-52" />
          <div className="ui-glass p-5 rounded-2xl h-52" />
        </div>
        <div className="space-y-4">
          <div className="ui-glass p-5 rounded-2xl h-44" />
          <div className="ui-glass p-5 rounded-2xl h-28" />
          <div className="ui-glass p-5 rounded-2xl h-28" />
        </div>
      </div>
      {/* Bottom row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="ui-glass p-5 rounded-2xl h-48" />
        <div className="ui-glass p-5 rounded-2xl h-48" />
      </div>
    </div>
  )
}

export function TicketsListSkeleton() {
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex gap-3 animate-pulse">
        <div className="h-10 w-64 bg-gray-200 rounded-lg" />
        <div className="h-10 w-32 bg-gray-200 rounded-lg" />
        <div className="h-10 w-32 bg-gray-200 rounded-lg" />
      </div>
      {/* Table */}
      <div className="ui-glass-table animate-pulse">
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <div className="h-4 w-16 bg-gray-100 rounded" />
              <div className="h-4 flex-1 bg-gray-100 rounded" />
              <div className="h-5 w-20 bg-gray-100 rounded-md" />
              <div className="h-5 w-16 bg-gray-100 rounded-md" />
              <div className="h-6 w-6 bg-gray-100 rounded-full" />
              <div className="h-4 w-20 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function BoardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((col) => (
        <div key={col} className="ui-glass p-4 animate-pulse">
          <div className="h-5 w-24 bg-gray-200 rounded mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((card) => (
              <div key={card} className="p-3 bg-gray-50 rounded-xl space-y-2">
                <div className="h-3 w-16 bg-gray-200 rounded" />
                <div className="h-4 w-full bg-gray-200 rounded" />
                <div className="flex gap-2">
                  <div className="h-5 w-14 bg-gray-100 rounded-md" />
                  <div className="h-5 w-14 bg-gray-100 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
