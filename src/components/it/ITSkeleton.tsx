'use client'

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="ui-glass p-4 animate-pulse">
            <div className="h-3 w-16 bg-gray-200 rounded mb-3" />
            <div className="h-8 w-12 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
      {/* Recent tickets */}
      <div className="ui-glass p-6 animate-pulse">
        <div className="h-5 w-32 bg-gray-200 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 w-16 bg-gray-100 rounded" />
              <div className="h-4 w-48 bg-gray-100 rounded flex-1" />
              <div className="h-5 w-16 bg-gray-100 rounded-md" />
            </div>
          ))}
        </div>
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
