const HOUR_HEIGHT = 64

// ─── Week View Skeletons ─────────────────────────────────────────────

const WEEK_SKELETON_BLOCKS = [
  { day: 0, hour: 9, duration: 1.5 },
  { day: 1, hour: 10, duration: 1 },
  { day: 1, hour: 14, duration: 0.75 },
  { day: 2, hour: 9.5, duration: 2 },
  { day: 3, hour: 11, duration: 1 },
  { day: 4, hour: 13, duration: 1.5 },
  { day: 5, hour: 10, duration: 0.75 },
  { day: 6, hour: 15, duration: 1 },
]

export function WeekViewSkeletons() {
  return (
    <>
      {WEEK_SKELETON_BLOCKS.map((block, i) => (
        <div
          key={i}
          className="absolute rounded-xl bg-slate-100 animate-pulse"
          style={{
            top: block.hour * HOUR_HEIGHT,
            height: block.duration * HOUR_HEIGHT,
            left: `calc(${(block.day / 7) * 100}% + 4px)`,
            width: `calc(${100 / 7}% - 8px)`,
          }}
        />
      ))}
    </>
  )
}

// ─── Day View Skeletons ──────────────────────────────────────────────

const DAY_SKELETON_BLOCKS = [
  { hour: 9, duration: 1.5 },
  { hour: 11, duration: 1 },
  { hour: 13.5, duration: 0.75 },
  { hour: 15, duration: 1.5 },
  { hour: 17, duration: 1 },
]

export function DayViewSkeletons() {
  return (
    <>
      {DAY_SKELETON_BLOCKS.map((block, i) => (
        <div
          key={i}
          className="absolute left-1 right-4 rounded-xl bg-slate-100 animate-pulse"
          style={{
            top: block.hour * HOUR_HEIGHT,
            height: block.duration * HOUR_HEIGHT,
          }}
        />
      ))}
    </>
  )
}

// ─── Month View Skeletons ────────────────────────────────────────────

export function MonthViewSkeletons({ weeks }: { weeks: number }) {
  return (
    <>
      {Array.from({ length: weeks }, (_, wi) =>
        Array.from({ length: 7 }, (_, di) => {
          const seed = wi * 7 + di
          const count = seed % 3 // 0, 1, or 2 pills per cell
          if (count === 0) return null
          return Array.from({ length: count }, (_, pi) => (
            <div
              key={`${wi}-${di}-${pi}`}
              className="h-5 rounded-md bg-slate-100 animate-pulse"
              style={{
                gridColumn: di + 1,
                gridRow: wi + 1,
                marginTop: `${28 + pi * 24}px`,
                marginLeft: '4px',
                marginRight: '4px',
                width: `${60 + ((seed + pi) % 3) * 15}%`,
              }}
            />
          ))
        })
      )}
    </>
  )
}

// ─── Agenda View Skeletons ───────────────────────────────────────────

export function AgendaViewSkeletons() {
  return (
    <div className="space-y-2 px-4 sm:px-10 pt-4">
      {/* Date header skeleton */}
      <div className="h-5 w-40 rounded bg-slate-100 animate-pulse mb-3" />

      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="p-3 rounded-lg border border-slate-100 flex gap-3">
          {/* Color bar */}
          <div className="w-1 rounded-full bg-slate-100 animate-pulse self-stretch" />
          <div className="flex-1 space-y-2">
            {/* Title */}
            <div className="h-4 rounded bg-slate-100 animate-pulse" style={{ width: `${55 + (i % 3) * 15}%` }} />
            {/* Time */}
            <div className="h-3.5 w-32 rounded bg-slate-100 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Mobile Month View Skeletons ─────────────────────────────────────

export function MobileMonthViewSkeletons() {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="p-3 rounded-lg border border-slate-100 flex gap-3">
          <div className="w-1 rounded-full bg-slate-100 animate-pulse self-stretch" />
          <div className="flex-1 space-y-2">
            <div className="h-4 rounded bg-slate-100 animate-pulse" style={{ width: `${50 + (i % 3) * 20}%` }} />
            <div className="h-3.5 w-28 rounded bg-slate-100 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}
