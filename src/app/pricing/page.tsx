'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, ChevronDown, ChevronUp, Zap, Building2, BarChart3, Shield } from 'lucide-react'
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
  essentials: boolean | string
  pro: boolean | string
  enterprise: boolean | string
}

interface FeatureCategory {
  name: string
  rows: FeatureRow[]
}

interface FaqItem {
  question: string
  answer: string
}

// ─── Data ────────────────────────────────────────────────────────────────
const plans: Plan[] = [
  {
    id: 'essentials',
    name: 'Essentials',
    tagline: 'Core operations for a single campus',
    monthlyPrice: 650,
    annualTotal: 7800,
    recommended: false,
    cta: 'Start Free Trial',
    ctaHref: '/signup',
    ctaVariant: 'outline',
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
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Full suite + integrations, unlimited AI',
    monthlyPrice: 1067,
    annualTotal: 12800,
    recommended: true,
    cta: 'Start Free Trial',
    ctaHref: '/signup',
    ctaVariant: 'accent',
    features: [
      'Everything in Essentials, plus:',
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
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Multi-campus, SSO, SLA, dedicated CSM',
    monthlyPrice: 1400,
    annualTotal: 16800,
    recommended: false,
    cta: 'Contact Sales',
    ctaHref: '/contact?topic=sales',
    ctaVariant: 'outline',
    features: [
      '2 campuses included',
      'Everything in Pro, plus:',
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
  },
]

const featureCategories: FeatureCategory[] = [
  {
    name: 'Core Features',
    rows: [
      { label: 'Events & Calendar', essentials: true, pro: true, enterprise: true },
      { label: 'Maintenance Tickets', essentials: true, pro: 'Full suite', enterprise: 'Full suite' },
      { label: 'IT Tickets', essentials: true, pro: 'Full suite', enterprise: 'Full suite' },
      { label: 'A/V Requests', essentials: true, pro: 'Full suite', enterprise: 'Full suite' },
      { label: 'Multi-Campus Support', essentials: '1 campus', pro: 'Unlimited', enterprise: '2 included' },
      { label: 'Staff Accounts', essentials: 'Unlimited', pro: 'Unlimited', enterprise: 'Unlimited' },
    ],
  },
  {
    name: 'AI & Integrations',
    rows: [
      { label: 'AI Actions', essentials: '50 / month', pro: 'Unlimited', enterprise: 'Unlimited' },
      { label: 'Google Calendar Sync', essentials: false, pro: true, enterprise: true },
      { label: 'Outlook Calendar Sync', essentials: false, pro: true, enterprise: true },
      { label: 'Advanced Reporting', essentials: false, pro: true, enterprise: true },
      { label: 'API Access', essentials: false, pro: false, enterprise: true },
    ],
  },
  {
    name: 'Administration',
    rows: [
      { label: 'System Roles', essentials: true, pro: true, enterprise: true },
      { label: 'Custom Roles & Permissions', essentials: false, pro: true, enterprise: true },
      { label: 'Custom Permission Scopes', essentials: false, pro: false, enterprise: true },
      { label: 'Audit Logs', essentials: false, pro: false, enterprise: true },
      { label: 'SSO / SAML', essentials: false, pro: false, enterprise: true },
      { label: 'White Label', essentials: false, pro: false, enterprise: true },
    ],
  },
  {
    name: 'Support',
    rows: [
      { label: 'Email Support', essentials: true, pro: true, enterprise: true },
      { label: 'Priority Support', essentials: false, pro: true, enterprise: true },
      { label: 'Dedicated CSM', essentials: false, pro: false, enterprise: true },
      { label: 'SLA Guarantee', essentials: false, pro: false, enterprise: '99.9% uptime' },
      { label: 'Phone Support', essentials: false, pro: false, enterprise: true },
      { label: 'Quarterly Business Reviews', essentials: false, pro: false, enterprise: true },
    ],
  },
]

const faqs: FaqItem[] = [
  {
    question: 'Is there a free trial?',
    answer: 'Yes — all plans include a 30-day free trial with full access. No credit card required to start. You can explore every feature before committing.',
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
    question: 'Do you offer multi-campus or district pricing?',
    answer: 'Enterprise includes 2 campuses out of the box, with additional campuses available. For districts with more than 5 schools we build custom packages — contact sales.',
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
    <div className="min-h-screen bg-white">
      <PublicNav />

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-50/60 to-white py-16 sm:py-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              transition={{ duration: 0.45, ease: EASE_OUT_CUBIC }}
              className="text-sm font-semibold text-slate-500 tracking-wide uppercase mb-3"
            >
              Pricing
            </motion.p>

            <motion.h1
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              transition={{ duration: 0.5, delay: 0.05, ease: EASE_OUT_CUBIC }}
              className="text-3xl sm:text-5xl font-bold text-slate-900 leading-tight tracking-tight mb-4"
            >
              Simple, transparent pricing
            </motion.h1>

            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              transition={{ duration: 0.5, delay: 0.1, ease: EASE_OUT_CUBIC }}
              className="text-lg text-slate-600 max-w-xl mx-auto mb-10"
            >
              One price per school. No per-seat math. No hidden fees, cancel anytime.
            </motion.p>
          </div>

          {/* Ambient blobs */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-slate-100/30 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
        </section>

        {/* ── Pricing Cards ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <motion.div
            variants={staggerContainer(0.1, 0)}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-3 gap-8 -mt-6"
          >
            {plans.map((plan) => {
              const isRecommended = plan.recommended

              return (
                <motion.article
                  key={plan.id}
                  variants={cardEntrance}
                  className={`relative rounded-2xl p-8 flex flex-col ${
                    isRecommended
                      ? 'bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-slate-700 shadow-2xl shadow-slate-300 scale-[1.02] z-10'
                      : 'bg-white border border-slate-200 shadow-sm'
                  }`}
                  aria-label={`${plan.name} plan`}
                >
                  {/* Most Popular badge */}
                  {isRecommended && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="bg-white text-slate-900 text-xs font-bold px-4 py-1.5 rounded-full shadow-md">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="mb-6">
                    <h2 className={`text-xl font-bold mb-1 ${isRecommended ? 'text-white' : 'text-slate-900'}`}>
                      {plan.name}
                    </h2>
                    <p className={`text-sm ${isRecommended ? 'text-slate-400' : 'text-slate-500'}`}>
                      {plan.tagline}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-end gap-1">
                      <span className={`text-5xl font-bold ${isRecommended ? 'text-white' : 'text-slate-900'}`}>
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
                    className={`block w-full text-center py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.97] mb-8 cursor-pointer ${
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
                  <ul className="space-y-3 flex-1" role="list">
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

        {/* ── Feature Comparison Table ── */}
        <section className="bg-slate-50 border-t border-slate-200 py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 1, y: 0 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12"
            >
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">Compare all features</h2>
              <p className="text-slate-500">See exactly what&apos;s included in each plan.</p>
            </motion.div>

            {/* Desktop comparison table */}
            <div className="hidden md:block">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
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
                          Most Popular
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
                          <FeatureValue value={row.essentials} />
                        </div>
                        <div className="p-4 flex items-center justify-center bg-slate-50/50">
                          <FeatureValue value={row.pro} />
                        </div>
                        <div className="p-4 flex items-center justify-center">
                          <FeatureValue value={row.enterprise} />
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
                          const val = plan.id === 'essentials' ? row.essentials : plan.id === 'pro' ? row.pro : row.enterprise
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
        <section className="py-16 bg-white border-b border-slate-100">
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
                { icon: Building2, label: 'Multi-Campus', sub: 'Scale across all your sites' },
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
        <section className="py-20 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 1, y: 0 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12"
            >
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">Frequently asked questions</h2>
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
        <section className="relative bg-slate-900 py-16 sm:py-20 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" aria-hidden="true" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4 pointer-events-none" aria-hidden="true" />

          <div className="max-w-3xl mx-auto text-center px-4 sm:px-6 lg:px-8 relative z-10">
            <motion.h2
              initial={{ opacity: 1, y: 0 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4"
            >
              Ready to simplify your school&apos;s operations?
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
                Start Free Trial
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
