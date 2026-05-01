import type { Metadata } from 'next'
import PublicNav from '@/components/public/PublicNav'
import PublicFooter from '@/components/public/PublicFooter'

export const metadata: Metadata = {
  title: {
    default: 'Help Center — Lionheart',
    template: '%s — Lionheart Help',
  },
  description:
    'Guides, walkthroughs, and reference for using Lionheart — the school operations platform for K-12.',
  alternates: { canonical: 'https://lionheartapp.com/help' },
  openGraph: {
    type: 'website',
    siteName: 'Lionheart',
    title: 'Help Center — Lionheart',
    description:
      'Guides, walkthroughs, and reference for using Lionheart.',
    url: 'https://lionheartapp.com/help',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Help Center — Lionheart',
    description:
      'Guides, walkthroughs, and reference for using Lionheart.',
  },
}

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <PublicNav />
      {children}
      <PublicFooter />
    </div>
  )
}
