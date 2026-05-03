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
                { title: 'IT Help Desk', desc: 'Structured ticketing for hardware, software, and network issues with SLA tracking.' },
                { title: 'Maintenance Management', desc: 'Work order routing, asset tracking, and compliance calendars for facilities teams.' },
                { title: 'Athletics Coordination', desc: 'Schedule games and practices, manage rosters, track stats, and share public schedules.' },
                { title: 'Campus Calendar', desc: 'Shared event calendar with approval workflows across departments and buildings.' },
                { title: 'Compliance Tracking', desc: 'Stay on top of fire inspections, HVAC service records, and regulatory deadlines.' },
                { title: 'Multi-Campus Support', desc: 'Manage multiple school buildings under one organization with campus-level filtering.' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-3"
                >
                  <CheckCircle2 className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-slate-900 text-sm mb-1">{item.title}</p>
                    <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
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
