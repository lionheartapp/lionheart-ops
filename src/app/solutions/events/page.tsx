import type { Metadata } from 'next'
import { CalendarDays, ClipboardCheck, FileText } from 'lucide-react'
import SeoLandingPage from '@/components/public/SeoLandingPage'

export const metadata: Metadata = {
  title: 'School Event Management Software | Lionheart',
  description: 'Plan school events with room requests, approval workflows, resource needs, staff coordination, and parent-facing schedules in one place.',
}

export default function EventsSolutionPage() {
  return (
    <SeoLandingPage
      eyebrow="Events & calendars"
      title="School event management software that connects the whole day."
      description="Lionheart helps schools plan events, route approvals, reserve rooms, coordinate resources, publish calendars, and keep staff aligned from request to day-of execution."
      visual={{
        src: '/marketing/generated/solution-events-calendar.jpg',
        alt: 'Lionheart Academy events hero image with product cards for awards night planning, room approval, A/V routing, and family notes.',
        presentation: 'campaign',
        framing: 'left-detail',
      }}
      sections={[
        {
          icon: CalendarDays,
          title: 'Calendar planning',
          body: 'Manage event requests, rooms, resources, and schedule conflicts from a shared school calendar.',
        },
        {
          icon: ClipboardCheck,
          title: 'Approval workflows',
          body: 'Route events through office, facilities, athletics, A/V, or administrative approval before details are finalized.',
        },
        {
          icon: FileText,
          title: 'Day-of details',
          body: 'Keep forms, setup needs, equipment, messages, and follow-up tasks attached to the event record.',
        },
      ]}
      checklistTitle="A cleaner way to run concerts, field trips, assemblies, meetings, and game days."
      checklist={[
        'Reduce double-booked rooms and missing equipment requests.',
        'Attach approvals, forms, messages, and setup details to the event.',
        'Give staff one place to check what is approved, assigned, and still pending.',
        'Publish parent-facing schedules without duplicating the same event data in multiple tools.',
      ]}
      related={[
        { label: 'Platform overview', href: '/platform' },
        { label: 'Forms & registration', href: '/solutions/forms-registration' },
        { label: 'Staff messaging', href: '/solutions/messaging' },
        { label: 'Leo AI', href: '/leo-ai' },
      ]}
    />
  )
}
