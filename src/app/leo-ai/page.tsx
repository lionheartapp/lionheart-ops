import type { Metadata } from 'next'
import { FileText, Search, Sparkles } from 'lucide-react'
import SeoLandingPage from '@/components/public/SeoLandingPage'

export const metadata: Metadata = {
  title: 'AI for School Operations | Leo AI by Lionheart',
  description: 'Leo AI helps schools ask questions, draft updates, summarize work, and reason across events, tickets, maintenance, forms, and assets.',
}

export default function LeoAiPage() {
  return (
    <SeoLandingPage
      eyebrow="Leo AI"
      title="Leo helps staff answer what changed today."
      description="Leo helps staff ask questions, draft updates, summarize activity, and find context across events, tickets, maintenance, assets, forms, and messages."
      primaryCta="Start trial"
      visual={{
        src: '/marketing/generated/leo-ai-operations.jpg',
        alt: 'Lionheart Academy Leo AI hero image with product cards showing operational sources and a drafted answer.',
        presentation: 'campaign',
      }}
      sections={[
        {
          icon: Search,
          title: 'Ask across school work',
          body: 'Find context across tickets, events, assets, work orders, forms, and staff messages.',
        },
        {
          icon: FileText,
          title: 'Draft the next step',
          body: 'Create staff updates, family-facing drafts, summaries, reports, and follow-up notes from the work already in Lionheart.',
        },
        {
          icon: Sparkles,
          title: 'Support every team',
          body: 'Help office, IT, facilities, events, and administrators work from the same recent details instead of separate notes.',
        },
      ]}
      checklistTitle="Give staff faster answers without sending them through every tool."
      checklist={[
        'Answer questions using events, tickets, work orders, forms, messages, and assets already in Lionheart.',
        'Help staff understand what happened, who owns it, and what should happen next.',
        'Draft useful updates while leaving final control with the school team.',
        'Respect permissions so staff only see the work they are allowed to access.',
      ]}
      related={[
        { label: 'Platform overview', href: '/platform' },
        { label: 'Events & calendars', href: '/solutions/events' },
        { label: 'Maintenance', href: '/solutions/maintenance' },
        { label: 'Security', href: '/security' },
      ]}
    />
  )
}
