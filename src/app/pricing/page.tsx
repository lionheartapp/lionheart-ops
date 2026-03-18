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
  annualPrice: number | null
  recommended: boolean
  cta: string
  ctaHref: string
  ctaVariant: 'primary' | 'accent' | 'outline'
  features: string[]
  annualSavings?: string
}

interface FeatureRow {
  label: string
  starter: boolean | string
  professional: boolean | string
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
    id: 'starter',
    name: 'Starter',
    tagline: 'For small schools getting started',
    monthlyPrice: 99,
    annualPrice: 79,
    recommended: false,
    cta: 'Start Free Trial',
    ctaHref: '/signup',
    ctaVariant: 'outline',
    annualSavings: 'Save $240/year',
    features: [
      'Up to 1 campus',
      'Up to 50 staff accounts',
      'IT & Maintenance ticketing',
      'Knowledge base',
      'Basic reporting',
      'Email support',
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    tagline: 'For growing schools that need everything',
    monthlyPrice: 199,
    annualPrice: 159,
    recommended: true,
    cta: 'Start Free Trial',
    ctaHref: '/signup',
    ctaVariant: 'accent',
    annualSavings: 'Save $480/year',
    features: [
      'Unlimited campuses',
      'Unlimited staff accounts',
      'Everything in Starter, plus:',
      'Athletics module',
      'Calendar & events',
      'AI-powered diagnostics',
      'Compliance & board reporting',
      'Preventive maintenance scheduling',
      'Priority support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For large districts with custom needs',
    monthlyPrice: null,
    annualPrice: null,
    recommended: false,
    cta: 'Contact Sales',
    ctaHref: '/about#contact',
    ctaVariant: 'outline',
    features: [
      'Everything in Professional, plus:',
      'Dedicated onboarding',
      'Custom integrations',
      'SLA guarantee (99.9% uptime)',
      'SSO/SAML (when available)',
      'Dedicated account manager',
      'Custom contract & billing',
      'Priority enterprise support',
    ],
  },
]

const featureCategories: FeatureCategory[] = [
  {
    name: 'Core Features',
    rows: [
      { label: 'IT & Maintenance Ticketing', starter: true, professional: true, enterprise: true },
      { label: 'Knowledge Base', starter: true, professional: true, enterprise: true },
      { label: 'Role-Based Access Control', starter: true, professional: true, enterprise: true },
      { label: 'Multi-Campus Support', starter: '1 campus', professional: 'Unlimited', enterprise: 'Unlimited' },
      { label: 'Staff Accounts', starter: 'Up to 50', professional: 'Unlimited', enterprise: 'Unlimited' },
    ],
  },
  {
    name: 'Modules',
    rows: [
      { label: 'Athletics Module', starter: false, professional: true, enterprise: true },
      { label: 'Calendar & Events', starter: false, professional: true, enterprise: true },
      { label: 'AI-Powered Diagnostics', starter: false, professional: true, enterprise: true },
      { label: 'Compliance & Board Reporting', starter: false, professional: true, enterprise: true },
      { label: 'Preventive Maintenance Scheduling', starter: false, professional: true, enterprise: true },
    ],
  },
  {
    name: 'Support',
    rows: [
      { label: 'Email Support', starter: true, professional: true, enterprise: true },
      { label: 'Priority Support', starter: false, professional: true, enterprise: true },
      { label: 'Dedicated Account Manager', starter: false, professional: false, enterprise: true },
      { label: 'SLA Guarantee', starter: false, professional: false, enterprise: '99.9% uptime' },
      { label: 'Dedicated Onboarding', starter: false, professional: false, enterprise: true },
    ],
  },
  {
    name: 'Advanced',
    rows: [
      { label: 'Custom Integrations', starter: false, professional: false, enterprise: true },
      { label: 'SSO / SAML', starter: false, professional: false, enterprise: 'Coming soon' },
      { label: 'Custom Contract & Billing', starter: false, professional: false, enterprise: true },
      { label: 'Data Export', starter: true, professional: true, enterprise: true },
    ],
  },
]

const faqs: FaqItem[] = [
  {
    question: 'Is there a free trial?',
    answer: 'Yes — all plans include a 14-day free trial with full access. No credit card required to start. You can explore every feature before committing.',
  },
  {
    question: 'Can I change plans later?',
    answer: 'Absolutely. You can upgrade or downgrade your plan at any time from your account Settings. Upgrades take effect immediately; downgrades apply at your next billing cycle.',
  },
  {
    question: 'What happens when my trial ends?',
    answer: 'At the end of your 14-day trial, you choose the plan that fits your school and add a payment method. If you don\'t choose a plan, your account is paused — your data is preserved for 30 days while you decide.',
  },
  {
    question: 'Do you offer discounts for schools?',
    answer: 'Choosing annual billing saves 20% versus monthly. For multi-school districts or special circumstances, contact us at sales@lionheartapp.com — we\'re happy to work with your procurement process.',
  },
  {
    question: 'How do I cancel?',
    answer: 'You can cancel anytime from Settings > Subscription. There are no cancellation fees. After cancellation, your account remains active through the end of your billing period, then enters a 30-day data retention window.',
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
  const [annual, setAnnual] = useState(false)

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      <main>
        {/* ── Hero + Toggle ── */}
        <section className="relative overflow-hidden bg-gradient-to-b from-primary-50/40 to-white py-16 sm:py-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              transition={{ duration: 0.45, ease: EASE_OUT_CUBIC }}
              className="text-sm font-semibold text-primary-600 tracking-wide uppercase mb-3"
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
              Choose the plan that fits your school. No hidden fees, cancel anytime.
            </motion.p>

            {/* Billing toggle */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              transition={{ duration: 0.5, delay: 0.15, ease: EASE_OUT_CUBIC }}
              className="inline-flex items-center gap-3 bg-slate-100 rounded-full p-1"
              role="group"
              aria-label="Billing period"
            >
              <button
                onClick={() => setAnnual(false)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer ${
                  !annual
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                aria-pressed={!annual}
              >
                Monthly
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  annual
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                aria-pressed={annual}
              >
                Annual
                <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                  Save 20%
                </span>
              </button>
            </motion.div>
          </div>

          {/* Ambient blobs */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary-100/20 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
        </section>

        {/* ── Pricing Cards ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <motion.div
            variants={staggerContainer(0.1, 0)}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-3 gap-8 -mt-6"
          >
            {plans.map((plan, idx) => {
              const price = annual ? plan.annualPrice : plan.monthlyPrice
              const isRecommended = plan.recommended

              return (
                <motion.article
                  key={plan.id}
                  variants={cardEntrance}
                  className={`relative rounded-2xl p-8 flex flex-col ${
                    isRecommended
                      ? 'bg-gradient-to-br from-primary-600 to-indigo-700 border-2 border-primary-500 shadow-2xl shadow-primary-200 scale-[1.02] z-10'
                      : 'bg-white border border-slate-200 shadow-sm'
                  }`}
                  aria-label={`${plan.name} plan`}
                >
                  {/* Most Popular badge */}
                  {isRecommended && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="bg-amber-400 text-amber-900 text-xs font-bold px-4 py-1.5 rounded-full shadow-md">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="mb-6">
                    <h2 className={`text-xl font-bold mb-1 ${isRecommended ? 'text-white' : 'text-slate-900'}`}>
                      {plan.name}
                    </h2>
                    <p className={`text-sm ${isRecommended ? 'text-primary-200' : 'text-slate-500'}`}>
                      {plan.tagline}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <AnimatePresence mode="wait">
                      {price !== null ? (
                        <motion.div
                          key={annual ? 'annual' : 'monthly'}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-end gap-1"
                        >
                          <span className={`text-5xl font-bold ${isRecommended ? 'text-white' : 'text-slate-900'}`}>
                            ${price}
                          </span>
                          <span className={`text-sm mb-2 ${isRecommended ? 'text-primary-200' : 'text-slate-500'}`}>
                            /mo
                          </span>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="custom"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.2 }}
                        >
                          <span className={`text-4xl font-bold ${isRecommended ? 'text-white' : 'text-slate-900'}`}>
                            Custom
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {annual && plan.annualSavings && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`text-sm mt-1 font-medium ${isRecommended ? 'text-emerald-300' : 'text-emerald-600'}`}
                      >
                        {plan.annualSavings}
                      </motion.p>
                    )}

                    {price !== null && (
                      <p className={`text-xs mt-1 ${isRecommended ? 'text-primary-200' : 'text-slate-400'}`}>
                        {annual ? 'billed annually' : 'billed monthly'}
                      </p>
                    )}
                  </div>

                  {/* CTA */}
                  <Link
                    href={plan.ctaHref}
                    className={`block w-full text-center py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.97] mb-8 cursor-pointer ${
                      isRecommended
                        ? 'bg-white text-primary-700 hover:bg-primary-50 shadow-sm'
                        : plan.ctaVariant === 'accent'
                        ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm'
                        : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {plan.cta}
                  </Link>

                  {/* Trust signals */}
                  {plan.monthlyPrice !== null && (
                    <p className={`text-xs text-center mb-6 ${isRecommended ? 'text-primary-200' : 'text-slate-400'}`}>
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
                                ? 'text-primary-200 font-semibold pt-2'
                                : 'text-slate-500 font-semibold pt-2'
                              : isRecommended
                              ? 'text-primary-100'
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="text-center text-sm text-slate-400 mt-8"
          >
            All plans include a 14-day free trial &middot; No credit card required &middot; Cancel anytime
          </motion.p>
        </section>

        {/* ── Feature Comparison Table ── */}
        <section className="bg-slate-50 border-t border-slate-200 py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
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
                        plan.recommended ? 'bg-primary-50 border-x border-primary-100' : ''
                      }`}
                    >
                      <p className={`font-bold text-base ${plan.recommended ? 'text-primary-700' : 'text-slate-900'}`}>
                        {plan.name}
                      </p>
                      {plan.recommended && (
                        <span className="inline-block mt-1 text-xs font-semibold bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
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
                        className={`grid grid-cols-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors`}
                      >
                        <div className="p-4 px-5">
                          <span className="text-sm text-slate-700">{row.label}</span>
                        </div>
                        <div className={`p-4 flex items-center justify-center ${row.starter === false ? '' : ''}`}>
                          <FeatureValue value={row.starter} />
                        </div>
                        <div className={`p-4 flex items-center justify-center bg-primary-50/30`}>
                          <FeatureValue value={row.professional} />
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
                    plan.recommended ? 'border-primary-300' : 'border-slate-200'
                  }`}
                >
                  <h3 className={`font-bold text-lg mb-4 ${plan.recommended ? 'text-primary-700' : 'text-slate-900'}`}>
                    {plan.name}
                  </h3>
                  {featureCategories.map((cat) => (
                    <div key={cat.name} className="mb-4">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{cat.name}</p>
                      <ul className="space-y-2">
                        {cat.rows.map((row) => {
                          const val = plan.id === 'starter' ? row.starter : plan.id === 'professional' ? row.professional : row.enterprise
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
                        ? 'bg-primary-600 text-white hover:bg-primary-700'
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
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                    <Icon className="w-6 h-6 text-primary-600" aria-hidden="true" />
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
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12"
            >
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">Frequently asked questions</h2>
              <p className="text-slate-500">
                Still have questions?{' '}
                <Link href="/about#contact" className="text-primary-600 hover:text-primary-700 underline">
                  Contact us
                </Link>
                .
              </p>
            </motion.div>

            <FaqAccordion items={faqs} />
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section className="relative bg-primary-600 py-16 sm:py-20 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" aria-hidden="true" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4 pointer-events-none" aria-hidden="true" />

          <div className="max-w-3xl mx-auto text-center px-4 sm:px-6 lg:px-8 relative z-10">
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4"
            >
              Ready to simplify your school&apos;s operations?
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-primary-100 text-base sm:text-lg mb-8"
            >
              Start your free 14-day trial today. No credit card required.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link
                href="/signup"
                className="px-8 py-4 min-h-[48px] bg-white text-primary-600 font-semibold rounded-xl hover:bg-primary-50 transition inline-flex items-center justify-center gap-2 active:scale-[0.97]"
              >
                Start Free Trial
              </Link>
              <Link
                href="/about#contact"
                className="px-8 py-4 min-h-[48px] border border-white/40 text-white font-semibold rounded-xl hover:bg-white/10 transition inline-flex items-center justify-center gap-2 active:scale-[0.97]"
              >
                Talk to Sales
              </Link>
            </motion.div>
            <p className="text-primary-200 text-sm mt-5">
              No credit card required &middot; 14-day free trial &middot; Cancel anytime
            </p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
