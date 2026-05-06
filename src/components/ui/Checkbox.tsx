'use client'

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className' | 'children'> {
  /** Optional label rendered to the right of the box. */
  label?: ReactNode
  /** Optional helper text rendered below the label. */
  description?: ReactNode
  /** Optional className appended to the wrapper label element. Use sparingly. */
  className?: string
}

/**
 * Standard checkbox with consistent styling — same indigo accent and slate
 * border as Radio. Use this in product code instead of raw
 * `<input type="checkbox">`.
 *
 * Wraps the input in a `<label>` so the label/description areas are
 * click-targets too. If you don't pass a label, just the box renders.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, disabled, className = '', ...rest },
  ref,
) {
  const inputClasses = [
    'mt-0.5 h-4 w-4 flex-shrink-0 rounded',
    'border border-slate-300',
    'text-indigo-600 accent-indigo-600',
    'focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:ring-offset-0',
    'cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
    'transition-colors',
  ].join(' ')

  // Bare checkbox with no label — just the input.
  if (!label && !description) {
    return (
      <input
        ref={ref}
        type="checkbox"
        disabled={disabled}
        className={`${inputClasses} ${className}`.trim()}
        {...rest}
      />
    )
  }

  return (
    <label
      className={`flex items-start gap-2.5 ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      } ${className}`.trim()}
    >
      <input
        ref={ref}
        type="checkbox"
        disabled={disabled}
        className={inputClasses}
        {...rest}
      />
      <div className="min-w-0 flex-1 leading-tight">
        {label && (
          <span className="text-sm text-slate-900 select-none">{label}</span>
        )}
        {description && (
          <p className="text-xs text-slate-500 mt-0.5 select-none">{description}</p>
        )}
      </div>
    </label>
  )
})
