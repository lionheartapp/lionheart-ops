'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, ExternalLink } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'

interface SetupStep {
  id: string
  label: string
  status: 'pending' | 'loading' | 'done'
}

const INITIAL_STEPS: SetupStep[] = [
  { id: 'profile', label: 'Setting up your school profile...', status: 'pending' },
  { id: 'branding', label: 'Applying your brand colors...', status: 'pending' },
  { id: 'workspace', label: 'Creating your workspace...', status: 'pending' },
  { id: 'trial', label: 'Starting your free trial...', status: 'pending' },
  { id: 'invitations', label: 'Sending team invitations...', status: 'pending' },
]

// SVG Progress Ring component
function ProgressRing({ progress }: { progress: number }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference

  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
        {/* Background circle */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="8"
        />
        {/* Progress circle */}
        <motion.circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#2563eb"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          key={Math.round(progress)}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-2xl font-bold text-gray-900"
        >
          {Math.round(progress)}%
        </motion.span>
      </div>
    </div>
  )
}

// Animated checkmark SVG for completion
function AnimatedCheckmark() {
  return (
    <div className="relative w-32 h-32 mx-auto">
      <motion.svg
        viewBox="0 0 120 120"
        className="w-32 h-32"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      >
        {/* Green circle background */}
        <motion.circle
          cx="60"
          cy="60"
          r="52"
          fill="#22c55e"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.4 }}
        />
        {/* Checkmark path */}
        <motion.path
          d="M38 62 L52 76 L82 46"
          fill="none"
          stroke="white"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
        />
      </motion.svg>
    </div>
  )
}

const stepRowVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.08, duration: 0.3 },
  }),
}

const featureVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.5 + i * 0.15, duration: 0.3 },
  }),
}

