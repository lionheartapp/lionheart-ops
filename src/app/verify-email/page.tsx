'use client'

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Clock, Mail, RefreshCw, ArrowLeft } from 'lucide-react'
import { Input } from '@/components/ui/Input'

type PageState =
  | 'check-email'      // No token, no error — user just signed up
  | 'error-invalid'    // Token invalid or already used
  | 'error-expired'    // Token expired
  | 'resend-success'   // Resend email sent successfully

type ResendFormState = 'idle' | 'submitting' | 'sent' | 'error'

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Layout><div className="text-center"><div className="mx-auto mb-6 h-16 w-16 rounded-full bg-slate-100 animate-pulse" /><div className="h-6 w-48 mx-auto bg-slate-100 rounded animate-pulse mb-2" /><div className="h-4 w-64 mx-auto bg-slate-100 rounded animate-pulse" /></div></Layout>}>
      <VerifyEmailContent />
    </Suspense>
  )
}

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const error = searchParams.get('error')
  const emailParam = searchParams.get('email')
  const orgIdParam = searchParams.get('organizationId')

  const [pageState, setPageState] = useState<PageState>(() => {
    if (error === 'expired') return 'error-expired'
    if (error === 'invalid') return 'error-invalid'
    return 'check-email'
  })

  const [resendState, setResendState] = useState<ResendFormState>('idle')
  const [resendEmail, setResendEmail] = useState(emailParam || '')
  const [resendOrgId, setResendOrgId] = useState(orgIdParam || '')
  const [showResendForm, setShowResendForm] = useState(false)

  async function handleResend(e: React.FormEvent) {
    e.preventDefault()
    if (!resendEmail || !resendOrgId) return
    setResendState('submitting')

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail, organizationId: resendOrgId }),
      })
      if (res.ok) {
        setResendState('sent')
        setPageState('resend-success')
      } else {
        setResendState('error')
      }
    } catch {
      setResendState('error')
    }
  }

  if (pageState === 'resend-success') {
    return (
      <Layout>
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Email sent!</h1>
          <p className="text-slate-500 text-sm mb-6">
            If your account exists and is unverified, a new verification link has been sent to{' '}
            <span className="font-medium text-slate-700">{resendEmail}</span>. Please check your inbox.
          </p>
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </button>
        </div>
      </Layout>
    )
  }

  if (pageState === 'error-expired') {
    return (
      <Layout>
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-50">
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Link expired</h1>
          <p className="text-slate-500 text-sm mb-6">
            This verification link has expired. Verification links are valid for 24 hours.
            Request a new one below.
          </p>
          <button
            type="button"
            onClick={() => setShowResendForm(true)}
            className="w-full px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-colors duration-200 mb-3 cursor-pointer"
          >
            Resend verification email
          </button>
          {showResendForm && <ResendForm email={resendEmail} orgId={resendOrgId} onSuccess={() => setPageState('resend-success')} />}
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 font-medium mt-2 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </button>
        </div>
      </Layout>
    )
  }

  if (pageState === 'error-invalid') {
    return (
      <Layout>
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Invalid link</h1>
          <p className="text-slate-500 text-sm mb-6">
            This verification link is invalid or has already been used. If you need a new link,
            please use the resend option below.
          </p>
          <button
            type="button"
            onClick={() => setShowResendForm(true)}
            className="w-full px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-colors duration-200 mb-3 cursor-pointer"
          >
            Resend verification email
          </button>
          {showResendForm && <ResendForm email={resendEmail} orgId={resendOrgId} onSuccess={() => setPageState('resend-success')} />}
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 font-medium mt-2 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </button>
        </div>
      </Layout>
    )
  }

  // Default: check-email state
  return (
    <Layout>
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
          <Mail className="h-8 w-8 text-slate-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Check your email</h1>
        <p className="text-slate-500 text-sm mb-6">
          We&apos;ve sent a verification link to your email address. Please click the link to verify
          your account and get started.
        </p>
        <p className="text-slate-400 text-xs mb-6">
          Didn&apos;t receive it? Check your spam folder, or resend the verification email.
        </p>
        {!showResendForm ? (
          <button
            type="button"
            onClick={() => setShowResendForm(true)}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 font-medium mb-4 cursor-pointer transition-colors duration-200"
          >
            <RefreshCw className="h-4 w-4" />
            Resend verification email
          </button>
        ) : (
          <ResendForm email={resendEmail} orgId={resendOrgId} onSuccess={() => setPageState('resend-success')} />
        )}
      </div>
    </Layout>
  )
}

// ─── Resend Form ───────────────────────────────────────────────────────────

function ResendForm({
  email: initialEmail,
  orgId: initialOrgId,
  onSuccess,
}: {
  email: string
  orgId: string
  onSuccess: () => void
}) {
  const [email, setEmail] = useState(initialEmail)
  const [orgId, setOrgId] = useState(initialOrgId)
  const [state, setState] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !orgId) {
      setErrorMsg('Please enter your email address and organization ID.')
      return
    }
    setState('submitting')
    setErrorMsg('')

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, organizationId: orgId }),
      })
      if (res.ok) {
        onSuccess()
      } else {
        setState('error')
        setErrorMsg('Something went wrong. Please try again.')
      }
    } catch {
      setState('error')
      setErrorMsg('Network error. Please check your connection and try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 text-left space-y-3">
      <div>
        <label htmlFor="verify-email" className="block text-xs font-medium text-slate-700 mb-1">
          Email address
        </label>
        <Input
          id="verify-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@school.edu"
          className="w-full text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus-visible:ring-1 focus-visible:ring-slate-900/10"
        />
      </div>
      <div>
        <label htmlFor="verify-org" className="block text-xs font-medium text-slate-700 mb-1">
          Organization ID
        </label>
        <Input
          id="verify-org"
          type="text"
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          required
          placeholder="Organization ID from your signup"
          className="w-full text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus-visible:ring-1 focus-visible:ring-slate-900/10"
        />
      </div>
      {errorMsg && (
        <p className="text-xs text-red-600">{errorMsg}</p>
      )}
      <button
        type="submit"
        disabled={state === 'submitting'}
        className="w-full px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200 cursor-pointer"
      >
        {state === 'submitting' ? 'Sending...' : 'Send verification email'}
      </button>
    </form>
  )
}

// ─── Layout Wrapper ────────────────────────────────────────────────────────

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Branded side panel */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 relative overflow-hidden">
        <div className="text-center px-12">
          <h1 className="text-5xl font-bold text-white mb-4">Lionheart</h1>
          <p className="text-xl text-slate-300 mb-12">Operations Platform</p>
          <img
            src="/logo-white.svg"
            alt="Lionheart"
            className="h-10 w-auto mx-auto opacity-60"
          />
        </div>
      </div>

      {/* Content side */}
      <div className="flex-1 flex items-center justify-center bg-white px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-8">
            <img src="/logo.svg" alt="Lionheart" className="h-12 w-auto mx-auto" />
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
