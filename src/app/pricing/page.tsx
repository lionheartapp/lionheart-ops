'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  CreditCard,
  HardDrive,
  Headset,
  MessageCircle,
  Shield,
  ShieldCheck,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import PublicNav from '@/components/public/PublicNav'
import PublicFooter from '@/components/public/PublicFooter'
import { fadeInUp, cardEntrance, staggerContainer, EASE_OUT_CUBIC } from '@/lib/animations'

// ─── Types ──────────────────────────────────────────────────────────────
interface Plan {
  id: string
  name: string
  tagline: string
  monthlyPrice: number | null
  annualTotal: number
  recommended: boolean
  cta: string
  ctaHref: string
  ctaVariant: 'primary' | 'accent' | 'outline'
  features: string[]
}

interface FeatureRow {
  label: string
  heart: boolean | string
  lion: boolean | string
  pride: boolean | string
}

interface FeatureCategory {
  name: string
  rows: FeatureRow[]
}

interface FaqItem {
  question: string
  answer: string
}

interface AddOn {
  icon: typeof MessageCircle
  name: string
  tagline: string
  price: string
  priceAlt?: string
  description: string
  includedInPride?: boolean
}

// ─── Data ────────────────────────────────────────────────────────────────
const plans: Plan[] = [
  {
    id: 'heart',
    name: 'Heart',
    tagline: 'Every great school starts with heart.',
    monthlyPrice: 800,
    annualTotal: 9600,
    recommended: false,
    cta: 'Start 30-day trial',
    ctaHref: '/signup',
    ctaVariant: 'outline',
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
  },
  {
    id: 'lion',
    name: 'Lion',
    tagline: 'For schools running at full strength.',
    monthlyPrice: 1375,
    annualTotal: 16500,
    recommended: true,
    cta: 'Start 30-day trial',
    ctaHref: '/signup',
    ctaVariant: 'accent',
    features: [
      'Up to 10 schools, unlimited campuses',
      'Everything in Heart, plus:',
      'Unlimited AI + AI Diagnostics',
      'Custom approval workflows',
      'Full form builder (templates, QR, conditional logic)',
      'Custom roles & permissions',
      'Advanced reporting',
      'Branded emails',
      'Priority support',
    ],
  },
  {
    id: 'pride',
    name: 'Pride',
    tagline: 'More than one Lionheart, under one banner.',
    monthlyPrice: 2000,
    annualTotal: 24000,
    recommended: false,
    cta: 'Contact Sales',
    ctaHref: '/contact?topic=sales',
    ctaVariant: 'outline',
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
  },
]

const addOns: AddOn[] = [
  {
    icon: MessageCircle,
    name: 'Messaging',
    tagline: 'Replace Slack and Teams for staff comms.',
    price: '$1,800 / yr per school',
    priceAlt: 'OR $12,000 / yr org-wide unlimited',
    description:
      'DMs, channels, threads, reactions, GIFs, attachments, presence, push to mobile, auto-created channels per event or team.',
    includedInPride: true,
  },
  {
    icon: Trophy,
    name: 'Athletics',
    tagline: 'Take athletics as seriously as your school does.',
    price: '$2,400 / yr per school',
    priceAlt: 'OR $24,000 / yr org-wide unlimited',
    description:
      'Season planning, schedule conflict detection, rosters, stats, tournaments, public roster + schedule pages, parent comm tools.',
  },
  {
    icon: CreditCard,
    name: 'Registration + Payments',
    tagline: 'Stop using SignUpGenius and Eventbrite.',
    price: '$2,400 / yr flat per school',
    priceAlt: 'OR 1.5% PAYG, capped at $4,800 / school',
    description:
      'Stripe-powered registration for events, camps, programs. Magic-link parent signups, discount codes, refunds, auto-reconciliation.',
  },
  {
    icon: HardDrive,
    name: 'IT Fleet Manager',
    tagline: 'Replace GoGuardian / Securly / Lightspeed.',
    price: '$4 / device / yr',
    priceAlt: 'minimum $1,800 / yr',
    description:
      'Chromebook fleet, damage tracking with photos, loaner management, MDM, content filtering, summer mode, eRate, device intelligence, Google Admin sync.',
  },
  {
    icon: ShieldCheck,
    name: 'Security & Compliance',
    tagline: 'Built for IT directors and compliance officers.',
    price: '$9,600 / yr',
    priceAlt: 'unlimited org-wide',
    description:
      'SSO / SAML (Azure AD, Google, Okta), audit logs, security incident management, eRate reporting, API access, custom permission scopes.',
    includedInPride: true,
  },
  {
    icon: Headset,
    name: 'Premium Support',
    tagline: 'White-glove relationship.',
    price: '$7,200 / yr',
    priceAlt: 'unlimited org-wide',
    description:
      'Dedicated CSM, quarterly business reviews, 99.9% uptime SLA, phone support, emergency response, onboarding and migration assistance.',
    includedInPride: true,
  },
]

