'use client'

/**
 * Lionheart Marketing Landing Page
 *
 * Design system: monochrome restraint (Cal.com) + warm near-black
 * (Notion/Superhuman). Mockups are inline SVG/divs matching the
 * reskinned UpcomingEventsPanel tokens so the marketing surface
 * and the product surface read as one cohesive product.
 *
 * All mockup data is fabricated — no live data hits this page.
 */

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { animate, AnimatePresence, motion, MotionConfig, useInView, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  ClipboardCheck,
  FileText,
  HardDrive,
  MessageCircle,
  MessageSquare,
  MonitorSmartphone,
  Sparkles,
  Wrench,
} from 'lucide-react'
import {
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, BORDER, BORDER_SOFT,
  SURFACE_ALT, CARD_SHADOW, AI_GRADIENT, EASE, REVEAL_VIEWPORT, REVEAL_VARIANTS,
} from '@/components/landing/tokens'
import { MockEventDetailCard, MockMaintenanceCard } from '@/components/landing/Mockups'
import { LeoSection, ClosingCTA, Footer } from '@/components/landing/BottomSections'
import MarketingNav from '@/components/public/MarketingNav'

/**
 * Counts up from 0 to `to` when the element enters the viewport.
 * Respects prefers-reduced-motion — jumps straight to the final value.
 */
function CountUp({
  to,
  duration = 1.4,
  suffix = '',
  prefix = '',
  format = (n: number) => Math.round(n).toLocaleString('en-US'),
}: {
  to: number
  duration?: number
  suffix?: string
  prefix?: string
  format?: (n: number) => string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!inView || !ref.current) return
    if (reduced) {
      ref.current.textContent = `${prefix}${format(to)}${suffix}`
      return
    }
    const controls = animate(0, to, {
      duration,
      ease: EASE,
      onUpdate: (latest) => {
        if (ref.current) ref.current.textContent = `${prefix}${format(latest)}${suffix}`
      },
    })
    return () => controls.stop()
  }, [inView, to, duration, suffix, prefix, format, reduced])

  return <span ref={ref}>{`${prefix}${format(to)}${suffix}`}</span>
}

// ─── Entry component ────────────────────────────────────────────────────────

export default function Landing() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen" style={{ backgroundColor: '#f7f8f7', color: TEXT_PRIMARY }}>
        <MarketingNav />
        <Hero />
        <TrustBar />
        <PlatformShowcase />
        <ModulesGrid />
        <LeoSection />
        <SolutionsHub />
        <ClosingCTA />
        <Footer />
      </div>
    </MotionConfig>
  )
}

