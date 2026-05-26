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
      title="AI for school operations, grounded in the work your teams already do."
      description="Leo helps staff ask operational questions, draft updates, summarize activity, and find context across school events, tickets, maintenance, assets, forms, and messages."
      primaryCta="Start trial"
      visual={{
        photo: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=82',
        alt: 'Staff member working with a laptop in an education operations context.',
        accent: '#7c3aed',
        metric: '4',
        metricLabel: 'source types used in one answer',
        productTitle: 'What changed for tonight?',
        productSubtitle: 'Leo AI answer',
        chips: ['Events source', 'Ticket source', 'Draft ready'],
        rows: [
          { label: 'Events', value: 'Found', tone: 'green' },
          { label: 'Tickets', value: 'Linked', tone: 'blue' },
          { label: 'Draft', value: 'Ready', tone: 'dark' },
        ],
      }}
      sections={[
        {
          icon: Search,
          title: 'Ask across the workspace',
          body: 'Find context across tickets, events, assets, work orders, forms, and school operations records.',
        },
        {
          icon: FileText,
          title: 'Draft the next step',
          body: 'Create staff updates, family-facing drafts, summaries, reports, and follow-up notes from existing operational data.',
        },
        {
          icon: Sparkles,
          title: 'Support every team',
          body: 'Help office, IT, facilities, events, and administrators work from the same memory instead of separate notes.',
        },
      ]}
      checklistTitle="Leo is positioned as an operations layer, not a generic chatbot."
      checklist={[
        'Ground answers in school operational records instead of disconnected prompts.',
        'Help staff understand what happened, who owns it, and what should happen next.',
        'Draft useful updates while leaving final control with the school team.',
        'Connect AI to events, work orders, tickets, forms, messages, and assets.',
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
