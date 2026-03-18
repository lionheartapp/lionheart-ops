'use client'

/**
 * DayOfDashboard — day-of operations hub for event staff.
 *
 * Tabbed interface: Check-In | Roster | Incidents | Headcount
 * Mounts cacheRoster on load to pre-populate offline cache.
 * Full-screen capable for QR scanning mode.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  QrCode,
  Users,
  TriangleAlert,
  BarChart2,
  WifiOff,
  RefreshCw,
  Maximize2,
  Minimize2,
  Search,
} from 'lucide-react'
import { useCheckIn } from '@/lib/hooks/useCheckIn'
import { useIncidents } from '@/lib/hooks/useIncidents'
import { cacheRoster } from '@/lib/offline/event-sync'
import { eventDb } from '@/lib/offline/event-db'
import CheckInScanner from './CheckInScanner'
import CheckInList from './CheckInList'
import IncidentForm from './IncidentForm'
import IncidentList from './IncidentList'

// ─── Types ────────────────────────────────────────────────────────────────────

type DayOfTab = 'checkin' | 'roster' | 'incidents' | 'headcount'

interface DayOfDashboardProps {
  eventProjectId: string
  eventName: string
  eventDate?: string
  hasMedicalPermission?: boolean
}

// ─── Group type labels ────────────────────────────────────────────────────────

const GROUP_TYPE_LABELS: Record<string, string> = {
  BUS: 'Bus',
  CABIN: 'Cabin',
  SMALL_GROUP: 'Group',
  ACTIVITY: 'Activity',
}

const GROUP_TYPE_COLORS: Record<string, string> = {
  BUS: 'bg-blue-100 text-blue-700',
  CABIN: 'bg-emerald-100 text-emerald-700',
  SMALL_GROUP: 'bg-violet-100 text-violet-700',
  ACTIVITY: 'bg-amber-100 text-amber-700',
}

// ─── Headcount component ──────────────────────────────────────────────────────

interface HeadcountViewProps {
  eventProjectId: string
  checkedIn: number
  total: number
}

interface GroupHeadcount {
  groupId: string
  groupName: string
  groupType: string
  checkedIn: number
  total: number
}

function HeadcountView({ eventProjectId, checkedIn, total }: HeadcountViewProps) {
  const [groupCounts, setGroupCounts] = useState<GroupHeadcount[]>([])
  const notYet = total - checkedIn
  const pct = total > 0 ? Math.round((checkedIn / total) * 100) : 0

  useEffect(() => {
    // Derive per-group counts from cached participants + check-in queue
    const calculate = async () => {
      const [cached, pendingCheckIns] = await Promise.all([
        eventDb.cachedParticipants.where('eventProjectId').equals(eventProjectId).toArray(),
        eventDb.eventCheckInQueue
          .where('eventProjectId')
          .equals(eventProjectId)
          .filter((e) => e.status === 'pending')
          .toArray(),
      ])

      const pendingSet = new Set(pendingCheckIns.map((e) => e.registrationId))

      // Build per-group accumulator
      const groupMap = new Map<string, { name: string; type: string; checkedIn: number; total: number }>()

      for (const p of cached) {
        let groups: Array<{ id: string; name: string; type: string }> = []
        try {
          groups = JSON.parse(p.groups) as typeof groups
        } catch {
          groups = []
        }

        for (const g of groups) {
          const entry = groupMap.get(g.id) ?? { name: g.name, type: g.type, checkedIn: 0, total: 0 }
          const isChecked = p.isCheckedIn || pendingSet.has(p.registrationId)
          setGroupCounts((prev) => prev) // trigger re-render trick
          groupMap.set(g.id, {
            name: entry.name,
            type: entry.type,
            total: entry.total + 1,
            checkedIn: isChecked ? entry.checkedIn + 1 : entry.checkedIn,
          })
        }
      }

      const counts: GroupHeadcount[] = []
      for (const [groupId, data] of groupMap.entries()) {
        counts.push({ groupId, groupName: data.name, groupType: data.type, ...data })
      }
      counts.sort((a, b) => a.groupName.localeCompare(b.groupName))
      setGroupCounts(counts)
    }

    void calculate()
  }, [eventProjectId, checkedIn, total])

  return (
    <div className="p-4 space-y-5">
      {/* Overall */}
      <div className="ui-glass p-5 rounded-2xl">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Overall Headcount</h3>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-900">{total}</div>
            <div className="text-xs text-slate-500 mt-0.5">Registered</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{checkedIn}</div>
            <div className="text-xs text-slate-500 mt-0.5">Checked In</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-400">{notYet}</div>
            <div className="text-xs text-slate-500 mt-0.5">Not Yet</div>
          </div>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #3B82F6, #6366F1)' }}
          />
        </div>
        <p className="text-xs text-center text-slate-400 mt-1.5">{pct}% checked in</p>
      </div>

      {/* Per-group breakdown */}
      {groupCounts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">By Group</h3>
          {groupCounts.map((g) => {
            const gPct = g.total > 0 ? Math.round((g.checkedIn / g.total) * 100) : 0
            return (
              <div key={g.groupId} className="flex items-center gap-3 py-2.5 px-3 bg-white border border-slate-100 rounded-xl">
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${GROUP_TYPE_COLORS[g.groupType] ?? 'bg-slate-100 text-slate-600'}`}>
                  {GROUP_TYPE_LABELS[g.groupType] ?? g.groupType}
                </span>
                <span className="flex-1 text-sm font-medium text-slate-800 truncate">{g.groupName}</span>
                <span className="text-sm text-slate-600 flex-shrink-0">
                  {g.checkedIn}/{g.total}
                </span>
                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${gPct}%`,
                      background: gPct === 100 ? '#16a34a' : 'linear-gradient(90deg, #3B82F6, #6366F1)',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Roster view ──────────────────────────────────────────────────────────────

interface RosterViewProps {
  eventProjectId: string
  participants: Array<{
    registrationId: string
    firstName: string
    lastName: string
    photoUrl: string | null
    grade: string | null
    groups: Array<{ id: string; name: string; type: string }>
  }>
}

function RosterView({ participants }: RosterViewProps) {
  const [search, setSearch] = useState('')

  const filtered = participants.filter((p) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search roster..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">
            {search ? `No participants matching "${search}"` : 'No roster data available offline yet'}
          </div>
        ) : (
          filtered.map((p) => {
            const initials = `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase()
            return (
              <div key={p.registrationId} className="flex items-center gap-3 py-2.5 px-3 bg-white border border-slate-100 rounded-xl">
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.photoUrl}
                    alt={`${p.firstName} ${p.lastName}`}
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
                  >
                    {initials}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {p.firstName} {p.lastName}
                  </p>
                  {p.grade && <p className="text-xs text-slate-400">{p.grade}</p>}
                </div>

                {p.groups.length > 0 && (
                  <div className="flex gap-1 flex-wrap justify-end max-w-[140px]">
                    {p.groups.slice(0, 2).map((g) => (
                      <span
                        key={g.id}
                        className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${GROUP_TYPE_COLORS[g.type] ?? 'bg-slate-100 text-slate-600'}`}
                      >
                        {g.name}
                      </span>
                    ))}
                    {p.groups.length > 2 && (
                      <span className="text-xs text-slate-400">+{p.groups.length - 2}</span>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function DayOfDashboard({
  eventProjectId,
  eventName,
  eventDate,
  hasMedicalPermission = false,
}: DayOfDashboardProps) {
  const [activeTab, setActiveTab] = useState<DayOfTab>('checkin')
  const [scannerMode, setScannerMode] = useState<'scanner' | 'list'>('scanner')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showIncidentForm, setShowIncidentForm] = useState(true)
  const [rosterParticipants, setRosterParticipants] = useState<RosterViewProps['participants']>([])

  const checkInData = useCheckIn(eventProjectId)
  const incidentData = useIncidents(eventProjectId)

  // ─── Pre-cache roster on mount ───────────────────────────────────────

  useEffect(() => {
    void cacheRoster(eventProjectId)
  }, [eventProjectId])

  // ─── Load cached roster for offline roster tab ───────────────────────

  const loadCachedRoster = useCallback(async () => {
    const cached = await eventDb.cachedParticipants
      .where('eventProjectId')
      .equals(eventProjectId)
      .toArray()

    setRosterParticipants(
      cached.map((p) => {
        let groups: Array<{ id: string; name: string; type: string }> = []
        try {
          groups = JSON.parse(p.groups) as typeof groups
        } catch {
          groups = []
        }
        return {
          registrationId: p.registrationId,
          firstName: p.firstName,
          lastName: p.lastName,
          photoUrl: p.photoUrl,
          grade: p.grade,
          groups,
        }
      })
    )
  }, [eventProjectId])

  useEffect(() => {
    void loadCachedRoster()
  }, [loadCachedRoster])

  // ─── Fullscreen ──────────────────────────────────────────────────────

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      void document.documentElement.requestFullscreen?.()
    } else {
      void document.exitFullscreen?.()
    }
    setIsFullscreen((f) => !f)
  }

  // ─── Tabs config ─────────────────────────────────────────────────────

  const tabs: Array<{ id: DayOfTab; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'checkin', label: 'Check-In', Icon: QrCode },
    { id: 'roster', label: 'Roster', Icon: Users },
    { id: 'incidents', label: 'Incidents', Icon: TriangleAlert },
    { id: 'headcount', label: 'Headcount', Icon: BarChart2 },
  ]

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-slate-900 truncate">{eventName}</h1>
          {eventDate && <p className="text-xs text-slate-500">{eventDate}</p>}
        </div>

        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
          {/* Offline indicator */}
          {!checkInData.isOnline && (
            <div className="flex items-center gap-1 text-amber-600 text-xs font-medium">
              <WifiOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Offline</span>
            </div>
          )}

          {/* Pending sync with sync now button */}
          {checkInData.pendingSync > 0 && checkInData.isOnline && (
            <button
              onClick={() => void checkInData.syncNow()}
              className="flex items-center gap-1 text-blue-600 text-xs font-medium hover:text-blue-800 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync {checkInData.pendingSync}
            </button>
          )}

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex items-center border-b border-slate-200 bg-white flex-shrink-0 px-4">
        {tabs.map(({ id, label, Icon }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                isActive
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {id === 'incidents' && incidentData.pendingSync > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </button>
          )
        })}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-hidden min-h-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {activeTab === 'checkin' && (
              scannerMode === 'scanner' ? (
                <CheckInScanner
                  eventProjectId={eventProjectId}
                  useCheckInData={checkInData}
                  hasMedicalPermission={hasMedicalPermission}
                  onSwitchToList={() => setScannerMode('list')}
                />
              ) : (
                <CheckInList
                  useCheckInData={checkInData}
                  onSwitchToScanner={() => setScannerMode('scanner')}
                />
              )
            )}

            {activeTab === 'roster' && (
              <RosterView
                eventProjectId={eventProjectId}
                participants={rosterParticipants}
              />
            )}

            {activeTab === 'incidents' && (
              <div className="h-full overflow-y-auto">
                <div className="p-4 space-y-4">
                  {/* Collapsible form */}
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setShowIncidentForm((s) => !s)}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-800 cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <span>Log New Incident</span>
                      <TriangleAlert className={`w-4 h-4 transition-colors ${showIncidentForm ? 'text-red-500' : 'text-slate-400'}`} />
                    </button>

                    <AnimatePresence>
                      {showIncidentForm && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="overflow-hidden border-t border-slate-100"
                        >
                          <IncidentForm
                            eventProjectId={eventProjectId}
                            participants={checkInData.checkInList}
                            isOnline={incidentData.isOnline}
                            onSubmit={incidentData.createIncident}
                            onSuccess={() => setShowIncidentForm(false)}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Incident list */}
                  <IncidentList
                    incidents={incidentData.incidents}
                    isLoading={incidentData.isLoading}
                  />
                </div>
              </div>
            )}

            {activeTab === 'headcount' && (
              <div className="h-full overflow-y-auto">
                <HeadcountView
                  eventProjectId={eventProjectId}
                  checkedIn={checkInData.counter.checkedIn}
                  total={checkInData.counter.total}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
