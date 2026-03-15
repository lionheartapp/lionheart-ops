/**
 * Participant Self-Service QR Page
 *
 * Public page participants see when scanning their own QR code.
 * No auth required — registrationId (non-guessable cuid) is the access token.
 *
 * Displays: event info, personal schedule, group assignments, announcements.
 * No medical data shown (FERPA — public page).
 */

import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  CalendarDays,
  MapPin,
  Users,
  Megaphone,
  CheckCircle2,
  Clock,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScheduleBlock {
  id: string
  title: string
  type: string
  startsAt: string
  endsAt: string
  locationText: string | null
}

interface GroupAssignment {
  id: string
  name: string
  type: string
}

interface Announcement {
  id: string
  title: string
  body: string
  audience: string
  sentAt: string | null
  createdAt: string
}

interface ParticipantData {
  registrationId: string
  firstName: string
  lastName: string
  photoUrl: string | null
  grade: string | null
  status: string
  checkInStatus: {
    isCheckedIn: boolean
    checkedInAt: string | null
  }
  groups: GroupAssignment[]
  schedule: ScheduleBlock[]
  announcements: Announcement[]
  eventTitle?: string
  eventDate?: string
  orgName?: string
  orgLogoUrl?: string
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Your Event Info',
  description: 'View your event schedule, group assignments, and announcements.',
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchParticipantData(registrationId: string): Promise<ParticipantData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3004'
    const res = await fetch(`${baseUrl}/api/events/check-in/${registrationId}`, {
      cache: 'no-store',
    })

    if (!res.ok) return null

    const json = (await res.json()) as { ok: boolean; data: ParticipantData }
    if (!json.ok) return null

    return json.data
  } catch {
    return null
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
}

// ─── Page component ───────────────────────────────────────────────────────────

export default async function ParticipantSelfServicePage({
  params,
}: {
  params: Promise<{ registrationId: string }>
}) {
  const { registrationId } = await params
  const data = await fetchParticipantData(registrationId)

  if (!data) {
    notFound()
  }

  const {
    firstName,
    lastName,
    photoUrl,
    grade,
    checkInStatus,
    groups,
    schedule,
    announcements,
    eventTitle,
    eventDate,
    orgName,
    orgLogoUrl,
  } = data

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header / branding ── */}
      <div
        className="px-4 pt-8 pb-6 text-center"
        style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #3B82F6 100%)' }}
      >
        {orgLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={orgLogoUrl}
            alt={orgName ?? 'Organization'}
            className="w-12 h-12 rounded-full object-cover mx-auto mb-3 border-2 border-white/30"
          />
        )}
        {orgName && (
          <p className="text-blue-200 text-xs font-medium uppercase tracking-wide mb-1">{orgName}</p>
        )}
        {eventTitle && (
          <h1 className="text-white text-xl font-bold">{eventTitle}</h1>
        )}
        {eventDate && (
          <p className="text-blue-200 text-sm mt-1">{formatDate(eventDate)}</p>
        )}
      </div>

      {/* ── Participant card ── */}
      <div className="max-w-lg mx-auto px-4 -mt-6">
        <div className="bg-white rounded-2xl shadow-lg p-5 flex items-center gap-4">
          {/* Avatar */}
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={`${firstName} ${lastName}`}
              className="w-16 h-16 rounded-full object-cover flex-shrink-0 border-2 border-gray-100"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-full flex-shrink-0 flex items-center justify-center text-xl font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
            >
              {initials}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900">
              {firstName} {lastName}
            </h2>
            {grade && <p className="text-sm text-gray-500">{grade}</p>}
          </div>

          {/* Check-in status */}
          {checkInStatus.isCheckedIn ? (
            <div className="flex-shrink-0 flex flex-col items-center text-center">
              <CheckCircle2 className="w-7 h-7 text-green-500" />
              <span className="text-xs text-green-600 font-medium mt-0.5">Checked In</span>
              {checkInStatus.checkedInAt && (
                <span className="text-xs text-gray-400">{formatTime(checkInStatus.checkedInAt)}</span>
              )}
            </div>
          ) : (
            <div className="flex-shrink-0 flex flex-col items-center text-center">
              <Clock className="w-7 h-7 text-gray-300" />
              <span className="text-xs text-gray-400 font-medium mt-0.5">Not Yet</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Content sections ── */}
      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">

        {/* Group assignments */}
        {groups.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <Users className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-bold text-gray-800">Your Groups</h2>
            </div>
            <div className="px-4 py-3 flex flex-wrap gap-2">
              {groups.map((g) => (
                <div
                  key={g.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium ${
                    GROUP_TYPE_COLORS[g.type] ?? 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <span className="text-xs font-semibold opacity-70">
                    {GROUP_TYPE_LABELS[g.type] ?? g.type}
                  </span>
                  <span className="font-bold">{g.name}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Schedule */}
        {schedule.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <CalendarDays className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-bold text-gray-800">Schedule</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {schedule.map((block) => (
                <div key={block.id} className="flex gap-3 px-4 py-3">
                  <div className="flex-shrink-0 text-right min-w-[72px]">
                    <p className="text-xs font-semibold text-blue-600">{formatTime(block.startsAt)}</p>
                    <p className="text-xs text-gray-400">{formatTime(block.endsAt)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{block.title}</p>
                    {block.locationText && (
                      <p className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        {block.locationText}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Announcements */}
        {announcements.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <Megaphone className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-bold text-gray-800">Announcements</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {announcements.map((a) => (
                <div key={a.id} className="px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900">{a.title}</p>
                  <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{a.body}</p>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {formatDate(a.sentAt ?? a.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state if nothing to show */}
        {groups.length === 0 && schedule.length === 0 && announcements.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Event details are being prepared.</p>
            <p className="text-xs mt-1">Check back closer to the event date.</p>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="max-w-lg mx-auto px-4 pb-8 text-center">
        <p className="text-xs text-gray-300">Powered by Lionheart</p>
      </div>
    </div>
  )
}
