import Link from 'next/link'
import { UserPermissionsClient } from './UserPermissionsClient'

export default function AdminUsersPage() {
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
          User Permissions
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Grant event submission access to specific teachers.
        </p>
      </header>
      <UserPermissionsClient />
    </main>
  )
}
