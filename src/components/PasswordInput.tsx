'use client'

import { useState } from 'react'
import { Eye, EyeOff, Check, X } from 'lucide-react'
import { validatePassword } from '@/lib/validation/password'
import { Input } from '@/components/ui/Input'

// ─── Props ─────────────────────────────────────────────────────────────────

interface PasswordInputProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  id?: string
  required?: boolean
  autoComplete?: string
  showRules?: boolean
  /** If true, show error state on rules when the field is blurred (default: true) */
  showErrorsAfterBlur?: boolean
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function PasswordInput({
  value,
  onChange,
  label = 'Password',
  placeholder = 'Enter your password',
  id = 'password',
  required = false,
  autoComplete = 'new-password',
  showRules = true,
  showErrorsAfterBlur = true,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [touched, setTouched] = useState(false)

  const { results } = validatePassword(value)
  const hasContent = value.length > 0
  const showIndicators = showRules && (hasContent || touched)
  const hasError = showErrorsAfterBlur && touched && hasContent && results.some((r) => !r.passed)

  // Only show rules that are relevant — hide max-length unless they're near it
  const visibleResults = results.filter((r) => {
    if (r.id === 'max-length') return value.length > 50
    return true
  })

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}

      {/* Input with toggle */}
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="pr-12"
          hasError={hasError}
          aria-invalid={hasError}
        />
        <button
          type="button"
          onClick={() => setShowPassword((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors duration-200"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {/* Rule indicators */}
      {showIndicators && (
        <ul className="space-y-1 pt-1">
          {visibleResults.map((rule) => {
            const showError = (touched || hasContent) && showErrorsAfterBlur
            const iconColor = rule.passed
              ? 'text-green-500'
              : showError
              ? 'text-red-500'
              : 'text-slate-300'
            const textColor = rule.passed
              ? 'text-green-600'
              : showError
              ? 'text-red-500'
              : 'text-slate-400'

            return (
              <li key={rule.id} className="flex items-center gap-1.5">
                {rule.passed ? (
                  <Check className={`h-3.5 w-3.5 flex-shrink-0 ${iconColor}`} />
                ) : (
                  <X className={`h-3.5 w-3.5 flex-shrink-0 ${iconColor}`} />
                )}
                <span className={`text-xs ${textColor}`}>{rule.label}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
