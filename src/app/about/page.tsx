'use client'

import Link from 'next/link'
import { motion, MotionConfig } from 'framer-motion'
import { CheckCircle2, ArrowRight } from 'lucide-react'
import PublicNav from '@/components/public/PublicNav'
import PublicFooter from '@/components/public/PublicFooter'

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
}

export default function AboutPage() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-white">
        <PublicNav />

        {/* About Section */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <motion.div
            custom={0}
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
          >
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
              About Lionheart
            </h1>
          </motion.div>

          <motion.div
            custom={1}
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="prose prose-gray max-w-none space-y-6 text-base sm:text-lg text-slate-600 leading-relaxed"
          >
            <p>
              Lionheart was built because schools deserve better than email threads and shared spreadsheets.
              Every day, administrators, IT staff, and maintenance teams across the country spend hours
              managing requests through systems designed for a different era. We set out to change that.
            </p>
            <p>
              We built Lionheart from the ground up with one goal: give every school — from a small charter
              to a large district — the operational tools that used to be reserved for large enterprises.
              That means smart IT ticketing, maintenance management, athletics coordination, compliance
              tracking, and real-time communication all in one unified platform.
            </p>
            <p>
              What sets Lionheart apart is deep focus on the people who actually use it. A custodian
              shouldn&apos;t need a manual to file a work order. A teacher shouldn&apos;t have to follow up
              three times to find out if their broken projector has been fixed. A principal should be able
              to see the health of their campus at a glance — not after a two-hour reporting session.
            </p>
          </motion.div>

          {/* What We Do */}
          <motion.div
            custom={2}
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="mt-16"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-8">What Lionheart Does</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { title: 'Events & Calendar', desc: 'Plan, approve, and run every school event with conflict detection and parent-facing calendars.', href: '/solutions/events', cta: 'Explore events' },
                { title: 'IT Help Desk', desc: 'Structured ticketing for hardware, software, and network issues with SLA tracking and roster sync.', href: '/solutions/it', cta: 'Explore IT' },
                { title: 'Maintenance Management', desc: 'Work order routing, asset tracking, preventive maintenance schedules, and compliance calendars.', href: '/solutions/maintenance', cta: 'Explore maintenance' },
                { title: 'Forms & Submissions', desc: 'Build permission slips, surveys, and sign-ups with QR codes, conditional logic, and approval workflows.', href: '/solutions/forms-registration', cta: 'Explore forms' },
                { title: 'Approval Workflows', desc: 'Multi-step approval rules per calendar, resource, or request type — configurable, not hard-coded.', href: '/platform', cta: 'See platform' },
                { title: 'Messaging', desc: 'Replace scattered staff comms with DMs, channels, threads, and push to mobile.', href: '/solutions/messaging', cta: 'Explore messaging' },
                { title: 'Registration + Payments', desc: 'Stripe-powered registration for events, camps, and programs with magic-link parent signups.', href: '/solutions/forms-registration', cta: 'Explore registration' },
                { title: 'Athletics Coordination', desc: 'Season planning, schedules, rosters, stats, tournaments, and public-facing roster pages.', href: '/solutions/events', cta: 'See scheduling' },
                { title: 'IT Fleet Manager', desc: 'Chromebook fleet, damage tracking, loaners, MDM, content filtering, summer mode, and eRate.', href: '/solutions/it', cta: 'See fleet work' },
                { title: 'Mobile App', desc: 'Role-based bottom tabs, push notifications, pull-to-refresh — built for the people on the move.', href: '/platform', cta: 'See workspace' },
                { title: 'Leo AI', desc: 'Institutional memory that answers "who, what, when" about your school in plain English.', href: '/leo-ai', cta: 'Explore Leo AI' },
                { title: 'Multi-School Support', desc: 'Manage anything from a single school to a multi-school operation, with campuses under one workspace.', href: '/platform', cta: 'See platform' },
              ].map((item, idx) => (
                <Link
                  key={idx}
                  href={item.href}
                  className="group flex cursor-pointer items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-500" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 text-sm mb-1">{item.title}</p>
                    <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 transition-colors duration-200 group-hover:text-primary-700">
                      {item.cta}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Contact CTA — full form now lives at /contact */}
        <section
          id="contact"
          className="bg-slate-50 border-y border-slate-200 py-16 sm:py-24"
        >
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 1, y: 0 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
                Get in Touch
              </h2>
              <p className="text-slate-600 mb-8 max-w-lg mx-auto">
                Questions about Lionheart? We&apos;d love to hear from you. Fill out
                our contact form and we&apos;ll get back to you within one business day.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-primary-600 text-white font-semibold rounded-full hover:bg-primary-700 transition-colors active:scale-[0.97]"
              >
                Open the contact form
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </motion.div>
          </div>
        </section>

        <PublicFooter />
      </div>
    </MotionConfig>
  )
}
