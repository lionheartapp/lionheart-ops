import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About | Lionheart',
  description: 'Learn about Lionheart — the school operations platform built by educators for educators.',
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
