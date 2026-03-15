'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
  Plus,
  Edit2,
  Trash2,
  Users,
  AlertCircle,
  Check,
  X,
} from 'lucide-react'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import { useToast } from '@/components/Toast'
import {
  useActivities,
  useActivitySignups,
  useActivitySignup,
} from '@/lib/hooks/useEventGroups'
import type { EventActivity } from '@/lib/hooks/useEventGroups'
import { fetchApi } from '@/lib/api-client'
import { useQueryClient } from '@tanstack/react-query'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ActivityManagerProps {
  eventProjectId: string
}

// ─── Capacity Bar ────────────────────────────────────────────────────────────────

function CapacityBar({ current, max }: { current: number; max: number | null }) {
  if (!max) {
    return <span className="text-xs text-gray-500">{current} signed up</span>
  }
  const pct = Math.min(100, Math.round((current / max) * 100))
  const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-400' : 'bg-green-500'
  const textColor = pct >= 100 ? 'text-red-600' : pct >= 80 ? 'text-yellow-600' : 'text-green-700'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-medium ${textColor}`}>
        {current}/{max}
      </span>
      {pct >= 100 && (
        <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full">
          FULL
        </span>
      )}
    </div>
  )
}

// ─── Activity Form ───────────────────────────────────────────────────────────────

interface ActivityFormValues {
  name: string
  description: string
  capacity: string
  scheduledAt: string
  location: string
}

function ActivityForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial?: Partial<ActivityFormValues>
  onSubmit: (data: ActivityFormValues) => void
  onCancel: () => void
  submitLabel?: string
}) {
  const [values, setValues] = useState<ActivityFormValues>({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    capacity: initial?.capacity ?? '',
    scheduledAt: initial?.scheduledAt ?? '',
    location: initial?.location ?? '',
  })

  function set(field: keyof ActivityFormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.name.trim()) return
    onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        autoFocus
        value={values.name}
        onChange={(e) => set('name', e.target.value)}
        placeholder="Activity name *"
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
        required
      />
      <input
        value={values.description}
        onChange={(e) => set('description', e.target.value)}
        placeholder="Description (optional)"
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          type="number"
          value={values.capacity}
          onChange={(e) => set('capacity', e.target.value)}
          placeholder="Max capacity"
          min={1}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          type="datetime-local"
          value={values.scheduledAt}
          onChange={(e) => set('scheduledAt', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
      <input
        value={values.location}
        onChange={(e) => set('location', e.target.value)}
        placeholder="Location (optional)"
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!values.name.trim()}
          className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
        >
          {submitLabel ?? 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Activity Row ────────────────────────────────────────────────────────────────

function ActivityRow({
  activity,
  eventProjectId,
}: {
  activity: EventActivity
  eventProjectId: string
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: signups = [], isLoading: signupsLoading } = useActivitySignups(
    expanded ? eventProjectId : null,
    expanded ? activity.id : null
  )
  const signupMutation = useActivitySignup(eventProjectId)

  function formatTime(iso: string | null) {
    if (!iso) return null
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  async function handleUpdate(data: ActivityFormValues) {
    try {
      await fetchApi(`/api/events/projects/${eventProjectId}/activities`, {
        method: 'PUT',
        body: JSON.stringify({
          activityId: activity.id,
          name: data.name,
          description: data.description || null,
          capacity: data.capacity ? parseInt(data.capacity, 10) : null,
          scheduledAt: data.scheduledAt || null,
          location: data.location || null,
        }),
      })
      queryClient.invalidateQueries({ queryKey: ['event-activities', eventProjectId] })
      setEditing(false)
      toast('Activity updated', 'success')
    } catch {
      toast('Failed to update activity', 'error')
    }
  }

  async function handleDelete() {
    try {
      await fetchApi(`/api/events/projects/${eventProjectId}/activities`, {
        method: 'DELETE',
        body: JSON.stringify({ activityId: activity.id }),
      })
      queryClient.invalidateQueries({ queryKey: ['event-activities', eventProjectId] })
      toast('Activity deleted', 'success')
    } catch {
      toast('Failed to delete activity', 'error')
    }
  }

  async function handleRemoveSignup(registrationId: string) {
    try {
      await signupMutation.mutateAsync({
        activityId: activity.id,
        registrationId,
        action: 'cancel',
      })
      toast('Removed from activity', 'success')
    } catch {
      toast('Failed to remove', 'error')
    }
  }

  return (
    <div className="ui-glass rounded-2xl overflow-hidden">
      {/* Activity header */}
      {editing ? (
        <div className="p-4">
          <h4 className="text-sm font-semibold text-gray-800 mb-3">Edit Activity</h4>
          <ActivityForm
            initial={{
              name: activity.name,
              description: activity.description ?? '',
              capacity: activity.capacity?.toString() ?? '',
              scheduledAt: activity.scheduledAt
                ? new Date(activity.scheduledAt).toISOString().slice(0, 16)
                : '',
              location: activity.location ?? '',
            }}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(false)}
            submitLabel="Update"
          />
        </div>
      ) : (
        <div className="p-4">
          {/* Delete confirm */}
          {confirmDelete ? (
            <div className="bg-red-50 rounded-xl p-3 mb-3">
              <p className="text-xs text-red-700 font-medium mb-2">
                Delete &quot;{activity.name}&quot;?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 px-3 py-1.5 text-xs border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-gray-900 truncate">{activity.name}</h3>
                {activity.isFull && (
                  <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full flex-shrink-0">
                    FULL
                  </span>
                )}
              </div>

              {activity.description && (
                <p className="text-xs text-gray-500 mb-2">{activity.description}</p>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
                {activity.scheduledAt && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    {formatTime(activity.scheduledAt)}
                  </span>
                )}
                {activity.location && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <MapPin className="w-3 h-3" />
                    {activity.location}
                  </span>
                )}
              </div>

              <CapacityBar current={activity.signupCount} max={activity.capacity} />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded: participant list */}
      <AnimatePresence>
        {expanded && !editing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-100 p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Signed Up ({activity.signupCount})
              </h4>

              {signupsLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : signups.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No signups yet.</p>
              ) : (
                <div className="space-y-2">
                  {signups.map((signup) => (
                    <div
                      key={signup.id}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white border border-gray-200"
                    >
                      <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {signup.participant.firstName} {signup.participant.lastName}
                        </p>
                        {signup.participant.grade && (
                          <p className="text-xs text-gray-500">Gr. {signup.participant.grade}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSignup(signup.registrationId)}
                        className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 cursor-pointer"
                        title="Remove from activity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Staff override signup message if full */}
              {activity.isFull && (
                <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Activity is at capacity. Staff can override via the Registrations tab to add participants manually.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main ActivityManager Component ─────────────────────────────────────────────

export default function ActivityManager({ eventProjectId }: ActivityManagerProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showAddForm, setShowAddForm] = useState(false)

  const { data: activities = [], isLoading } = useActivities(eventProjectId)

  async function handleCreateActivity(data: ActivityFormValues) {
    try {
      await fetchApi(`/api/events/projects/${eventProjectId}/activities`, {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          description: data.description || null,
          capacity: data.capacity ? parseInt(data.capacity, 10) : null,
          scheduledAt: data.scheduledAt || null,
          location: data.location || null,
        }),
      })
      queryClient.invalidateQueries({ queryKey: ['event-activities', eventProjectId] })
      setShowAddForm(false)
      toast('Activity created', 'success')
    } catch {
      toast('Failed to create activity', 'error')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Activities</h3>
          <p className="text-xs text-gray-500">{activities.length} activities</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.97] transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Activity
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="ui-glass p-4 rounded-2xl border border-blue-200">
          <h4 className="text-sm font-semibold text-gray-800 mb-3">New Activity</h4>
          <ActivityForm
            onSubmit={handleCreateActivity}
            onCancel={() => setShowAddForm(false)}
            submitLabel="Create Activity"
          />
        </div>
      )}

      {/* Activities list */}
      {activities.length === 0 && !showAddForm ? (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center justify-center py-16 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200"
        >
          <p className="text-sm font-semibold text-gray-700 mb-1">No activities yet</p>
          <p className="text-sm text-gray-500 mb-4">
            Create elective activities for participants to sign up for.
          </p>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add First Activity
          </button>
        </motion.div>
      ) : (
        <motion.div
          variants={staggerContainer()}
          initial="hidden"
          animate="visible"
          className="space-y-3"
        >
          {activities.map((activity) => (
            <motion.div key={activity.id} variants={fadeInUp}>
              <ActivityRow activity={activity} eventProjectId={eventProjectId} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
