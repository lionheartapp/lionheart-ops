'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CampusMapViewer } from './CampusMapViewer'

export function CampusPageClient() {
  const searchParams = useSearchParams()
  const roomId = searchParams.get('roomId')

  return (
    <main className="flex min-h-screen flex-col bg-zinc-100 dark:bg-zinc-900">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-6 py-4 flex items-center gap-6">
        <Link
          href="/"
          className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 text-sm"
        >
          ← Back
        </Link>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Campus Map
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {roomId ? 'Viewing room from search' : '360° virtual tour — Red pins = maintenance tickets'}
        </p>
      </header>
      <CampusMapViewer initialRoomId={roomId ?? undefined} />
    </main>
  )
}
