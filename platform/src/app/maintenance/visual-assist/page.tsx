import Link from 'next/link'
import { VisualAssistClient } from './VisualAssistClient'

export default function VisualAssistPage() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4 flex items-center gap-6">
        <Link
          href="/"
          className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 text-sm"
        >
          ← Back
        </Link>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Visual AI — Repair Assistant
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Upload a photo of a broken part for identification and repair steps.
        </p>
      </header>
      <VisualAssistClient />
    </main>
  )
}
