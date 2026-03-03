import type { Metadata } from 'next'
import { Instrument_Serif, Poppins } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const headingFont = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-heading',
})

const bodyFont = Poppins({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
})

export const metadata: Metadata = {
  title: 'Lionheart Operations Platform',
  description: 'Single-app, strict multi-tenant school operations platform',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${headingFont.variable} ${bodyFont.variable}`}>
      <body className="min-h-screen antialiased bg-white font-body">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}