export default function SetupPage() {
  const router = useRouter()
  const [steps, setSteps] = useState(INITIAL_STEPS)
  const [complete, setComplete] = useState(false)
  const [schoolName, setSchoolName] = useState('Your School')
  const [progress, setProgress] = useState(0)

  const fireConfetti = useCallback(() => {
    // Left burst
    confetti({
      particleCount: 60,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.65 },
      colors: ['#2563eb', '#22c55e', '#f59e0b', '#8b5cf6'],
    })
    // Right burst
    confetti({
      particleCount: 60,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.65 },
      colors: ['#2563eb', '#22c55e', '#f59e0b', '#8b5cf6'],
    })
    // Center burst (delayed)
    setTimeout(() => {
      confetti({
        particleCount: 80,
        spread: 100,
        origin: { y: 0.55 },
        colors: ['#2563eb', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'],
      })
    }, 300)
  }, [])

  useEffect(() => {
    const runSetup = async () => {
      try {
        const name = localStorage.getItem('org-name') || 'Your School'
        setSchoolName(name)

        const stepIds = ['profile', 'branding', 'workspace', 'trial', 'invitations']
        const memberCount = parseInt(sessionStorage.getItem('onboarding-member-count') || '0')

        const activeSteps = stepIds.filter((id) => !(id === 'invitations' && memberCount === 0))
        const totalSteps = activeSteps.length

        for (let i = 0; i < activeSteps.length; i++) {
          const stepId = activeSteps[i]

          await new Promise((resolve) => setTimeout(resolve, 800))

          // Set to loading
          setSteps((prev) =>
            prev.map((step) =>
              step.id === stepId ? { ...step, status: 'loading' } : step
            )
          )

          // Simulate work
          await new Promise((resolve) => setTimeout(resolve, 500))

          // Set to done
          setSteps((prev) =>
            prev.map((step) =>
              step.id === stepId ? { ...step, status: 'done' } : step
            )
          )

          // Update progress
          setProgress(((i + 1) / totalSteps) * 100)
        }

        // Call finalize endpoint
        const token = localStorage.getItem('auth-token')
        if (token) {
          let theme: Record<string, string> | undefined
          let logoUrl: string | undefined
          try {
            const raw = sessionStorage.getItem('onboarding-school-data')
            if (raw) {
              const parsed = JSON.parse(raw)
              if (parsed.primaryColor) {
                theme = { primaryColor: parsed.primaryColor }
              }
              if (parsed.logo) {
                logoUrl = parsed.logo
              }
            }
          } catch {
            // Ignore parse errors
          }

          const finalizeRes = await fetch('/api/onboarding/finalize', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ theme, logoUrl }),
          })

          if (finalizeRes.ok) {
            const finalizeData = await finalizeRes.json()
            if (finalizeData.ok && finalizeData.data?.logoUrl) {
              localStorage.setItem('org-logo-url', finalizeData.data.logoUrl)
            }
          }
          if (logoUrl) {
            localStorage.setItem('org-logo-url', logoUrl)
          }
        }

        // Fire confetti then show completion
        fireConfetti()
        setComplete(true)
      } catch (err) {
        console.error('Setup error:', err)
        setComplete(true)
      }
    }

    runSetup()
  }, [fireConfetti])

  const handleGoToDashboard = () => {
    const slug = localStorage.getItem('org-slug')
    if (slug) {
      window.location.href = `https://${slug}.lionheartapp.com/dashboard`
    } else {
      router.push('/dashboard')
    }
  }

  if (!complete) {
    const memberCount = typeof window !== 'undefined' ? parseInt(sessionStorage.getItem('onboarding-member-count') || '0') : 0
    const visibleSteps = steps.filter((s) => !(s.id === 'invitations' && memberCount === 0))

    return (
      <div className="space-y-10 py-8">
        {/* Title */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h2 className="text-3xl font-bold text-gray-900">
            Getting things set up for you...
          </h2>
        </motion.div>

        {/* Progress Ring */}
        <ProgressRing progress={progress} />

        {/* Steps */}
        <div className="space-y-3 max-w-xl mx-auto">
          {visibleSteps.map((step, idx) => (
            <motion.div
              key={step.id}
              custom={idx}
              variants={stepRowVariants}
              initial="hidden"
              animate="visible"
              className="flex items-center gap-4 p-4 rounded-lg bg-gray-50 border border-gray-200"
            >
              <div className="flex-shrink-0">
                <AnimatePresence mode="wait">
                  {step.status === 'done' ? (
                    <motion.div
                      key="done"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    >
                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                    </motion.div>
                  ) : step.status === 'loading' ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="pending"
                      className="w-6 h-6 rounded-full border-2 border-gray-300"
                    />
                  )}
                </AnimatePresence>
              </div>
              <span
                className={`text-sm font-medium transition-colors duration-300 ${
                  step.status === 'done'
                    ? 'text-green-700'
                    : step.status === 'loading'
                      ? 'text-primary-700'
                      : 'text-gray-500'
                }`}
              >
                {step.status === 'loading' ? (
                  <span className="flex items-center gap-2">
                    {step.label}
                    <span
                      className="inline-block h-1 w-16 rounded-full bg-gradient-to-r from-primary-200 via-primary-400 to-primary-200"
                      style={{
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 1.5s linear infinite',
                      }}
                    />
                  </span>
                ) : (
                  step.label
                )}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-10 py-8 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Animated Checkmark */}
      <AnimatedCheckmark />

      {/* Welcome Text with typewriter effect */}
      <div>
        <motion.h2
          className="text-4xl font-bold text-gray-900 mb-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          style={{
            overflow: 'hidden',
            borderRight: '2px solid transparent',
            whiteSpace: 'nowrap',
            display: 'inline-block',
            animation: 'typing 1.2s steps(22) 0.5s forwards, blink-caret 0.6s step-end 3',
            width: 0,
          }}
        >
          Welcome to Lionheart!
        </motion.h2>
        {/* Fallback for reduced motion / after animation */}
        <noscript>
          <h2 className="text-4xl font-bold text-gray-900 mb-2">Welcome to Lionheart!</h2>
        </noscript>
        <motion.p
          className="text-lg text-gray-600"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.4 }}
        >
          {schoolName} is ready to go
        </motion.p>
      </div>

      {/* Features Preview */}
      <div className="space-y-3 max-w-xl mx-auto">
        {[
          'School profile configured',
          'Team members invited',
          'Dashboard ready to use',
          'Free trial activated',
        ].map((feature, idx) => (
          <motion.div
            key={idx}
            custom={idx}
            variants={featureVariants}
            initial="hidden"
            animate="visible"
            className="flex items-center gap-3 text-left"
          >
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            <span className="text-gray-700">{feature}</span>
          </motion.div>
        ))}
      </div>

      {/* CTA Buttons */}
      <motion.div
        className="flex flex-col gap-3 max-w-sm mx-auto pt-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.4, ease: 'easeOut' }}
      >
        <motion.button
          onClick={handleGoToDashboard}
          className="px-8 py-4 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Go to Dashboard
        </motion.button>
        <a
          href="https://help.lionheartapp.com"
          target="_blank"
          rel="noopener noreferrer"
          className="px-8 py-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition flex items-center justify-center gap-2"
        >
          View Help & Docs
          <ExternalLink className="w-4 h-4" />
        </a>
      </motion.div>
    </motion.div>
  )
}
