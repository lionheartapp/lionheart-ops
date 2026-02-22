'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/apiFetch'

type RoomData = {
  id: string
  name: string
  buildingName: string
  teacher?: { id: string; name: string | null; imageUrl?: string | null } | null
  tickets?: Array<{ id: string; title: string; status: string }>
}

type ScheduleData = {
  teacher: { id: string; name: string | null; imageUrl: string | null } | null
  status: string
}

export function RoomDetailPanel({
  roomId,
  onClose,
}: {
  roomId: string
  onClose: () => void
}) {
  const [room, setRoom] = useState<RoomData | null>(null)
  const [schedule, setSchedule] = useState<ScheduleData | null>(null)

  useEffect(() => {
    apiFetch(`/api/room/${roomId}`)
      .then((r) => r.json())
      .then(setRoom)
      .catch(() => setRoom(null))
  }, [roomId])

  useEffect(() => {
    if (!roomId) return
    apiFetch(`/api/room/${roomId}/schedule`)
      .then((r) => r.json())
      .then(setSchedule)
      .catch(() => setSchedule(null))
  }, [roomId])

  if (!room) return null

  const tickets = room.tickets ?? []
  const teacher = schedule?.teacher ?? room.teacher

  return (
    <aside
      className="absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-xl overflow-y-auto z-10"
      role="complementary"
      aria-label="Room details"
    >
      <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
          {room.name}
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
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{room.buildingName}</p>

        {tickets.length > 0 && (
          <section>
            <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
              Maintenance Tickets
            </h3>
            <ul className="space-y-2">
              {tickets.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  <span className="text-zinc-700 dark:text-zinc-300">{t.title}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
            Room Status
          </h3>
          {teacher ? (
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700 shrink-0">
                {teacher.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={teacher.imageUrl}
                    alt={teacher.name ?? 'Teacher'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg font-medium text-zinc-500">
                    {teacher.name?.[0] ?? '?'}
                  </div>
                )}
              </div>
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {teacher.name ?? 'Unknown'}
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {schedule?.status ?? 'Schedule'}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {schedule?.status ?? 'No schedule data'}
            </p>
          )}
        </section>
      </div>
    </aside>
  )
}
