'use client'

import { forwardRef, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react'

// Shared styles
const borderBase = 'border border-gray-300 rounded-lg bg-white transition-colors'
const borderFocus = 'focus:border-gray-900 focus:ring-1 focus:ring-gray-900/10'
const borderDisabled = 'disabled:bg-gray-50 disabled:text-gray-500 disabled:border-gray-200'
const labelBase = 'absolute left-3 -top-2.5 px-1 bg-white text-xs text-gray-500 font-medium pointer-events-none transition-all duration-200'
const labelInside = 'peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:text-gray-400'
const labelFocused = 'peer-focus:-top-2.5 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:font-medium peer-focus:text-gray-600'

// ─── FloatingInput ────────────────────────────────────────────────────────────

interface FloatingInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export const FloatingInput = forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ label, id, className, ...props }, ref) => (
    <div className="relative">
      <input
        ref={ref}
        id={id}
        placeholder={label}
        className={`peer w-full px-3.5 py-3.5 text-sm text-gray-900 placeholder-transparent outline-none ${borderBase} ${borderFocus} ${borderDisabled} ${className || ''}`}
        {...props}
      />
      <label
        htmlFor={id}
        className={`${labelBase} ${labelInside} ${labelFocused} peer-disabled:bg-gray-50`}
      >
        {label}
      </label>
    </div>
  )
)
FloatingInput.displayName = 'FloatingInput'

// ─── FloatingSelect ───────────────────────────────────────────────────────────

interface FloatingSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  children: ReactNode
}

const chevronSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%236B7280' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`

export const FloatingSelect = forwardRef<HTMLSelectElement, FloatingSelectProps>(
  ({ label, id, className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        id={id}
        className={`peer w-full px-3.5 py-3.5 pr-10 text-sm text-gray-900 outline-none appearance-none bg-no-repeat ${borderBase} ${borderFocus} ${borderDisabled} ${className || ''}`}
        style={{
          backgroundImage: chevronSvg,
          backgroundSize: '16px 16px',
          backgroundPosition: 'right 12px center',
        }}
        {...props}
      >
        {children}
      </select>
      <label
        htmlFor={id}
        className={`${labelBase} peer-disabled:bg-gray-50`}
      >
        {label}
      </label>
    </div>
  )
)
FloatingSelect.displayName = 'FloatingSelect'

// ─── FloatingTextarea ─────────────────────────────────────────────────────────

interface FloatingTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
}

export const FloatingTextarea = forwardRef<HTMLTextAreaElement, FloatingTextareaProps>(
  ({ label, id, className, ...props }, ref) => (
    <div className="relative">
      <textarea
        ref={ref}
        id={id}
        placeholder={label}
        className={`peer w-full px-3.5 pt-5 pb-3 text-sm text-gray-900 placeholder-transparent outline-none resize-none ${borderBase} ${borderFocus} ${borderDisabled} ${className || ''}`}
        {...props}
      />
      <label
        htmlFor={id}
        className={`${labelBase} peer-placeholder-shown:top-4 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:text-gray-400 ${labelFocused} peer-disabled:bg-gray-50`}
      >
        {label}
      </label>
    </div>
  )
)
FloatingTextarea.displayName = 'FloatingTextarea'
