'use client'

import { useState, useEffect } from 'react'

type User = { id: string; name: string | null; email: string; role: string; canSubmitEvents: boolean }

export function UserPermissionsClient() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }, [])

  const toggleCanSubmit = async (userId: string, value: boolean) => {
    const res = await fetch('/api/admin/users/' + userId + '/can-submit', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canSubmitEvents: value }),
    })
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, canSubmitEvents: value } : u))
      )
    }
  }

  const teachers = users.filter((u) => u.role === 'TEACHER')
  const admins = users.filter((u) => u.role === 'ADMIN' || u.role === 'SITE_SECRETARY')

  if (loading) return <div className="p-6 text-zinc-500">Loading…</div>

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">
          Teachers — Event submission access
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          Admins and Site Secretaries can always submit. Teachers need this permission granted.
        </p>
        {teachers.length === 0 ? (
          <p className="text-sm text-zinc-500 italic">No teachers in database. Seed users to see them here.</p>
        ) : (
          <ul className="space-y-3">
            {teachers.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-3 py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
              >
                <span className="flex-1 font-medium text-zinc-900 dark:text-zinc-100">
                  {u.name || u.email}
                </span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={u.canSubmitEvents}
                    onChange={(e) => toggleCanSubmit(u.id, e.target.checked)}
                    className="rounded border-zinc-300"
                  />
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    Can submit events
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>
      {admins.length > 0 && (
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">
            Admins & Site Secretaries
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            These roles can always submit event requests.
          </p>
          <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            {admins.map((u) => (
              <li key={u.id}>{u.name || u.email} ({u.role})</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
