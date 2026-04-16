'use client'

/**
 * Lionheart Marketing Landing Page
 *
 * Design system: monochrome restraint (Cal.com) + warm near-black
 * (Notion/Superhuman) + a single signature gradient reserved for
 * the Leo AI section. Mockups are inline SVG/divs matching the
 * reskinned UpcomingEventsPanel tokens so the marketing surface
 * and the product surface read as one cohesive product.
 *
 * All mockup data is fabricated — no live data hits this page.
 */

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { animate, motion, useInView, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  GraduationCap,
  Headphones,
  Lock,
  Mail,
  MessageSquare,
  MonitorSmartphone,
  Plus,
  ShieldCheck,
  Sparkles,
  Trophy,
  Wrench,
} from 'lucide-react'

// ─── Tokens (kept inline so this file is self-contained) ────────────────────

const TEXT_PRIMARY = '#0f0f0f'
const TEXT_SECONDARY = '#5a5a5a'
const TEXT_MUTED = '#9a9a9a'
const BORDER = 'rgba(15, 15, 15, 0.08)'
const BORDER_SOFT = 'rgba(15, 15, 15, 0.05)'
const SURFACE_ALT = '#fafaf9'
const SURFACE_WARM = '#fdfcfb'
const DARK_SURFACE = '#0b0b0e'

const CARD_SHADOW =
  '0 0 0 1px rgba(34,42,53,0.06), 0 0.8px 2.9px rgba(0,0,0,0.02), 0 2px 7.8px rgba(0,0,0,0.027), 0 4px 18px rgba(0,0,0,0.04)'
const HERO_MOCKUP_SHADOW =
  '0 0 0 1px rgba(34,42,53,0.08), 0 30px 60px -20px rgba(15,15,15,0.18), 0 18px 36px -18px rgba(15,15,15,0.12)'

const AI_GRADIENT = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 55%, #ec4899 100%)'

// ─── Scroll-reveal + count-up primitives ────────────────────────────────────

/** Smooth "aurora" easing used across the page — matches design-system memory. */
const EASE = [0.25, 0.1, 0.25, 1] as const

/** Reusable viewport trigger: fires once, ~80px before the section enters the viewport. */
const REVEAL_VIEWPORT = { once: true, margin: '-80px' } as const

/** Standard fade-up variants for whole sections. */
const REVEAL_VARIANTS = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
} as const

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

  return <span ref={ref}>{`${prefix}${format(0)}${suffix}`}</span>
}

// ─── Entry component ────────────────────────────────────────────────────────

export default function Landing() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#ffffff', color: TEXT_PRIMARY }}>
      <Nav />
      <Hero />
      <TrustBar />
      <WhatItReplaces />
      <ModulesGrid />
      <DeepDiveEvents />
      <DeepDiveMaintenance />
      <LeoSection />
      <Pricing />
      <FAQ />
      <ClosingCTA />
      <Footer />
    </div>
  )
}

// ─── Nav ────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav
      className="sticky top-0 z-40 backdrop-blur-md"
      style={{
        backgroundColor: 'rgba(255,255,255,0.85)',
        borderBottom: `1px solid ${BORDER_SOFT}`,
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center" aria-label="Lionheart — home">
          <img src="/logo.svg" alt="Lionheart" className="h-7 w-auto" />
        </Link>

        <div
          className="hidden md:flex items-center gap-9 text-[14px] font-medium"
          style={{ color: TEXT_SECONDARY }}
        >
          <a href="#modules" className="hover:text-black transition-colors duration-200">
            Product
          </a>
          <a href="#leo" className="hover:text-black transition-colors duration-200">
            Leo AI
          </a>
          <a href="#pricing" className="hover:text-black transition-colors duration-200">
            Pricing
          </a>
          <a href="#faq" className="hover:text-black transition-colors duration-200">
            FAQ
          </a>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/signin"
            className="hidden sm:inline text-[14px] font-medium hover:text-black transition-colors duration-200"
            style={{ color: TEXT_SECONDARY }}
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold text-white transition-all duration-200 hover:-translate-y-px"
            style={{
              backgroundColor: TEXT_PRIMARY,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.04)',
            }}
          >
            Start free trial
          </Link>
        </div>
      </div>
    </nav>
  )
}

// ─── Hero ───────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative px-6 pt-20 pb-14 sm:pt-28 sm:pb-20">
      <div className="max-w-[1200px] mx-auto">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex justify-center"
        >
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{
              border: `1px solid ${BORDER}`,
              color: TEXT_SECONDARY,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            The Operating System for K-12 Schools
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05, ease: [0.25, 0.1, 0.25, 1] }}
          className="mt-8 text-center font-semibold max-w-[1100px] mx-auto"
          style={{
            fontSize: 'clamp(42px, 7vw, 84px)',
            lineHeight: '0.95',
            letterSpacing: '-0.045em',
            color: TEXT_PRIMARY,
          }}
        >
          School operations infrastructure
          <br className="hidden sm:inline" /> for absolutely everyone.
        </motion.h1>

        {/* Sub */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12 }}
          className="mt-8 text-center max-w-[680px] mx-auto"
          style={{
            fontSize: 'clamp(17px, 1.4vw, 20px)',
            lineHeight: '1.55',
            letterSpacing: '-0.003em',
            color: TEXT_SECONDARY,
          }}
        >
          Events, maintenance, IT help desk, athletics, and the AI that knows how
          your school actually runs. One platform, one source of truth, built for
          every classroom, hallway, and practice field.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-[14px] font-semibold text-white transition-all duration-200 hover:-translate-y-px"
            style={{
              backgroundColor: TEXT_PRIMARY,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 14px rgba(0,0,0,0.1)',
            }}
          >
            Start your 30-day free trial
            <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
          </Link>
          <Link
            href="#pricing"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-[14px] font-semibold transition-colors duration-200"
            style={{ color: TEXT_PRIMARY }}
          >
            See pricing
            <ChevronDown className="w-4 h-4" strokeWidth={2.5} />
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.28 }}
          className="mt-6 text-center text-[13px]"
          style={{ color: TEXT_MUTED }}
        >
          No credit card required · Cancel anytime · Set up in minutes
        </motion.p>

        {/* Dashboard mockup */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          className="mt-16 sm:mt-20"
        >
          <DashboardMockup />
        </motion.div>
      </div>
    </section>
  )
}