const featureCategories: FeatureCategory[] = [
  {
    name: 'Tier Capacity',
    rows: [
      { label: 'Schools included', heart: 'Up to 3', lion: 'Up to 10', pride: 'Unlimited' },
      { label: 'Campuses per school', heart: 'Unlimited', lion: 'Unlimited', pride: 'Unlimited' },
      { label: 'Staff accounts', heart: 'Unlimited', lion: 'Unlimited', pride: 'Unlimited' },
    ],
  },
  {
    name: 'Core Platform',
    rows: [
      { label: 'Events & Calendar', heart: true, lion: true, pride: true },
      { label: 'Maintenance', heart: true, lion: true, pride: true },
      { label: 'IT Help Desk', heart: true, lion: true, pride: true },
      { label: 'A/V Requests', heart: true, lion: true, pride: true },
      { label: 'Inventory', heart: true, lion: true, pride: true },
      { label: 'Approval Workflows', heart: 'Preset', lion: 'Custom multi-step', pride: 'Custom multi-step' },
      { label: 'Forms (unlimited submissions)', heart: 'Basic builder', lion: 'Full builder', pride: 'Full builder' },
      { label: 'Form templates', heart: false, lion: true, pride: true },
      { label: 'QR codes on forms', heart: false, lion: true, pride: true },
      { label: 'Conditional logic + routing', heart: false, lion: true, pride: true },
      { label: 'Mobile App', heart: true, lion: true, pride: true },
      { label: 'Knowledge Base', heart: true, lion: true, pride: true },
      { label: 'Compliance', heart: 'Basic', lion: 'Basic', pride: 'Full Compliance Center' },
    ],
  },
  {
    name: 'AI & Reporting',
    rows: [
      { label: 'Leo AI', heart: '200 actions/mo', lion: 'Unlimited', pride: 'Unlimited' },
      { label: 'AI Diagnostics (IT + Maintenance)', heart: false, lion: true, pride: true },
      { label: 'Advanced Reporting', heart: false, lion: true, pride: true },
      { label: 'See every school in one dashboard', heart: false, lion: false, pride: true },
      { label: 'Compare schools side-by-side', heart: false, lion: false, pride: true },
    ],
  },
  {
    name: 'Integrations & Identity',
    rows: [
      { label: 'Roster Sync (ClassLink / Clever)', heart: true, lion: true, pride: true },
      { label: 'Google Calendar Sync', heart: true, lion: true, pride: true },
      { label: 'Outlook Calendar Sync', heart: true, lion: true, pride: true },
      { label: 'MFA + Passkeys', heart: true, lion: true, pride: true },
      { label: 'Branded Emails', heart: false, lion: true, pride: true },
    ],
  },
  {
    name: 'Roles & Administration',
    rows: [
      { label: 'System Roles', heart: true, lion: true, pride: true },
      { label: 'Custom Roles & Permissions', heart: false, lion: true, pride: true },
    ],
  },
  {
    name: 'Support',
    rows: [
      { label: 'Email Support', heart: true, lion: true, pride: true },
      { label: 'Priority Support (4hr response)', heart: false, lion: true, pride: true },
    ],
  },
]

