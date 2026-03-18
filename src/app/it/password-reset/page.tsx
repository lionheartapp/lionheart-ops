'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
  GraduationCap,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────

type Step = 'school' | 'verify' | 'password' | 'success'

interface LookupResult {
  found: boolean
  studentName?: string
  maskedEmail?: string
}

// ─── Animation Variants ─────────────────────────────────────────────────

const stepVariants = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const } },
  exit: { opacity: 0, x: -40, transition: { duration: 0.2, ease: 'easeIn' as const } },
}

// ─── Step Indicator ─────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'school', label: 'School' },
    { key: 'verify', label: 'Verify' },
    { key: 'password', label: 'Reset' },
    { key: 'success', label: 'Done' },
  ]
  const currentIdx = steps.findIndex((s) => s.key === currentStep)

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors duration-200 ${
              i < currentIdx
                ? 'bg-green-500 text-white'
                : i === currentIdx
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-400'
            }`}
          >
            {i < currentIdx ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              i + 1
            )}
          </div>
          {i < steps.length - 1 && (
            <div
              className={`w-8 h-0.5 rounded-full transition-colors duration-200 ${
                i < currentIdx ? 'bg-green-500' : 'bg-slate-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────

export default function PasswordResetPage() {
  const [step, setStep] = useState<Step>('school')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [schoolSlug, setSchoolSlug] = useState('')
  const [studentId, setStudentId] = useState('')
  const [email, setEmail] = useState('')
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null)
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Auto-detect subdomain
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname
      const parts = hostname.split('.')
      if (parts.length > 2 || (parts.length === 2 && hostname.endsWith('.localhost'))) {
        const sub = parts[0]
        if (sub !== 'www' && sub !== 'app' && sub !== 'api' && sub !== 'admin') {
          setSchoolSlug(sub)
        }
      }
    }
  }, [])

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleLookup = async () => {
    if (!schoolSlug.trim()) {
      setError('Please enter your school slug')
      return
    }
    setError(null)
    setStep('verify')
  }

  const handleVerify = async () => {
    if (!studentId.trim() || !email.trim()) {
      setError('Please enter both your student ID and email')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/it/student-password/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: schoolSlug.trim(),
          studentId: studentId.trim(),
          email: email.trim(),
        }),
      })

      const json = await res.json()

      if (!res.ok || !json.ok) {
        setError(json.error?.message || 'Student not found. Please check your information.')
        setIsLoading(false)
        return
      }

      setLookupResult({
        found: true,
        studentName: json.data?.studentName,
        maskedEmail: json.data?.maskedEmail,
      })

      // Request a token
      const tokenRes = await fetch('/api/it/student-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: schoolSlug.trim(),
          studentId: studentId.trim(),
          email: email.trim(),
        }),
      })

      const tokenJson = await tokenRes.json()

      if (!tokenRes.ok || !tokenJson.ok) {
        setError(tokenJson.error?.message || 'Could not generate reset token. Try again later.')
        setIsLoading(false)
        return
      }

      setResetToken(tokenJson.data?.token)
      setStep('password')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = async () => {
    if (!newPassword) {
      setError('Please enter a new password')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (!resetToken) {
      setError('Session expired. Please start over.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/it/student-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resetToken,
          newPassword,
        }),
      })

      const json = await res.json()

      if (!res.ok || !json.ok) {
        setError(json.error?.message || 'Password reset failed. The token may have expired.')
        setIsLoading(false)
        return
      }

      setStep('success')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Password strength indicator
  const getPasswordStrength = (pw: string): { label: string; color: string; width: string } => {
    if (!pw) return { label: '', color: '', width: '0%' }
    if (pw.length < 8) return { label: 'Too short', color: 'bg-red-500', width: '25%' }
    let score = 0
    if (pw.length >= 8) score++
    if (pw.length >= 12) score++
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++

    if (score <= 2) return { label: 'Weak', color: 'bg-orange-500', width: '40%' }
    if (score <= 3) return { label: 'Fair', color: 'bg-yellow-500', width: '60%' }
    if (score <= 4) return { label: 'Good', color: 'bg-blue-500', width: '80%' }
    return { label: 'Strong', color: 'bg-green-500', width: '100%' }
  }

  const strength = getPasswordStrength(newPassword)

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 to-zinc-900 flex items-center justify-center px-4 py-12">
      {/* Background ambient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo and branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Password Reset</h1>
          <p className="text-zinc-400 mt-1 text-sm">
            Reset your student account password
          </p>
        </div>

        {/* Step indicator */}
        <StepIndicator currentStep={step} />

        {/* Card container */}
        <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 overflow-hidden">
          <AnimatePresence mode="wait">
            {/* ─── Step 1: School ────────────────────────────────── */}
            {step === 'school' && (
              <motion.div
                key="school"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="p-6 sm:p-8"
              >
                <h2 className="text-lg font-semibold text-slate-900 mb-1">
                  Find Your School
                </h2>
                <p className="text-sm text-slate-500 mb-6">
                  Enter your school&apos;s identifier to get started
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      School Slug
                    </label>
                    <input
                      type="text"
                      value={schoolSlug}
                      onChange={(e) => {
                        setSchoolSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                        setError(null)
                      }}
                      placeholder="e.g. linfield"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-shadow"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      This is the part before .lionheartapp.com in your school&apos;s URL
                    </p>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    onClick={handleLookup}
                    disabled={!schoolSlug.trim()}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─── Step 2: Verify ────────────────────────────────── */}
            {step === 'verify' && (
              <motion.div
                key="verify"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="p-6 sm:p-8"
              >
                <h2 className="text-lg font-semibold text-slate-900 mb-1">
                  Verify Your Identity
                </h2>
                <p className="text-sm text-slate-500 mb-6">
                  Enter your student ID and email to verify your account
                </p>

                <div className="space-y-4">
                  {/* School indicator */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
                    <GraduationCap className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-600 font-medium">{schoolSlug}</span>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Student ID
                    </label>
                    <input
                      type="text"
                      value={studentId}
                      onChange={(e) => { setStudentId(e.target.value); setError(null) }}
                      placeholder="Enter your student ID"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-shadow"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(null) }}
                      placeholder="your.email@school.edu"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-shadow"
                      onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                    />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => { setStep('school'); setError(null) }}
                      className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                    <button
                      onClick={handleVerify}
                      disabled={isLoading || !studentId.trim() || !email.trim()}
                      className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          Verify
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ─── Step 3: Password ──────────────────────────────── */}
            {step === 'password' && (
              <motion.div
                key="password"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="p-6 sm:p-8"
              >
                <h2 className="text-lg font-semibold text-slate-900 mb-1">
                  Set New Password
                </h2>

                {lookupResult?.studentName && (
                  <p className="text-sm text-slate-500 mb-6">
                    Hello, <span className="font-medium text-slate-700">{lookupResult.studentName}</span>.
                    Choose a new password for your account.
                  </p>
                )}

                <div className="space-y-4">
                  {/* New password */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); setError(null) }}
                        placeholder="Enter new password"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-shadow"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Password strength indicator */}
                    {newPassword && (
                      <div className="mt-2">
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${strength.color} transition-all duration-300`}
                            style={{ width: strength.width }}
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{strength.label}</p>
                      </div>
                    )}
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); setError(null) }}
                        placeholder="Confirm new password"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-shadow"
                        onKeyDown={(e) => e.key === 'Enter' && handleReset()}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Match indicator */}
                    {confirmPassword && (
                      <p className={`text-xs mt-1 ${
                        newPassword === confirmPassword ? 'text-green-600' : 'text-red-500'
                      }`}>
                        {newPassword === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                      </p>
                    )}
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    onClick={handleReset}
                    disabled={isLoading || !newPassword || !confirmPassword}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4" />
                        Reset Password
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─── Step 4: Success ───────────────────────────────── */}
            {step === 'success' && (
              <motion.div
                key="success"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="p-6 sm:p-8 text-center"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-50 mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>

                <h2 className="text-lg font-semibold text-slate-900 mb-2">
                  Password Reset Successful
                </h2>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                  Your password has been updated. You can now sign in with your new password.
                </p>

                <a
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer"
                >
                  Return to Login
                  <ArrowRight className="w-4 h-4" />
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-zinc-500 mt-6">
          Need help? Contact your school&apos;s IT department for assistance.
        </p>
      </div>
    </div>
  )
}
