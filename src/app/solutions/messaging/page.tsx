import type { Metadata } from 'next'
import { Bell, MessageCircle, MessageSquare } from 'lucide-react'
import SeoLandingPage from '@/components/public/SeoLandingPage'

export const metadata: Metadata = {
  title: 'School Staff Messaging Software | Lionheart',
  description: 'Keep school staff communication connected to events, tickets, work orders, forms, and daily operations.',
}

export default function MessagingSolutionPage() {
  return (
    <SeoLandingPage
      eyebrow="Staff messaging"
      title="School staff messaging tied to the work people are talking about."
      description="Lionheart keeps staff messages, channels, threads, notifications, and operational context together so schools can reduce scattered updates across email, chat, and text."
      visual={{
        photo: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1000&q=82',
        alt: 'School staff communication context with a small team conversation.',
        accent: '#14b8a6',
        metric: '3',
        metricLabel: 'teams notified from one thread',
        productTitle: 'Awards night thread',
        productSubtitle: 'Staff messaging',
        chips: ['Event linked', 'Read status', 'Mobile push'],
        rows: [
          { label: 'Office', value: 'Sent', tone: 'green' },
          { label: 'Coaches', value: 'Replied', tone: 'blue' },
          { label: 'Facilities', value: 'Notified', tone: 'dark' },
        ],
      }}
      sections={[
        {
          icon: MessageCircle,
          title: 'Staff conversations',
          body: 'Create direct messages, channels, and threads for the teams doing the work.',
        },
        {
          icon: MessageSquare,
          title: 'Context-aware updates',
          body: 'Keep conversations close to events, tickets, forms, rooms, and tasks instead of separated from the workflow.',
        },
        {
          icon: Bell,
          title: 'Timely notifications',
          body: 'Send updates through the channels staff already use in the school day, including mobile notifications.',
        },
      ]}
      checklistTitle="Staff communication works better when it is attached to the operational record."
      checklist={[
        'Reduce one-off email threads about events, work orders, and requests.',
        'Help the right teams see updates without looping everyone into everything.',
        'Keep decisions and follow-up visible after the conversation ends.',
        'Connect staff messaging to Leo AI, tickets, events, and forms.',
      ]}
      related={[
        { label: 'Platform overview', href: '/platform' },
        { label: 'Events & calendars', href: '/solutions/events' },
        { label: 'Forms & registration', href: '/solutions/forms-registration' },
        { label: 'Leo AI', href: '/leo-ai' },
      ]}
    />
  )
}
