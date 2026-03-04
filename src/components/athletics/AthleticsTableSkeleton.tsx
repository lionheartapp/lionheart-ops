'use client'

/**
 * Skeleton loading component for athletics table sections.
 * Mimics a toolbar + table layout with animated shimmer effect.
 */
export default function AthleticsTableSkeleton({
  columns = 5,
  rows = 5,
  showToolbar = true,
}: {
  columns?: number
  rows?: number
  showToolbar?: boolean
}) {
  return (
    <div className="space-y-4">
      {/* Toolbar skeleton */}
      {showToolbar && (
        <div className="flex items-center gap-3">
          <div className="h-[46px] w-64 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-[46px] w-32 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      )}

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {/* Header row */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
          {Array.from({ length: columns }).map((_, i) => (
            <div
              key={i}
              className="h-3 rounded bg-gray-200/70 animate-pulse"
              style={{ width: `${i === 0 ? 28 : 12 + Math.random() * 10}%` }}
            />
          ))}
        </div>

        {/* Data rows */}
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div
            key={rowIdx}
            className="flex items-center gap-4 px-4 py-3.5 border-b border-gray-50 last:border-b-0"
          >
            {Array.from({ length: columns }).map((_, colIdx) => (
              <div key={colIdx} className="flex items-center gap-2" style={{ width: `${colIdx === 0 ? 28 : 12 + Math.random() * 10}%` }}>
                {colIdx === 0 && (
                  <div className="w-3 h-3 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                )}
                <div
                  className="h-3.5 rounded bg-gray-100 animate-pulse"
                  style={{
                    width: `${55 + Math.random() * 40}%`,
                    animationDelay: `${rowIdx * 75}ms`,
                  }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Skeleton for schedule/agenda-style sections with date groups.
 */
export function ScheduleSkeleton({ groups = 3 }: { groups?: number }) {
  return (
    <div className="space-y-4">
      {/* Toolbar skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-[46px] w-56 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-9 w-48 bg-gray-100 rounded-lg animate-pulse" />
      </div>

      {/* Agenda groups */}
      {Array.from({ length: groups }).map((_, groupIdx) => (
        <div key={groupIdx} className="space-y-2">
          {/* Date header */}
          <div className="h-4 w-40 bg-gray-200/60 rounded animate-pulse" style={{ animationDelay: `${groupIdx * 100}ms` }} />

          {/* Event cards */}
          {Array.from({ length: 2 + Math.floor(Math.random() * 2) }).map((_, cardIdx) => (
            <div
              key={cardIdx}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-white"
            >
              <div className="w-1 h-10 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-3/5 bg-gray-100 rounded animate-pulse" style={{ animationDelay: `${(groupIdx * 3 + cardIdx) * 75}ms` }} />
                <div className="h-3 w-2/5 bg-gray-50 rounded animate-pulse" style={{ animationDelay: `${(groupIdx * 3 + cardIdx) * 75 + 50}ms` }} />
              </div>
              <div className="h-6 w-14 bg-gray-50 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
