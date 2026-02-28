'use client'

import { ReactNode } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'

interface OnboardingLayoutProps {
  children: ReactNode
}

const STEPS = [
  { number: 1, label: 'School Info' },
  { number: 2, label: 'Add Members' },
  { number: 3, label: 'Setup Complete' },
]

export default function OnboardingLayout({ children }: OnboardingLayoutProps) {
  // Get current step from pathname
  const getActiveStep = () => {
    if (typeof window === 'undefined') return 1
    const pathname = window.location.pathname
    if (pathname.includes('school-info')) return 1
    if (pathname.includes('members')) return 2
    if (pathname.includes('setup')) return 3
    return 1
  }

  const activeStep = getActiveStep()

  return (
    <div className="min-h-screen bg-white">
      {/* Top Bar */}
      <div className="border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between gap-8">
            {/* Logo */}
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-bold text-primary-600">Lionheart</h1>
            </div>

            {/* Progress Indicator */}
            <div className="hidden sm:flex items-center gap-8 flex-1 justify-center">
              {STEPS.map((step, idx) => (
                <div key={step.number} className="flex items-center gap-3">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full font-medium text-sm transition ${
                      step.number < activeStep
                        ? 'bg-green-100 text-green-700'
                        : step.number === activeStep
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {step.number < activeStep ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <span>{step.number}</span>
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      step.number <= activeStep
                        ? 'text-gray-900'
                        : 'text-gray-500'
                    }`}
                  >
                    {step.label}
                  </span>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`w-8 h-0.5 transition ${
                        step.number < activeStep
                          ? 'bg-green-200'
                          : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Mobile Progress */}
            <div className="sm:hidden flex items-center gap-2">
              {STEPS.map((step) => (
                <div
                  key={step.number}
                  className={`w-2 h-2 rounded-full transition ${
                    step.number <= activeStep
                      ? 'bg-primary-600'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 sm:p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
