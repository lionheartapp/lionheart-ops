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
import { animate, motion, MotionConfig, useInView, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  GraduationCap,
  Headphones,
  MessageSquare,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
  Trophy,
  Wrench,
} from 'lucide-react'
import {
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, BORDER, BORDER_SOFT,
  SURFACE_ALT, CARD_SHADOW, AI_GRADIENT, EASE, REVEAL_VIEWPORT, REVEAL_VARIANTS,
} from '@/components/landing/tokens'
import { DashboardMockup, MockEventDetailCard, MockMaintenanceCard } from '@/components/landing/Mockups'
import { LeoSection, Pricing, FAQ, ClosingCTA, Footer } from '@/components/landing/BottomSections'

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
    <MotionConfig reducedMotion="user">
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
    </MotionConfig>
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

