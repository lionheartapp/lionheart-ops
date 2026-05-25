'use client'

import { useState, useRef } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { motion, MotionConfig } from 'framer-motion'
import Link from 'next/link'
import { Input } from '@/components/ui/Input'

const showcaseCardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.3 + i * 0.15, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
}

export default function SigninPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const errorRef = useRef<HTMLDivElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!subdomain.trim()) {
        throw new Error('School subdomain is required')
      }

      // Verify the subdomain exists via slug-check
      const orgResponse = await fetch(
        `/api/organizations/slug-check?slug=${encodeURIComponent(subdomain)}`
      )
      const orgData = await orgResponse.json()

      // slug-check returns valid:true when slug is available (not taken)
      // For signin, we want the slug to already exist, so valid:true means not found
      if (orgData.data?.valid === true) {
        throw new Error('School subdomain not found. Please check the spelling and try again.')
      }

      // F-039: Use the current host's base domain instead of hardcoded
      // lionheartapp.com so the redirect works in dev (localhost) and for any
      // whitelabel domain.
      const host = typeof window !== 'undefined' ? window.location.hostname : ''
      const port = typeof window !== 'undefined' && window.location.port ? `:${window.location.port}` : ''
      const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:'
      const isLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(host)
      const baseDomain = isLocal
        ? `localhost${port}`
        : `${host.replace(/^[^.]+\./, '')}${port}`
      window.location.href = `${protocol}//${subdomain}.${baseDomain}/login`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      errorRef.current?.focus()
      setLoading(false)
    }
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2" style={{ backgroundColor: '#fdfcfb' }}>
      {/* Left Panel — Form */}
      <motion.div
        className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-20"
        style={{ backgroundColor: '#fdfcfb' }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="w-full max-w-md mx-auto">
          {/* Logo */}
          <Link href="/" className="inline-block mb-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded">
            <img src="/logo.svg" alt="Lionheart" className="h-10 w-auto" />
          </Link>

          <h1 className="text-3xl font-semibold mb-2" style={{ color: '#1a1915', letterSpacing: '-0.025em' }}>Welcome back</h1>
          <p className="mb-8" style={{ color: '#6a6864' }}>
            Enter your school&apos;s subdomain to sign in.
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="subdomain" className="block text-sm font-medium mb-1.5" style={{ color: '#1a1915' }}>
                School Subdomain
              </label>
              <div className="relative">
                <Input
                  id="subdomain"
                  type="text"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  placeholder="e.g., mitchell-academy"
                  className="sm:pr-44"
                  required
                />
                <span className="hidden sm:block absolute right-4 top-1/2 -translate-y-1/2 text-sm pointer-events-none" style={{ color: '#a8a49d' }}>
                  .lionheartapp.com
                </span>
              </div>
              <p className="text-xs mt-1.5" style={{ color: '#a8a49d' }}>
                Enter your school&apos;s subdomain to continue
              </p>
            </div>

            <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.1)' }}>
              <p className="text-sm text-center" style={{ color: '#6366f1' }}>
                You&apos;ll be redirected to your school&apos;s branded login page
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !subdomain.trim()}
              className="w-full py-3.5 rounded-full mt-2 flex items-center justify-center gap-2 text-[14px] font-semibold text-white transition-all duration-200 hover:-translate-y-px cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#1a1915', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.08)' }}
              aria-busy={loading}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Continue to Login
            </button>
          </form>

          <p className="text-sm text-center mt-8" style={{ color: '#6a6864' }}>
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-semibold underline" style={{ color: '#1a1915' }}>
              Sign up
            </Link>
          </p>
        </div>
      </motion.div>

      {/* Right Panel — Product Showcase */}
      <div className="hidden lg:flex flex-col justify-center items-center p-12 xl:p-16 relative overflow-hidden" style={{ backgroundColor: '#0b0b0e' }}>
        {/* Ambient gradient orbs */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full pointer-events-none opacity-25" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', filter: 'blur(120px)' }} />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full pointer-events-none opacity-15" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)', filter: 'blur(120px)' }} />

        <div className="relative z-10 max-w-lg text-center">
          <motion.h2
            className="text-3xl xl:text-4xl font-semibold text-white mb-4"
            style={{ letterSpacing: '-0.03em' }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Your school operations hub
          </motion.h2>
          <motion.p
            className="text-lg mb-12"
            style={{ color: 'rgba(255,255,255,0.6)' }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            Everything you need to manage IT, maintenance, and daily operations in one place.
          </motion.p>

          {/* Dashboard preview card */}
          <motion.div
            custom={0}
            variants={showcaseCardVariants}
            initial="hidden"
            animate="visible"
            className="rounded-2xl p-6 text-left" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 bg-red-400 rounded-full" />
              <div className="w-3 h-3 bg-yellow-400 rounded-full" />
              <div className="w-3 h-3 bg-green-400 rounded-full" />
              <span className="text-xs ml-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Dashboard</span>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <p className="text-2xl font-bold text-white">12</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Open Tickets</p>
              </div>
              <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <p className="text-2xl font-bold text-emerald-400">94%</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Resolved</p>
              </div>
              <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <p className="text-2xl font-bold text-amber-400">2.1h</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Avg Response</p>
              </div>
            </div>

            {/* Recent tickets */}
            <div className="space-y-2">
              <motion.div
                className="rounded-lg p-3 flex items-center justify-between"
                style={{ background: 'rgba(255,255,255,0.06)' }}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6, duration: 0.4 }}
              >
                <div>
                  <p className="text-white text-sm font-medium">Projector in Room 201</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>IT Support</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>In Progress</span>
              </motion.div>
              <motion.div
                className="rounded-lg p-3 flex items-center justify-between"
                style={{ background: 'rgba(255,255,255,0.06)' }}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7, duration: 0.4 }}
              >
                <div>
                  <p className="text-white text-sm font-medium">AC unit in Gym</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Maintenance</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>Resolved</span>
              </motion.div>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
    </MotionConfig>
  )
}