// ─── Dashboard mockup (the hero visual) ─────────────────────────────────────

function DashboardMockup() {
  return (
    <div
      className="relative rounded-3xl overflow-hidden"
      style={{ boxShadow: HERO_MOCKUP_SHADOW }}
    >
      {/* Browser chrome */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ backgroundColor: '#f7f6f4', borderBottom: `1px solid ${BORDER_SOFT}` }}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ff5f57' }} />
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#febc2e' }} />
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#28c840' }} />
        </div>
        <div className="flex-1 flex justify-center">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-medium"
            style={{ backgroundColor: '#ffffff', color: TEXT_SECONDARY, border: `1px solid ${BORDER_SOFT}` }}
          >
            <Lock className="w-2.5 h-2.5" strokeWidth={2.5} />
            lincoln-high.lionheartapp.com
          </div>
        </div>
        <div className="w-12" />
      </div>

      {/* Trial banner inside mockup */}
      <div
        className="h-9 flex items-center justify-center text-[12px] font-semibold text-white gap-2"
        style={{ background: 'linear-gradient(90deg, #3B82F6 0%, #6366F1 100%)' }}
      >
        <Sparkles className="w-3 h-3" />
        Free trial — 28 days remaining. Everything&rsquo;s unlocked. No card required.
      </div>

      {/* App body */}
      <div
        className="grid grid-cols-[200px_1fr_280px] h-[520px]"
        style={{ backgroundColor: '#fbfaf8' }}
      >
        {/* Sidebar */}
        <MockSidebar />

        {/* Main: upcoming events panel */}
        <MockEventsPanel />

        {/* Leo rail */}
        <MockLeoRail />
      </div>
    </div>
  )
}

