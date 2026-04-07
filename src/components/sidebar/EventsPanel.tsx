'use client'

import PrefetchLink from '@/components/PrefetchLink'
import {
  Home,
  Calendar,
  ScrollText,
  Sparkles,
} from 'lucide-react'
import { CalendarClock } from 'lucide-react'

interface EventsPanelProps {
  pathname: string
  setIsOpen: (open: boolean) => void
}

export default function EventsPanel({
  pathname,
  setIsOpen,
}: EventsPanelProps) {
  const navLinks = [
    { href: '/events', label: 'Events Hub', icon: Home, match: (p: string) => p === '/events' },
    { href: '/calendar', label: 'Calendar', icon: Calendar, match: (p: string) => p.startsWith('/calendar') },
    { href: '/planning', label: 'Planning', icon: ScrollText, match: (p: string) => p.startsWith('/planning') },
    { href: '/events/new/ai', label: 'Create with Leo', icon: Sparkles, match: (p: string) => p.startsWith('/events/new/ai') },
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-10 pb-4 border-b border-white/30 flex items-center gap-2">
        <CalendarClock className="w-5 h-5 text-primary-500 flex-shrink-0" aria-hidden="true" />
        <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Events</h2>
      </div>

      <div className="px-3 pt-4 flex-shrink-0">
        <nav className="space-y-1" aria-label="Events navigation">
          {navLinks.map((link) => {
            const Icon = link.icon
            const active = link.match(pathname)
            return (
              <PrefetchLink
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                  active
                    ? 'text-slate-900 font-semibold bg-[rgb(236,241,252)]'
                    : 'text-slate-600 hover:bg-white/30 hover:text-slate-900'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-primary-500' : ''}`} aria-hidden="true" />
                {link.label}
              </PrefetchLink>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
