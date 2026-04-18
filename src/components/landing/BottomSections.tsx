'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Check, ChevronDown, Mail, Sparkles } from 'lucide-react'
import { TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, BORDER, BORDER_SOFT, SURFACE_ALT, DARK_SURFACE, CARD_SHADOW, AI_GRADIENT, REVEAL_VIEWPORT, REVEAL_VARIANTS } from './tokens'

// ─── Leo AI section (the one dark section) ─────────────────────────────────

export function LeoSection() {
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

export function Pricing() {
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


export function FAQ() {
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



export function ClosingCTA() {
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

export function Footer() {
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
