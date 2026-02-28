'use client'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { MotionConfig } from 'framer-motion'
import OnboardingSidebar from '@/components/onboarding/OnboardingSidebar'
import StepTransition from '@/components/onboarding/StepTransition'

interface OnboardingLayoutProps {
  children: ReactNode
}

function getStepFromPath(pathname: string): number {
  if (pathname.includes('school-info')) return 1
  if (pathname.includes('members')) return 2
  if (pathname.includes('setup')) return 3
  return 1
}

function getCompletedSteps(activeStep: number): number[] {
  const completed: number[] = []
  for (let i = 1; i < activeStep; i++) {
    completed.push(i)
  }
  return completed
}

export default function OnboardingLayout({ children }: OnboardingLayoutProps) {
  const pathname = usePathname()
  const activeStep = getStepFromPath(pathname)
  const completedSteps = getCompletedSteps(activeStep)

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-white grid grid-cols-1 lg:grid-cols-[340px_1fr]">
        {/* Sidebar */}
        <OnboardingSidebar activeStep={activeStep} completedSteps={completedSteps} />

        {/* Main Content */}
        <div className="flex flex-col min-h-screen lg:min-h-0">
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
              <StepTransition stepKey={pathname}>
                {children}
              </StepTransition>
            </div>
          </div>
        </div>
      </div>
    </MotionConfig>
  )
}
