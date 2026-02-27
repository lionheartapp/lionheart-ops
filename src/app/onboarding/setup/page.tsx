// @ts-nocheck — canvas-confetti types available after npm install
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'
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

export default function SetupPage() {
  const router = useRouter()
  const [steps, setSteps] = useState(INITIAL_STEPS)
  const [complete, setComplete] = useState(false)
  const [schoolName, setSchoolName] = useState('Your School')

  useEffect(() => {
    const runSetup = async () => {
      try {
        // Get school name from localStorage
        const name = localStorage.getItem('org-name') || 'Your School'
        setSchoolName(name)

        // Stagger the steps
        const stepIds = ['profile', 'branding', 'workspace', 'trial', 'invitations']
        const memberCount = parseInt(sessionStorage.getItem('onboarding-member-count') || '0')

        for (let i = 0; i < stepIds.length; i++) {
          // Skip invitations step if no members were added
          if (stepIds[i] === 'invitations' && memberCount === 0) {
            continue
          }

          await new Promise((resolve) => setTimeout(resolve, 800))

          // Set to loading
          setSteps((prev) =>
            prev.map((step) =>
              step.id === stepIds[i] ? { ...step, status: 'loading' } : step
            )
          )

          // Simulate work (500ms)
          await new Promise((resolve) => setTimeout(resolve, 500))

          // Set to done
          setSteps((prev) =>
            prev.map((step) =>
              step.id === stepIds[i] ? { ...step, status: 'done' } : step
            )
          )
        }

        // Call finalize endpoint
        const token = localStorage.getItem('auth-token')
        if (token) {
          // Parse school data from sessionStorage
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

          await fetch('/api/onboarding/finalize', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ theme, logoUrl }),
          })
        }

        // Trigger confetti
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        })

        setComplete(true)
      } catch (err) {
        console.error('Setup error:', err)
        setComplete(true)
      }
    }

    runSetup()
  }, [])

  const handleGoToDashboard = () => {
    const slug = localStorage.getItem('org-slug')
    if (slug) {
      window.location.href = `https://${slug}.lionheartapp.com/dashboard`
    } else {
      router.push('/dashboard')
    }
  }

  if (!complete) {
    return (
      <div className="space-y-12 py-12">
        {/* Title */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            Getting things set up for you...
          </h2>
        </div>

        {/* Steps */}
        <div className="space-y-4 max-w-xl mx-auto">
          {steps.map((step) => (
            <div
              key={step.id}
              className="flex items-center gap-4 p-4 rounded-lg bg-gray-50 border border-gray-200"
            >
              <div className="flex-shrink-0">
                {step.status === 'done' ? (
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                ) : step.status === 'loading' ? (
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                )}
              </div>
              <span className="text-sm font-medium text-gray-900">
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-12 py-12 text-center">
      {/* Confetti should be playing */}

      {/* Success Icon */}
      <div className="flex justify-center animate-in fade-in zoom-in duration-500">
        <CheckCircle2 className="w-20 h-20 text-green-500" />
      </div>

      {/* Title */}
      <div>
        <h2 className="text-4xl font-bold text-gray-900 mb-2">
          Welcome to Lionheart!
        </h2>
        <p className="text-lg text-gray-600">
          {schoolName} is ready to go
        </p>
      </div>

      {/* Features Preview */}
      <div className="space-y-4 max-w-xl mx-auto">
        {[
          'School profile configured',
          'Team members invited',
          'Dashboard ready to use',
          'Free trial activated',
        ].map((feature, idx) => (
          <div key={idx} className="flex items-center gap-3 text-left">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            <span className="text-gray-700">{feature}</span>
          </div>
        ))}
      </div>

      {/* CTA Buttons */}
      <div className="flex flex-col gap-3 max-w-sm mx-auto pt-6">
        <button
          onClick={handleGoToDashboard}
          className="px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
        >
          Go to Dashboard
        </button>
        <a
          href="https://help.lionheartapp.com"
          target="_blank"
          rel="noopener noreferrer"
          className="px-8 py-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
        >
          View Help & Docs
        </a>
      </div>
    </div>
  )
}
