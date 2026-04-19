/**
 * /r/[eventSlug] — Public event registration with styled layouts.
 *
 * Renders the registration form in one of three public styles:
 * - MINIMAL: Centered card on a colored background
 * - SPLIT: Form + image side-by-side
 * - HERO: Image banner on top, form below
 *
 * Server component that fetches data, then renders a client form wrapper.
 */

import { notFound } from 'next/navigation'
import { rawPrisma } from '@/lib/db'
import PublicRegistrationForm from './PublicRegistrationForm'

async function getFormData(eventSlug: string) {
  const form = await rawPrisma.registrationForm.findUnique({
    where: { shareSlug: eventSlug },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
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
        },
      },
      sections: {
        orderBy: { sortOrder: 'asc' },
        include: {
          fields: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  })

  if (!form) return null

  // Check open/close dates
  const now = new Date()
  if (form.openAt && form.openAt > now) return { ...form, status: 'not_open_yet' as const }
  if (form.closeAt && form.closeAt < now) return { ...form, status: 'closed' as const }

  return { ...form, status: 'open' as const }
}

export default async function PublicRegistrationPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>
}) {
  const { eventSlug } = await params
  const data = await getFormData(eventSlug)

  if (!data) notFound()

  const {
    organization: org,
    eventProject: event,
    sections,
    publicStyle,
    publicCtaColor,
    publicBgColor,
    publicImageUrl,
    publicImageSide,
    status,
  } = data

  if (!event) notFound()

  // Serialize dates for client
  const eventInfo = {
    title: event.title,
    description: event.description,
    locationText: event.locationText,
    startsAt: event.startsAt?.toISOString() ?? null,
    endsAt: event.endsAt?.toISOString() ?? null,
    coverImageUrl: event.coverImageUrl,
  }

  const orgInfo = {
    name: org.name,
    logoUrl: org.logoUrl,
    slug: org.slug,
  }

  const serializedSections = sections.map((s) => ({
    id: s.id,
    title: s.title,
    sortOrder: s.sortOrder,
    fields: s.fields.map((f) => ({
      id: f.id,
      label: f.label,
      inputType: f.inputType,
      required: f.required,
      helpText: f.helpText,
      placeholder: f.placeholder,
      options: f.options as unknown,
      sortOrder: f.sortOrder,
    })),
  }))

  return (
    <PublicRegistrationForm
      eventSlug={eventSlug}
      event={eventInfo}
      org={orgInfo}
      sections={serializedSections}
      publicStyle={publicStyle}
      publicCtaColor={publicCtaColor ?? '#4f46e5'}
      publicBgColor={publicBgColor ?? '#f5f4f0'}
      publicImageUrl={publicImageUrl ?? event.coverImageUrl}
      publicImageSide={publicImageSide}
      status={status}
    />
  )
}
