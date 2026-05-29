import type { Metadata } from 'next'
import { CalendarDays, ClipboardCheck, MessageSquare } from 'lucide-react'
import SeoLandingPage from '@/components/public/SeoLandingPage'

export const metadata: Metadata = {
  title: 'School Operations Platform | Lionheart',
  description: 'Lionheart brings school events, work orders, IT tickets, forms, messages, approvals, and payments into one shared operations workspace.',
}

export default function PlatformPage() {
  return (
    <SeoLandingPage
      eyebrow="School operations platform"
      title="One workspace for the work that keeps school running."
      description="Lionheart connects daily school operations across events, facilities, IT, forms, messaging, approvals, and payments so staff can see what needs attention without chasing updates across separate tools."
      visual={{
        src: '/marketing/generated/platform-overview.jpg',
        alt: 'Lionheart Academy platform overview hero image with dashboard cards for events, tickets, forms, and connected school work.',
        presentation: 'campaign',
        framing: 'left-detail',
      }}
      stats={[
        { value: '12', label: 'areas of school work connected in one workspace' },
        { value: '30 days', label: 'full trial without a credit card' },
        { value: 'Unlimited', label: 'staff accounts on every paid plan' },
      ]}
      sections={[
        {
          icon: CalendarDays,
          title: 'Plan the day',
          body: 'Events, rooms, resources, approvals, and schedules stay connected to the same operational plan.',
        },
        {
          icon: ClipboardCheck,
          title: 'Resolve the work',
          body: 'Work orders, IT tickets, assets, and follow-up history give every request a clear owner and status.',
        },
        {
          icon: MessageSquare,
          title: 'Keep people aligned',
          body: 'Staff messages, notifications, and Leo AI answers live beside the work they reference.',
        },
      ]}
      checklistTitle="Bring the daily work of school operations into one calm place."
      checklist={[
        'Replace scattered spreadsheets, form tools, ticket queues, and chat threads with one shared view.',
        'Help office, IT, maintenance, teachers, and administrators see the same status.',
        'Keep events connected to rooms, work orders, messages, forms, and approvals.',
        'Support single-school and multi-school operations without limiting staff accounts.',
      ]}
      related={[
        { label: 'Events & calendars', href: '/solutions/events' },
        { label: 'Maintenance', href: '/solutions/maintenance' },
        { label: 'IT & devices', href: '/solutions/it' },
        { label: 'Pricing', href: '/pricing' },
      ]}
    />
  )
}
