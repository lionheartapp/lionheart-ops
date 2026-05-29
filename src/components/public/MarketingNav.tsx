'use client'

import Link from 'next/link'
import type { ElementType } from 'react'
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  FileText,
  HelpCircle,
  LifeBuoy,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react'

type NavLink = {
  label: string
  description: string
  href: string
  icon: ElementType
}

type NavGroup = {
  title: string
  links: NavLink[]
}

const productGroups: NavGroup[] = [
  {
    title: 'Platform',
    links: [
      {
        label: 'Operations workspace',
        description: 'Events, work orders, tickets, forms, and messages together.',
        href: '/platform',
        icon: ClipboardCheck,
      },
      {
        label: 'Leo AI',
        description: 'Answers and drafts grounded in school operations data.',
        href: '/leo-ai',
        icon: Sparkles,
      },
      {
        label: 'Security basics',
        description: 'MFA, passkeys, roles, permissions, and audit-ready controls.',
        href: '/security',
        icon: ShieldCheck,
      },
    ],
  },
]

const solutionGroups: NavGroup[] = [
  {
    title: 'Teams',
    links: [
      {
        label: 'Events & calendars',
        description: 'Approvals, rooms, resources, and parent-facing schedules.',
        href: '/solutions/events',
        icon: CalendarDays,
      },
      {
        label: 'IT & devices',
        description: 'Help desk tickets, assets, devices, and routing.',
        href: '/solutions/it',
        icon: MessageSquare,
      },
      {
        label: 'Maintenance',
        description: 'Work orders, asset history, and preventive schedules.',
        href: '/solutions/maintenance',
        icon: Wrench,
      },
    ],
  },
  {
    title: 'Workflows',
    links: [
      {
        label: 'Forms & registration',
        description: 'Submissions, payments, approvals, and follow-up.',
        href: '/solutions/forms-registration',
        icon: FileText,
      },
      {
        label: 'Staff messaging',
        description: 'Threads, channels, and updates tied to the work.',
        href: '/solutions/messaging',
        icon: MessageSquare,
      },
    ],
  },
]

const resourceGroups: NavGroup[] = [
  {
    title: 'Learn',
    links: [
      {
        label: 'Help center',
        description: 'Browse setup and product guidance.',
        href: '/help',
        icon: HelpCircle,
      },
      {
        label: 'About Lionheart',
        description: 'Why we are building school operations software.',
        href: '/about',
        icon: BookOpen,
      },
    ],
  },
  {
    title: 'Connect',
    links: [
      {
        label: 'Talk to sales',
        description: 'Ask about setup, pricing, or fit.',
        href: '/contact?topic=sales',
        icon: LifeBuoy,
      },
      {
        label: 'Status',
        description: 'Check platform availability.',
        href: '/status',
        icon: ShieldCheck,
      },
    ],
  },
]

function MegaMenu({ label, groups }: { label: string; groups: NavGroup[] }) {
  return (
    <div className="group/menu relative">
      <button
        type="button"
        className="flex cursor-pointer items-center gap-1 rounded-full px-3 py-2 text-[14px] font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-950 group-focus-within/menu:bg-slate-100 group-focus-within/menu:text-slate-950"
        aria-haspopup="true"
      >
        {label}
        <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-hover/menu:rotate-180 group-focus-within/menu:rotate-180" />
      </button>

      <div className="invisible absolute left-1/2 top-full z-50 w-max -translate-x-1/2 pt-3 opacity-0 transition-all duration-200 group-hover/menu:visible group-hover/menu:opacity-100 group-focus-within/menu:visible group-focus-within/menu:opacity-100">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white/[0.98] p-4 text-left shadow-[0_24px_80px_rgba(15,15,15,0.14)] backdrop-blur-xl">
          <div className="grid auto-cols-[300px] grid-flow-col gap-3">
            {groups.map((group) => (
              <div key={group.title}>
                <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {group.title}
                </div>
                <div className="space-y-1">
                  {group.links.map((item) => {
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        className="group/item flex rounded-2xl p-3 transition-colors duration-200 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      >
                        <span className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors duration-200 group-hover/item:border-slate-300 group-hover/item:bg-slate-950 group-hover/item:text-white">
                          <Icon className="h-4.5 w-4.5" strokeWidth={2.2} />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold leading-5 text-slate-950">
                            {item.label}
                          </span>
                          <span className="mt-0.5 block max-w-[220px] text-xs leading-5 text-slate-500">
                            {item.description}
                          </span>
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MarketingNav() {
  return (
    <nav className="sticky top-3 z-40 px-3 sm:top-4 sm:px-6" role="navigation" aria-label="Main navigation">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-4 rounded-full border border-slate-200/80 bg-white/90 px-4 shadow-[0_14px_50px_rgba(15,15,15,0.08)] backdrop-blur-md sm:px-5">
        <Link
          href="/"
          className="flex items-center rounded px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          aria-label="Lionheart - home"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG logo renders more cleanly here than next/image and avoids dev sizing warnings. */}
          <img src="/logo.svg" alt="Lionheart" className="h-7 w-auto" />
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          <MegaMenu label="Platform" groups={productGroups} />
          <MegaMenu label="Solutions" groups={solutionGroups} />
          <MegaMenu label="Resources" groups={resourceGroups} />
          <Link
            href="/pricing"
            className="rounded-full px-3 py-2 text-[14px] font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-950"
          >
            Pricing
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/signin"
            className="hidden rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-950 active:scale-[0.98] sm:inline-flex"
            aria-label="Sign in to your account"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-px hover:bg-slate-800 active:scale-[0.98]"
            aria-label="Get started - create a new school account"
          >
            Start trial
          </Link>
        </div>
      </div>
    </nav>
  )
}
