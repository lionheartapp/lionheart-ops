import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/providers'

export const metadata: Metadata = {
  title: 'Lionheart Operations Platform',
  description: 'Single-app, strict multi-tenant school operations platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}