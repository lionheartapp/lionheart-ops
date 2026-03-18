'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, AlertCircle, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react'
import PortalView, { type PortalViewProps } from '@/components/registration/PortalView'

// ─── Constants ────────────────────────────────────────────────────────────────

const PORTAL_TOKEN_KEY = 'lionheart_portal_token'
const PORTAL_REG_ID_KEY = 'lionheart_portal_reg_id'

// ─── Types ────────────────────────────────────────────────────────────────────

type PageState =
  | { phase: 'loading' }
  | { phase: 'validating' }
  | { phase: 'loaded'; data: PortalViewProps }
  | { phase: 'token_expired'; errorMessage?: string }
  | { phase: 'request_link'; sent?: boolean }
  | { phase: 'error'; message: string }

// ─── Token Storage ────────────────────────────────────────────────────────────

function getStoredToken(): { token: string; registrationId: string } | null {
  if (typeof window === 'undefined') return null
  const token = window.localStorage.getItem(PORTAL_TOKEN_KEY)
  const registrationId = window.localStorage.getItem(PORTAL_REG_ID_KEY)
  if (!token || !registrationId) return null
  return { token, registrationId }
}

function storeToken(token: string, registrationId: string): void {
  window.localStorage.setItem(PORTAL_TOKEN_KEY, token)
  window.localStorage.setItem(PORTAL_REG_ID_KEY, registrationId)
}

function clearStoredToken(): void {
  window.localStorage.removeItem(PORTAL_TOKEN_KEY)
  window.localStorage.removeItem(PORTAL_REG_ID_KEY)
}

