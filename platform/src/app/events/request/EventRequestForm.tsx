'use client'

import { useState, useEffect } from 'react'

type Room = { id: string; name: string; building: { name: string; division: string | null } }
type Teacher = { id: string; name: string | null; email: string }
type ScheduleBlock = { startTime: string; endTime: string; subject: string | null; roomName: string | null }

export function EventRequestForm() {
  const [canSubmit, setCanSubmit] = useState(true)
  const [rawText, setRawText] = useState('')
  const [parsed, setParsed] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [rooms, setRooms] = useState<Room[]>([])
  const [teacherId, setTeacherId] = useState<string>('')
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [teacherBlocks, setTeacherBlocks] = useState<ScheduleBlock[]>([])
  const [conflicts, setConflicts] = useState<{ hasConflict: boolean; warnings: string[] } | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [selectedRoomId, setSelectedRoomId] = useState<string>('')

  useEffect(() => {
    fetch('/api/user/can-submit-events')
      .then((r) => r.json())
      .then((d) => setCanSubmit(d.canSubmit ?? true))
  }, [])

  useEffect(() => {
    fetch('/api/rooms')
      .then((r) => r.json())
      .then(setRooms)
      .catch(() => setRooms([]))
  }, [])

  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then(setTeachers)
      .catch(() => setTeachers([]))
  }, [])

  useEffect(() => {
    if (!teacherId) {
      setTeacherBlocks([])
      return
    }
    fetch(`/api/user/${teacherId}/schedule`)
      .then((r) => r.json())
      .then((d) => setTeacherBlocks(d.blocks || []))
      .catch(() => setTeacherBlocks([]))
  }, [teacherId])

  const handleParse = async () => {
    if (!rawText.trim()) return
    setLoading(true)
    setParsed(null)
    setConflicts(null)
    try {
      const res = await fetch('/api/events/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText.trim() }),
      })
      const data = await res.json()
      if (res.ok && data && typeof data === 'object') {
        setParsed(data)
      } else {
        setParsed({ error: data?.error || 'Parse failed' })
      }
    } catch {
      setParsed({ error: 'Request failed' })
    } finally {
      setLoading(false)
    }
  }

  const draft = (parsed || {}) as Record<string, unknown>
  const name = (draft.name as string) || ''
  const date = (draft.date as string) || ''
  const startTime = (draft.startTime as string) || ''
  const endTime = (draft.endTime as string) || ''
  const location = (draft.location as string) || ''
  const chairsRequested = (draft.chairsRequested as number) ?? 0
  const tablesRequested = (draft.tablesRequested as number) ?? 0

  const matchedRoom = rooms.find(
    (r) =>
      r.name.toLowerCase().includes((location || '').toLowerCase()) ||
      (location || '').toLowerCase().includes(r.name.toLowerCase())
  )
  const roomId = selectedRoomId || matchedRoom?.id || ''

  useEffect(() => {
    if (matchedRoom?.id && !selectedRoomId) setSelectedRoomId(matchedRoom.id)
  }, [matchedRoom?.id, selectedRoomId])

  const checkConflicts = async () => {
    if (!date || !startTime) return
    const res = await fetch('/api/events/conflicts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        startTime,
        endTime: endTime || startTime,
        roomId: roomId || undefined,
        location,
        chairsRequested,
        tablesRequested,
      }),
    })
    const data = await res.json()
    setConflicts({ hasConflict: data.hasConflict, warnings: data.warnings || [] })
  }

  const handleSubmit = async () => {
    if (!name || !date || !startTime) return
    setLoading(true)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          date,
          startTime,
          endTime: endTime || undefined,
          roomId: roomId || undefined,
          chairsRequested: chairsRequested || undefined,
          tablesRequested: tablesRequested || undefined,
        }),
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        const err = await res.json()
        setConflicts((c) => ({
          hasConflict: true,
          warnings: [...(c?.warnings || []), err?.error || 'Submit failed'],
        }))
      }
    } catch {
      setConflicts((c) => ({
        hasConflict: true,
        warnings: [...(c?.warnings || []), 'Submit failed'],
      }))
    } finally {
      setLoading(false)
    }
  }

  if (!canSubmit) {
    return (
      <div className="max-w-xl mx-auto p-8">
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-6 text-center">
          <p className="text-amber-800 dark:text-amber-200 font-medium">
            You don&apos;t have permission to submit event requests.
          </p>
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
            Contact your administrator to request event submission access.
          </p>
          <p className="mt-4 text-xs text-zinc-500">
            Admins can grant this under Settings → User permissions.
          </p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto p-8">
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-6 text-center">
          <p className="text-emerald-800 dark:text-emerald-200 font-medium">
            Event request submitted.
          </p>
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
            The request has been routed to the appropriate approvers (Principal, Maintenance, etc.).
          </p>
          <button
            onClick={() => {
              setSubmitted(false)
              setParsed(null)
              setRawText('')
              setConflicts(null)
            }}
            className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
          >
            Submit another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Free-form input + Parse */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
          Describe your event
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
          e.g. &quot;Parent Night on March 15 at 5pm in the Cafeteria, need 80 chairs and 10 tables&quot;
        </p>
        <div className="flex gap-2">
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Type or paste your event request…"
            className="flex-1 min-h-[100px] px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 resize-y"
            disabled={loading}
          />
        </div>
        <button
          onClick={handleParse}
          disabled={!rawText.trim() || loading}
          className="mt-3 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
        >
          {loading ? 'Parsing…' : 'Parse with AI'}
        </button>
      </section>

      {/* Teacher schedule (for admins: select teacher to avoid booking during their class) */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
          Schedule check
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
          Optional: Select a teacher to see their block schedule and avoid booking during their class.
        </p>
        <select
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          className="w-full max-w-xs px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
        >
          <option value="">— No teacher selected —</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name || t.email}
            </option>
          ))}
          {teachers.length === 0 && (
            <option value="demo">Demo: Sarah Johnson (no DB)</option>
          )}
        </select>
        {teacherBlocks.length > 0 && (
          <div className="mt-3 p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm">
            <p className="font-medium text-zinc-700 dark:text-zinc-300 mb-2">Today&apos;s blocks:</p>
            <ul className="space-y-1 text-zinc-600 dark:text-zinc-400">
              {teacherBlocks.map((b, i) => (
                <li key={i}>
                  {b.startTime}–{b.endTime} {b.subject || '—'} {b.roomName ? `(${b.roomName})` : ''}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              Don&apos;t book your event during these times if the teacher needs the room.
            </p>
          </div>
        )}
      </section>

      {/* Parsed form */}
      {parsed && !('error' in parsed) && (
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Parsed event
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setParsed((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setParsed((p) => ({ ...p, date: e.target.value }))}
                className="w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Start time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setParsed((p) => ({ ...p, startTime: e.target.value }))}
                className="w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">End time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setParsed((p) => ({ ...p, endTime: e.target.value }))}
                className="w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Room</label>
              <select
                value={roomId}
                onChange={(e) => {
                  const r = rooms.find((x) => x.id === e.target.value)
                  setSelectedRoomId(e.target.value)
                  setParsed((p) => ({ ...p, location: r?.name || '' }))
                }}
                className="w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
              >
                <option value="">— Select —</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.building.name})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Chairs requested</label>
              <input
                type="number"
                min={0}
                value={chairsRequested || ''}
                onChange={(e) =>
                  setParsed((p) => ({ ...p, chairsRequested: parseInt(e.target.value, 10) || 0 }))
                }
                className="w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Tables requested</label>
              <input
                type="number"
                min={0}
                value={tablesRequested || ''}
                onChange={(e) =>
                  setParsed((p) => ({ ...p, tablesRequested: parseInt(e.target.value, 10) || 0 }))
                }
                className="w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
              />
            </div>
          </div>

          {conflicts?.warnings && conflicts.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
              <p className="font-medium text-amber-800 dark:text-amber-200">Proximal Conflict / Inventory Warning</p>
              <ul className="mt-2 text-sm text-amber-700 dark:text-amber-300 list-disc list-inside">
                {conflicts.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                You can still submit, but please coordinate with affected parties.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={checkConflicts}
              disabled={!date || !startTime || loading}
              className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
            >
              Check conflicts
            </button>
            <button
              onClick={handleSubmit}
              disabled={!name || !date || !startTime || loading}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
        </section>
      )}

      {parsed && 'error' in parsed && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 text-red-800 dark:text-red-200">
          {(parsed as { error: string }).error}
        </div>
      )}
    </div>
  )
}
