'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, MotionConfig } from 'framer-motion'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import PublicNav from '@/components/public/PublicNav'
import PublicFooter from '@/components/public/PublicFooter'

// ─── Topics ───────────────────────────────────────────────────────────────
// Each topic maps the ?topic= URL param to page copy + default subject.
// Keep this list in sync with the contact links across the codebase.

type ContactTopic = 'sales' | 'privacy' | 'legal' | 'billing' | 'general'

interface TopicCopy {
  eyebrow: string
  heading: string
  intro: string
  subject: string
}

const TOPICS: Record<ContactTopic, TopicCopy> = {
  sales: {
    eyebrow: 'Talk to Sales',
    heading: 'Tell us about your school',
    intro:
      "Looking at Enterprise, multi-school, or district pricing? Share a few details and our team will get back to you within one business day.",
    subject: 'Sales inquiry',
  },
  privacy: {
    eyebrow: 'Privacy',
    heading: 'Privacy questions & data requests',
    intro:
      "We take data privacy seriously. Submit your question or data request below and our privacy team will respond within 5 business days.",
    subject: 'Privacy inquiry',
  },
  legal: {
    eyebrow: 'Legal',
    heading: 'Legal inquiries',
    intro:
      "For questions about our Terms of Service, contracts, or other legal matters, send us a note and our legal team will respond within 5 business days.",
    subject: 'Legal inquiry',
  },
  billing: {
    eyebrow: 'Billing',
    heading: 'Billing & account questions',
    intro:
      "Questions about invoices, payment methods, or your subscription? Send us the details and we'll sort it out.",
    subject: 'Billing inquiry',
  },
  general: {
    eyebrow: 'Contact Us',
    heading: 'Get in touch',
    intro:
      "Questions, feedback, or just saying hi? Fill out the form and we'll get back to you soon.",
    subject: '',
  },
}

function resolveTopic(param: string | null): ContactTopic {
  if (!param) return 'general'
  const normalized = param.toLowerCase()
  if (normalized in TOPICS) return normalized as ContactTopic
  return 'general'
}

// ─── Form ──────────────────────────────────────────────────────────────────

type FormState = 'idle' | 'loading' | 'success' | 'error'

function ContactFormInner() {
  const searchParams = useSearchParams()
  const topic = resolveTopic(searchParams.get('topic'))
  const copy = TOPICS[topic]

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState(copy.subject)
  const [message, setMessage] = useState('')
  const [formState, setFormState] = useState<FormState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // If the topic changes via client-side navigation, refresh the subject.
  useEffect(() => {
    setSubject(copy.subject)
  }, [copy.subject])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormState('loading')
    setErrorMessage('')

    try {
      const res = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          subject: subject || undefined,
          message,
        }),
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
      setSubject(copy.subject)
      setMessage('')
    } catch {
      setErrorMessage('Network error. Please try again.')
      setFormState('error')
    }
  }

  const inputClass =
    'w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus:border-primary-500 transition disabled:opacity-60 disabled:cursor-not-allowed'

  const isLoading = formState === 'loading'

  return (
    <>
      {/* Hero */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-8 text-center">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-600 mb-4"
        >
          {copy.eyebrow}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="text-3xl sm:text-4xl lg:text-[44px] font-bold text-slate-900 tracking-tight mb-4"
        >
          {copy.heading}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-base sm:text-lg text-slate-600 leading-relaxed"
        >
          {copy.intro}
        </motion.p>
      </section>

      {/* Form */}
      <section className="pb-20 sm:pb-28">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
          >
            {formState === 'success' ? (
              <div className="flex flex-col items-center text-center py-16 gap-4 bg-white border border-slate-200 rounded-2xl">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2
                    className="w-7 h-7 text-green-600"
                    aria-hidden="true"
                  />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Message sent!
                </h2>
                <p className="text-slate-600 max-w-sm">
                  Thanks for reaching out. We&apos;ll get back to you soon.
                </p>
                <button
                  onClick={() => setFormState('idle')}
                  className="mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium cursor-pointer"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="space-y-4 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8"
              >
                {formState === 'error' && errorMessage && (
                  <div
                    className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3"
                    role="alert"
                    aria-live="polite"
                  >
                    <AlertCircle
                      className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-red-700">{errorMessage}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="contact-name"
                      className="block text-sm font-medium text-slate-900 mb-1.5"
                    >
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
                    <label
                      htmlFor="contact-email"
                      className="block text-sm font-medium text-slate-900 mb-1.5"
                    >
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
                  <label
                    htmlFor="contact-subject"
                    className="block text-sm font-medium text-slate-900 mb-1.5"
                  >
                    Subject{' '}
                    <span className="text-slate-400 font-normal">
                      (optional)
                    </span>
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
                  <label
                    htmlFor="contact-message"
                    className="block text-sm font-medium text-slate-900 mb-1.5"
                  >
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="contact-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us how we can help..."
                    rows={6}
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
                  {isLoading && (
                    <Loader2
                      className="w-4 h-4 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  {isLoading ? 'Sending...' : 'Send Message'}
                </button>

                <p className="text-xs text-slate-500 text-center pt-2">
                  We typically respond within one business day.
                </p>
              </form>
            )}
          </motion.div>
        </div>
      </section>
    </>
  )
}

// ─── Exported component ────────────────────────────────────────────────────

export default function ContactForm() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <PublicNav />
        <main className="flex-1">
          <Suspense
            fallback={
              <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 text-center">
                <div className="h-6 w-32 bg-slate-200 rounded animate-pulse mx-auto mb-4" />
                <div className="h-10 w-80 bg-slate-200 rounded animate-pulse mx-auto mb-3" />
                <div className="h-5 w-96 bg-slate-200 rounded animate-pulse mx-auto" />
              </div>
            }
          >
            <ContactFormInner />
          </Suspense>
        </main>
        <PublicFooter />
      </div>
    </MotionConfig>
  )
}