// ─── Animation ────────────────────────────────────────────────────────────────

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
  transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function EventPortalPage() {
  const searchParams = useSearchParams()
  const [pageState, setPageState] = useState<PageState>({ phase: 'loading' })
  const [emailInput, setEmailInput] = useState('')
  const [emailError, setEmailError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Fetch portal data using a stored portal token
  const fetchPortalData = useCallback(async (token: string, registrationId: string) => {
    try {
      const res = await fetch(`/api/registration/${registrationId}/portal`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()

      if (res.status === 401 || res.status === 403) {
        // Token expired or invalid — clear it and prompt for new link
        clearStoredToken()
        setPageState({
          phase: 'token_expired',
          errorMessage: 'Your session has expired. Please request a new link.',
        })
        return
      }

      if (!json.ok) {
        setPageState({
          phase: 'error',
          message: json.error?.message ?? 'Failed to load your registration.',
        })
        return
      }

      setPageState({
        phase: 'loaded',
        data: {
          ...json.data,
          onRequestNewLink: handleRequestNewLink,
        },
      })
    } catch {
      setPageState({
        phase: 'error',
        message: 'Failed to load your registration. Please check your connection and try again.',
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle a fresh magic link token from the URL query param
  const validateMagicLinkToken = useCallback(async (urlToken: string) => {
    setPageState({ phase: 'validating' })
    try {
      const res = await fetch(`/api/registration/magic-link/validate?token=${encodeURIComponent(urlToken)}`)
      const json = await res.json()

      if (!json.ok) {
        const code = json.error?.code ?? ''
        if (code === 'TOKEN_ALREADY_USED' || code === 'TOKEN_EXPIRED') {
          setPageState({
            phase: 'token_expired',
            errorMessage: json.error?.message ?? 'This link has expired.',
          })
        } else {
          setPageState({
            phase: 'token_expired',
            errorMessage: 'This link is invalid. Please request a new one.',
          })
        }
        return
      }

      const { portalToken, registrationId } = json.data
      storeToken(portalToken, registrationId)

      // Remove token from URL without page reload
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        url.searchParams.delete('token')
        window.history.replaceState({}, '', url.toString())
      }

      await fetchPortalData(portalToken, registrationId)
    } catch {
      setPageState({
        phase: 'error',
        message: 'Failed to validate your link. Please try again.',
      })
    }
  }, [fetchPortalData])

  // Initial load effect
  useEffect(() => {
    const urlToken = searchParams.get('token')

    if (urlToken) {
      // Fresh magic link click — validate the URL token
      validateMagicLinkToken(urlToken)
      return
    }

    // No URL token — check localStorage for stored portal token
    const stored = getStoredToken()
    if (stored) {
      fetchPortalData(stored.token, stored.registrationId)
      return
    }

    // No token anywhere — show request form
    setPageState({ phase: 'request_link' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handler: request a new magic link
  const handleRequestNewLink = useCallback(() => {
    clearStoredToken()
    setPageState({ phase: 'request_link' })
  }, [])

  // Handler: submit email for magic link
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError('')

    const email = emailInput.trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/registration/magic-link/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = await res.json()

      if (res.status === 429) {
        const retryAfter = json.error?.details?.find((d: { field: string }) => d.field === 'retryAfterSec')?.message
        setEmailError(
          retryAfter
            ? `Too many requests. Please try again in ${Math.ceil(Number(retryAfter) / 60)} minutes.`
            : 'Too many requests. Please try again later.',
        )
        return
      }

      // Always show success regardless of whether email has registrations
      setPageState({ phase: 'request_link', sent: true })
    } catch {
      setEmailError('Failed to send link. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render states ──────────────────────────────────────────────────

  if (pageState.phase === 'loading' || pageState.phase === 'validating') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">
            {pageState.phase === 'validating' ? 'Verifying your link…' : 'Loading…'}
          </p>
        </div>
      </div>
    )
  }

  if (pageState.phase === 'loaded') {
    return <PortalView {...pageState.data} onRequestNewLink={handleRequestNewLink} />
  }

  // Shared card wrapper for auth states
  const CardWrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
      <motion.div
        {...fadeIn}
        className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
      >
        {/* Simple branded header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-5">
          <p className="text-blue-100 text-xs font-medium uppercase tracking-wider mb-1">
            Registration Portal
          </p>
          <h1 className="text-white font-bold text-lg">Access Your Registration</h1>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </div>
  )

  if (pageState.phase === 'token_expired') {
    return (
      <CardWrapper>
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            {pageState.errorMessage ?? 'Your session has expired.'}
          </p>
        </div>
        <p className="text-sm text-slate-600 mb-5">
          Enter your email address to receive a new access link.
        </p>
        <form onSubmit={handleRequestSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-slate-700 mb-1.5">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={emailInput}
              onChange={(e) => { setEmailInput(e.target.value); setEmailError('') }}
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400"
              disabled={submitting}
              autoFocus
            />
            {emailError && (
              <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {emailError}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer active:scale-[0.97]"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {submitting ? 'Sending…' : 'Send New Link'}
          </button>
        </form>
      </CardWrapper>
    )
  }

  if (pageState.phase === 'request_link') {
    if (pageState.sent) {
      return (
        <CardWrapper>
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 mb-2">Check your inbox</h2>
            <p className="text-sm text-slate-500 mb-6">
              If you have any registrations, we&apos;ve sent a secure link to{' '}
              <span className="font-medium text-slate-900">{emailInput}</span>.
            </p>
            <button
              type="button"
              onClick={() => setPageState({ phase: 'request_link', sent: false })}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1.5 mx-auto cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Send to a different email
            </button>
          </div>
        </CardWrapper>
      )
    }

    return (
      <CardWrapper>
        <p className="text-sm text-slate-600 mb-5">
          Enter the email address you used when registering to receive a secure access link.
          No account required.
        </p>
        <form onSubmit={handleRequestSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-slate-700 mb-1.5">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={emailInput}
              onChange={(e) => { setEmailInput(e.target.value); setEmailError('') }}
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400"
              disabled={submitting}
              autoFocus
            />
            {emailError && (
              <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {emailError}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer active:scale-[0.97]"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {submitting ? 'Sending…' : 'Send My Link'}
          </button>
        </form>
        <p className="text-xs text-slate-400 mt-4 text-center">
          Links are valid for 48 hours and can only be used once.
        </p>
      </CardWrapper>
    )
  }

  // Error state
  return (
    <CardWrapper>
      <div className="text-center py-4">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6 text-red-500" />
        </div>
        <h2 className="text-base font-semibold text-slate-900 mb-2">Something went wrong</h2>
        <p className="text-sm text-slate-500 mb-5">
          {pageState.phase === 'error' ? pageState.message : 'An unexpected error occurred.'}
        </p>
        <button
          type="button"
          onClick={handleRequestNewLink}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1.5 mx-auto cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try again
        </button>
      </div>
    </CardWrapper>
  )
}