function PlatformShowcase() {
  const [activeIndex, setActiveIndex] = useState(0)
  const pillars = [
    {
      label: 'Plan',
      title: 'Coordinate the school day',
      body: 'Events, rooms, approvals, forms, and family-facing details stay tied to the same operating plan.',
      href: '/solutions/events',
      accent: '#2563eb',
      icon: Calendar,
      metrics: ['Room conflict flagged', 'Approval routed', 'Family note drafted'],
    },
    {
      label: 'Resolve',
      title: 'Move tickets and work orders',
      body: 'IT, maintenance, assets, and facilities requests get owners, status, history, and next steps.',
      href: '/solutions/maintenance',
      accent: '#059669',
      icon: ClipboardCheck,
      metrics: ['Owner assigned', 'Priority visible', 'Status shared'],
    },
    {
      label: 'Align',
      title: 'Keep staff in context',
      body: 'Messages and Leo AI sit beside the work, so teams can ask, draft, and follow up without losing context.',
      href: '/leo-ai',
      accent: '#7c3aed',
      icon: Sparkles,
      metrics: ['Thread linked', 'Sources shown', 'Draft ready'],
    },
  ]
  const active = pillars[activeIndex]
  const ActiveIcon = active.icon

  return (
    <section className="px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-[1200px]">
        <div className="grid gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: TEXT_MUTED }}>
              Platform in action
            </p>
            <h2 className="mt-4 max-w-[560px] text-4xl font-semibold leading-[1.04] sm:text-5xl" style={{ letterSpacing: 0, color: TEXT_PRIMARY }}>
              One operating system, three ways to keep the day moving.
            </h2>
            <p className="mt-5 max-w-[560px] text-[16px] leading-7" style={{ color: TEXT_SECONDARY }}>
              Lionheart connects planning, requests, messages, and AI assistance so staff can move from signal to next step without switching tools.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {pillars.map((pillar, index) => {
              const Icon = pillar.icon
              const isActive = index === activeIndex
              return (
                <button
                  key={pillar.label}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className="cursor-pointer rounded-[1.25rem] border p-4 text-left transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    borderColor: isActive ? pillar.accent : BORDER,
                    backgroundColor: isActive ? '#ffffff' : 'rgba(255,255,255,0.62)',
                    boxShadow: isActive ? '0 18px 46px rgba(15,15,15,0.09)' : '0 10px 28px rgba(15,15,15,0.04)',
                  }}
                  aria-pressed={isActive}
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: pillar.accent }}>
                    <Icon className="h-5 w-5" strokeWidth={2.4} />
                  </div>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: pillar.accent }}>
                    {pillar.label}
                  </div>
                  <div className="mt-1 text-[15px] font-semibold leading-5" style={{ color: TEXT_PRIMARY }}>
                    {pillar.title}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-10 grid gap-5 overflow-hidden rounded-[2rem] border bg-white p-4 shadow-[0_24px_80px_rgba(15,15,15,0.1)] lg:grid-cols-[0.72fr_1.28fr] lg:p-5" style={{ borderColor: BORDER }}>
          <div className="rounded-[1.5rem] bg-[#101010] p-6 text-white sm:p-7">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: active.accent }}>
              <ActiveIcon className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
              {active.label}
            </p>
            <h3 className="mt-3 text-3xl font-semibold leading-[1.08]" style={{ letterSpacing: 0 }}>
              {active.title}
            </h3>
            <p className="mt-4 text-[15px] leading-7 text-white/68">
              {active.body}
            </p>
            <Link
              href={active.href}
              className="mt-7 inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-950 transition-transform duration-200 hover:-translate-y-px active:scale-[0.98]"
            >
              Explore {active.label.toLowerCase()}
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </Link>
          </div>

          <div className="rounded-[1.5rem] border bg-[#f7f8f7] p-4 sm:p-5" style={{ borderColor: BORDER_SOFT }}>
            <div className="rounded-[1.25rem] border bg-white shadow-[0_18px_55px_rgba(15,15,15,0.08)]" style={{ borderColor: BORDER }}>
              <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: BORDER_SOFT }}>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold" style={{ color: TEXT_MUTED }}>
                  Live operations workspace
                </span>
              </div>

              <div className="grid gap-4 p-4 md:grid-cols-[0.34fr_0.66fr]">
                <div className="space-y-2">
                  {pillars.map((pillar, index) => (
                    <div
                      key={pillar.label}
                      className="rounded-2xl border px-3 py-3"
                      style={{
                        borderColor: index === activeIndex ? pillar.accent : BORDER_SOFT,
                        backgroundColor: index === activeIndex ? '#f8fafc' : '#ffffff',
                      }}
                    >
                      <div className="text-[12px] font-semibold" style={{ color: TEXT_PRIMARY }}>
                        {pillar.label}
                      </div>
                      <div className="mt-1 text-[11px] leading-4" style={{ color: TEXT_MUTED }}>
                        {pillar.title}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border p-4" style={{ borderColor: BORDER_SOFT, backgroundColor: '#fbfcfb' }}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: active.accent }}>
                        {active.label} view
                      </div>
                      <div className="mt-1 text-xl font-semibold" style={{ color: TEXT_PRIMARY }}>
                        {active.title}
                      </div>
                    </div>
                    <div className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-white" style={{ backgroundColor: active.accent }}>
                      Connected
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {active.metrics.map((metric) => (
                      <div key={metric} className="rounded-2xl border bg-white p-3" style={{ borderColor: BORDER_SOFT }}>
                        <Check className="h-4 w-4" style={{ color: active.accent }} strokeWidth={3} />
                        <div className="mt-3 text-[12px] font-semibold leading-4" style={{ color: TEXT_PRIMARY }}>
                          {metric}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 space-y-2">
                    {[72, 48, 86].map((width, index) => (
                      <div key={width} className="rounded-2xl border bg-white p-3" style={{ borderColor: BORDER_SOFT }}>
                        <div className="flex items-center gap-3">
                          <span className="h-8 w-8 rounded-xl" style={{ backgroundColor: `${active.accent}18` }} />
                          <div className="flex-1">
                            <span className="block h-2.5 rounded-full" style={{ width: `${width}%`, backgroundColor: `${active.accent}2e` }} />
                            <span className="mt-2 block h-2 rounded-full bg-slate-100" style={{ width: `${Math.max(width - 22, 28)}%` }} />
                          </div>
                          <span className="h-7 w-16 rounded-full bg-slate-100" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Hero ───────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative px-4 pb-12 pt-6 sm:px-6 sm:pb-16 sm:pt-10">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 0.05, ease: EASE }}
        className="relative mx-auto min-h-[690px] max-w-[1380px] overflow-hidden rounded-[2rem] border bg-white shadow-[0_32px_100px_rgba(15,23,42,0.18)] sm:min-h-[760px] lg:min-h-[720px]"
        style={{ borderColor: BORDER_SOFT }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Generated marketing hero art is stored as a local public asset. */}
        <img
          src="/marketing/generated/homepage-lionheart-academy-hero.png"
          alt="Lionheart Academy school operations coordinator with Lionheart product cards for IT support and connected work."
          className="absolute inset-0 h-full w-full object-cover object-[32%_center] sm:object-center"
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 bg-white/70 sm:hidden" />
        <div
          className="absolute inset-0 hidden sm:block"
          style={{
            background: 'linear-gradient(90deg, #ffffff 0%, rgba(255,255,255,0.97) 24%, rgba(255,255,255,0.82) 42%, rgba(255,255,255,0.18) 65%, rgba(255,255,255,0) 100%)',
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white/45 to-transparent lg:hidden" />

        <div className="relative z-10 flex min-h-[690px] items-center px-7 py-12 sm:min-h-[760px] sm:px-12 lg:min-h-[720px] lg:px-16">
          <div className="max-w-[520px]">
            <motion.h1
              initial={{ opacity: 1, y: 16 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.5, delay: 0.12, ease: [0.25, 0.1, 0.25, 1] }}
              className="text-[40px] font-semibold leading-[1] sm:text-[54px] sm:leading-[1.02] lg:text-[58px] xl:text-[64px]"
              style={{
                letterSpacing: 0,
                color: TEXT_PRIMARY,
              }}
            >
              Run school operations from one{' '}
              <span className="text-[#2f7fd5]">shared workspace.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 1, y: 12 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.5, delay: 0.18 }}
              className="mt-6 max-w-[500px] text-[16px] leading-[1.62] sm:mt-7 sm:text-[18px] sm:leading-[1.65]"
              style={{
                letterSpacing: 0,
                color: TEXT_SECONDARY,
              }}
            >
              Tickets, work orders, events, forms, messages, approvals, and payments
              stay connected, so staff stop chasing updates and everyone knows what
              happens next.
            </motion.p>

            <motion.div
              initial={{ opacity: 1, y: 12 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.5, delay: 0.24 }}
              className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:items-center"
            >
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-semibold transition-all duration-200 hover:-translate-y-px active:scale-[0.98]"
                style={{
                  backgroundColor: TEXT_PRIMARY,
                  color: '#ffffff',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 14px rgba(0,0,0,0.1)',
                }}
              >
                Start 30-day trial
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/12">
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-semibold transition-colors duration-200 hover:bg-black/[0.04] active:scale-[0.98]"
                style={{ color: TEXT_PRIMARY }}
              >
                See pricing
                <ChevronDown className="w-4 h-4" strokeWidth={2.5} />
              </Link>
            </motion.div>

            <motion.p
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-5 text-[13px] sm:mt-6"
              style={{ color: TEXT_MUTED }}
            >
              No credit card required · Unlimited staff · Set up in minutes
            </motion.p>

          </div>
        </div>
      </motion.div>
    </section>
  )
}

function HeroProductMotion() {
  const reducedMotion = useReducedMotion()
  const [roleIndex, setRoleIndex] = useState(0)

  type Widget =
    | { kind: 'alert'; icon: typeof Calendar; title: string; detail: string; color: string; metric: string; span?: string }
    | { kind: 'checklist'; title: string; items: string[]; color: string; span?: string }
    | { kind: 'score'; title: string; home: string; away: string; time: string; color: string; span?: string }
    | { kind: 'message'; title: string; from: string; body: string; color: string; span?: string }
    | { kind: 'conversation'; title: string; color: string; messages: Array<{ from: string; body: string; align?: 'left' | 'right' }>; span?: string }
    | { kind: 'chart'; title: string; value: string; bars: number[]; color: string; span?: string }

  const roleStacks: {
    role: string
    title: string
    badge: string
    widgets: Widget[]
  }[] = [
    {
      role: 'Office',
      title: 'Awards night is coming together',
      badge: '3 signals',
      widgets: [
        {
          kind: 'alert',
          icon: Calendar,
          title: 'Calendar conflict',
          detail: 'Gym overlaps with varsity practice.',
          color: '#6366f1',
          metric: '6:00p',
          span: 'sm:col-span-2',
        },
        {
          kind: 'checklist',
          title: 'Approval path',
          items: ['Principal approved', 'Facilities routed', 'Family note ready'],
          color: '#10b981',
        },
        {
          kind: 'message',
          title: 'Leo draft',
          from: 'Leo',
          body: 'Move practice setup to Gym B and notify coaches?',
          color: '#8b5cf6',
          span: 'sm:col-span-2',
        },
      ],
    },
    {
      role: 'IT Team',
      title: 'Device patterns are visible',
      badge: '27 devices',
      widgets: [
        {
          kind: 'chart',
          title: 'Cart B health',
          value: '68%',
          bars: [58, 44, 72, 36, 68],
          color: '#2563eb',
          span: 'sm:col-span-2',
        },
        {
          kind: 'alert',
          icon: HardDrive,
          title: 'Asset records',
          detail: 'Serials and rooms attached.',
          color: '#7c3aed',
          metric: '27',
        },
        {
          kind: 'checklist',
          title: 'Ticket routing',
          items: ['Fleet ticket open', 'Loaners assigned', 'Teachers notified'],
          color: '#10b981',
          span: 'sm:col-span-2',
        },
      ],
    },
    {
      role: 'Maintenance',
      title: 'Facilities sees the next fix',
      badge: 'urgent',
      widgets: [
        {
          kind: 'alert',
          icon: Wrench,
          title: 'Leak reported',
          detail: 'Near Room 214 hallway.',
          color: '#10b981',
          metric: 'P1',
        },
        {
          kind: 'checklist',
          title: 'Safety steps',
          items: ['Shutoff note found', 'Custodial routed', 'Room impact checked'],
          color: '#ef4444',
          span: 'sm:col-span-2',
        },
        {
          kind: 'message',
          title: 'Status update',
          from: 'Facilities',
          body: 'Team assigned. Office gets an automatic follow-up.',
          color: '#f59e0b',
          span: 'sm:col-span-2',
        },
      ],
    },
    {
      role: 'Messaging',
      title: 'The right people hear it fast',
      badge: '3 replies',
      widgets: [
        {
          kind: 'conversation',
          title: 'Awards night thread',
          color: '#0ea5e9',
          messages: [
            { from: 'Office', body: 'Gym is double-booked at 6:00.' },
            { from: 'Coach Diaz', body: 'We can move practice to Gym B.', align: 'right' },
            { from: 'Leo', body: 'I drafted the family update and facilities note.', align: 'right' },
          ],
          span: 'sm:col-span-2',
        },
        {
          kind: 'alert',
          icon: MessageSquare,
          title: 'Audience matched',
          detail: 'Office, coaches, and facilities are linked.',
          color: '#0ea5e9',
          metric: '3',
        },
        {
          kind: 'checklist',
          title: 'Message status',
          items: ['Staff thread open', 'Family note drafted', 'Read receipts live'],
          color: '#10b981',
          span: 'sm:col-span-2',
        },
      ],
    },
    {
      role: 'Athletics',
      title: 'Game day details line up',
      badge: 'tonight',
      widgets: [
        {
          kind: 'score',
          title: 'Varsity game',
          home: 'LHS',
          away: 'East',
          time: '7:00p',
          color: '#f59e0b',
          span: 'sm:col-span-2',
        },
        {
          kind: 'checklist',
          title: 'Game ops',
          items: ['Officials confirmed', 'Gym setup routed', 'Scorer table open'],
          color: '#6366f1',
        },
        {
          kind: 'message',
          title: 'Coach note',
          from: 'Athletics',
          body: 'Family update drafted with arrival time and ticket link.',
          color: '#10b981',
          span: 'sm:col-span-2',
        },
      ],
    },
    {
      role: 'Teachers',
      title: 'Field trip forms are almost done',
      badge: '5 missing',
      widgets: [
        {
          kind: 'alert',
          icon: FileText,
          title: 'Missing forms',
          detail: 'Guardian signatures due today.',
          color: '#6366f1',
          metric: '5',
        },
        {
          kind: 'message',
          title: 'Family reminder',
          from: 'Ms. Carter',
          body: 'Reminder text is ready with the form link.',
          color: '#10b981',
          span: 'sm:col-span-2',
        },
        {
          kind: 'checklist',
          title: 'Trip packet',
          items: ['Roster ready', 'Medication note flagged', 'Office list prepared'],
          color: '#f59e0b',
          span: 'sm:col-span-2',
        },
      ],
    },
  ]
  const activeRole = roleStacks[roleIndex]

  useEffect(() => {
    if (reducedMotion) return
    const interval = window.setInterval(() => {
      setRoleIndex((current) => (current + 1) % roleStacks.length)
    }, 5400)

    return () => window.clearInterval(interval)
  }, [reducedMotion, roleStacks.length])

  function renderWidget(widget: Widget) {
    if (widget.kind === 'alert') {
      const Icon = widget.icon
      return (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: widget.color }}>
                <Icon className="h-4.5 w-4.5" strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-[13px] font-semibold" style={{ color: TEXT_PRIMARY }}>{widget.title}</div>
                <div className="mt-0.5 text-[12px] leading-5" style={{ color: TEXT_SECONDARY }}>{widget.detail}</div>
              </div>
            </div>
            <span className="rounded-full px-2 py-1 text-[11px] font-semibold" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
              {widget.metric}
            </span>
          </div>
        </>
      )
    }

    if (widget.kind === 'checklist') {
      return (
        <>
          <div className="text-[13px] font-semibold" style={{ color: TEXT_PRIMARY }}>{widget.title}</div>
          <div className="mt-3 space-y-2">
            {widget.items.map((item) => (
              <div key={item} className="flex items-center gap-2 text-[12px]" style={{ color: TEXT_SECONDARY }}>
                <Check className="h-3.5 w-3.5 shrink-0" style={{ color: widget.color }} strokeWidth={3} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </>
      )
    }

    if (widget.kind === 'score') {
      return (
        <>
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-semibold" style={{ color: TEXT_PRIMARY }}>{widget.title}</div>
            <span className="rounded-full px-2 py-1 text-[11px] font-semibold text-white" style={{ backgroundColor: widget.color }}>
              {widget.time}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
            <div className="rounded-xl py-3 text-[15px] font-bold" style={{ backgroundColor: SURFACE_ALT, color: TEXT_PRIMARY }}>{widget.home}</div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: TEXT_MUTED }}>vs</div>
            <div className="rounded-xl py-3 text-[15px] font-bold" style={{ backgroundColor: SURFACE_ALT, color: TEXT_PRIMARY }}>{widget.away}</div>
          </div>
        </>
      )
    }

    if (widget.kind === 'message') {
      return (
        <>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: widget.color }} />
            <div className="text-[13px] font-semibold" style={{ color: TEXT_PRIMARY }}>{widget.title}</div>
          </div>
          <p className="mt-2 text-[12px] leading-5" style={{ color: TEXT_SECONDARY }}>
            <span className="font-semibold" style={{ color: TEXT_PRIMARY }}>{widget.from}:</span> {widget.body}
          </p>
        </>
      )
    }

    if (widget.kind === 'conversation') {
      return (
        <>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl text-white" style={{ backgroundColor: widget.color }}>
              <MessageCircle className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-[13px] font-semibold" style={{ color: TEXT_PRIMARY }}>{widget.title}</div>
              <div className="text-[11px] font-semibold" style={{ color: TEXT_MUTED }}>Live school-day thread</div>
            </div>
          </div>
          <div className="mt-2.5 space-y-1.5">
            {widget.messages.map((message, index) => {
              const isLeoResponse = index === widget.messages.length - 1
              const messageDelay = 1.05 + index * 0.42
              const bubbleStyle = {
                backgroundColor: message.align === 'right' ? widget.color : SURFACE_ALT,
                color: message.align === 'right' ? '#ffffff' : TEXT_SECONDARY,
                border: message.align === 'right' ? '1px solid rgba(255,255,255,0.2)' : `1px solid ${BORDER_SOFT}`,
              }

              return (
                <div key={`${message.from}-${message.body}`} className={`flex ${message.align === 'right' ? 'justify-end' : 'justify-start'}`}>
                  <div className="relative max-w-[88%]">
                    {isLeoResponse && !reducedMotion && (
                      <motion.div
                        className="absolute right-0 top-0 flex h-full items-center gap-1 rounded-xl px-3"
                        style={bubbleStyle}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 1, 1, 0] }}
                        transition={{ duration: 1.08, delay: messageDelay, times: [0, 0.18, 0.78, 1], ease: EASE }}
                      >
                        {[0, 1, 2].map((dot) => (
                          <motion.span
                            key={dot}
                            className="h-1.5 w-1.5 rounded-full bg-white/80"
                            animate={{ opacity: [0.35, 1, 0.35] }}
                            transition={{ duration: 0.7, delay: dot * 0.12, repeat: Infinity, ease: 'easeInOut' }}
                          />
                        ))}
                      </motion.div>
                    )}
                    <motion.div
                      className="rounded-xl px-2.5 py-1.5"
                      style={bubbleStyle}
                      initial={reducedMotion ? false : { opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
                      animate={{ opacity: 1, clipPath: 'inset(0 0% 0 0)' }}
                      transition={{ duration: 0.32, delay: isLeoResponse ? messageDelay + 1.02 : messageDelay, ease: EASE }}
                    >
                      <div className="text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ color: message.align === 'right' ? 'rgba(255,255,255,0.72)' : TEXT_MUTED }}>
                        {message.from}
                      </div>
                      <div className="mt-0.5 text-[11px] leading-4">{message.body}</div>
                    </motion.div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )
    }

    return (
      <>
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-semibold" style={{ color: TEXT_PRIMARY }}>{widget.title}</div>
          <div className="text-[18px] font-bold" style={{ color: widget.color }}>{widget.value}</div>
        </div>
        <div className="mt-4 flex h-16 items-end gap-1.5">
          {widget.bars.map((height, index) => (
            <div key={index} className="flex-1 rounded-t-md" style={{ height: `${height}%`, backgroundColor: widget.color, opacity: 0.28 + index * 0.1 }} />
          ))}
        </div>
      </>
    )
  }

  function ScrambleBadge({ value }: { value: string }) {
    const [displayValue, setDisplayValue] = useState(value)

    useEffect(() => {
      if (reducedMotion) {
        setDisplayValue(value)
        return
      }

      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      let frame = 0
      const maxFrames = 14
      const interval = window.setInterval(() => {
        frame += 1
        const progress = frame / maxFrames
        const nextValue = value
          .split('')
          .map((char, index) => {
            if (char === ' ') return ' '
            if (index / value.length < progress) return char
            return alphabet[Math.floor(Math.random() * alphabet.length)]
          })
          .join('')

        setDisplayValue(nextValue)

        if (frame >= maxFrames) {
          window.clearInterval(interval)
          setDisplayValue(value)
        }
      }, 28)

      return () => window.clearInterval(interval)
    }, [value])

    return (
      <motion.span
        layout
        className="ml-auto inline-flex justify-end rounded-full px-2.5 py-1 text-right text-[11px] font-semibold tabular-nums"
        style={{
          backgroundColor: '#fef3c7',
          color: '#92400e',
          whiteSpace: 'nowrap',
        }}
        transition={{ layout: { duration: 0.28, ease: EASE } }}
      >
        {displayValue}
      </motion.span>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, delay: 0.3, ease: EASE }}
      className="mt-10 grid items-center gap-8 overflow-hidden rounded-[1.75rem] p-4 sm:mt-16 sm:p-5 lg:grid-cols-[0.9fr_1.1fr] lg:p-6"
      style={{
        backgroundColor: '#101010',
        border: '1px solid rgba(15,15,15,0.08)',
        boxShadow: CARD_SHADOW,
      }}
    >
      <div className="px-2 py-4 sm:px-5 lg:py-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
          Role-aware school-day motion
        </p>
        <h2
          className="mt-4 max-w-[520px] text-3xl font-semibold leading-[1.06] text-white sm:text-4xl lg:text-5xl"
          style={{
            letterSpacing: 0,
          }}
        >
          One school day. A different view for every team.
        </h2>
        <p className="mt-5 max-w-[520px] text-[15px] leading-6 text-white/70 sm:text-[16px]">
          Office, IT, facilities, athletics, teachers, and messaging all stay
          connected to the same day. Lionheart changes the workspace around the
          role, so every team sees what needs attention next.
        </p>

      </div>

      <div
        className="relative h-[560px] overflow-hidden rounded-[1.5rem] p-4 sm:h-[430px] sm:p-5"
        style={{
          backgroundColor: '#f7f6f4',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <div
          className="mb-4 flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ backgroundColor: '#ffffff', border: `1px solid ${BORDER_SOFT}` }}
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#ff5f57' }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#febc2e' }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#28c840' }} />
          <span className="ml-auto text-[11px] font-semibold" style={{ color: TEXT_MUTED }}>
            lincoln-high.lionheartapp.com
          </span>
        </div>

        <div
          className="relative h-[500px] overflow-visible rounded-t-[1.25rem] rounded-b-none p-4 sm:h-[370px]"
          style={{ backgroundColor: '#ffffff', border: `1px solid ${BORDER}` }}
        >
          <div className="mb-4 flex min-h-[72px] items-start justify-between gap-4 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeRole.role}-heading`}
                initial={{ opacity: 0, y: 36, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -34, filter: 'blur(8px)' }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <motion.p
                  initial={{ clipPath: 'inset(0 100% 0 0)' }}
                  animate={{ clipPath: 'inset(0 0% 0 0)' }}
                  transition={{ duration: 0.5, delay: 0.08, ease: EASE }}
                  className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: TEXT_MUTED }}
                >
                  {activeRole.role}
                </motion.p>
                <motion.h3
                  initial={{ y: 12 }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.44, delay: 0.05, ease: EASE }}
                  className="mt-1 text-[20px] font-semibold"
                  style={{ color: TEXT_PRIMARY, letterSpacing: 0 }}
                >
                  {activeRole.title}
                </motion.h3>
              </motion.div>
            </AnimatePresence>
            <ScrambleBadge value={activeRole.badge} />
          </div>

          <div className="relative h-[350px] overflow-visible sm:h-[220px]" style={{ perspective: '1600px' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeRole.role}
                className="absolute inset-0 grid grid-cols-1 gap-3 sm:grid-cols-3"
                initial="hidden"
                animate="show"
                exit="exit"
                variants={{
                  hidden: {
                    opacity: 1,
                    x: 0,
                    y: 360,
                    scale: 1,
                    rotateX: 0,
                    rotateY: 0,
                    rotateZ: 0,
                    z: 0,
                    zIndex: 1,
                    filter: 'none',
                  },
                  show: {
                    opacity: 1,
                    x: [0, 0, 0],
                    y: [0, 0, 0],
                    scale: [1, 1, 1],
                    rotateX: [0, 0, 0],
                    rotateY: [0, 0, 0],
                    rotateZ: [0, 0, 0],
                    z: 0,
                    zIndex: 1,
                    filter: 'none',
                    transition: {
                      duration: 1.05,
                      ease: [0.45, 0, 0.2, 1],
                      times: [0, 0.58, 1],
                      staggerChildren: 0.28,
                      delayChildren: 0.12,
                    },
                  },
                  exit: {
                    opacity: 1,
                    x: [0, 0, 760],
                    y: [0, 0, 0],
                    scale: [1, 1, 1],
                    rotateX: [0, 0, 0],
                    rotateY: [0, 0, 0],
                    rotateZ: [0, 0, 0],
                    z: 0,
                    zIndex: 1,
                    filter: 'none',
                    transition: {
                      duration: 1.2,
                      ease: [0.45, 0, 0.2, 1],
                      times: [0, 0.42, 1],
                    },
                  },
                }}
                style={{ transformStyle: 'preserve-3d' }}
              >
              {activeRole.widgets.map((widget, index) => {
                const exitRippleDelay = index === 1 ? 0 : index === 2 ? 0.08 : 0.16

                return (
                  <motion.div
                    key={`${activeRole.role}-${widget.title}`}
                    variants={{
                      hidden: {
                        opacity: 1,
                        scale: 1,
                        x: 0,
                        y: 240 + index * 20,
                        rotateX: 0,
                        rotateY: 0,
                        rotateZ: 0,
                        z: 0,
                        zIndex: 1,
                        boxShadow: '0 0 0 rgba(15,15,15,0)',
                      },
                      show: {
                        opacity: 1,
                        scale: [1, 1, 1],
                        x: [0, 0, 0],
                        y: [240 + index * 20, 0, 0],
                        rotateX: [0, 0, 0],
                        rotateY: [0, 0, 0],
                        rotateZ: [0, 0, 0],
                        z: 0,
                        zIndex: 1,
                        boxShadow: '0 0 0 rgba(15,15,15,0)',
                        transition: {
                          duration: 1,
                          ease: [0.45, 0, 0.2, 1],
                          times: [0, 0.58, 1],
                          delay: index * 0.05,
                        },
                      },
                      exit: {
                        opacity: 1,
                        scale: [1, 1, 1],
                        x: [0, 0, 690 + index * 24],
                        y: [0, 0, 0],
                        rotateX: [0, 0, 0],
                        rotateY: [0, 0, 0],
                        rotateZ: [0, 0, 0],
                        z: [0, 250, 250],
                        zIndex: [1, 30 + index, 30 + index],
                        boxShadow: '0 52px 86px rgba(15,15,15,0.24)',
                        transition: {
                          duration: 1,
                          ease: [0.45, 0, 0.2, 1],
                          times: [0, 0.45, 1],
                          delay: exitRippleDelay,
                        },
                      },
                    }}
                    className={`${widget.span ?? ''} rounded-2xl p-3`}
                    style={{
                      backgroundColor: '#fbfbfa',
                      border: `1px solid ${BORDER_SOFT}`,
                      transformStyle: 'preserve-3d',
                    }}
                  >
                    {renderWidget(widget)}
                  </motion.div>
                )
              })}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2" aria-label="Role preview progress">
          {roleStacks.map((role, index) => (
            <span
              key={role.role}
              className="h-1.5 flex-1 rounded-full transition-colors duration-200"
              style={{
                backgroundColor: index === roleIndex ? '#0f0f0f' : 'rgba(15,15,15,0.12)',
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

type SchoolLifePhoto = {
  id: string
  src: string
  alt: string
  label: string
  audience: string
  problem: string
  detailTitle: string
  detail: string
  signals: string[]
}

const schoolLifePhotos: SchoolLifePhoto[] = [
  {
    id: 'teacher-support',
    src: 'https://images.pexels.com/photos/8617967/pexels-photo-8617967.jpeg?auto=compress&cs=tinysrgb&w=1400',
    alt: 'A teacher helping students at desks in a bright classroom.',
    label: 'Teachers',
    audience: 'Classroom staff',
    problem: 'Room needs, forms, messages, and schedule changes should not live in five different places.',
    detailTitle: 'Teachers should not have to chase five systems.',
    detail: 'Lionheart gives staff a single place for room needs, event requests, forms, messages, approvals, and follow-up status.',
    signals: ['Room requests', 'Student forms', 'Staff messages'],
  },
  {
    id: 'front-office',
    src: 'https://images.pexels.com/photos/34526414/pexels-photo-34526414.jpeg?auto=compress&cs=tinysrgb&w=1000',
    alt: 'A teacher leading a class discussion in a familiar high school classroom.',
    label: 'Office',
    audience: 'Front office',
    problem: 'Daily questions need clear ownership, not another email thread.',
    detailTitle: 'The office gets fewer mystery threads.',
    detail: 'Every request can land with the right owner, campus, room, priority, and timeline instead of disappearing into email.',
    signals: ['Approvals', 'Owner routing', 'Status updates'],
  },
  {
    id: 'athletics-staff',
    src: 'https://images.pexels.com/photos/9935450/pexels-photo-9935450.jpeg?auto=compress&cs=tinysrgb&w=1000',
    alt: 'High school football players in helmets competing on a field with stadium lights.',
    label: 'Athletics',
    audience: 'Athletics staff',
    problem: 'Game day needs coaches, buses, venues, families, and facilities moving from the same schedule.',
    detailTitle: 'Game day has too many moving parts for scattered tools.',
    detail: 'Schedules, rosters, buses, venues, scores, and parent-facing updates stay connected to the same school calendar.',
    signals: ['Team schedules', 'Game-day tasks', 'Public updates'],
  },
  {
    id: 'arts-activities',
    src: 'https://images.pexels.com/photos/8382377/pexels-photo-8382377.jpeg?auto=compress&cs=tinysrgb&w=1000',
    alt: 'Children painting on easels during an art class.',
    label: 'Activities',
    audience: 'Arts and activities',
    problem: 'Concerts, clubs, trips, and showcases all need approvals, rooms, forms, and equipment.',
    detailTitle: 'Activities need the same operational care as academics.',
    detail: 'Lionheart keeps rooms, equipment, forms, approvals, and day-of details attached to the event.',
    signals: ['Event approvals', 'Equipment needs', 'Permission forms'],
  },
  {
    id: 'campus-operations',
    src: 'https://images.pexels.com/photos/33089236/pexels-photo-33089236.jpeg?auto=compress&cs=tinysrgb&w=1000',
    alt: 'An American high school hallway with rows of lockers and warm overhead lights.',
    label: 'Operations',
    audience: 'Campus operations',
    problem: 'Maintenance, IT, A/V, and admin teams need the same view of what is happening today.',
    detailTitle: 'The hallway is where operations become real.',
    detail: 'Tickets, assets, room schedules, staff messages, and urgent updates all connect back to the same day-of picture.',
    signals: ['Work orders', 'IT tickets', 'Live calendar'],
  },
]

function SchoolLifeMosaic() {
  const [selectedId, setSelectedId] = useState(schoolLifePhotos[0].id)
  const selectedPhoto = schoolLifePhotos.find((photo) => photo.id === selectedId) ?? schoolLifePhotos[0]

  return (
    <motion.section
      id="school-life-section"
      className="px-6 pb-28"
      initial="hidden"
      whileInView="visible"
      viewport={REVEAL_VIEWPORT}
      variants={REVEAL_VARIANTS}
    >
      <div className="max-w-[1200px] mx-auto">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-14 items-end mb-10">
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-4"
              style={{ color: TEXT_SECONDARY }}
            >
              Built around the school day
            </p>
            <h2
              className="max-w-[620px] text-4xl font-semibold leading-[1.06] sm:text-5xl"
              style={{
                letterSpacing: 0,
                color: TEXT_PRIMARY,
              }}
            >
              Built for the teachers and staff holding the school day together.
            </h2>
          </div>

          <p
            className="text-[17px] max-w-[560px] lg:ml-auto"
            style={{ color: TEXT_SECONDARY, lineHeight: 1.65 }}
          >
            One place for room requests, approvals, staff messages, maintenance,
            IT help, forms, and event details — so the people serving students can
            spend less time chasing updates.
          </p>
        </div>

        <div
          className="grid overflow-hidden rounded-[1.75rem] lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]"
          style={{ border: `1px solid ${BORDER}`, boxShadow: CARD_SHADOW, backgroundColor: '#ffffff' }}
        >
          <div className="p-4 sm:p-5 lg:p-6">
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-1"
              role="group"
              aria-label="Choose a school staff workflow"
            >
              {schoolLifePhotos.map((photo) => {
                const selected = selectedId === photo.id
                return (
                  <button
                    key={photo.id}
                    type="button"
                    aria-pressed={selected}
                    aria-controls="school-life-story"
                    aria-label={`Show ${photo.audience}: ${photo.label}`}
                    onClick={() => setSelectedId(photo.id)}
                    className="cursor-pointer rounded-xl p-3 text-left transition-colors duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 sm:p-4"
                    style={{
                      backgroundColor: selected ? TEXT_PRIMARY : SURFACE_ALT,
                      border: `1px solid ${selected ? TEXT_PRIMARY : BORDER_SOFT}`,
                      color: selected ? '#ffffff' : TEXT_PRIMARY,
                    }}
                  >
                    <div
                      className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{ color: selected ? 'rgba(255,255,255,0.72)' : TEXT_SECONDARY }}
                    >
                      {photo.audience}
                    </div>
                    <div className="mt-1 text-[14px] font-semibold sm:text-[15px]">
                      {photo.label}
                    </div>
                    <p
                      className="mt-2 hidden text-[13px] leading-snug lg:block"
                      style={{ color: selected ? 'rgba(255,255,255,0.72)' : TEXT_SECONDARY }}
                    >
                      {photo.problem}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid overflow-hidden border-t lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.8fr)] lg:border-l lg:border-t-0" style={{ borderColor: BORDER_SOFT }}>
            <motion.div
              key={selectedPhoto.id}
              initial={{ opacity: 0.2, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="relative min-h-[280px] sm:min-h-[360px] lg:min-h-[620px]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Remote marketing photos avoid touching shared Next image config in this pass. */}
              <img
                src={selectedPhoto.src}
                alt={selectedPhoto.alt}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </motion.div>

            <motion.div
              key={`${selectedPhoto.id}-copy`}
              id="school-life-story"
              role="region"
              aria-live="polite"
              aria-label={`${selectedPhoto.audience} workflow`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="flex flex-col justify-end p-6 sm:p-8"
              style={{ backgroundColor: '#0f0f0f', color: '#ffffff' }}
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.72)' }}>
                {selectedPhoto.audience}
              </div>
              <h3 className="mt-3 max-w-[620px] text-[28px] font-semibold leading-[1.08] sm:text-[36px]" style={{ letterSpacing: 0 }}>
                {selectedPhoto.detailTitle}
              </h3>
              <p className="mt-4 max-w-[580px] text-[15px] leading-6 sm:text-[16px]" style={{ color: 'rgba(255,255,255,0.8)' }}>
                {selectedPhoto.detail}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {selectedPhoto.signals.map((signal) => (
                  <span
                    key={signal}
                    className="rounded-full px-3 py-1.5 text-[12px] font-semibold"
                    style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: '#ffffff' }}
                  >
                    {signal}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.section>
  )
}


// ─── Trust bar ──────────────────────────────────────────────────────────────

function TrustBar() {
  type Stat = {
    label: string
    // Either a countable number (+ optional suffix) or a static string
    count?: number
    suffix?: string
    value?: string
  }
  const stats: Stat[] = [
    { count: 12, label: 'areas of school work' },
    { count: 30, suffix: ' days', label: 'free trial, no card' },
    { value: 'K–12', label: 'public, private, charter' },
    { value: 'Multi-school', label: 'from one school to many' },
  ]
  return (
    <motion.section
      className="mx-3 rounded-[1.75rem] border sm:mx-6"
      style={{ borderColor: BORDER_SOFT, backgroundColor: '#eef3f0' }}
      initial="hidden"
      whileInView="visible"
      viewport={REVEAL_VIEWPORT}
      variants={REVEAL_VARIANTS}
    >
      <div className="mx-auto max-w-[1200px] px-6 py-10 sm:py-12">
        <p
          className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] mb-6"
          style={{ color: TEXT_MUTED }}
        >
          Built for every kind of school
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div
                className="font-semibold tabular-nums"
                style={{
                  fontSize: '28px',
                  color: TEXT_PRIMARY,
                  letterSpacing: 0,
                }}
              >
                {s.count !== undefined ? (
                  <CountUp to={s.count} suffix={s.suffix ?? ''} />
                ) : (
                  s.value
                )}
              </div>
              <div className="text-[13px] mt-1" style={{ color: TEXT_SECONDARY }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  )
}

// ─── "What it replaces" ─────────────────────────────────────────────────────

function WhatItReplaces() {
  const legacy = [
    'Airtable for room requests',
    'ClickUp for maintenance tickets',
    'Slack / Teams for staff comms',
    'SignUpGenius / Eventbrite for camps',
    'Google Forms for permission slips',
    'HUDL for athletic rosters',
    'GoGuardian for Chromebook fleet',
    'Paper binders for compliance',
  ]
  return (
    <motion.section
      className="px-6 py-28"
      initial="hidden"
      whileInView="visible"
      viewport={REVEAL_VIEWPORT}
      variants={REVEAL_VARIANTS}
    >
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-14">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-4"
            style={{ color: TEXT_MUTED }}
          >
            One platform, instead of
          </p>
          <h2
            className="mx-auto max-w-[760px] text-4xl font-semibold leading-[1.07] sm:text-5xl"
            style={{
              letterSpacing: 0,
              color: TEXT_PRIMARY,
            }}
          >
            Stop running your school on twelve different tools.
          </h2>
          <p
            className="mt-5 max-w-[620px] mx-auto text-[17px]"
            style={{ color: TEXT_SECONDARY, lineHeight: 1.6 }}
          >
            Most schools are piecing together calendars, inboxes, forms, tickets, and
            spreadsheets. Lionheart brings that daily work into one place.
          </p>
        </div>

        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-8 items-center">
          {/* Legacy column */}
          <div
            className="rounded-[1.5rem] p-6 sm:p-7"
            style={{
              backgroundColor: SURFACE_ALT,
              border: `1px solid ${BORDER_SOFT}`,
            }}
          >
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-4"
              style={{ color: TEXT_MUTED }}
            >
              Before Lionheart
            </p>
            <ul className="space-y-2.5">
              {legacy.map((l) => (
                <li
                  key={l}
                  className="flex items-center gap-3 text-[14px]"
                  style={{ color: TEXT_SECONDARY }}
                >
                  <span className="w-4 h-4 rounded-full border-2 flex-shrink-0" style={{ borderColor: '#d4d4d4' }} />
                  <span className="line-through" style={{ textDecorationColor: '#d4d4d4' }}>
                    {l}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Arrow divider */}
          <div className="flex justify-center">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: TEXT_PRIMARY, color: '#ffffff' }}
            >
              <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
            </div>
          </div>

          {/* New column */}
          <div
            className="relative overflow-hidden rounded-[1.5rem] p-6 sm:p-7"
            style={{
              backgroundColor: '#ffffff',
              border: `1px solid ${BORDER}`,
              boxShadow: CARD_SHADOW,
            }}
          >
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-4"
              style={{ color: TEXT_MUTED }}
            >
              With Lionheart
            </p>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ background: AI_GRADIENT }}
              >
                LH
              </div>
              <div>
                <div className="text-[16px] font-semibold" style={{ color: TEXT_PRIMARY, letterSpacing: 0 }}>
                  Lionheart
                </div>
                <div className="text-[12px]" style={{ color: TEXT_SECONDARY }}>
                  Everything, in one app
                </div>
              </div>
            </div>
            <ul className="space-y-2.5">
              {['Rooms + events', 'Maintenance + PM', 'IT + devices', 'Messaging + channels', 'Forms + submissions', 'Registration + payments', 'Athletics + rosters', 'Compliance'].map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 text-[14px]"
                  style={{ color: TEXT_PRIMARY }}
                >
                  <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#10b981' }} strokeWidth={3} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </motion.section>
  )
}

// ─── Modules grid ───────────────────────────────────────────────────────────

function ModulesGrid() {
  const moduleGroups = [
    {
      icon: Calendar,
      title: 'Plan the school day',
      description: 'Events, calendars, rooms, resources, approvals, and parent-facing schedules stay tied to the same plan.',
      modules: ['Events & Calendar', 'Approvals', 'A/V Production'],
    },
    {
      icon: MonitorSmartphone,
      title: 'Fix what breaks',
      description: 'IT, maintenance, assets, devices, and compliance deadlines get ownership, status, and history.',
      modules: ['IT Help Desk', 'Maintenance', 'IT Fleet Manager', 'Compliance'],
    },
    {
      icon: MessageSquare,
      title: 'Keep people aligned',
      description: 'Staff messages, team channels, notifications, and Leo AI answers live beside the work they reference.',
      modules: ['Messaging', 'Leo AI', 'Mobile app'],
    },
    {
      icon: FileText,
      title: 'Collect what matters',
      description: 'Forms, registration, payments, rosters, and reports move through the same school operations system.',
      modules: ['Forms', 'Registration + Payments', 'Athletics'],
    },
  ]

  return (
    <motion.section
      id="modules"
      className="px-6 py-28"
      style={{ backgroundColor: '#eef3f0', borderTop: `1px solid ${BORDER_SOFT}`, borderBottom: `1px solid ${BORDER_SOFT}` }}
      initial="hidden"
      whileInView="visible"
      viewport={REVEAL_VIEWPORT}
      variants={REVEAL_VARIANTS}
    >
      <div className="max-w-[1200px] mx-auto">
        <div className="text-center mb-14">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-4"
            style={{ color: TEXT_MUTED }}
          >
            Four jobs · One workspace
          </p>
          <h2
            className="mx-auto max-w-[820px] text-4xl font-semibold leading-[1.07] sm:text-5xl"
            style={{
              letterSpacing: 0,
              color: TEXT_PRIMARY,
            }}
          >
            The daily work, grouped the way schools actually run.
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {moduleGroups.map((group) => {
            const Icon = group.icon
            return (
              <div
                key={group.title}
                className="relative overflow-hidden rounded-[1.5rem] p-6 transition-all duration-300 hover:-translate-y-1 sm:p-7"
                style={{
                  backgroundColor: '#ffffff',
                  border: `1px solid ${BORDER}`,
                  boxShadow: CARD_SHADOW,
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: 'rgba(15,15,15,0.04)' }}
                >
                  <Icon
                    className="h-5 w-5"
                    style={{ color: TEXT_PRIMARY }}
                    strokeWidth={2}
                  />
                </div>
                <h3
                  className="mb-2 text-[21px] font-semibold leading-tight"
                  style={{ color: TEXT_PRIMARY, letterSpacing: 0 }}
                >
                  {group.title}
                </h3>
                <p className="text-[14px]" style={{ color: TEXT_SECONDARY, lineHeight: 1.6 }}>
                  {group.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {group.modules.map((module) => (
                    <span
                      key={module}
                      className="rounded-full px-3 py-1 text-[12px] font-medium"
                      style={{ backgroundColor: SURFACE_ALT, color: TEXT_SECONDARY, border: `1px solid ${BORDER_SOFT}` }}
                    >
                      {module}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </motion.section>
  )
}

function SolutionsHub() {
  const solutions = [
    {
      icon: Calendar,
      title: 'Events & calendars',
      description: 'Approvals, rooms, resources, and day-of details for school events.',
      href: '/solutions/events',
    },
    {
      icon: MonitorSmartphone,
      title: 'IT & devices',
      description: 'Help desk tickets, asset context, device support, and staff follow-up.',
      href: '/solutions/it',
    },
    {
      icon: Wrench,
      title: 'Maintenance',
      description: 'Work orders, asset history, preventive schedules, and room needs.',
      href: '/solutions/maintenance',
    },
    {
      icon: FileText,
      title: 'Forms & registration',
      description: 'Forms, approvals, registrations, payments, and submission follow-up.',
      href: '/solutions/forms-registration',
    },
    {
      icon: MessageSquare,
      title: 'Staff messaging',
      description: 'Threads and channels tied to events, tickets, forms, and daily work.',
      href: '/solutions/messaging',
    },
  ]

  return (
    <motion.section
      className="px-6 py-28"
      initial="hidden"
      whileInView="visible"
      viewport={REVEAL_VIEWPORT}
      variants={REVEAL_VARIANTS}
    >
      <div className="mx-auto max-w-[1200px]">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p
              className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: TEXT_MUTED }}
            >
              Explore by area
            </p>
            <h2
              className="text-4xl font-semibold leading-[1.07] sm:text-5xl"
              style={{ color: TEXT_PRIMARY, letterSpacing: 0 }}
            >
              The homepage stays simple. The details live where they belong.
            </h2>
          </div>
          <p
            className="max-w-[620px] text-[17px] leading-[1.65] lg:ml-auto"
            style={{ color: TEXT_SECONDARY }}
          >
            Each solution page goes deeper on a specific part of the school day, so
            the homepage can stay focused on the big picture.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {solutions.map((solution) => {
            const Icon = solution.icon
            return (
              <Link
                key={solution.href}
                href={solution.href}
                className="group rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_14px_45px_rgba(15,15,15,0.05)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_55px_rgba(15,15,15,0.09)]"
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <h3 className="text-xl font-semibold leading-tight text-slate-950" style={{ letterSpacing: 0 }}>
                  {solution.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {solution.description}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
                  Learn more
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </Link>
            )
          })}

          <Link
            href="/platform"
            className="group rounded-[1.5rem] border border-slate-950 bg-slate-950 p-6 text-white shadow-[0_18px_55px_rgba(15,15,15,0.16)] transition-all duration-200 hover:-translate-y-1"
          >
            <div className="mb-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
              Platform overview
            </div>
            <h3 className="text-2xl font-semibold leading-tight" style={{ letterSpacing: 0 }}>
              See how the system fits together.
            </h3>
            <p className="mt-3 text-sm leading-6 text-white/70">
              Start with the full operations platform, then move into the areas
              that matter most.
            </p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white">
              View platform
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </span>
          </Link>
        </div>
      </div>
    </motion.section>
  )
}

// ─── Deep dive: Events ──────────────────────────────────────────────────────

function DeepDiveEvents() {
  return (
    <motion.section
      className="px-6 py-28"
      initial="hidden"
      whileInView="visible"
      viewport={REVEAL_VIEWPORT}
      variants={REVEAL_VARIANTS}
    >
      <div className="max-w-[1200px] mx-auto grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-4"
            style={{ color: TEXT_MUTED }}
          >
            Events that actually happen
          </p>
          <h2
            className="mb-6 text-4xl font-semibold leading-[1.08] sm:text-5xl"
            style={{
              letterSpacing: 0,
              color: TEXT_PRIMARY,
            }}
          >
            Plan it, approve it, run it — all from one place.
          </h2>
          <p
            className="text-[17px] mb-8"
            style={{ color: TEXT_SECONDARY, lineHeight: 1.6 }}
          >
            Every event — concerts, field trips, board meetings, game day — goes through
            the same approval workflow, with conflict detection, resource booking, and
            parent-facing calendar publishing built in.
          </p>
          <ul className="space-y-3">
            {[
              'Conflict detection across rooms, staff, and equipment',
              'Approval workflows per calendar (events, athletics, facilities)',
              'Parent-facing calendars with iCal subscription',
              'Bus, cabin, medical, and emergency PDF packets auto-generated',
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 text-[15px]"
                style={{ color: TEXT_PRIMARY }}
              >
                <Check className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: '#10b981' }} strokeWidth={3} />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <MockEventDetailCard />
      </div>
    </motion.section>
  )
}

// ─── Deep dive: Maintenance ─────────────────────────────────────────────────

function DeepDiveMaintenance() {
  return (
    <motion.section
      className="px-6 py-28"
      style={{ backgroundColor: '#eef3f0', borderTop: `1px solid ${BORDER_SOFT}`, borderBottom: `1px solid ${BORDER_SOFT}` }}
      initial="hidden"
      whileInView="visible"
      viewport={REVEAL_VIEWPORT}
      variants={REVEAL_VARIANTS}
    >
      <div className="max-w-[1200px] mx-auto grid lg:grid-cols-2 gap-16 items-center">
        <MockMaintenanceCard />

        <div className="order-first lg:order-last">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-4"
            style={{ color: TEXT_MUTED }}
          >
            Every work order, every asset
          </p>
          <h2
            className="mb-6 text-4xl font-semibold leading-[1.08] sm:text-5xl"
            style={{
              letterSpacing: 0,
              color: TEXT_PRIMARY,
            }}
          >
            Maintenance with a real memory.
          </h2>
          <p
            className="text-[17px] mb-8"
            style={{ color: TEXT_SECONDARY, lineHeight: 1.6 }}
          >
            Track work orders, preventive schedules, labor hours, parts cost, and
            compliance deadlines against a live asset register — so the next HVAC
            filter change isn&rsquo;t a surprise.
          </p>
          <ul className="space-y-3">
            {[
              'QR-code asset labels for in-the-field ticket creation',
              'Preventive maintenance schedules that avoid the school year',
              'Labor + parts cost tracking per ticket, per asset',
              'Compliance calendar: fire drills, inspections, board reports',
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 text-[15px]"
                style={{ color: TEXT_PRIMARY }}
              >
                <Check className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: '#10b981' }} strokeWidth={3} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.section>
  )
}
