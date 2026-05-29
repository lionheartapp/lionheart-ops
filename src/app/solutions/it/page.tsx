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
        src: '/marketing/generated/solution-it-helpdesk.jpg',
        alt: 'Lionheart Academy IT support hero image with product cards for a projector ticket, linked device, room, owner, and open device metric.',
        presentation: 'campaign',
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
          body: 'Use roles, permissions, MFA, and passkeys to keep school support access controlled.',
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
