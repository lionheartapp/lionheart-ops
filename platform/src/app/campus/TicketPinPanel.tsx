'use client'

import { useEffect, useState } from 'react'

type PinInfo = {
  roomId: string
  roomName: string
  ticketIds: string[]
  ticketTitles: string[]
}

type ScheduleData = {
  teacher: {
    id: string
    name: string | null
    imageUrl: string | null
  } | null
  status: string
}

export function TicketPinPanel({
  pin,
  onClose,
}: {
  pin: PinInfo
  onClose: () => void
}) {
  const [schedule, setSchedule] = useState<ScheduleData | null>(null)

  useEffect(() => {
    fetch(`/api/room/${pin.roomId}/schedule`)
      .then((r) => r.json())
      .then(setSchedule)
      .catch(() =>
        setSchedule({ teacher: null, status: 'No schedule data available' })
      )
  }, [pin.roomId])

  return (
    <aside
      className="absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-xl overflow-y-auto z-10"
      role="complementary"
      aria-label="Ticket details"
    >
      <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
          {pin.roomName}
        </h2>
        <button
          onClick={onClose}
          className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded"
          aria-label="Close panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-4 space-y-4">
        {/* Maintenance tickets */}
        <section>
          <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
            Maintenance Tickets
          </h3>
          <ul className="space-y-2">
            {pin.ticketTitles.map((title, i) => (
              <li
                key={pin.ticketIds[i] ?? i}
                className="flex items-center gap-2 text-sm"
              >
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <span className="text-zinc-700 dark:text-zinc-300">{title}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Teacher & schedule */}
        <section>
          <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
            Room Status
          </h3>
          {schedule?.teacher ? (
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700 shrink-0">
                {schedule.teacher.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={schedule.teacher.imageUrl}
                    alt={schedule.teacher.name ?? 'Teacher'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg font-medium text-zinc-500">
                    {schedule.teacher.name?.[0] ?? '?'}
                  </div>
                )}
              </div>
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {schedule.teacher.name ?? 'Unknown'}
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {schedule.status}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {schedule?.status ?? 'Loading...'}
            </p>
          )}
        </section>
      </div>
    </aside>
  )
}
