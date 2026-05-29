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
        src: '/marketing/generated/solution-messaging.jpg',
        alt: 'Lionheart Academy messaging hero image with product cards for an awards night thread and notified school teams.',
        presentation: 'campaign',
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
          body: 'Keep conversations close to events, tickets, forms, rooms, and tasks instead of scattered across separate threads.',
        },
        {
          icon: Bell,
          title: 'Timely notifications',
          body: 'Send updates through the channels staff already use in the school day, including mobile notifications.',
        },
      ]}
      checklistTitle="Staff communication works better when it stays connected to the work."
      productShowcase="messaging"
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
