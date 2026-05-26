import type { Metadata } from 'next'
import { ClipboardCheck, QrCode, Wrench } from 'lucide-react'
import SeoLandingPage from '@/components/public/SeoLandingPage'

export const metadata: Metadata = {
  title: 'School Maintenance Management Software | Lionheart',
  description: 'Track school maintenance work orders, assets, preventive schedules, room requests, and status updates in one shared operations workspace.',
}

export default function MaintenanceSolutionPage() {
  return (
    <SeoLandingPage
      eyebrow="Maintenance"
      title="School maintenance management software with a real memory."
      description="Lionheart helps facilities teams intake work orders, assign owners, track asset history, schedule preventive maintenance, and keep offices updated without long email chains."
      visual={{
        photo: 'https://images.unsplash.com/photo-1581090464777-f3220bbe1b8b?auto=format&fit=crop&w=1000&q=82',
        alt: 'Maintenance and facilities work context.',
        accent: '#0f9f6e',
        metric: '4',
        metricLabel: 'campus work orders visible today',
        productTitle: 'Gym AC unit',
        productSubtitle: 'Facilities queue',
        chips: ['Priority visible', 'Asset history', 'Room impact'],
        rows: [
          { label: 'Priority', value: 'Urgent', tone: 'red' },
          { label: 'Owner', value: 'Facilities', tone: 'dark' },
          { label: 'Status', value: 'In progress', tone: 'amber' },
        ],
      }}
      sections={[
        {
          icon: Wrench,
          title: 'Work order routing',
          body: 'Capture the issue, location, priority, owner, and status so each request has a clear path to resolution.',
        },
        {
          icon: QrCode,
          title: 'Asset history',
          body: 'Connect work orders to rooms, equipment, QR labels, labor, parts, and previous repairs.',
        },
        {
          icon: ClipboardCheck,
          title: 'Preventive schedules',
          body: 'Plan recurring work around the school calendar so maintenance is visible before it becomes urgent.',
        },
      ]}
      checklistTitle="A better way to handle facilities requests across classrooms, offices, gyms, and campuses."
      checklist={[
        'Give teachers and staff a simple way to submit maintenance needs.',
        'Help facilities teams prioritize urgent work and see what is already assigned.',
        'Keep asset repair history available for future decisions.',
        'Connect facilities work to events, rooms, and campus operations.',
      ]}
      related={[
        { label: 'Platform overview', href: '/platform' },
        { label: 'Events & calendars', href: '/solutions/events' },
        { label: 'IT & devices', href: '/solutions/it' },
        { label: 'Leo AI', href: '/leo-ai' },
      ]}
    />
  )
}
