import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, MapPin, User, AlertCircle, Building2, Loader2 } from 'lucide-react'
import { DIRECTORY_USERS } from '../data/linfieldDirectory'

const PLATFORM_URL = import.meta.env.VITE_PLATFORM_URL?.trim() || 'http://localhost:3001'
const CAMPUS_URL = `${PLATFORM_URL}/campus`

/** Get team label for directory teachers (no room assignment) */
function getTeamLabel(teamIds) {
  if (!teamIds?.length) return 'Staff'
  const labels = { elementary: 'Elementary', 'middle-school': 'Middle School', 'high-school': 'High School', admin: 'Admin', facilities: 'Facilities', it: 'IT', athletics: 'Athletics', av: 'A/V', teachers: 'Teachers' }
  return teamIds.map((id) => labels[id] || id).join(', ') || 'Staff'
}

/** Command Bar (K-Bar): Cmd+K / Ctrl+K — unified search across Rooms, Teachers, Active Tickets */
export default function CommandBar({ isOpen, onClose, supportRequests = [], onNavigateToTab, onSelectTicket }) {
  const [query, setQuery] = useState('')
  const [platformResults, setPlatformResults] = useState({ rooms: [], teachers: [], tickets: [] })
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const q = query.trim().toLowerCase()
  const words = q ? q.split(/\s+/).filter(Boolean) : []
  const match = (s) => s && words.some((w) => String(s).toLowerCase().includes(w))

  const activeTickets = useMemo(() => {
    const active = (supportRequests || []).filter(
      (r) => r.status === 'new' || r.status === 'in-progress'
    )
    if (!words.length) return active
    return active.filter((r) => match(r.title) || match(r.submittedBy) || match(String(r.id)))
  }, [supportRequests, words])

  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    setSelectedIndex(0)
    setPlatformResults({ rooms: [], teachers: [], tickets: [] })
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [isOpen])

  useEffect(() => {
    if (!q) {
      setPlatformResults({ rooms: [], teachers: [], tickets: [] })
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`${PLATFORM_URL}/api/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setPlatformResults({
            rooms: d.rooms ?? [],
            teachers: d.teachers ?? [],
            tickets: d.tickets ?? [],
          })
        }
      })
      .catch(() => {
        if (!cancelled) setPlatformResults({ rooms: [], teachers: [], tickets: [] })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [q])

  const platformTeachers = platformResults.teachers ?? []
  const directoryTeachers = useMemo(() => {
    if (!words.length) return []
    return DIRECTORY_USERS.filter(
      (u) => match(u.name) || match(u.email)
    ).map((u) => ({
      id: u.id,
      name: u.name,
      roomId: null,
      roomName: null,
      buildingName: getTeamLabel(u.teamIds),
      fromDirectory: true,
    }))
  }, [words, q])
  const platformTeacherIds = new Set(platformTeachers.map((t) => t.id))
  const teachers = [
    ...platformTeachers,
    ...directoryTeachers.filter((t) => !platformTeacherIds.has(t.id)),
  ]
  const rooms = platformResults.rooms ?? []
  const platformTickets = platformResults.tickets ?? []
  const lionTickets = activeTickets

  const flatResults = useMemo(() => {
    const out = []
    if (teachers.length) out.push({ type: 'section', label: 'Teachers' })
    teachers.forEach((t) => out.push({ type: 'teacher', ...t }))
    if (rooms.length) out.push({ type: 'section', label: 'Rooms' })
    rooms.forEach((r) => out.push({ type: 'room', ...r }))
    if (platformTickets.length || lionTickets.length) out.push({ type: 'section', label: 'Active Tickets' })
    platformTickets.forEach((t) => out.push({ type: 'platformTicket', ...t }))
    lionTickets.forEach((t) => out.push({ type: 'lionTicket', ticketType: t.type, ...t }))
    return out
  }, [teachers, rooms, platformTickets, lionTickets])

  const selectableItems = flatResults.filter(
    (r) => r.type === 'teacher' || r.type === 'room' || r.type === 'platformTicket' || r.type === 'lionTicket'
  )
  const maxIdx = Math.max(0, selectableItems.length - 1)
  const clampedIdx = Math.min(Math.max(0, selectedIndex), maxIdx)

  useEffect(() => {
    setSelectedIndex(clampedIdx)
  }, [clampedIdx, flatResults.length])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const item = el.querySelector(`[data-index="${clampedIdx}"]`)
    item?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [clampedIdx])

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose?.()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, maxIdx))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const item = selectableItems[clampedIdx]
      if (item) handleSelect(item)
    }
  }

  const handleSelect = (item) => {
    if (item.type === 'teacher' || item.type === 'room') {
      const roomId = item.type === 'room' ? item.id : item.roomId
      const url = roomId ? `${CAMPUS_URL}?roomId=${roomId}` : CAMPUS_URL
      window.open(url, '_blank')
      onClose?.()
      return
    }
    if (item.type === 'platformTicket') {
      window.open(`${CAMPUS_URL}?roomId=${item.roomId}`, '_blank')
      onClose?.()
      return
    }
    if (item.type === 'lionTicket') {
      const tab = item.ticketType === 'Facilities' ? 'facilities' : 'it-support'
      onNavigateToTab?.(tab)
      onSelectTicket?.(item.id)
      onClose?.()
    }
  }

  if (!isOpen) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-start justify-center pt-[15vh] px-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -8 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xl rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl overflow-hidden"
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-700">
            <Search className="w-5 h-5 text-zinc-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search teachers, rooms, tickets… (e.g. Mrs. Smith)"
              className="flex-1 bg-transparent text-zinc-100 placeholder:text-zinc-500 text-lg outline-none"
              autoComplete="off"
              autoCapitalize="off"
            />
            <kbd className="hidden sm:inline-flex px-2 py-1 rounded bg-zinc-800 text-zinc-400 text-xs font-medium">
              esc
            </kbd>
          </div>

          <div
            ref={listRef}
            className="max-h-[60vh] overflow-y-auto py-2"
          >
            {loading && (
              <div className="flex items-center justify-center gap-2 py-8 text-zinc-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Searching…</span>
              </div>
            )}
            {!loading && flatResults.length === 0 && (
              <p className="px-4 py-8 text-center text-zinc-500 text-sm">
                {query.trim() ? 'No results.' : 'Type to search teachers, rooms, or tickets.'}
              </p>
            )}
            {!loading && flatResults.length > 0 && (
              <ul className="py-1">
                {flatResults.map((item, i) => {
                  if (item.type === 'section') {
                    return (
                      <li
                        key={`${item.label}-${i}`}
                        className="px-4 py-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider"
                      >
                        {item.label}
                      </li>
                    )
                  }
                  const idx = selectableItems.findIndex(
                    (s) =>
                      (s.type === 'teacher' && s.id === item.id) ||
                      (s.type === 'room' && s.id === item.id) ||
                      (s.type === 'platformTicket' && s.id === item.id) ||
                      (s.type === 'lionTicket' && s.id === item.id)
                  )
                  const isSelected = idx === clampedIdx
                  if (item.type === 'teacher') {
                    return (
                      <li key={`t-${item.id}`}>
                        <button
                          type="button"
                          data-index={idx}
                          onClick={() => handleSelect(item)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            isSelected ? 'bg-zinc-700/80' : 'hover:bg-zinc-800/60'
                          }`}
                        >
                          <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-blue-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-zinc-100 truncate">{item.name}</p>
                            <p className="text-sm text-zinc-400 truncate">
                              {item.roomName ? `${item.roomName} · ${item.buildingName}` : item.buildingName}
                            </p>
                          </div>
                          <MapPin className="w-4 h-4 text-zinc-500 shrink-0" />
                        </button>
                      </li>
                    )
                  }
                  if (item.type === 'room') {
                    return (
                      <li key={`r-${item.id}`}>
                        <button
                          type="button"
                          data-index={idx}
                          onClick={() => handleSelect(item)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            isSelected ? 'bg-zinc-700/80' : 'hover:bg-zinc-800/60'
                          }`}
                        >
                          <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-amber-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-zinc-100 truncate">{item.name}</p>
                            <p className="text-sm text-zinc-400 truncate">
                              {item.buildingName}
                              {item.teacherName && ` · ${item.teacherName}`}
                            </p>
                          </div>
                          <MapPin className="w-4 h-4 text-zinc-500 shrink-0" />
                        </button>
                      </li>
                    )
                  }
                  if (item.type === 'platformTicket' || item.type === 'lionTicket') {
                    return (
                      <li key={`tk-${item.type}-${item.id}`}>
                        <button
                          type="button"
                          data-index={idx}
                          onClick={() => handleSelect(item)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            isSelected ? 'bg-zinc-700/80' : 'hover:bg-zinc-800/60'
                          }`}
                        >
                          <div className="w-9 h-9 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                            <AlertCircle className="w-4 h-4 text-red-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-zinc-100 truncate">{item.title}</p>
                            <p className="text-sm text-zinc-400 truncate">
                              {item.roomName ?? item.ticketType ?? ''} · {item.status ?? (item.ticketType === 'Facilities' ? 'Facilities' : 'IT')}
                            </p>
                          </div>
                        </button>
                      </li>
                    )
                  }
                  return null
                })}
              </ul>
            )}
          </div>

          <div className="px-4 py-2 border-t border-zinc-700 flex items-center justify-between text-xs text-zinc-500">
            <span>↑↓ navigate · ↵ select · Esc close</span>
            <span>⌘K to open</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
