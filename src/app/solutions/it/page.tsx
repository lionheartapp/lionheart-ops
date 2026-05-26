import type { Metadata } from 'next'
import { HardDrive, MessageSquare, ShieldCheck } from 'lucide-react'
import SeoLandingPage from '@/components/public/SeoLandingPage'

export const metadata: Metadata = {
  title: 'School IT Help Desk Software | Lionheart',
  description: 'Manage school IT tickets, devices, routing, staff requests, and support history in one operations workspace.',
}

export default function ItSolutionPage() {
  return (
    <SeoLandingPage
      eyebrow="IT & devices"
      title="School IT help desk software built for campus support."
      description="Lionheart gives school IT teams a clear way to intake requests, route tickets, track devices, coordinate with staff, and keep support history connected to rooms, users, and assets."
      visual={{
        photo: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1000&q=82',
        alt: 'School technology support context with people working around laptops.',
        accent: '#2f7fd5',
        metric: '27',
        metricLabel: 'devices linked to open support work',
        productTitle: 'Projector not connecting',
        productSubtitle: 'IT support queue',
        chips: ['Device context', 'Room history', 'SLA routing'],
        rows: [
          { label: 'Room 204', value: 'Open', tone: 'blue' },
          { label: 'MacBook Air', value: 'Linked', tone: 'green' },
          { label: 'Owner', value: 'IT', tone: 'dark' },
        ],
      }}
      sections={[
        {
          icon: MessageSquare,
          title: 'Ticket intake',
          body: 'Give teachers and staff a simple way to report issues while IT gets priority, owner, room, and status in one queue.',
        },
        {
          icon: HardDrive,
          title: 'Device context',
          body: 'Keep assets, rooms, users, and support history connected so recurring device issues are easier to spot.',
        },
        {
          icon: ShieldCheck,
          title: 'Role-aware access',
          body: 'Use roles, permissions, MFA, and passkeys to keep school support workflows controlled.',
        },
      ]}
      checklistTitle="A school IT queue that understands classrooms, rooms, devices, and staff."
      checklist={[
        'Route support requests by team, priority, campus, and location.',
        'Keep issue history tied to the people, rooms, and equipment involved.',
        'Give staff visibility into ticket status without extra email follow-up.',
        'Connect IT work to the broader school day when events, forms, or messages are involved.',
      ]}
      related={[
        { label: 'Platform overview', href: '/platform' },
        { label: 'Maintenance', href: '/solutions/maintenance' },
        { label: 'Security', href: '/security' },
        { label: 'Pricing', href: '/pricing' },
      ]}
    />
  )
}
