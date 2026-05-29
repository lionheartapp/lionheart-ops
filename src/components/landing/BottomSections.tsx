'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Check, ChevronDown, Mail, Sparkles } from 'lucide-react'
import { TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, BORDER, BORDER_SOFT, SURFACE_ALT, DARK_SURFACE, CARD_SHADOW, REVEAL_VIEWPORT, REVEAL_VARIANTS } from './tokens'
import { OptimizedImage } from '@/components/ui/OptimizedImage'

// ─── Leo AI section (the one dark section) ─────────────────────────────────

export function LeoSection() {
  return (
    <motion.section
      id="leo"
      className="relative overflow-hidden px-6 py-28"
      style={{ backgroundColor: DARK_SURFACE, color: '#ffffff' }}
      initial="hidden"
      whileInView="visible"
      viewport={REVEAL_VIEWPORT}
      variants={REVEAL_VARIANTS}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)' }}
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
            className="mb-6 text-4xl font-semibold leading-[1.05] sm:text-5xl"
            style={{
              letterSpacing: 0,
            }}
          >
            Your school&rsquo;s
            <br />
            <span
              style={{ color: 'rgba(255,255,255,0.92)' }}
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
                  style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
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
          className="relative rounded-[1.75rem] p-5 sm:p-6"
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
                style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
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
                backgroundColor: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
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

export function Pricing() {
  const plans = [
    {
      name: 'Heart',
      slug: 'heart',
      annual: 9600,
      monthly: 800,
      description: 'Every great school starts with heart. The real foundation, for any school doing the work.',
      features: [
        'Up to 3 schools, unlimited campuses',
        'All core modules included',
        'Mobile app + push notifications',
        'Leo AI (200 actions/mo)',
        'Forms (basic builder, unlimited submissions)',
        'Roster + calendar sync',
        'MFA + Passkeys',
        'Email support',
      ],
      cta: 'Start 30-day trial',
      featured: false,
    },
    {
      name: 'Lion',
      slug: 'lion',
      annual: 16500,
      monthly: 1375,
      description: 'For schools running at full strength. Operational sophistication for growing systems.',
      features: [
        'Up to 10 schools, unlimited campuses',
        'Everything in Heart, plus:',
        'Unlimited AI + AI Diagnostics',
        'Custom approval workflows',
        'Full form builder (templates, QR, conditional logic)',
        'Custom roles & permissions',
        'Advanced reporting',
        'Priority support',
      ],
      cta: 'Start 30-day trial',
      featured: true,
    },
    {
      name: 'Pride',
      slug: 'pride',
      annual: 24000,
      monthly: 2000,
      description: 'More than one Lionheart, under one banner. Built for your whole Pride.',
      features: [
        'Unlimited schools, unlimited campuses',
        'Everything in Lion, plus:',
        'See every school in one dashboard',
        'Compare schools side-by-side',
        'Compliance Center',
        'Messaging included (org-wide unlimited)',
        'Security & Compliance included (SSO, audit, eRate)',
        'Premium Support included (CSM, SLA, phone)',
      ],
      cta: 'Contact sales',
      featured: false,
    },
  ]

  return (
    <motion.section
      id="pricing"
      className="px-6 py-28"
      style={{ backgroundColor: '#f7f8f7' }}
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
            Pricing that makes sense before a sales call
          </p>
          <h2
            className="mx-auto max-w-[820px] text-4xl font-semibold leading-[1.07] sm:text-5xl"
            style={{
              letterSpacing: 0,
              color: TEXT_PRIMARY,
            }}
          >
            One flat platform price. Unlimited staff.
          </h2>
          <p
            className="mt-5 max-w-[620px] mx-auto text-[17px]"
            style={{ color: TEXT_SECONDARY, lineHeight: 1.6 }}
          >
            Start with the core school operations workspace, then add athletics,
            messaging, registration, fleet, or premium support only when you need them.
          </p>
        </div>

        <div className="mx-auto grid max-w-[1120px] gap-5 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.slug}
              className="relative flex flex-col rounded-[1.75rem] p-7"
              style={{
                backgroundColor: plan.featured ? TEXT_PRIMARY : '#ffffff',
                color: plan.featured ? '#ffffff' : TEXT_PRIMARY,
                border: plan.featured ? '1px solid rgba(255,255,255,0.1)' : `1px solid ${BORDER}`,
                boxShadow: plan.featured
                  ? '0 26px 70px -28px rgba(15,15,15,0.42), 0 0 0 1px rgba(255,255,255,0.08)'
                  : CARD_SHADOW,
              }}
            >
              <div className="mb-3 flex min-h-7 items-start justify-between gap-3">
                <div
                  className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: plan.featured ? 'rgba(255,255,255,0.5)' : TEXT_MUTED }}
                >
                  {plan.name}
                </div>
                {plan.featured && (
                  <span
                    className="inline-flex max-w-[160px] items-center gap-1 rounded-full px-2.5 py-1 text-right text-[10px] font-semibold leading-tight text-white"
                    style={{ backgroundColor: 'rgba(255,255,255,0.14)' }}
                  >
                    <Sparkles className="h-2.5 w-2.5 shrink-0" />
                    Growing schools
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1.5 mb-2">
                <span
                  className="font-semibold"
                  style={{
                    fontSize: '40px',
                    letterSpacing: 0,
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

              <ul
                className="mb-8 flex-1 space-y-2.5 border-t pt-6"
                style={{ borderColor: plan.featured ? 'rgba(255,255,255,0.14)' : BORDER_SOFT }}
              >
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

              {plan.slug === 'pride' ? (
                <Link
                  href="/contact?topic=sales"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-[13px] font-semibold transition-all duration-200 hover:-translate-y-px active:scale-[0.98]"
                  style={{
                    backgroundColor: '#ffffff',
                    color: TEXT_PRIMARY,
                    border: `1px solid ${BORDER}`,
                  }}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Contact sales
                </Link>
              ) : (
                <Link
                  href="/signup"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-[13px] font-semibold transition-all duration-200 hover:-translate-y-px active:scale-[0.98]"
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


export function FAQ() {
  const faqs = [
    {
      q: 'Do you really not require a credit card for the trial?',
      a: 'Correct. Sign up, get 30 days of full access — every tier, every add-on — with no card. When the trial ends, your workspace switches to read-only mode until you pick a plan. You never lose data.',
    },
    {
      q: 'What’s the difference between "schools" and "campuses"?',
      a: 'A school is a logical school (your K-8, your high school, your charter). Each school can have unlimited physical campuses underneath it. So a school with three buildings is still one school. A K-12 system with separate K-8 and HS is two schools. Heart covers up to 3 schools; Lion up to 10; Pride is unlimited.',
    },
    {
      q: 'Do you have a mobile app?',
      a: 'Yes — a mobile app with role-based bottom tabs (Admins see Approvals, IT sees the ticket queue, Maintenance sees Work Orders, Teachers see their submissions). Push notifications, pull-to-refresh, offline-aware. Works on iOS and Android without an app store install.',
    },
    {
      q: 'Can parents register and pay through Lionheart?',
      a: 'Yes, with the Registration + Payments add-on. Stripe-powered registration for events, camps, programs, and after-school clubs. Magic-link parent signups (no account required), discount codes, refunds, and auto-reconciliation. Available on any tier.',
    },
    {
      q: 'Can I build my own forms?',
      a: 'Yes. Forms are built in on every tier with unlimited submissions — no monthly caps. Heart includes the basic builder for permission slips, surveys, sign-ups, and incident reports. Lion and Pride unlock the full builder: templates, QR codes, conditional logic, and approval workflows.',
    },
    {
      q: 'Does Lionheart replace our staff messaging tool?',
      a: 'Yes, with the Messaging add-on. DMs, channels, threads, reactions, attachments, presence, and push to mobile. Built to replace Slack and Teams for staff comms.',
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
  ]

  return (
    <motion.section
      id="faq"
      className="px-6 py-28"
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
            className="text-3xl font-semibold leading-[1.08] sm:text-4xl"
            style={{
              letterSpacing: 0,
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
                  style={{ letterSpacing: 0 }}
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



export function ClosingCTA() {
  return (
    <motion.section
      className="px-6 py-28"
      style={{ backgroundColor: '#f7f8f7' }}
      initial="hidden"
      whileInView="visible"
      viewport={REVEAL_VIEWPORT}
      variants={REVEAL_VARIANTS}
    >
      <div className="max-w-[900px] mx-auto text-center">
        <h2
          className="mb-6 text-4xl font-semibold leading-[1.03] sm:text-6xl"
          style={{
            letterSpacing: 0,
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
            className="inline-flex items-center gap-2 rounded-full px-7 py-4 text-[15px] font-semibold transition-all duration-200 hover:-translate-y-px active:scale-[0.98]"
            style={{
              backgroundColor: TEXT_PRIMARY,
              color: '#ffffff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.12)',
            }}
          >
            Start 30-day trial
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/12">
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
          </Link>
          <Link
            href="/contact?topic=sales"
            className="inline-flex items-center gap-2 rounded-full px-7 py-4 text-[15px] font-semibold transition-colors duration-200 hover:bg-black/[0.04] active:scale-[0.98]"
            style={{ color: TEXT_PRIMARY }}
          >
            Talk to sales
          </Link>
        </div>
      </div>
    </motion.section>
  )
}


// ─── Footer ─────────────────────────────────────────────────────────────────

export function Footer() {
  const cols = [
    {
      heading: 'Product',
      links: [
        { label: 'Features', href: '#modules' },
        { label: 'Pricing', href: '#pricing' },
        { label: 'Leo AI', href: '#leo' },
      ],
    },
    {
      heading: 'Company',
      links: [
        { label: 'About', href: '/about' },
        { label: 'Contact', href: '/contact' },
        { label: 'Sales', href: '/contact?topic=sales' },
      ],
    },
    {
      heading: 'Resources',
      links: [
        { label: 'Help Center', href: '/help' },
        { label: 'Documentation', href: '/help' },
        { label: 'Status', href: '/status' },
      ],
    },
    {
      heading: 'Legal',
      links: [
        { label: 'Privacy', href: '/privacy' },
        { label: 'Terms', href: '/terms' },
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
            <OptimizedImage src="/logo-white.svg" alt="Lionheart" className="h-7 w-auto mb-4" />
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
                {col.links.map((link) => {
                  const isInternal = link.href.startsWith('/')
                  const className =
                    'text-[13px] transition-colors duration-200 hover:text-white'
                  return (
                    <li key={link.label}>
                      {isInternal ? (
                        <Link href={link.href} className={className}>
                          {link.label}
                        </Link>
                      ) : (
                        <a href={link.href} className={className}>
                          {link.label}
                        </a>
                      )}
                    </li>
                  )
                })}
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
