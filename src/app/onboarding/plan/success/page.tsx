'use client'

/**
 * Plan Checkout Success
 *
 * Landing page after Stripe Checkout completes. The Stripe webhook
 * (/api/webhooks/stripe) persists the Subscription row asynchronously,
 * so by the time this page loads the subscription may or may not be
 * synced yet — either way we continue into the onboarding wizard.
 */

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle2, ArrowRight } from 'lucide-react'

const REDIRECT_DELAY_MS = 2000
const NEXT_STEP_PATH = '/onboarding/school-info'

export default function PlanSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setRedirecting(true)
      router.push(NEXT_STEP_PATH)
    }, REDIRECT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [router])

  function handleManualContinue() {
    setRedirecting(true)
    router.push(NEXT_STEP_PATH)
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        className="mb-6"
      >
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
          <CheckCircle2 className="w-11 h-11 text-white" strokeWidth={2.5} />
        </div>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight"
      >
        You&apos;re all set!
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="mt-3 max-w-md text-base text-slate-600"
      >
        Payment method saved. Your <span className="font-semibold text-slate-900">14-day free trial</span>{' '}
        has started — you won&apos;t be charged until it ends.
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="mt-8 flex flex-col items-center gap-3"
      >
        <button
          type="button"
          onClick={handleManualContinue}
          disabled={redirecting}
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-semibold text-sm rounded-full hover:bg-slate-800 transition-colors duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Continue to onboarding
          <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-xs text-slate-500">
          Redirecting you automatically in a moment…
        </p>
      </motion.div>

      {sessionId && (
        <p className="mt-8 text-[11px] text-slate-400 font-mono">
          Ref: {sessionId.slice(-12)}
        </p>
      )}
    </div>
  )
}
