'use client'

import PrefetchLink from '@/components/PrefetchLink'
import {
  Home,
  Calendar,
  ScrollText,
} from 'lucide-react'

interface EventsPanelProps {
  pathname: string
  setIsOpen: (open: boolean) => void
}

export default function EventsPanel({
  pathname,
  setIsOpen,
}: EventsPanelProps) {
  const navLinks = [
    { href: '/calendar', label: 'Calendar', icon: Calendar, match: (p: string) => p.startsWith('/calendar') },
    { href: '/events', label: 'Events Hub', icon: Home, match: (p: string) => p === '/events' },
    { href: '/planning', label: 'Year Plans', icon: ScrollText, match: (p: string) => p.startsWith('/planning') },
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-10 flex-shrink-0">
        <div className="px-3 pb-3">
          <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">Calendar</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">What is coming up, what is being planned, and what needs timing.</p>
        </div>
        <nav className="space-y-0.5" aria-label="Events navigation">
          {navLinks.map((link) => {
            const Icon = link.icon
            const active = link.match(pathname)
            return (
              <PrefetchLink
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 min-h-[40px] rounded-xl text-[13.5px] transition-colors focus:outline-none"
                style={{
                  backgroundColor: active ? '#f6f4f0' : 'transparent',
                  color: active ? '#1a1915' : '#6a6864',
                  fontWeight: active ? 600 : 500,
                  letterSpacing: '-0.005em',
                }}
                aria-current={active ? 'page' : undefined}
              >
                <Icon
                  className="w-[18px] h-[18px] flex-shrink-0"
                  strokeWidth={active ? 2.25 : 1.75}
                  aria-hidden="true"
                />
                {link.label}
              </PrefetchLink>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
