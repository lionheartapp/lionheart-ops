'use client'

import { useState } from 'react'
import { motion, MotionConfig } from 'framer-motion'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
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

type FormState = 'idle' | 'loading' | 'success' | 'error'

export default function AboutPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [formState, setFormState] = useState<FormState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormState('loading')
    setErrorMessage('')

    try {
      const res = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject: subject || undefined, message }),
      })
      const data = await res.json()

      if (!data.ok) {
        const msg = data.error?.message || 'Failed to send message'
        setErrorMessage(msg)
        setFormState('error')
        return
      }

      setFormState('success')
      setName('')
      setEmail('')
      setSubject('')
      setMessage('')
    } catch {
      setErrorMessage('Network error. Please try again.')
      setFormState('error')
    }
  }

  const inputClass =
    'w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus:border-primary-500 transition disabled:opacity-60 disabled:cursor-not-allowed'

  const isLoading = formState === 'loading'

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
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              About Lionheart
            </h1>
          </motion.div>

          <motion.div
            custom={1}
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="prose prose-gray max-w-none space-y-6 text-base sm:text-lg text-gray-600 leading-relaxed"
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
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">What Lionheart Does</h2>
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
                  className="bg-white border border-gray-200 rounded-xl p-5 flex items-start gap-3"
                >
                  <CheckCircle2 className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm mb-1">{item.title}</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Contact Section */}
        <section
          id="contact"
          className="bg-gray-50 border-y border-gray-200 py-16 sm:py-24"
        >
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Get in Touch</h2>
              <p className="text-gray-600 mb-8">
                Questions about Lionheart? We&apos;d love to hear from you.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {formState === 'success' ? (
                <div className="flex flex-col items-center text-center py-12 gap-4">
                  <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-green-600" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Message sent!</h3>
                  <p className="text-gray-600">We&apos;ll get back to you soon.</p>
                  <button
                    onClick={() => setFormState('idle')}
                    className="mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium cursor-pointer"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-gray-200 rounded-2xl p-6 sm:p-8">
                  {formState === 'error' && errorMessage && (
                    <div
                      className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3"
                      role="alert"
                      aria-live="polite"
                    >
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                      <p className="text-sm text-red-700">{errorMessage}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="contact-name" className="block text-sm font-medium text-gray-900 mb-1.5">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="contact-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        className={inputClass}
                        disabled={isLoading}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-email" className="block text-sm font-medium text-gray-900 mb-1.5">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@school.edu"
                        className={inputClass}
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="contact-subject" className="block text-sm font-medium text-gray-900 mb-1.5">
                      Subject <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      id="contact-subject"
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g., Demo request, Question about pricing"
                      className={inputClass}
                      disabled={isLoading}
                    />
                  </div>

                  <div>
                    <label htmlFor="contact-message" className="block text-sm font-medium text-gray-900 mb-1.5">
                      Message <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="contact-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tell us how we can help..."
                      rows={5}
                      className={`${inputClass} resize-none`}
                      disabled={isLoading}
                      required
                      minLength={10}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full ui-btn-lg ui-btn-accent rounded-lg flex items-center justify-center gap-2 cursor-pointer"
                    aria-busy={isLoading}
                  >
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                    {isLoading ? 'Sending...' : 'Send Message'}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        </section>

        <PublicFooter />
      </div>
    </MotionConfig>
  )
}
