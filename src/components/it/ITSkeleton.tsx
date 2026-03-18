'use client'

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stats row — 6 cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="ui-glass p-5 rounded-2xl">
            <div className="w-9 h-9 rounded-xl bg-slate-100 mb-3" />
            <div className="h-8 bg-slate-100 rounded w-16 mb-2" />
            <div className="h-3 bg-slate-100 rounded w-20" />
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
        <div className="h-10 w-64 bg-slate-200 rounded-lg" />
        <div className="h-10 w-32 bg-slate-200 rounded-lg" />
        <div className="h-10 w-32 bg-slate-200 rounded-lg" />
      </div>
      {/* Table */}
      <div className="ui-glass-table animate-pulse">
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <div className="h-4 w-16 bg-slate-100 rounded" />
              <div className="h-4 flex-1 bg-slate-100 rounded" />
              <div className="h-5 w-20 bg-slate-100 rounded-md" />
              <div className="h-5 w-16 bg-slate-100 rounded-md" />
              <div className="h-6 w-6 bg-slate-100 rounded-full" />
              <div className="h-4 w-20 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function DevicesTabSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3 animate-pulse">
        <div className="h-10 w-64 bg-slate-200 rounded-lg" />
        <div className="h-10 w-32 bg-slate-200 rounded-lg" />
        <div className="h-10 w-32 bg-slate-200 rounded-lg" />
        <div className="h-10 w-28 bg-slate-200 rounded-full" />
      </div>
      <div className="ui-glass-table animate-pulse">
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <div className="h-4 w-4 bg-slate-100 rounded" />
              <div className="h-4 w-20 bg-slate-100 rounded" />
              <div className="h-5 w-16 bg-slate-100 rounded-md" />
              <div className="h-4 flex-1 bg-slate-100 rounded" />
              <div className="h-5 w-16 bg-slate-100 rounded-md" />
              <div className="h-4 w-24 bg-slate-100 rounded" />
              <div className="h-4 w-24 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function StudentsTabSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3 animate-pulse">
        <div className="h-10 w-64 bg-slate-200 rounded-lg" />
        <div className="h-10 w-32 bg-slate-200 rounded-lg" />
        <div className="h-10 w-32 bg-slate-200 rounded-lg" />
        <div className="h-10 w-28 bg-slate-200 rounded-full" />
      </div>
      <div className="ui-glass-table animate-pulse">
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <div className="h-4 flex-1 bg-slate-100 rounded" />
              <div className="h-4 w-20 bg-slate-100 rounded" />
              <div className="h-4 w-12 bg-slate-100 rounded" />
              <div className="h-4 w-24 bg-slate-100 rounded" />
              <div className="h-5 w-16 bg-slate-100 rounded-md" />
              <div className="h-5 w-8 bg-slate-100 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function LoanersTabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="ui-glass p-5 rounded-2xl">
            <div className="h-4 w-24 bg-slate-100 rounded mb-3" />
            <div className="h-8 w-12 bg-slate-100 rounded mb-2" />
            <div className="h-3 w-20 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
      <div className="ui-glass-table">
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <div className="h-4 w-20 bg-slate-100 rounded" />
              <div className="h-4 flex-1 bg-slate-100 rounded" />
              <div className="h-5 w-16 bg-slate-100 rounded-md" />
              <div className="h-4 w-24 bg-slate-100 rounded" />
              <div className="h-8 w-20 bg-slate-100 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SyncTabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="ui-glass p-5 rounded-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 bg-slate-100 rounded-xl" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-slate-100 rounded mb-2" />
                <div className="h-3 w-48 bg-slate-100 rounded" />
              </div>
              <div className="h-6 w-12 bg-slate-100 rounded-full" />
            </div>
            <div className="h-8 w-24 bg-slate-100 rounded-full" />
          </div>
        ))}
      </div>
      <div className="ui-glass-table">
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <div className="h-5 w-16 bg-slate-100 rounded-md" />
              <div className="h-4 w-32 bg-slate-100 rounded" />
              <div className="h-4 w-20 bg-slate-100 rounded" />
              <div className="h-4 w-24 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function IntelligenceTabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="ui-glass p-5 rounded-2xl">
            <div className="h-4 w-24 bg-slate-100 rounded mb-3" />
            <div className="h-8 w-12 bg-slate-100 rounded mb-2" />
            <div className="h-3 w-20 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
      <div className="ui-glass-table">
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <div className="h-4 w-20 bg-slate-100 rounded" />
              <div className="h-4 flex-1 bg-slate-100 rounded" />
              <div className="h-5 w-16 bg-slate-100 rounded-md" />
              <div className="h-4 w-24 bg-slate-100 rounded" />
              <div className="h-4 w-20 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ERateSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-9 w-40 bg-slate-200 rounded-lg" />
        <div className="flex gap-3">
          <div className="h-10 w-32 bg-slate-200 rounded-full" />
          <div className="h-10 w-40 bg-slate-200 rounded-full" />
        </div>
      </div>
      <div className="ui-glass p-5 rounded-2xl">
        <div className="h-4 w-32 bg-slate-200 rounded mb-3" />
        <div className="h-3 w-full bg-slate-100 rounded-full" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="ui-glass p-4 rounded-2xl flex items-center gap-4">
            <div className="w-3 h-3 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 bg-slate-200 rounded" />
              <div className="h-3 w-64 bg-slate-100 rounded" />
            </div>
            <div className="h-3 w-20 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ContentFiltersSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="ui-glass p-5 rounded-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-slate-200" />
              <div className="h-5 w-28 bg-slate-200 rounded" />
            </div>
            <div className="h-3 w-20 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="ui-glass p-4 rounded-2xl">
            <div className="h-3 w-16 bg-slate-200 rounded mb-2" />
            <div className="h-7 w-12 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
      <div className="ui-glass-table rounded-2xl p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 bg-slate-100 rounded" />
        ))}
      </div>
    </div>
  )
}

export function SecurityIncidentsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <div className="h-10 w-64 bg-slate-200 rounded-xl" />
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-16 bg-slate-100 rounded-lg" />
            ))}
          </div>
          <div className="h-10 w-32 bg-slate-200 rounded-xl" />
        </div>
        <div className="h-10 w-36 bg-slate-200 rounded-full" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="ui-glass p-4 text-center">
            <div className="w-9 h-9 rounded-xl bg-slate-100 mx-auto mb-2" />
            <div className="h-7 w-12 bg-slate-100 rounded mx-auto mb-1" />
            <div className="h-3 w-20 bg-slate-100 rounded mx-auto" />
          </div>
        ))}
      </div>
      <div className="ui-glass-table p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 py-2">
            <div className="h-4 w-20 bg-slate-100 rounded" />
            <div className="h-4 flex-1 bg-slate-100 rounded" />
            <div className="h-5 w-20 bg-slate-100 rounded-md" />
            <div className="h-5 w-16 bg-slate-100 rounded-md" />
            <div className="h-4 w-24 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function BoardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((col) => (
        <div key={col} className="ui-glass p-4 animate-pulse">
          <div className="h-5 w-24 bg-slate-200 rounded mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((card) => (
              <div key={card} className="p-3 bg-slate-50 rounded-xl space-y-2">
                <div className="h-3 w-16 bg-slate-200 rounded" />
                <div className="h-4 w-full bg-slate-200 rounded" />
                <div className="flex gap-2">
                  <div className="h-5 w-14 bg-slate-100 rounded-md" />
                  <div className="h-5 w-14 bg-slate-100 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
