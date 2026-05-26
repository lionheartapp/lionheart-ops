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
        photo: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1000&q=82',
        alt: 'School staff planning around a shared table.',
        accent: '#2563eb',
        metric: '6:00',
        metricLabel: 'conflict caught before the event',
        productTitle: 'Awards night plan',
        productSubtitle: 'Events calendar',
        chips: ['Room approved', 'A/V routed', 'Family note ready'],
        rows: [
          { label: 'Gym', value: 'Approved', tone: 'green' },
          { label: 'A/V', value: 'Routed', tone: 'blue' },
          { label: 'Setup', value: 'Pending', tone: 'amber' },
        ],
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