const faqs: FaqItem[] = [
  {
    question: 'Is there a free trial?',
    answer: 'Yes — all plans include a 30-day free trial with full access to every tier and every add-on. No credit card required to start. You can explore every feature before committing.',
  },
  {
    question: 'What’s the difference between "schools" and "campuses"?',
    answer: 'A school is a logical school (your K-8, your high school, your charter). Each school can have unlimited physical campuses underneath it. So a school with three buildings is still one school. A K-12 system with separate K-8 and HS is two schools. Heart covers up to 3 schools, Lion up to 10, Pride is unlimited.',
  },
  {
    question: 'Can I add modules like Athletics or Registration without upgrading my tier?',
    answer: 'Yes — that’s what add-ons are for. Messaging, Athletics, Registration + Payments, IT Fleet Manager, Security & Compliance, and Premium Support are all available on any tier. Buy what you actually use.',
  },
  {
    question: 'Can I change plans later?',
    answer: 'Absolutely. You can upgrade or downgrade your plan at any time from your account Settings. Upgrades take effect immediately; downgrades apply at your next billing cycle.',
  },
  {
    question: 'What happens when my trial ends?',
    answer: 'At the end of your 30-day trial, your workspace switches to read-only mode until you pick a plan. You never lose data — it stays available for export.',
  },
  {
    question: 'How do I cancel?',
    answer: 'You can cancel anytime from Settings > Subscription. There are no cancellation fees. After cancellation, your workspace enters a 30-day grace period where it stays read-only and downloadable. You can export to CSV / PDF at any time.',
  },
]

// ─── Sub-components ──────────────────────────────────────────────────────
function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true) {
    return <Check className="w-5 h-5 text-primary-600 mx-auto" aria-label="Included" />
  }
  if (value === false) {
    return <X className="w-5 h-5 text-slate-300 mx-auto" aria-label="Not included" />
  }
  return <span className="text-sm text-slate-600 font-medium">{value}</span>
}

