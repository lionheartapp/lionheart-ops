'use client'

/**
 * IncidentList — displays logged incidents with expand/collapse detail view.
 *
 * Shows: type icon, severity badge, description, participant names, timestamp.
 * Filters by type and severity. Pending sync items have orange dot.
 */

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  HeartPulse,
  ShieldAlert,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  Circle,
} from 'lucide-react'
import type { IncidentListItem, OfflineIncident } from '@/lib/hooks/useIncidents'
import type { EventIncidentWithParticipants } from '@/lib/types/events-phase21'
import type { EventIncidentType, EventIncidentSeverity } from '@/lib/types/events-phase21'

// ─── Types ────────────────────────────────────────────────────────────────────

interface IncidentListProps {
  incidents: IncidentListItem[]
  isLoading: boolean
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<EventIncidentType, React.ComponentType<{ className?: string }>> = {
  MEDICAL: HeartPulse,
  BEHAVIORAL: AlertTriangle,
  SAFETY: ShieldAlert,
  OTHER: HelpCircle,
}

const TYPE_LABELS: Record<EventIncidentType, string> = {
  MEDICAL: 'Medical',
  BEHAVIORAL: 'Behavioral',
  SAFETY: 'Safety',
  OTHER: 'Other',
}

const SEVERITY_COLORS: Record<EventIncidentSeverity, string> = {
  MINOR: 'bg-blue-100 text-blue-700',
  MODERATE: 'bg-amber-100 text-amber-700',
  SERIOUS: 'bg-red-100 text-red-700',
}

const TYPE_ICON_COLORS: Record<EventIncidentType, string> = {
  MEDICAL: 'text-red-500',
  BEHAVIORAL: 'text-amber-500',
  SAFETY: 'text-orange-500',
  OTHER: 'text-blue-500',
}

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// ─── Type guard ───────────────────────────────────────────────────────────────

function isOfflineIncident(item: IncidentListItem): item is OfflineIncident {
  return (item as OfflineIncident).isPendingSync === true
}

// ─── Single card ──────────────────────────────────────────────────────────────

function IncidentCard({ incident }: { incident: IncidentListItem }) {
  const [expanded, setExpanded] = useState(false)

  const isOffline = isOfflineIncident(incident)

  const online = incident as EventIncidentWithParticipants
  const offline = incident as OfflineIncident

  const type: EventIncidentType = incident.type
  const severity: EventIncidentSeverity = incident.severity
  const description = incident.description
  const actionsTaken = isOffline ? offline.actionsTaken : online.actionsTaken
  const followUpNeeded = isOffline ? offline.followUpNeeded : online.followUpNeeded
  const followUpNotes = isOffline ? offline.followUpNotes : online.followUpNotes
  const participantNames = isOffline
    ? [] // We don't resolve names for offline items
    : online.participants.map((p) => p.participantName)
  const reporterName = isOffline ? offline.reporterName : online.reporterName
  const createdAt = isOffline ? offline.createdAt : online.createdAt

  const Icon = TYPE_ICONS[type]

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Card header (always visible) */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start gap-3 p-4 text-left cursor-pointer hover:bg-gray-50 transition-colors"
      >
        {/* Type icon */}
        <div className="flex-shrink-0 mt-0.5">
          <Icon className={`w-5 h-5 ${TYPE_ICON_COLORS[type]}`} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{TYPE_LABELS[type]}</span>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${SEVERITY_COLORS[severity]}`}>
              {severity.charAt(0) + severity.slice(1).toLowerCase()}
            </span>
            {isOffline && (
              <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                <Circle className="w-1.5 h-1.5 fill-amber-400" />
                Pending sync
              </span>
            )}
          </div>

          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{description}</p>

          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
            <span>{formatDateTime(createdAt)}</span>
            {reporterName && <span>by {reporterName}</span>}
            {participantNames.length > 0 && (
              <span>{participantNames.slice(0, 2).join(', ')}{participantNames.length > 2 ? ` +${participantNames.length - 2}` : ''}</span>
            )}
          </div>
        </div>

        {/* Expand chevron */}
        <ChevronDown
          className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5 transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
              {/* Full description */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</p>
                <p className="text-sm text-gray-700">{description}</p>
              </div>

              {/* Actions taken */}
              {actionsTaken && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Actions Taken</p>
                  <p className="text-sm text-gray-700">{actionsTaken}</p>
                </div>
              )}

              {/* Follow-up */}
              {followUpNeeded && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Follow-Up Required</p>
                  {followUpNotes && <p className="text-sm text-amber-700">{followUpNotes}</p>}
                </div>
              )}

              {/* Participants */}
              {participantNames.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Involved Participants
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {participantNames.map((name, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Photo */}
              {!isOffline && online.photoUrl && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Photo</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={online.photoUrl}
                    alt="Incident"
                    className="w-32 h-32 object-cover rounded-xl border border-gray-200"
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

interface FilterBarProps {
  typeFilter: EventIncidentType | 'ALL'
  severityFilter: EventIncidentSeverity | 'ALL'
  onTypeChange: (v: EventIncidentType | 'ALL') => void
  onSeverityChange: (v: EventIncidentSeverity | 'ALL') => void
}

function FilterBar({ typeFilter, severityFilter, onTypeChange, onSeverityChange }: FilterBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Type filter */}
      <select
        value={typeFilter}
        onChange={(e) => onTypeChange(e.target.value as EventIncidentType | 'ALL')}
        className="text-xs border border-gray-200 rounded-full px-3 py-1.5 bg-white text-gray-600 focus:outline-none cursor-pointer"
      >
        <option value="ALL">All Types</option>
        {Object.entries(TYPE_LABELS).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>

      {/* Severity filter */}
      <select
        value={severityFilter}
        onChange={(e) => onSeverityChange(e.target.value as EventIncidentSeverity | 'ALL')}
        className="text-xs border border-gray-200 rounded-full px-3 py-1.5 bg-white text-gray-600 focus:outline-none cursor-pointer"
      >
        <option value="ALL">All Severities</option>
        <option value="MINOR">Minor</option>
        <option value="MODERATE">Moderate</option>
        <option value="SERIOUS">Serious</option>
      </select>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function IncidentList({ incidents, isLoading }: IncidentListProps) {
  const [typeFilter, setTypeFilter] = useState<EventIncidentType | 'ALL'>('ALL')
  const [severityFilter, setSeverityFilter] = useState<EventIncidentSeverity | 'ALL'>('ALL')

  const filtered = incidents.filter((i) => {
    if (typeFilter !== 'ALL' && i.type !== typeFilter) return false
    if (severityFilter !== 'ALL' && i.severity !== severityFilter) return false
    return true
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((n) => (
          <div key={n} className="animate-pulse bg-gray-100 rounded-xl h-20" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {incidents.length > 1 && (
        <FilterBar
          typeFilter={typeFilter}
          severityFilter={severityFilter}
          onTypeChange={setTypeFilter}
          onSeverityChange={setSeverityFilter}
        />
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          {incidents.length === 0 ? 'No incidents logged yet' : 'No incidents match the filters'}
        </div>
      ) : (
        filtered.map((incident) => (
          <IncidentCard key={incident.id} incident={incident} />
        ))
      )}
    </div>
  )
}
