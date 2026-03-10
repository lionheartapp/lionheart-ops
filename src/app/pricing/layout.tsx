import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing | Lionheart',
  description: 'Simple, transparent pricing for school operations management. Start free, upgrade when ready.',
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
