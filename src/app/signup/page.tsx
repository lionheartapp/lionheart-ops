'use client'

import { useState, useRef } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { motion, MotionConfig } from 'framer-motion'
import Link from 'next/link'
import PasswordInput from '@/components/PasswordInput'

const showcaseCardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.3 + i * 0.15, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
}

export default function SignupPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const errorRef = useRef<HTMLDivElement>(null)

  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [website, setWebsite] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!name.trim() || !email.trim() || !password.trim() || !schoolName.trim()) {
        throw new Error('All fields are required')
      }

      if (!email.includes('@')) {
        throw new Error('Please enter a valid email')
      }

      const normalizedWebsite = website.trim()
        ? website.startsWith('http://') || website.startsWith('https://')
          ? website.trim()
          : `https://${website.trim()}`
        : ''

      const res = await fetch('/api/organizations/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: schoolName,
          website: normalizedWebsite,
          adminEmail: email,
          adminName: name,
          adminPassword: password,
          slug: schoolName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, ''),
        }),
      })

      const data = await res.json()

      if (!data.ok) {
        throw new Error(data.error?.message || 'Signup failed')
      }

      if (data.data) {
        const { slug } = data.data
        // Non-sensitive display data for onboarding pages (AuthBridge will refresh from /api/auth/me)
        localStorage.setItem('org-name', schoolName)
        localStorage.setItem('org-slug', slug || '')
        localStorage.setItem('user-name', name)
        localStorage.setItem('user-email', email)

        // Auth token is now in httpOnly cookie set by the server — no localStorage write needed
        // Redirect to onboarding
        window.location.href = '/onboarding/school-info'
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      errorRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white">
      {/* Left Panel — Form */}
      <motion.div
        className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-20 bg-white"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="w-full max-w-md mx-auto">
          {/* Logo */}
          <Link href="/" className="inline-block mb-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded">
            <img src="/logo.svg" alt="Lionheart" className="h-10 w-auto" />
          </Link>

          <h1 className="text-3xl font-bold text-slate-900 mb-2">Create your account</h1>
          <p className="text-slate-600 mb-8">
            Set up your school on Lionheart in minutes.
          </p>

          {error && (
            <div
              ref={errorRef}
              className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 mb-6"
              role="alert"
              aria-live="polite"
            >
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-900 mb-1.5">
                Your Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Sarah Mitchell"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus:border-primary-500 transition"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-900 mb-1.5">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g., sarah@mitchell.edu"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus:border-primary-500 transition"
                disabled={loading}
                required
              />
            </div>

            <PasswordInput
              value={password}
              onChange={setPassword}
              label="Password"
              placeholder="Create a secure password"
              id="password"
              required
              showRules={true}
              autoComplete="new-password"
            />

            <div>
              <label htmlFor="school" className="block text-sm font-medium text-slate-900 mb-1.5">
                School Name
              </label>
              <input
                id="school"
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="e.g., Mitchell Academy"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus:border-primary-500 transition"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label htmlFor="website" className="block text-sm font-medium text-slate-900 mb-1.5">
                School Website <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id="website"
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="e.g., mitchell.edu"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus:border-primary-500 transition"
                disabled={loading}
              />
              <p className="text-xs text-slate-500 mt-1">
                We&apos;ll use this to set up your school automatically
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full ui-btn-lg ui-btn-accent rounded-lg mt-2 flex items-center justify-center gap-2"
              aria-busy={loading}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Account
            </button>
          </form>

          {/* Footer */}
          <p className="text-xs text-slate-500 text-center mt-6">
            By signing up, you agree to our{' '}
            <Link href="/terms" className="underline hover:text-slate-700">Terms of Service</Link>
            {' '}and{' '}
            <Link href="/privacy" className="underline hover:text-slate-700">Privacy Policy</Link>
          </p>

          <p className="text-sm text-slate-600 text-center mt-4">
            Already have an account?{' '}
            <Link href="/signin" className="text-primary-600 font-medium hover:text-primary-700">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>

      {/* Right Panel — Product Showcase */}
      <div className="hidden lg:flex flex-col justify-center items-center bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-800 p-12 xl:p-16 relative overflow-hidden">
        {/* Decorative background circles */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4" />

        <div className="relative z-10 max-w-lg text-center">
          <motion.h2
            className="text-3xl xl:text-4xl font-bold text-white mb-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Simplify your school operations
          </motion.h2>
          <motion.p
            className="text-primary-100 text-lg mb-12"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            Join schools already using Lionheart to manage IT, maintenance, and operations.
          </motion.p>

          {/* Product mockup cards */}
          <div className="space-y-4">
            {/* Card 1 — Ticket overview */}
            <motion.div
              custom={0}
              variants={showcaseCardVariants}
              initial="hidden"
              animate="visible"
              className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-5 text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <span className="text-white font-semibold">Smart Ticket Management</span>
              </div>
              <p className="text-primary-100 text-sm">Track and resolve IT and maintenance requests with real-time status updates.</p>
            </motion.div>

            {/* Card 2 — Team collab */}
            <motion.div
              custom={1}
              variants={showcaseCardVariants}
              initial="hidden"
              animate="visible"
              className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-5 text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className="text-white font-semibold">Team Collaboration</span>
              </div>
              <p className="text-primary-100 text-sm">Assign tickets to teams, communicate across departments, and stay organized.</p>
            </motion.div>

            {/* Card 3 — Quick stats */}
            <motion.div
              custom={2}
              variants={showcaseCardVariants}
              initial="hidden"
              animate="visible"
              className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-5 text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="text-white font-semibold">AI-Powered Setup</span>
              </div>
              <p className="text-primary-100 text-sm">Automatically configure your campus, rooms, and teams with AI-assisted onboarding.</p>
            </motion.div>
          </div>

          {/* Social proof */}
          <motion.div
            className="mt-10 flex items-center justify-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
          >
            <div className="flex -space-x-2">
              {['bg-primary-400', 'bg-emerald-400', 'bg-amber-400', 'bg-rose-400'].map((color, i) => (
                <div key={i} className={`w-8 h-8 ${color} rounded-full border-2 border-white/20 flex items-center justify-center text-white text-xs font-bold`}>
                  {['S', 'M', 'J', 'R'][i]}
                </div>
              ))}
            </div>
            <p className="text-primary-100 text-sm ml-2">
              Trusted by school administrators
            </p>
          </motion.div>
        </div>
      </div>
    </div>
    </MotionConfig>
  )
}
