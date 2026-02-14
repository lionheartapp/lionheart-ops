import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'School Facility Management',
  description: 'School Facility Management Platform',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-zinc-50 dark:bg-zinc-950">
        {children}
      </body>
    </html>
  )
}
