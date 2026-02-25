import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lionheart Platform',
  description: 'School operations and facilities management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
