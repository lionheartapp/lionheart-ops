'use client'

import { useState, useRef } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'

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

      // Redirect to the subdomain's login page
      window.location.href = `https://${subdomain}.lionheartapp.com/login`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      errorRef.current?.focus()
      setLoading(false)
    }
  }

  return (
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
          <Link href="/" className="text-2xl font-bold text-primary-600 hover:text-primary-700 inline-block mb-8">
            Lionheart
          </Link>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h1>
          <p className="text-gray-600 mb-8">
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

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="subdomain" className="block text-sm font-medium text-gray-900 mb-1.5">
                School Subdomain
              </label>
              <div className="relative">
                <input
                  id="subdomain"
                  type="text"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  placeholder="e.g., mitchell-academy"
                  className="w-full px-4 py-2.5 pr-44 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                  .lionheartapp.com
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                Enter your school&apos;s subdomain to continue
              </p>
            </div>

            <div className="bg-primary-50 rounded-lg p-3">
              <p className="text-sm text-primary-700 text-center">
                You&apos;ll be redirected to your school&apos;s branded login page
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !subdomain.trim()}
              className="w-full px-4 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              aria-busy={loading}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Continue to Login
            </button>
          </form>

          <p className="text-sm text-gray-600 text-center mt-8">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-primary-600 font-medium hover:text-primary-700">
              Sign up
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
            Your school operations hub
          </motion.h2>
          <motion.p
            className="text-primary-100 text-lg mb-12"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            Everything you need to manage IT, maintenance, and daily operations in one place.
          </motion.p>

          {/* Mockup: Dashboard preview */}
          <motion.div
            className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 text-left"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 bg-red-400 rounded-full" />
              <div className="w-3 h-3 bg-yellow-400 rounded-full" />
              <div className="w-3 h-3 bg-green-400 rounded-full" />
              <span className="text-white/60 text-xs ml-2">Dashboard</span>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-white">12</p>
                <p className="text-primary-200 text-xs">Open Tickets</p>
              </div>
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-300">94%</p>
                <p className="text-primary-200 text-xs">Resolved</p>
              </div>
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-300">2.1h</p>
                <p className="text-primary-200 text-xs">Avg Response</p>
              </div>
            </div>

            {/* Recent tickets */}
            <div className="space-y-2">
              <motion.div
                className="bg-white/10 rounded-lg p-3 flex items-center justify-between"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6, duration: 0.4 }}
              >
                <div>
                  <p className="text-white text-sm font-medium">Projector in Room 201</p>
                  <p className="text-primary-200 text-xs">IT Support</p>
                </div>
                <span className="text-xs bg-amber-500/30 text-amber-200 px-2 py-1 rounded-full">In Progress</span>
              </motion.div>
              <motion.div
                className="bg-white/10 rounded-lg p-3 flex items-center justify-between"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7, duration: 0.4 }}
              >
                <div>
                  <p className="text-white text-sm font-medium">AC unit in Gym</p>
                  <p className="text-primary-200 text-xs">Maintenance</p>
                </div>
                <span className="text-xs bg-emerald-500/30 text-emerald-200 px-2 py-1 rounded-full">Resolved</span>
              </motion.div>
            </div>
          </motion.div>

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
  )
}