function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx
        return (
          <div
            key={idx}
            className="border border-slate-200 rounded-xl overflow-hidden"
          >
            <button
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset"
              aria-expanded={isOpen}
            >
              <span className="text-base font-medium text-slate-900">{item.question}</span>
              {isOpen ? (
                <ChevronUp className="w-5 h-5 text-slate-500 flex-shrink-0" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-500 flex-shrink-0" aria-hidden="true" />
              )}
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="answer"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: EASE_OUT_CUBIC }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-5 text-slate-600 text-sm leading-relaxed border-t border-slate-100 pt-4">
                    {item.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────
export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#f7f8f7]">
      <PublicNav />

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden px-4 pb-16 pt-20 sm:px-6 sm:pb-24 sm:pt-28 lg:px-8">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              transition={{ duration: 0.45, ease: EASE_OUT_CUBIC }}
              className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
            >
              Pricing
            </motion.p>

            <motion.h1
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              transition={{ duration: 0.5, delay: 0.05, ease: EASE_OUT_CUBIC }}
              className="mx-auto mb-5 max-w-[820px] text-4xl font-semibold leading-[1.06] text-slate-950 sm:text-6xl"
              style={{ letterSpacing: 0 }}
            >
              One flat platform price. Unlimited staff.
            </motion.h1>

            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              transition={{ duration: 0.5, delay: 0.1, ease: EASE_OUT_CUBIC }}
              className="mx-auto mb-10 max-w-2xl text-[17px] leading-[1.65] text-slate-600 sm:text-[19px]"
            >
              Start with the core school operations workspace. Add athletics, messaging, registration, fleet, or premium support only when you need them.
            </motion.p>
          </div>
        </section>

        {/* ── Pricing Cards ── */}
        <section className="mx-auto max-w-7xl px-4 pb-28 sm:px-6 lg:px-8">
          <motion.div
            variants={staggerContainer(0.1, 0)}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 gap-5 md:grid-cols-3"
          >
            {plans.map((plan) => {
              const isRecommended = plan.recommended

              return (
                <motion.article
                  key={plan.id}
                  variants={cardEntrance}
                  className={`relative flex flex-col rounded-[1.75rem] p-8 ${
                    isRecommended
                      ? 'z-10 scale-[1.02] border border-slate-800 bg-slate-950 shadow-[0_26px_70px_-28px_rgba(15,15,15,0.5)]'
                      : 'border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,15,15,0.06)]'
                  }`}
                  aria-label={`${plan.name} plan`}
                >
                  <div className="mb-6">
                    <div className="mb-2 flex min-h-7 items-start justify-between gap-3">
                      <h2 className={`text-xl font-semibold ${isRecommended ? 'text-white' : 'text-slate-900'}`}>
                        {plan.name}
                      </h2>
                      {isRecommended && (
                        <span className="rounded-full bg-white/12 px-2.5 py-1 text-right text-[11px] font-semibold leading-tight text-white">
                          Growing schools
                        </span>
                      )}
                    </div>
                    <p className={`text-sm ${isRecommended ? 'text-slate-400' : 'text-slate-500'}`}>
                      {plan.tagline}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-end gap-1">
                      <span className={`text-5xl font-semibold ${isRecommended ? 'text-white' : 'text-slate-900'}`} style={{ letterSpacing: 0 }}>
                        ${plan.annualTotal.toLocaleString('en-US')}
                      </span>
                      <span className={`text-sm mb-2 ${isRecommended ? 'text-slate-400' : 'text-slate-500'}`}>
                        /year
                      </span>
                    </div>

                    {plan.monthlyPrice !== null && (
                      <p className={`text-xs mt-1 ${isRecommended ? 'text-slate-400' : 'text-slate-400'}`}>
                        Billed ${plan.monthlyPrice.toLocaleString('en-US')}/month &middot; all-in
                      </p>
                    )}
                  </div>

                  {/* CTA */}
                  <Link
                    href={plan.ctaHref}
                    className={`mb-8 block w-full cursor-pointer rounded-full px-6 py-3 text-center text-sm font-semibold transition-all duration-200 hover:-translate-y-px active:scale-[0.98] ${
                      isRecommended
                        ? 'bg-white text-slate-900 hover:bg-slate-100 shadow-sm'
                        : plan.ctaVariant === 'accent'
                        ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm'
                        : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {plan.cta}
                  </Link>

                  {/* Trust signals */}
                  {plan.monthlyPrice !== null && (
                    <p className={`text-xs text-center mb-6 ${isRecommended ? 'text-slate-400' : 'text-slate-400'}`}>
                      No credit card required &middot; Cancel anytime
                    </p>
                  )}

                  {/* Feature list */}
                  <ul
                    className={`flex-1 space-y-3 border-t pt-6 ${
                      isRecommended ? 'border-white/15' : 'border-slate-200'
                    }`}
                    role="list"
                  >
                    {plan.features.map((feature, fIdx) => {
                      const isDivider = feature.includes(', plus:') || feature.includes('Everything in')
                      return (
                        <li
                          key={fIdx}
                          className={`flex items-start gap-3 text-sm ${
                            isDivider
                              ? isRecommended
                                ? 'text-slate-400 font-semibold pt-2'
                                : 'text-slate-500 font-semibold pt-2'
                              : isRecommended
                              ? 'text-slate-300'
                              : 'text-slate-700'
                          }`}
                        >
                          {!isDivider && (
                            <Check
                              className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                                isRecommended ? 'text-emerald-300' : 'text-primary-500'
                              }`}
                              aria-hidden="true"
                            />
                          )}
                          <span className={isDivider ? 'ml-7' : ''}>{feature}</span>
                        </li>
                      )
                    })}
                  </ul>
                </motion.article>
              )
            })}
          </motion.div>

          {/* Trust line below cards */}
          <motion.p
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="text-center text-sm text-slate-400 mt-8"
          >
            All plans include a 30-day free trial &middot; No credit card required &middot; Cancel anytime
          </motion.p>
        </section>

        {/* ── Add-ons ── */}
        <section className="border-t border-slate-200 bg-white py-24">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 1, y: 0 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12"
            >
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Add-ons</p>
              <h2 className="mb-3 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl" style={{ letterSpacing: 0 }}>
                Bolt on what moves the needle.
              </h2>
              <p className="text-slate-500 max-w-xl mx-auto">
                Available on any tier. Pick what you actually use. Stop paying for what you don&apos;t.
              </p>
            </motion.div>

            <motion.div
              variants={staggerContainer(0.08, 0)}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              className="grid grid-cols-1 md:grid-cols-2 gap-5"
            >
              {addOns.map((addon) => {
                const Icon = addon.icon
                return (
                  <motion.div
                    key={addon.name}
                    variants={cardEntrance}
                    className="rounded-[1.5rem] border border-slate-200 bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-slate-700" aria-hidden="true" />
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold text-slate-900">{addon.price}</div>
                        {addon.priceAlt && (
                          <div className="text-xs text-slate-500 mt-0.5">{addon.priceAlt}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-bold text-slate-900">{addon.name}</h3>
                      {addon.includedInPride && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold uppercase tracking-wider border border-emerald-100">
                          Included in Pride
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 italic mb-3">{addon.tagline}</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{addon.description}</p>
                  </motion.div>
                )
              })}
            </motion.div>
          </div>
        </section>

        {/* ── Feature Comparison Table ── */}
        <section className="border-t border-slate-200 bg-[#eef3f0] py-24">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 1, y: 0 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12"
            >
              <h2 className="mb-3 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl" style={{ letterSpacing: 0 }}>Compare all features</h2>
              <p className="text-slate-500">See exactly what&apos;s included in each plan.</p>
            </motion.div>

            {/* Desktop comparison table */}
            <div className="hidden md:block">
              <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
                {/* Table header */}
                <div className="grid grid-cols-4 border-b border-slate-200">
                  <div className="p-5" />
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      className={`p-5 text-center ${
                        plan.recommended ? 'bg-slate-50 border-x border-slate-200' : ''
                      }`}
                    >
                      <p className={`font-bold text-base ${plan.recommended ? 'text-slate-900' : 'text-slate-900'}`}>
                        {plan.name}
                      </p>
                      {plan.recommended && (
                        <span className="inline-block mt-1 text-xs font-semibold bg-slate-900 text-white px-2 py-0.5 rounded-full">
                          Growing schools
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Feature rows */}
                {featureCategories.map((category, catIdx) => (
                  <div key={catIdx}>
                    <div className="grid grid-cols-4 bg-slate-50 border-b border-slate-200">
                      <div className="col-span-4 px-5 py-3">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{category.name}</p>
                      </div>
                    </div>
                    {category.rows.map((row, rowIdx) => (
                      <div
                        key={rowIdx}
                        className="grid grid-cols-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors"
                      >
                        <div className="p-4 px-5">
                          <span className="text-sm text-slate-700">{row.label}</span>
                        </div>
                        <div className="p-4 flex items-center justify-center">
                          <FeatureValue value={row.heart} />
                        </div>
                        <div className="p-4 flex items-center justify-center bg-slate-50/50">
                          <FeatureValue value={row.lion} />
                        </div>
                        <div className="p-4 flex items-center justify-center">
                          <FeatureValue value={row.pride} />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile: simplified per-plan cards */}
            <div className="md:hidden space-y-6">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`bg-white rounded-2xl border p-6 ${
                    plan.recommended ? 'border-slate-900' : 'border-slate-200'
                  }`}
                >
                  <h3 className={`font-bold text-lg mb-4 ${plan.recommended ? 'text-slate-900' : 'text-slate-900'}`}>
                    {plan.name}
                  </h3>
                  {featureCategories.map((cat) => (
                    <div key={cat.name} className="mb-4">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{cat.name}</p>
                      <ul className="space-y-2">
                        {cat.rows.map((row) => {
                          const val = plan.id === 'heart' ? row.heart : plan.id === 'lion' ? row.lion : row.pride
                          if (val === false) return null
                          return (
                            <li key={row.label} className="flex items-center gap-2 text-sm text-slate-700">
                              <Check className="w-4 h-4 text-primary-500 flex-shrink-0" aria-hidden="true" />
                              <span>{row.label}{typeof val === 'string' ? `: ${val}` : ''}</span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
                  <Link
                    href={plan.ctaHref}
                    className={`block w-full text-center py-3 px-6 rounded-xl font-semibold text-sm mt-4 transition-all duration-200 cursor-pointer ${
                      plan.recommended
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Value Props Strip ── */}
        <section className="border-b border-slate-100 bg-white py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              variants={staggerContainer(0.1, 0)}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center"
            >
              {[
                { icon: Zap, label: 'Quick Setup', sub: 'Up and running in minutes' },
                { icon: Building2, label: 'Multi-School', sub: 'From one school to many' },
                { icon: BarChart3, label: 'Real-Time Data', sub: 'Live dashboards & reports' },
                { icon: Shield, label: 'FERPA Compliant', sub: 'Built for K-12 schools' },
              ].map(({ icon: Icon, label, sub }, idx) => (
                <motion.div key={idx} variants={cardEntrance} className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                    <Icon className="w-6 h-6 text-slate-700" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="bg-white py-24">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 1, y: 0 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12"
            >
              <h2 className="mb-3 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl" style={{ letterSpacing: 0 }}>Frequently asked questions</h2>
              <p className="text-slate-500">
                Still have questions?{' '}
                <Link href="/contact" className="text-slate-900 hover:text-slate-700 underline">
                  Contact us
                </Link>
                .
              </p>
            </motion.div>

            <FaqAccordion items={faqs} />
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section className="relative overflow-hidden bg-slate-950 py-20 sm:py-24">
          <div className="max-w-3xl mx-auto text-center px-4 sm:px-6 lg:px-8 relative z-10">
            <motion.h2
              initial={{ opacity: 1, y: 0 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="mb-4 text-3xl font-semibold leading-tight text-white sm:text-4xl"
              style={{ letterSpacing: 0 }}
            >
              Ready to bring the work into one place?
            </motion.h2>
            <motion.p
              initial={{ opacity: 1, y: 0 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-slate-300 text-base sm:text-lg mb-8"
            >
              Start your free 30-day trial today. No credit card required.
            </motion.p>
            <motion.div
              initial={{ opacity: 1, y: 0 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link
                href="/signup"
                className="px-8 py-4 min-h-[48px] bg-white text-slate-900 font-semibold rounded-xl hover:bg-slate-100 transition inline-flex items-center justify-center gap-2 active:scale-[0.97]"
              >
                Start 30-day trial
              </Link>
              <Link
                href="/contact?topic=sales"
                className="px-8 py-4 min-h-[48px] border border-white/40 text-white font-semibold rounded-xl hover:bg-white/10 transition inline-flex items-center justify-center gap-2 active:scale-[0.97]"
              >
                Talk to Sales
              </Link>
            </motion.div>
            <p className="text-slate-400 text-sm mt-5">
              No credit card required &middot; 30-day free trial &middot; Cancel anytime
            </p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
