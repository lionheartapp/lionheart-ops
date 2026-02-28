'use client'

import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

const STEPS = [
  { number: 1, label: 'School Info', subtitle: 'Tell us about your school' },
  { number: 2, label: 'Add Members', subtitle: 'Invite your team' },
  { number: 3, label: 'Setup Complete', subtitle: 'Finalize your workspace' },
]

const TAGLINES: Record<number, string> = {
  1: 'Let\u2019s get to know your school',
  2: 'Your team will love this',
  3: 'Almost there!',
}

interface OnboardingSidebarProps {
  activeStep: number
  completedSteps: number[]
}

export default function OnboardingSidebar({ activeStep, completedSteps }: OnboardingSidebarProps) {
  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-800 p-8 xl:p-10 relative overflow-hidden min-h-screen">
        {/* Decorative background circles */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4" />

        <div className="relative z-10">
          {/* Logo */}
          <h1 className="text-2xl font-bold text-white mb-12">Lionheart</h1>

          {/* Step List */}
          <div className="space-y-0">
            {STEPS.map((step, idx) => {
              const isCompleted = completedSteps.includes(step.number)
              const isActive = step.number === activeStep
              const isPast = step.number < activeStep

              return (
                <div key={step.number} className="flex items-start gap-4">
                  {/* Step indicator column */}
                  <div className="flex flex-col items-center">
                    {/* Circle */}
                    <motion.div
                      className={`relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors duration-300 ${
                        isCompleted || isPast
                          ? 'bg-green-400 text-white'
                          : isActive
                            ? 'bg-white text-primary-700'
                            : 'bg-white/20 text-white/60'
                      }`}
                      initial={false}
                      animate={isCompleted ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 0.3 }}
                    >
                      {isCompleted || isPast ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        >
                          <Check className="w-5 h-5" />
                        </motion.div>
                      ) : (
                        <span>{step.number}</span>
                      )}

                      {/* Pulsing ring for active step */}
                      {isActive && (
                        <motion.div
                          className="absolute inset-0 rounded-full border-2 border-white/50"
                          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      )}
                    </motion.div>

                    {/* Connecting line */}
                    {idx < STEPS.length - 1 && (
                      <div className="relative w-0.5 h-16 bg-white/20 my-1">
                        <motion.div
                          className="absolute top-0 left-0 w-full bg-green-400"
                          initial={{ height: 0 }}
                          animate={{ height: isPast || isCompleted ? '100%' : '0%' }}
                          transition={{ duration: 0.5, delay: 0.2 }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Step text */}
                  <div className="pt-2">
                    <p
                      className={`font-semibold transition-colors duration-300 ${
                        isActive || isPast || isCompleted
                          ? 'text-white'
                          : 'text-white/50'
                      }`}
                    >
                      {step.label}
                    </p>
                    <p
                      className={`text-sm mt-0.5 transition-colors duration-300 ${
                        isActive ? 'text-white/80' : 'text-white/40'
                      }`}
                    >
                      {step.subtitle}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Bottom tagline */}
        <motion.div
          key={activeStep}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative z-10 mt-8"
        >
          <p className="text-white/70 text-sm font-medium">
            {TAGLINES[activeStep] || 'You\u2019re doing great!'}
          </p>
        </motion.div>
      </div>

      {/* Mobile Top Bar */}
      <div className="lg:hidden bg-gradient-to-r from-primary-600 to-indigo-700 px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-white">Lionheart</h1>

          {/* Dot indicators + label */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {STEPS.map((step) => {
                const isCompleted = completedSteps.includes(step.number) || step.number < activeStep
                const isActive = step.number === activeStep

                return (
                  <motion.div
                    key={step.number}
                    className={`rounded-full transition-colors duration-300 ${
                      isCompleted
                        ? 'bg-green-400 w-2.5 h-2.5'
                        : isActive
                          ? 'bg-white w-2.5 h-2.5'
                          : 'bg-white/30 w-2 h-2'
                    }`}
                    layout
                  />
                )
              })}
            </div>
            <span className="text-white/80 text-sm font-medium">
              {STEPS.find((s) => s.number === activeStep)?.label}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