function MockSidebar() {
  const navItems: { label: string; icon: typeof Calendar; active?: boolean }[] = [
    { label: 'Dashboard', icon: Calendar, active: true },
    { label: 'Events', icon: Calendar },
    { label: 'Maintenance', icon: Wrench },
    { label: 'IT Help Desk', icon: MonitorSmartphone },
    { label: 'Athletics', icon: Trophy },
    { label: 'A/V Production', icon: Headphones },
  ]
  return (
    <div
      className="flex flex-col p-4 gap-1"
      style={{ borderRight: `1px solid ${BORDER_SOFT}` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold"
          style={{ background: AI_GRADIENT }}
        >
          LH
        </div>
        <div>
          <div className="text-[12px] font-semibold leading-tight" style={{ color: TEXT_PRIMARY }}>
            Lincoln High
          </div>
          <div className="text-[9px]" style={{ color: TEXT_MUTED }}>
            1,240 students
          </div>
        </div>
      </div>
      <div className="h-px my-2" style={{ backgroundColor: BORDER_SOFT }} />
      {navItems.map((item) => {
        const Icon = item.icon
        return (
          <div
            key={item.label}
            className="flex items-center gap-2 text-[12px] px-2.5 py-1.5 rounded-lg"
            style={{
              backgroundColor: item.active ? 'rgba(15,15,15,0.05)' : 'transparent',
              color: item.active ? TEXT_PRIMARY : TEXT_SECONDARY,
              fontWeight: item.active ? 600 : 500,
            }}
          >
            <Icon className="w-3.5 h-3.5" strokeWidth={2} />
            {item.label}
          </div>
        )
      })}
    </div>
  )
}

function MockEventsPanel() {
  const days = Array.from({ length: 14 }, (_, i) => {
    const weekdayIdx = i % 7
    const hasEvents = [0, 1, 3, 5, 8, 11, 13].includes(i)
    return {
      label: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'][weekdayIdx],
      date: 9 + i,
      isToday: i === 0,
      eventCount: hasEvents ? (i === 0 ? 3 : 1) : 0,
    }
  })

  const eventRows = [
    { day: 'MON', date: 9, title: 'Spring Concert Rehearsal', time: '10:30a – 11:45a', loc: 'Auditorium', color: '#6366f1' },
    { day: 'MON', date: 9, title: 'Faculty PD Meeting', time: '3:00p – 4:00p', loc: 'Library', color: '#10b981' },
    { day: 'TUE', date: 10, title: 'JV Basketball vs Eastwood', time: '4:30p – 6:00p', loc: 'Home gym', color: '#f59e0b' },
    { day: 'THU', date: 12, title: 'Board of Directors', time: '6:00p – 8:00p', loc: 'Board room', color: '#8b5cf6' },
  ]

  return (
    <div className="p-5 overflow-hidden">
      <div
        className="rounded-2xl p-5 h-full flex flex-col"
        style={{ backgroundColor: SURFACE_WARM, border: `1px solid ${BORDER}`, boxShadow: CARD_SHADOW }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3
              className="text-[17px] font-semibold"
              style={{ color: TEXT_PRIMARY, letterSpacing: '-0.025em' }}
            >
              The next two weeks
            </h3>
            <p className="text-[11px] font-medium mt-0.5" style={{ color: '#6a6864' }}>
              Apr 9 – Apr 22 · 12 events · <span style={{ color: TEXT_PRIMARY, fontWeight: 600 }}>3 today</span>
            </p>
          </div>
          <div
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold text-white"
            style={{ backgroundColor: TEXT_PRIMARY }}
          >
            <Plus className="w-2.5 h-2.5" strokeWidth={3} />
            Event
          </div>
        </div>

        {/* Timeline strip */}
        <div className="grid grid-cols-14 gap-[3px] mb-4">
          {days.map((d, i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-between py-1.5 px-0.5 rounded-md"
              style={{
                backgroundColor: d.isToday ? TEXT_PRIMARY : 'transparent',
                color: d.isToday ? '#ffffff' : TEXT_PRIMARY,
                minHeight: '46px',
              }}
            >
              <span
                className="text-[7px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: d.isToday ? 'rgba(255,255,255,0.7)' : '#a8a49d' }}
              >
                {d.label}
              </span>
              <span className="text-[11px] font-semibold leading-none">{d.date}</span>
              <div className="flex items-center gap-[2px] h-1">
                {d.eventCount === 0 ? (
                  <div
                    className="w-[2px] h-[2px] rounded-full"
                    style={{ backgroundColor: 'rgba(15,15,15,0.15)' }}
                  />
                ) : (
                  Array.from({ length: Math.min(d.eventCount, 3) }).map((_, j) => (
                    <div
                      key={j}
                      className="w-[3px] h-[3px] rounded-full"
                      style={{
                        backgroundColor: d.isToday ? '#ffffff' : ['#6366f1', '#10b981', '#f59e0b'][j],
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="h-px mb-2" style={{ backgroundColor: 'rgba(15,15,15,0.05)' }} />

        {/* Event list */}
        <div className="space-y-1 overflow-hidden flex-1">
          {eventRows.map((e, i) => (
            <div key={i} className="flex items-start gap-3 py-2">
              <div className="w-9 text-center flex-shrink-0">
                <div
                  className="text-[8px] font-bold uppercase tracking-wider"
                  style={{ color: '#a8a49d' }}
                >
                  {e.day}
                </div>
                <div
                  className="text-[13px] font-semibold leading-none mt-0.5"
                  style={{ color: TEXT_PRIMARY }}
                >
                  {e.date}
                </div>
              </div>
              <div
                className="w-0.5 h-8 rounded-full flex-shrink-0 mt-0.5"
                style={{ backgroundColor: e.color }}
              />
              <div className="flex-1 min-w-0">
                <p
                  className="text-[12px] font-semibold truncate"
                  style={{ color: TEXT_PRIMARY, letterSpacing: '-0.005em' }}
                >
                  {e.title}
                </p>
                <p className="text-[10px] truncate" style={{ color: '#6a6864' }}>
                  {e.time} · {e.loc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MockLeoRail() {
  return (
    <div className="p-4 flex flex-col" style={{ borderLeft: `1px solid ${BORDER_SOFT}` }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: AI_GRADIENT }}
          >
            <Sparkles className="w-3 h-3 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-[12px] font-semibold" style={{ color: TEXT_PRIMARY }}>
            Leo
          </span>
        </div>
        <div
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-white"
          style={{ background: AI_GRADIENT }}
        >
          AI
        </div>
      </div>

      <div className="flex-1 space-y-2.5 text-[11px]">
        <div
          className="rounded-xl rounded-tr-sm p-2.5 self-end ml-6"
          style={{
            backgroundColor: '#ffffff',
            border: `1px solid ${BORDER_SOFT}`,
            color: TEXT_PRIMARY,
          }}
        >
          Who is scheduled to set up A/V for the board meeting Thursday?
        </div>
        <div
          className="rounded-xl rounded-tl-sm p-2.5 mr-6"
          style={{ backgroundColor: '#f5f3ef', color: TEXT_PRIMARY, lineHeight: 1.5 }}
        >
          <strong>Marcus Williams</strong> from A/V Production is assigned.
          Setup is scheduled 5:30p in the Board Room — one wireless mic,
          screen share from the lectern laptop.
        </div>
        <div
          className="rounded-xl rounded-tr-sm p-2.5 self-end ml-6"
          style={{
            backgroundColor: '#ffffff',
            border: `1px solid ${BORDER_SOFT}`,
            color: TEXT_PRIMARY,
          }}
        >
          Any open work orders for that room?
        </div>
        <div
          className="rounded-xl rounded-tl-sm p-2.5 mr-6"
          style={{ backgroundColor: '#f5f3ef', color: TEXT_PRIMARY, lineHeight: 1.5 }}
        >
          One open — projector bulb replacement, marked high priority.
          Assigned to facilities, due by Wednesday 3p.
        </div>
      </div>

      <div
        className="mt-3 px-3 py-2 rounded-full text-[10px]"
        style={{ border: `1px solid ${BORDER}`, color: TEXT_MUTED }}
      >
        Ask Leo about events, tickets, rosters…
      </div>
    </div>
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
    { count: 8, label: 'integrated modules' },
    { count: 30, suffix: ' days', label: 'free trial, no card' },
    { value: 'K–12', label: 'public, private, charter' },
    { value: 'Multi-campus', label: 'single-school to district' },
  ]
  return (
    <motion.section
      className="border-y"
      style={{ borderColor: BORDER_SOFT, backgroundColor: SURFACE_ALT }}
      initial="hidden"
      whileInView="visible"
      viewport={REVEAL_VIEWPORT}
      variants={REVEAL_VARIANTS}
    >
      <div className="max-w-[1200px] mx-auto px-6 py-10">
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
                  fontSize: 'clamp(22px, 2.2vw, 28px)',
                  color: TEXT_PRIMARY,
                  letterSpacing: '-0.02em',
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
    'Google Sheets for athletic rosters',
    'Email threads for event approvals',
    'WhatsApp for A/V coordination',
    'Paper binders for compliance',
  ]
  return (
    <motion.section
      className="px-6 py-24"
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
            className="font-semibold mx-auto max-w-[760px]"
            style={{
              fontSize: 'clamp(32px, 4.5vw, 52px)',
              lineHeight: '1.05',
              letterSpacing: '-0.035em',
              color: TEXT_PRIMARY,
            }}
          >
            Stop running your school on twelve different tools.
          </h2>
          <p
            className="mt-5 max-w-[620px] mx-auto text-[17px]"
            style={{ color: TEXT_SECONDARY, lineHeight: 1.6 }}
          >
            Every school we talk to runs the same Frankenstein stack. We replaced it
            with one place where every request, event, asset, and roster lives together.
          </p>
        </div>

        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-8 items-center">
          {/* Legacy column */}
          <div
            className="rounded-2xl p-6"
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
            className="rounded-2xl p-6 relative overflow-hidden"
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
                <div className="text-[16px] font-semibold" style={{ color: TEXT_PRIMARY, letterSpacing: '-0.01em' }}>
                  Lionheart
                </div>
                <div className="text-[12px]" style={{ color: TEXT_SECONDARY }}>
                  Everything, in one app
                </div>
              </div>
            </div>
            <ul className="space-y-2.5">
              {['Rooms + events', 'Maintenance + PM', 'IT + devices', 'Athletics + rosters', 'A/V + coordination', 'Compliance'].map((item) => (
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
  const modules = [
    {
      icon: Calendar,
      title: 'Events & Calendar',
      description: 'Plan, approve, and run every school event with conflict detection and parent-facing calendars.',
    },
    {
      icon: Wrench,
      title: 'Maintenance',
      description: 'Work orders, preventive maintenance schedules, asset tracking, and compliance — all in one ledger.',
    },
    {
      icon: MonitorSmartphone,
      title: 'IT Help Desk',
      description: 'Tickets, devices, Chromebook fleet management, roster sync, and student password self-service.',
    },
    {
      icon: Trophy,
      title: 'Athletics',
      description: 'Sports, teams, rosters, schedules, scoring, and tournaments for every level from elementary to varsity.',
    },
    {
      icon: Headphones,
      title: 'A/V Production',
      description: 'Equipment requests, inventory, and day-of production coordination for events that need more than a mic.',
    },
    {
      icon: GraduationCap,
      title: 'Academic Calendar',
      description: 'Define terms, breaks, and cycle days so the whole school reads from the same source.',
    },
    {
      icon: ShieldCheck,
      title: 'Compliance',
      description: 'Fire drill logs, inspection calendars, and board reports. Every deadline tracked, nothing dropped.',
    },
    {
      icon: MessageSquare,
      title: 'Leo AI',
      description: 'An institutional memory that answers "who, what, when" about your school in plain English.',
      isAi: true,
    },
  ]

  return (
    <motion.section
      id="modules"
      className="px-6 py-24"
      style={{ backgroundColor: SURFACE_ALT, borderTop: `1px solid ${BORDER_SOFT}`, borderBottom: `1px solid ${BORDER_SOFT}` }}
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
            Eight modules · One workspace
          </p>
          <h2
            className="font-semibold mx-auto max-w-[820px]"
            style={{
              fontSize: 'clamp(32px, 4.5vw, 52px)',
              lineHeight: '1.05',
              letterSpacing: '-0.035em',
              color: TEXT_PRIMARY,
            }}
          >
            Everything your school needs,
            <br />
            nothing it doesn&rsquo;t.
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {modules.map((m) => {
            const Icon = m.icon
            return (
              <div
                key={m.title}
                className="rounded-2xl p-6 relative overflow-hidden transition-all duration-300 hover:-translate-y-1"
                style={{
                  backgroundColor: '#ffffff',
                  border: `1px solid ${BORDER}`,
                  boxShadow: CARD_SHADOW,
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={
                    m.isAi
                      ? { background: AI_GRADIENT }
                      : { backgroundColor: 'rgba(15,15,15,0.04)' }
                  }
                >
                  <Icon
                    className="w-5 h-5"
                    style={{ color: m.isAi ? '#ffffff' : TEXT_PRIMARY }}
                    strokeWidth={2}
                  />
                </div>
                <h3
                  className="text-[16px] font-semibold mb-2"
                  style={{ color: TEXT_PRIMARY, letterSpacing: '-0.015em' }}
                >
                  {m.title}
                </h3>
                <p className="text-[13.5px]" style={{ color: TEXT_SECONDARY, lineHeight: 1.55 }}>
                  {m.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </motion.section>
  )
}

// ─── Deep dive: Events ──────────────────────────────────────────────────────

function DeepDiveEvents() {
  return (
    <motion.section
      className="px-6 py-24"
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
            className="font-semibold mb-6"
            style={{
              fontSize: 'clamp(32px, 4.2vw, 48px)',
              lineHeight: '1.05',
              letterSpacing: '-0.035em',
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

function MockEventDetailCard() {
  return (
    <div
      className="rounded-3xl p-7"
      style={{
        backgroundColor: SURFACE_WARM,
        border: `1px solid ${BORDER}`,
        boxShadow: CARD_SHADOW,
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: '#6366f1' }}
          >
            APR 14 · 6:00P – 8:00P
          </p>
          <h3
            className="text-[22px] font-semibold mt-1"
            style={{ color: TEXT_PRIMARY, letterSpacing: '-0.02em' }}
          >
            Spring Concert
          </h3>
          <p className="text-[13px] mt-1" style={{ color: TEXT_SECONDARY }}>
            Auditorium · 400 seats · public
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
          style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#047857' }}
        >
          <Check className="w-3 h-3" strokeWidth={3} />
          Approved
        </span>
      </div>

      <div className="h-px my-5" style={{ backgroundColor: BORDER_SOFT }} />

      {/* Approval chain */}
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: TEXT_MUTED }}>
        Approval chain
      </p>
      <div className="space-y-2">
        {[
          { name: 'Facilities Review', who: 'Derek K.', status: 'approved' },
          { name: 'A/V Resource Check', who: 'Marcus W.', status: 'approved' },
          { name: 'Principal Approval', who: 'Sarah L.', status: 'approved' },
        ].map((step) => (
          <div
            key={step.name}
            className="flex items-center justify-between py-2 px-3 rounded-lg"
            style={{ backgroundColor: 'rgba(15,15,15,0.02)' }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#10b981' }}
              >
                <Check className="w-3 h-3 text-white" strokeWidth={3.5} />
              </div>
              <div>
                <div className="text-[12.5px] font-semibold" style={{ color: TEXT_PRIMARY }}>
                  {step.name}
                </div>
                <div className="text-[10px]" style={{ color: TEXT_MUTED }}>
                  by {step.who}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-semibold" style={{ color: '#047857' }}>
              APPROVED
            </span>
          </div>
        ))}
      </div>

      <div className="h-px my-5" style={{ backgroundColor: BORDER_SOFT }} />

      {/* Resource tags */}
      <div className="flex flex-wrap gap-1.5">
        {['2 wireless mics', '1 projector', 'Risers (×4)', 'Programs printed', 'Parking attendants'].map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium"
            style={{
              backgroundColor: 'rgba(15,15,15,0.04)',
              color: TEXT_PRIMARY,
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Deep dive: Maintenance ─────────────────────────────────────────────────

function DeepDiveMaintenance() {
  return (
    <motion.section
      className="px-6 py-24"
      style={{ backgroundColor: SURFACE_ALT, borderTop: `1px solid ${BORDER_SOFT}`, borderBottom: `1px solid ${BORDER_SOFT}` }}
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
            className="font-semibold mb-6"
            style={{
              fontSize: 'clamp(32px, 4.2vw, 48px)',
              lineHeight: '1.05',
              letterSpacing: '-0.035em',
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

function MockMaintenanceCard() {
  return (
    <div
      className="rounded-3xl p-7"
      style={{
        backgroundColor: '#ffffff',
        border: `1px solid ${BORDER}`,
        boxShadow: CARD_SHADOW,
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'rgba(15,15,15,0.04)' }}
          >
            <Wrench className="w-5 h-5" style={{ color: TEXT_PRIMARY }} strokeWidth={2} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: TEXT_MUTED }}>
              WORK ORDER · #1042
            </div>
            <div className="text-[16px] font-semibold" style={{ color: TEXT_PRIMARY, letterSpacing: '-0.01em' }}>
              Boiler #2 annual inspection
            </div>
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
          style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#b45309' }}
        >
          In progress
        </span>
      </div>

      <div
        className="grid grid-cols-3 gap-3 py-4 border-y"
        style={{ borderColor: BORDER_SOFT }}
      >
        {[
          { label: 'Assigned', value: 'Derek K.' },
          { label: 'Due', value: 'Apr 12' },
          { label: 'Labor', value: '2.5h' },
        ].map((stat) => (
          <div key={stat.label}>
            <div
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: TEXT_MUTED }}
            >
              {stat.label}
            </div>
            <div
              className="text-[14px] font-semibold mt-0.5"
              style={{ color: TEXT_PRIMARY }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Linked asset */}
      <div className="mt-5">
        <div
          className="text-[10px] font-semibold uppercase tracking-wider mb-2"
          style={{ color: TEXT_MUTED }}
        >
          LINKED ASSET
        </div>
        <div
          className="rounded-xl p-4 flex items-center gap-3"
          style={{ backgroundColor: SURFACE_ALT }}
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-mono font-bold"
            style={{ backgroundColor: '#ffffff', border: `1px solid ${BORDER_SOFT}`, color: TEXT_PRIMARY }}
          >
            QR
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold" style={{ color: TEXT_PRIMARY }}>
              Peerless PFH-850 · Boiler #2
            </div>
            <div className="text-[11px]" style={{ color: TEXT_SECONDARY }}>
              Mechanical Room · Basement · installed 2018
            </div>
          </div>
        </div>
      </div>

      {/* Next PM schedule */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-[12px]" style={{ color: TEXT_SECONDARY }}>
          Next scheduled PM: <span style={{ color: TEXT_PRIMARY, fontWeight: 600 }}>Oct 15 · filter replacement</span>
        </div>
      </div>
    </div>
  )
}

// ─── Leo AI section (the one dark section) ─────────────────────────────────

function LeoSection() {
  return (
    <motion.section
      id="leo"
      className="relative px-6 py-28 overflow-hidden"
      style={{ backgroundColor: DARK_SURFACE, color: '#ffffff' }}
      initial="hidden"
      whileInView="visible"
      viewport={REVEAL_VIEWPORT}
      variants={REVEAL_VARIANTS}
    >
      {/* Ambient gradient orbs */}
      <div
        className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full pointer-events-none opacity-30"
        style={{ background: AI_GRADIENT, filter: 'blur(140px)' }}
      />
      <div
        className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full pointer-events-none opacity-20"
        style={{
          background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
          filter: 'blur(140px)',
        }}
      />

      <div className="relative max-w-[1200px] mx-auto grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.14em] mb-6"
            style={{
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.8)',
            }}
          >
            <Sparkles className="w-3 h-3" />
            Meet Leo
          </div>

          <h2
            className="font-semibold mb-6"
            style={{
              fontSize: 'clamp(34px, 4.8vw, 56px)',
              lineHeight: '1.0',
              letterSpacing: '-0.04em',
            }}
          >
            Your school&rsquo;s
            <br />
            <span
              style={{
                background: AI_GRADIENT,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              institutional memory,
            </span>
            <br />
            always on.
          </h2>

          <p
            className="text-[17px] mb-8"
            style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}
          >
            Leo knows every ticket, every event, every asset, every work order.
            Ask in plain English, get an answer grounded in your live data —
            not a hallucinated guess.
          </p>

          <ul className="space-y-3">
            {[
              'Grounded in your org data — no hallucinations',
              'Cross-module reasoning (events ↔ maintenance ↔ IT)',
              'Draft emails, generate reports, run diagnostics',
              'Available on every page, every device',
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 text-[15px]"
                style={{ color: 'rgba(255,255,255,0.9)' }}
              >
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                  style={{ background: AI_GRADIENT }}
                >
                  <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />
                </div>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Chat mockup */}
        <div
          className="rounded-3xl p-6 relative"
          style={{
            backgroundColor: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: AI_GRADIENT }}
              >
                <Sparkles className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-[14px] font-semibold">Leo</div>
                <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Knows Lincoln High inside and out
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Online
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div
              className="rounded-2xl rounded-tr-sm p-3.5 ml-8 text-[13px]"
              style={{
                backgroundColor: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.95)',
              }}
            >
              What do we need to set up for the spring concert next Monday?
            </div>

            <div
              className="rounded-2xl rounded-tl-sm p-3.5 mr-8 text-[13px]"
              style={{
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                color: 'rgba(255,255,255,0.95)',
                lineHeight: 1.55,
              }}
            >
              <strong>Spring Concert</strong> is Monday 6–8pm in the Auditorium.
              Setup needs: 2 wireless mics, 1 projector, risers (&times;4).
              Marcus from A/V is assigned. Programs are at the printer —
              400 copies, pickup Friday.
              <div className="mt-2.5 flex gap-2">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.85)',
                  }}
                >
                  View event details
                </span>
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.85)',
                  }}
                >
                  Check A/V status
                </span>
              </div>
            </div>
          </div>

          <div
            className="mt-5 px-4 py-3 rounded-full text-[13px]"
            style={{
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            Ask Leo anything about your school…
          </div>
        </div>
      </div>
    </motion.section>
  )
}

// ─── Pricing ────────────────────────────────────────────────────────────────

function Pricing() {
  const plans = [
    {
      name: 'Essentials',
      slug: 'essentials',
      annual: 7800,
      monthly: 650,
      description: 'Core operations for a single campus.',
      features: [
        '1 campus',
        '50 AI actions / month',
        'Events & calendar',
        'Maintenance tickets',
        'IT tickets',
        'A/V requests',
        'System roles',
        'Email support',
      ],
      cta: 'Start free trial',
      featured: false,
    },
    {
      name: 'Pro',
      slug: 'pro',
      annual: 12800,
      monthly: 1067,
      description: 'Full suite + integrations, unlimited AI.',
      features: [
        'Everything in Essentials',
        'Unlimited AI actions',
        'Full maintenance suite',
        'Full IT suite',
        'Full A/V suite',
        'Google Calendar sync',
        'Outlook Calendar sync',
        'Custom roles & permissions',
        'Advanced reporting',
        'Priority support',
      ],
      cta: 'Start free trial',
      featured: true,
    },
    {
      name: 'Enterprise',
      slug: 'enterprise',
      annual: 16800,
      monthly: 1400,
      description: 'Multi-campus, SSO, SLA, dedicated CSM.',
      features: [
        '2 campuses included',
        'Everything in Pro',
        'SSO / SAML',
        'Audit logs',
        'API access',
        'Custom permission scopes',
        'White label',
        'Dedicated CSM',
        '99.9% uptime SLA',
        'Quarterly business reviews',
        'Phone support',
      ],
      cta: 'Contact sales',
      featured: false,
    },
  ]

  return (
    <motion.section
      id="pricing"
      className="px-6 py-24"
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
            Simple, school-friendly pricing
          </p>
          <h2
            className="font-semibold mx-auto max-w-[820px]"
            style={{
              fontSize: 'clamp(32px, 4.5vw, 52px)',
              lineHeight: '1.05',
              letterSpacing: '-0.035em',
              color: TEXT_PRIMARY,
            }}
          >
            One price per school.
            <br />
            No per-seat math.
          </h2>
          <p
            className="mt-5 max-w-[620px] mx-auto text-[17px]"
            style={{ color: TEXT_SECONDARY, lineHeight: 1.6 }}
          >
            Every plan starts with a 30-day free trial. No credit card required.
            Cancel anytime from settings.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 max-w-[1100px] mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.slug}
              className="relative rounded-3xl p-7 flex flex-col"
              style={{
                backgroundColor: plan.featured ? TEXT_PRIMARY : '#ffffff',
                color: plan.featured ? '#ffffff' : TEXT_PRIMARY,
                border: plan.featured ? '1px solid rgba(255,255,255,0.1)' : `1px solid ${BORDER}`,
                boxShadow: plan.featured
                  ? '0 20px 60px -20px rgba(15,15,15,0.35), 0 0 0 1px rgba(255,255,255,0.08)'
                  : CARD_SHADOW,
              }}
            >
              {plan.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-semibold text-white"
                    style={{ background: AI_GRADIENT }}
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    Most Popular
                  </span>
                </div>
              )}

              <div
                className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-2"
                style={{ color: plan.featured ? 'rgba(255,255,255,0.5)' : TEXT_MUTED }}
              >
                {plan.name}
              </div>

              <div className="flex items-baseline gap-1.5 mb-2">
                <span
                  className="font-semibold"
                  style={{
                    fontSize: '40px',
                    letterSpacing: '-0.03em',
                  }}
                >
                  ${plan.annual.toLocaleString('en-US')}
                </span>
                <span
                  className="text-[14px] font-medium"
                  style={{
                    color: plan.featured ? 'rgba(255,255,255,0.5)' : TEXT_MUTED,
                  }}
                >
                  /year
                </span>
              </div>
              <p
                className="text-[12px] mb-5"
                style={{ color: plan.featured ? 'rgba(255,255,255,0.5)' : TEXT_MUTED }}
              >
                Billed ${plan.monthly.toLocaleString('en-US')}/month · all-in
              </p>

              <p
                className="text-[13px] mb-6"
                style={{
                  color: plan.featured ? 'rgba(255,255,255,0.7)' : TEXT_SECONDARY,
                  lineHeight: 1.55,
                }}
              >
                {plan.description}
              </p>

              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2.5 text-[13px]"
                    style={{
                      color: plan.featured ? 'rgba(255,255,255,0.85)' : TEXT_PRIMARY,
                    }}
                  >
                    <Check
                      className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                      style={{ color: plan.featured ? '#a78bfa' : '#10b981' }}
                      strokeWidth={3}
                    />
                    {f}
                  </li>
                ))}
              </ul>

              {plan.slug === 'enterprise' ? (
                <a
                  href="mailto:sales@lionheartapp.com"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full text-[13px] font-semibold transition-all duration-200 hover:-translate-y-px"
                  style={{
                    backgroundColor: '#ffffff',
                    color: TEXT_PRIMARY,
                    border: `1px solid ${BORDER}`,
                  }}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Contact sales
                </a>
              ) : (
                <Link
                  href="/signup"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full text-[13px] font-semibold transition-all duration-200 hover:-translate-y-px"
                  style={{
                    backgroundColor: plan.featured ? '#ffffff' : TEXT_PRIMARY,
                    color: plan.featured ? TEXT_PRIMARY : '#ffffff',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.04)',
                  }}
                >
                  {plan.cta}
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                </Link>
              )}
            </div>
          ))}
        </div>

        <p
          className="mt-8 text-center text-[13px]"
          style={{ color: TEXT_MUTED }}
        >
          All plans include unlimited users, SSL, daily backups, and U.S.-based support.
        </p>
      </div>
    </motion.section>
  )
}

// ─── FAQ ────────────────────────────────────────────────────────────────────

function FAQ() {
  const faqs = [
    {
      q: 'Do you really not require a credit card for the trial?',
      a: 'Correct. Sign up, get 30 days of full access with no card. When the trial ends your workspace switches to read-only mode until you pick a plan — you never lose data.',
    },
    {
      q: 'How long does setup take?',
      a: 'Most schools are running in under an hour. School profile, campus + rooms, team invites, and role assignments are the four required steps. You can add modules (athletics, A/V, etc.) as you need them.',
    },
    {
      q: 'Can Lionheart import data from my current tools?',
      a: 'Yes. We support CSV imports for students, staff, rosters, and assets, plus direct roster sync from ClassLink and Clever. Google Calendar and Outlook Calendar sync keep your existing calendars in the loop.',
    },
    {
      q: 'What happens to my data if I cancel?',
      a: 'Your workspace enters a 30-day grace period where it stays read-only and downloadable. After that, we hard-delete everything. You can export to CSV / PDF at any time from settings.',
    },
    {
      q: 'Is Leo AI trained on my data?',
      a: 'No. Leo uses retrieval-augmented generation grounded in your live data at query time — nothing is used to train the underlying model. Your data stays your data.',
    },
    {
      q: 'Do you offer multi-campus or district pricing?',
      a: 'Yes. Enterprise includes 2 campuses out of the box, with additional campuses available. For districts with more than 5 schools we build custom packages — contact sales.',
    },
  ]

  return (
    <motion.section
      id="faq"
      className="px-6 py-24"
      style={{ backgroundColor: SURFACE_ALT, borderTop: `1px solid ${BORDER_SOFT}`, borderBottom: `1px solid ${BORDER_SOFT}` }}
      initial="hidden"
      whileInView="visible"
      viewport={REVEAL_VIEWPORT}
      variants={REVEAL_VARIANTS}
    >
      <div className="max-w-[820px] mx-auto">
        <div className="text-center mb-12">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-4"
            style={{ color: TEXT_MUTED }}
          >
            Common questions
          </p>
          <h2
            className="font-semibold"
            style={{
              fontSize: 'clamp(30px, 4vw, 44px)',
              lineHeight: '1.05',
              letterSpacing: '-0.035em',
              color: TEXT_PRIMARY,
            }}
          >
            Everything you&rsquo;re wondering, answered.
          </h2>
        </div>

        <div
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: '#ffffff', border: `1px solid ${BORDER}` }}
        >
          {faqs.map((faq, i) => (
            <details
              key={i}
              className="group"
              style={{
                borderBottom: i < faqs.length - 1 ? `1px solid ${BORDER_SOFT}` : 'none',
              }}
            >
              <summary
                className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer select-none list-none"
                style={{ color: TEXT_PRIMARY }}
              >
                <span
                  className="text-[15px] font-semibold"
                  style={{ letterSpacing: '-0.01em' }}
                >
                  {faq.q}
                </span>
                <ChevronDown
                  className="w-4 h-4 flex-shrink-0 transition-transform duration-200 group-open:rotate-180"
                  style={{ color: TEXT_MUTED }}
                />
              </summary>
              <div
                className="px-6 pb-5 text-[14px]"
                style={{ color: TEXT_SECONDARY, lineHeight: 1.6 }}
              >
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </motion.section>
  )
}

// ─── Closing CTA ────────────────────────────────────────────────────────────

function ClosingCTA() {
  return (
    <motion.section
      className="px-6 py-28"
      initial="hidden"
      whileInView="visible"
      viewport={REVEAL_VIEWPORT}
      variants={REVEAL_VARIANTS}
    >
      <div className="max-w-[900px] mx-auto text-center">
        <h2
          className="font-semibold mb-6"
          style={{
            fontSize: 'clamp(36px, 5.5vw, 64px)',
            lineHeight: '1.0',
            letterSpacing: '-0.04em',
            color: TEXT_PRIMARY,
          }}
        >
          Run your school
          <br />
          like it&rsquo;s 2026.
        </h2>
        <p
          className="text-[18px] mb-10 max-w-[560px] mx-auto"
          style={{ color: TEXT_SECONDARY, lineHeight: 1.55 }}
        >
          30 days free. No credit card. No sales call. Just sign up and start running
          your school on one platform instead of twelve.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-7 py-4 rounded-full text-[15px] font-semibold text-white transition-all duration-200 hover:-translate-y-px"
            style={{
              backgroundColor: TEXT_PRIMARY,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.12)',
            }}
          >
            Start your 30-day free trial
            <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
          </Link>
          <a
            href="mailto:sales@lionheartapp.com"
            className="inline-flex items-center gap-2 px-7 py-4 rounded-full text-[15px] font-semibold transition-colors duration-200"
            style={{ color: TEXT_PRIMARY }}
          >
            Talk to sales
          </a>
        </div>
      </div>
    </motion.section>
  )
}

// ─── Footer ─────────────────────────────────────────────────────────────────

function Footer() {
  const cols = [
    {
      heading: 'Product',
      links: [
        { label: 'Features', href: '#modules' },
        { label: 'Pricing', href: '#pricing' },
        { label: 'Leo AI', href: '#leo' },
        { label: 'Changelog', href: '/changelog' },
      ],
    },
    {
      heading: 'Company',
      links: [
        { label: 'About', href: '/about' },
        { label: 'Contact', href: 'mailto:hello@lionheartapp.com' },
        { label: 'Sales', href: 'mailto:sales@lionheartapp.com' },
      ],
    },
    {
      heading: 'Resources',
      links: [
        { label: 'Documentation', href: '/docs' },
        { label: 'Status', href: '/status' },
        { label: 'Changelog', href: '/changelog' },
      ],
    },
    {
      heading: 'Legal',
      links: [
        { label: 'Privacy', href: '/privacy' },
        { label: 'Terms', href: '/terms' },
        { label: 'Security', href: '/security' },
      ],
    },
  ]
  return (
    <footer
      className="px-6 pt-20 pb-10"
      style={{ backgroundColor: DARK_SURFACE, color: 'rgba(255,255,255,0.6)' }}
    >
      <div className="max-w-[1200px] mx-auto">
        <div className="grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-10 pb-12">
          <div>
            <img src="/logo-white.svg" alt="Lionheart" className="h-7 w-auto mb-4" />
            <p className="text-[13px] max-w-[280px]" style={{ lineHeight: 1.6 }}>
              School operations infrastructure for every K-12 school, built by
              people who&rsquo;ve been in the principal&rsquo;s office and the
              mechanical room.
            </p>
          </div>
          {cols.map((col) => (
            <nav key={col.heading}>
              <h4
                className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-4"
                style={{ color: 'rgba(255,255,255,0.5)' }}
              >
                {col.heading}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-[13px] transition-colors duration-200 hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div
          className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
            © 2026 Lionheart Apps. All rights reserved.
          </p>
          <p
            className="text-[12px] inline-flex items-center gap-1.5"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            All systems operational
          </p>
        </div>
      </div>
    </footer>
  )
}
