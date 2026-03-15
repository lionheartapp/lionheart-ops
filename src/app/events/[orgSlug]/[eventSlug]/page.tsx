/**
 * Public event landing page.
 *
 * Renders event details with school branding and a "Register Now" CTA.
 * Zero Lionheart branding. Server component — no auth required.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Calendar, MapPin, Users } from 'lucide-react'
import { rawPrisma } from '@/lib/db'
import { formatDateRange } from '@/lib/utils/date-format'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getPublicEventData(orgSlug: string, eventSlug: string) {
  const form = await rawPrisma.registrationForm.findUnique({
    where: { shareSlug: eventSlug },
    include: {
      organization: {
        select: {
          slug: true,
          name: true,
          logoUrl: true,
          theme: true,
        },
      },
      eventProject: {
        select: {
          id: true,
          title: true,
          description: true,
          coverImageUrl: true,
          startsAt: true,
          endsAt: true,
          locationText: true,
          expectedAttendance: true,
        },
      },
      registrations: {
        where: { status: 'REGISTERED' },
        select: { id: true },
      },
    },
  })

  if (!form) return null
  if (form.organization.slug !== orgSlug) return null

  return form
}

function extractPrimaryColor(theme: unknown): string {
  if (!theme || typeof theme !== 'string') return '#6366f1'
  try {
    const parsed = JSON.parse(theme) as Record<string, unknown>
    if (typeof parsed.primaryColor === 'string') return parsed.primaryColor
  } catch {
    // Not JSON
  }
  return '#6366f1'
}

function getRegistrationState(form: {
  openAt: Date | null
  closeAt: Date | null
  maxCapacity: number | null
  waitlistEnabled: boolean
  registrations: { id: string }[]
}): 'open' | 'not_open_yet' | 'closed' | 'full' | 'waitlist' {
  const now = new Date()

  if (form.openAt && form.openAt > now) return 'not_open_yet'
  if (form.closeAt && form.closeAt < now) return 'closed'

  if (form.maxCapacity !== null) {
    const registered = form.registrations.length
    if (registered >= form.maxCapacity) {
      return form.waitlistEnabled ? 'waitlist' : 'full'
    }
  }

  return 'open'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ orgSlug: string; eventSlug: string }>
}) {
  const { orgSlug, eventSlug } = await params
  const form = await getPublicEventData(orgSlug, eventSlug)

  if (!form || !form.eventProject) {
    notFound()
  }

  const { eventProject: event, organization: org } = form
  const primaryColor = extractPrimaryColor(org.theme)
  const registrationState = getRegistrationState(form)

  const dateLabel = formatDateRange(event.startsAt, event.endsAt)

  return (
    <div className="space-y-0">
      {/* Cover image */}
      {event.coverImageUrl && (
        <div className="relative w-full h-72 overflow-hidden rounded-2xl mb-8 -mx-0">
          <Image
            src={event.coverImageUrl}
            alt={event.title}
            fill
            className="object-cover"
            priority
          />
          {/* Gradient overlay for legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
      )}

      {/* Event title + meta */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-900 leading-tight">{event.title}</h1>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-gray-600">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 flex-shrink-0 text-gray-400" />
            <span>{dateLabel}</span>
          </div>

          {event.locationText && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 flex-shrink-0 text-gray-400" />
              <span>{event.locationText}</span>
            </div>
          )}

          {event.expectedAttendance && (
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 flex-shrink-0 text-gray-400" />
              <span>Up to {event.expectedAttendance} attendees</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 pt-4" />

        {/* Description */}
        {event.description && (
          <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
            {event.description}
          </div>
        )}

        {/* CTA section */}
        <div className="mt-8 pb-24 sm:pb-8">
          {registrationState === 'open' && (
            <Link
              href={`/events/${orgSlug}/${eventSlug}/register`}
              className="inline-block w-full sm:w-auto text-center px-8 py-3.5 rounded-xl text-white font-semibold text-sm shadow-sm transition-all duration-200 hover:opacity-90 active:scale-[0.97] cursor-pointer"
              style={{ backgroundColor: primaryColor }}
            >
              Register Now
            </Link>
          )}

          {registrationState === 'waitlist' && (
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                <Users className="w-4 h-4" />
                This event is at capacity, but you can join the waitlist.
              </div>
              <Link
                href={`/events/${orgSlug}/${eventSlug}/register`}
                className="inline-block w-full sm:w-auto text-center px-8 py-3.5 rounded-xl text-white font-semibold text-sm shadow-sm transition-all duration-200 hover:opacity-90 active:scale-[0.97] cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                Join Waitlist
              </Link>
            </div>
          )}

          {registrationState === 'full' && (
            <div className="inline-flex items-center gap-2 px-5 py-3 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-600 font-medium">
              <Users className="w-4 h-4" />
              Registration is full
            </div>
          )}

          {registrationState === 'closed' && (
            <div className="inline-flex items-center gap-2 px-5 py-3 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-600 font-medium">
              Registration Closed
            </div>
          )}

          {registrationState === 'not_open_yet' && form.openAt && (
            <div className="inline-flex items-center gap-2 px-5 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 font-medium">
              <Calendar className="w-4 h-4" />
              Registration Opens {form.openAt.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          )}
        </div>
      </div>

      {/* Mobile sticky CTA */}
      {registrationState === 'open' && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 sm:hidden z-10">
          <Link
            href={`/events/${orgSlug}/${eventSlug}/register`}
            className="block w-full text-center px-6 py-3.5 rounded-xl text-white font-semibold text-sm shadow-md transition-all duration-200 hover:opacity-90 active:scale-[0.97] cursor-pointer"
            style={{ backgroundColor: primaryColor }}
          >
            Register Now
          </Link>
        </div>
      )}
    </div>
  )
}
