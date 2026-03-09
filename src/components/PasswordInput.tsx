'use client'

import { useState } from 'react'
import { Eye, EyeOff, Check, X } from 'lucide-react'
import { PASSWORD_RULES, validatePassword } from '@/lib/validation/password'

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

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-zinc-700">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}

      {/* Input with toggle */}
      <div className="relative">
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="w-full rounded-lg border border-zinc-300 px-4 py-3 pr-12 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors duration-200"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowPassword((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer transition-colors duration-200"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {/* Rule indicators */}
      {showIndicators && (
        <ul className="space-y-1 pt-1">
          {results.map((rule) => {
            const showError = (touched || hasContent) && showErrorsAfterBlur
            const iconColor = rule.passed
              ? 'text-green-500'
              : showError
              ? 'text-red-500'
              : 'text-zinc-300'
            const textColor = rule.passed
              ? 'text-green-600'
              : showError
              ? 'text-red-500'
              : 'text-zinc-400'

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
