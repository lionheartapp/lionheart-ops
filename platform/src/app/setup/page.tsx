'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

function setupFetch(orgId: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('x-org-id', orgId)
  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(path, { ...init, headers })
}

function SetupContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('orgId')
  const [buildingName, setBuildingName] = useState('')
  const [roomName, setRoomName] = useState('')
  const [buildings, setBuildings] = useState<{ id: string; name: string }[]>([])
  const [selectedBuildingId, setSelectedBuildingId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [buildingCreated, setBuildingCreated] = useState(false)
  const [roomCreated, setRoomCreated] = useState(false)

  useEffect(() => {
    if (!orgId) return
    setupFetch(orgId, '/api/buildings')
      .then((r) => r.json())
      .then((data) => (Array.isArray(data) ? setBuildings(data) : setBuildings(data?.buildings || [])))
      .catch(() => setBuildings([]))
  }, [orgId, buildingCreated])

  if (!orgId) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="text-center text-zinc-400">
          <p className="text-lg">Missing organization. Please complete signup first.</p>
          <a
            href={(process.env.NEXT_PUBLIC_LIONHEART_URL || 'http://localhost:5173') + '/signup'}
            className="mt-4 inline-block text-emerald-500 hover:underline"
          >
            Go to signup →
          </a>
        </div>
      </div>
    )
  }

  const handleAddBuilding = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!buildingName.trim() || !orgId) return
    setLoading(true)
    setError('')
    try {
      const res = await setupFetch(orgId, '/api/buildings', {
        method: 'POST',
        body: JSON.stringify({ name: buildingName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      setBuildingCreated(true)
      setBuildingName('')
      setSelectedBuildingId(data.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomName.trim() || !selectedBuildingId || !orgId) return
    setLoading(true)
    setError('')
    try {
      const res = await setupFetch(orgId, '/api/rooms', {
        method: 'POST',
        body: JSON.stringify({ name: roomName.trim(), buildingId: selectedBuildingId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      setRoomCreated(true)
      setRoomName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Setup your school</h1>
        <p className="text-zinc-400 text-sm mb-8">
          Add your first building and room to get started.
        </p>

        <section className="mb-8">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">1. Add a building</h2>
          <form onSubmit={handleAddBuilding} className="flex gap-2">
            <input
              type="text"
              value={buildingName}
              onChange={(e) => setBuildingName(e.target.value)}
              placeholder="e.g. Main Building"
              className="flex-1 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white"
            />
            <button
              type="submit"
              disabled={loading || !buildingName.trim()}
              className="px-4 py-2 rounded-lg bg-emerald-500 text-white font-medium disabled:opacity-50"
            >
              Add
            </button>
          </form>
          {buildings.length > 0 && (
            <p className="mt-2 text-sm text-zinc-500">
              Buildings: {buildings.map((b) => b.name).join(', ')}
            </p>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">2. Add a room</h2>
          <form onSubmit={handleAddRoom} className="space-y-2">
            <select
              value={selectedBuildingId}
              onChange={(e) => setSelectedBuildingId(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white"
            >
              <option value="">— Select building —</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="e.g. Room 101"
                className="flex-1 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white"
              />
              <button
                type="submit"
                disabled={loading || !roomName.trim() || !selectedBuildingId}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-white font-medium disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </form>
        </section>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {(buildingCreated || roomCreated) && (
          <div className="mt-8 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <p className="text-emerald-400 font-medium">You&apos;re all set!</p>
            <p className="text-sm text-zinc-400 mt-1">
              Update your .env with <code className="text-zinc-300">VITE_CURRENT_ORG_ID={orgId}</code> to use this org in Lionheart.
            </p>
            <a
              href="/"
              className="mt-4 inline-block px-4 py-2 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600"
            >
              Platform home →
            </a>
            <p className="mt-3 text-xs text-zinc-500">
              In Lionheart, set VITE_CURRENT_ORG_ID to your new org ID and go to /app
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center"><p className="text-zinc-400">Loading…</p></div>}>
      <SetupContent />
    </Suspense>
  )
}
